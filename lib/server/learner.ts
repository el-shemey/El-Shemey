import { db } from "@/lib/server/db";
import { getEntitlementProvider } from "@/lib/server/entitlement-provider";
import { canViewLesson } from "@/lib/domain/access";
import { resolveLessonAccess } from "@/lib/server/entitlements";
import { computeCourseProgress } from "@/lib/domain/progress";
import type { CourseProgress } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { authorizePlayback, buildStreamUrl } from "@/lib/server/video/playback";
import { extractLessonContent, type LessonContent } from "@/lib/content";

/**
 * Learner experience data layer (Phase 6).
 * Server-only; every function derives authorization from the verified
 * userId passed in (never from client payloads).
 */

export interface DashboardEntry {
  courseSlug: string;
  titleEn: string;
  titleAr: string;
  percent: number;
  completedCount: number;
  totalLessons: number;
  currentLessonSlug: string | null;
  currentLessonTitle: string | null;
  lastActiveAt: Date;
}

/** All enrollments with derived progress, most-recent-activity first. */
export async function getLearnerDashboard(userId: string): Promise<DashboardEntry[]> {
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    orderBy: [{ lastActiveAt: "desc" }],
    include: {
      course: {
        select: {
          slug: true,
          titleEn: true,
          titleAr: true,
          publishState: true,
          modules: {
            orderBy: { position: "asc" },
            include: { lessons: { orderBy: { position: "asc" } } },
          },
        },
      },
      progress: true,
    },
  });

  return enrollments
    .filter((e) => e.course.publishState === "PUBLISHED")
    .map((e) => {
      const progress = computeCourseProgress(
        e.course.modules,
        e.progress.map((p) => ({ lessonId: p.lessonId, completedAt: p.completedAt })),
      );
      const current = e.course.modules
        .flatMap((m) => m.lessons)
        .find((l) => l.id === progress.currentLessonId);

      return {
        courseSlug: e.course.slug,
        titleEn: e.course.titleEn,
        titleAr: e.course.titleAr,
        percent: progress.percent,
        completedCount: progress.completedCount,
        totalLessons: progress.publishedLessons,
        currentLessonSlug: current?.slug ?? null,
        currentLessonTitle: current?.titleEn ?? null,
        lastActiveAt: e.lastActiveAt,
      };
    });
}

export interface LessonLink {
  label: string;
  url: string;
}

/** Legacy plain-text body + structured blocks, per locale. */
type LessonBody = {
  descriptionEn: string | null;
  descriptionAr: string | null;
  resources: LessonLink[];
  attachments: LessonLink[];
  blocks: LessonContent["blocks"];
};

function extractLegacy(contentRef: unknown): Omit<LessonBody, "blocks"> {
  if (!contentRef || typeof contentRef !== "object") {
    return { descriptionEn: null, descriptionAr: null, resources: [], attachments: [] };
  }
  const c = contentRef as Record<string, unknown>;
  const links = (v: unknown): LessonLink[] =>
    Array.isArray(v)
      ? v
          .filter(
            (r): r is { label: string; url: string } =>
              typeof (r as { label?: unknown })?.label === "string" &&
              typeof (r as { url?: unknown })?.url === "string" &&
              /^https?:\/\//.test((r as { url: string }).url),
          )
          .slice(0, 20)
      : [];
  return {
    descriptionEn: typeof c.descriptionEn === "string" ? c.descriptionEn : null,
    descriptionAr: typeof c.descriptionAr === "string" ? c.descriptionAr : null,
    resources: links(c.resources),
    attachments: links(c.attachments),
  };
}

function lessonBody(contentRef: unknown): LessonBody {
  return { ...extractLegacy(contentRef), ...extractLessonContent(contentRef) };
}

export type LessonView =
  | {
      status: "OK";
      courseTitleEn: string;
      courseTitleAr: string;
      moduleTitleEn: string;
      lessonTitleEn: string;
      lessonTitleAr: string;
      /** Bilingual lesson body from contentRef (Phase 6 rendering). */
      descriptionEn: string | null;
      descriptionAr: string | null;
      resources: LessonLink[];
      attachments: LessonLink[];
      blocks: LessonContent["blocks"];
      /** Per-lesson override (0.1–1); null = platform default applies. */
      completionThreshold: number | null;
      durationSeconds: number | null;
      completed: boolean;
      /** Saved playback position (resume), null when none. */
      resumeAt: number | null;
      /** Bilingual lesson body + structured blocks (Phase 6). */
      body: LessonBody;
      progress: CourseProgress;
      prevHref: string | null;
      nextHref: string | null;
      /**
       * Next lesson that THIS user may actually open (skips locked/
       * unavailable). Null when none — including the course-complete case.
       */
      nextAvailableHref: string | null;
      /** True when every published lesson is complete. */
      courseCompleted: boolean;
      curriculum: Array<{
        id: string;
        titleEn: string;
        href: string;
        state: "done" | "current" | "locked" | "available";
        accessLevel: "FREE" | "PRO";
        durationSeconds: number | null;
        moduleId: string;
      }>;
      video:
        | {
            allowed: true;
            playbackUrl: string;
            expiresAt: Date;
            note: "SIGNED_URL";
          }
        | { allowed: false; reason: string };
    }
  | { status: "NO_ENROLLMENT" }
  | { status: "LESSON_NOT_FOUND" }
  | { status: "LOCKED" };

/**
 * Full lesson-player view. Authorization chain (all server-side):
 * verified userId → enrollment required → publishState checks →
 * entitlement check via EntitlementProvider → video authorization via
 * getAuthorizedPlaybackUrl().
 */
export async function getLessonView(
  userId: string,
  locale: Locale,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonView> {
  const entitlements = getEntitlementProvider();
  const hasPro = await entitlements.hasProAccess(userId);

  const enrollment = await db.enrollment
    .findUnique({
      where: {
        // Resolve courseId from slug first
        userId_courseId: { userId, courseId: "-" },
      },
    })
    .catch(() => null);
  void enrollment;

  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      modules: {
        where: { publishState: "PUBLISHED" },
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { publishState: "PUBLISHED" },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  if (!course || course.publishState !== "PUBLISHED") {
    return { status: "LESSON_NOT_FOUND" };
  }

  const enrollmentRecord = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    include: { progress: true },
  });
  if (!enrollmentRecord) return { status: "NO_ENROLLMENT" };

  const modules = course.modules.map((m) => ({
    id: m.id,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      moduleId: m.id,
      slug: l.slug,
      titleEn: l.titleEn,
      titleAr: l.titleAr,
      type: l.type,
      accessLevel: l.accessLevel,
      publishState: l.publishState,
      durationSeconds: l.durationSeconds,
      contentRef: l.contentRef,
    })),
  }));

  const flat = modules.flatMap((m) => m.lessons);
  const currentIndex = flat.findIndex((l) => l.slug === lessonSlug);
  if (currentIndex === -1) return { status: "LESSON_NOT_FOUND" };

  const currentLesson = flat[currentIndex];
  const currentModule = course.modules.find((m) => m.id === currentLesson.moduleId)!;

  // Single authoritative access decision (Phase 7A/8 resolver).
  const decision = await resolveLessonAccess(userId, courseSlug, lessonSlug);
  if (!decision.allowed && decision.reason !== "OK") {
    return { status: "LOCKED" };
  }

  const records: Array<{
    lessonId: string;
    completedAt: Date | null;
    positionSeconds: number | null;
  }> = enrollmentRecord.progress.map((p) => ({
    lessonId: p.lessonId,
    completedAt: p.completedAt,
    positionSeconds: p.positionSeconds,
  }));
  const progress = computeCourseProgress(modules, records);
  const completed = Boolean(
    records.find((r) => r.lessonId === currentLesson.id && r.completedAt !== null),
  );

  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next = currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  const base = `/${locale}/learn/${courseSlug}`;
  const curriculum = flat.map((l) => {
    const rec = records.find((r) => r.lessonId === l.id);
    const done = Boolean(rec?.completedAt);
    const lockable = l.accessLevel === "PRO" && !hasPro;
    return {
      id: l.id,
      titleEn: l.titleEn,
      href: `${base}/${l.slug}`,
      state: (done
        ? "done"
        : l.slug === lessonSlug
          ? "current"
          : lockable
            ? "locked"
            : "available") as "done" | "current" | "locked" | "available",
      accessLevel: l.accessLevel,
      durationSeconds: l.durationSeconds,
      moduleId: l.moduleId,
    };
  });

  // Structured + legacy body, one sanitizer for both admin write and render.
  const body = lessonBody(currentLesson.contentRef);

  // SMART NEXT: first later lesson this user may actually open.
  let nextAvailableHref: string | null = null;
  for (let i = currentIndex + 1; i < flat.length; i += 1) {
    const candidate = flat[i];
    const moduleState =
      course.modules.find((m) => m.id === candidate.moduleId)?.publishState ??
      "PUBLISHED";
    if (canViewLesson({ lesson: candidate, modulePublishState: moduleState }, hasPro)) {
      nextAvailableHref = `${base}/${candidate.slug}`;
      break;
    }
  }

  // Course complete: every published lesson has a completion timestamp.
  const publishedCount = flat.filter((l) => l.publishState === "PUBLISHED").length;
  const courseCompleted =
    publishedCount > 0 &&
    flat.filter(
      (l) =>
        l.publishState === "PUBLISHED" &&
        records.find((r) => r.lessonId === l.id)?.completedAt != null,
    ).length === publishedCount;

  const video = await authorizePlayback(userId, lessonSlug);

  // File-backed resources (Phase 8): served through the authorized download
  // route — the student only ever sees labels, never storage refs.
  const fileRows = await db.resourceFile.findMany({
    where: { lessonId: currentLesson.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true },
  });
  const fileResources = fileRows.map((r) => ({
    label: r.label,
    url: `/api/resources/${r.id}`,
  }));

  // Per-lesson completion threshold override (Phase 8), clamped.
  const rawThreshold =
    currentLesson.contentRef &&
    typeof currentLesson.contentRef === "object" &&
    typeof (currentLesson.contentRef as Record<string, unknown>).completionThreshold ===
      "number"
      ? ((currentLesson.contentRef as Record<string, unknown>)
          .completionThreshold as number)
      : null;
  const completionThreshold =
    rawThreshold !== null && rawThreshold >= 0.1 && rawThreshold <= 1
      ? rawThreshold
      : null;

  return {
    status: "OK",
    courseTitleEn: course.titleEn,
    courseTitleAr: course.titleAr,
    moduleTitleEn: currentModule.titleEn,
    lessonTitleEn: currentLesson.titleEn,
    lessonTitleAr: currentLesson.titleAr,
    descriptionEn: body.descriptionEn,
    descriptionAr: body.descriptionAr,
    resources: [...fileResources, ...body.resources],
    attachments: body.attachments,
    blocks: body.blocks,
    completionThreshold,
    body,
    durationSeconds: currentLesson.durationSeconds,
    completed,
    resumeAt:
      records.find((r) => r.lessonId === currentLesson.id)?.positionSeconds ?? null,
    progress,
    prevHref: prev ? `${base}/${prev.slug}` : null,
    nextHref: next ? `${base}/${next.slug}` : null,
    nextAvailableHref,
    courseCompleted,
    curriculum,
    video,
  };
}

/* ------------------------- Course learning overview ------------------------ */

export interface CourseLearningView {
  status: "OK";
  courseSlug: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  estimatedHours: number | null;
  progress: CourseProgress;
  modules: Array<{
    id: string;
    position: number;
    titleEn: string;
    titleAr: string;
    /** Derived per-module completion (Phase 6): done/total published. */
    completedCount: number;
    totalCount: number;
    lessons: Array<{
      id: string;
      slug: string;
      titleEn: string;
      titleAr: string;
      state: "done" | "current" | "locked" | "available";
      accessLevel: "FREE" | "PRO";
      durationSeconds: number | null;
    }>;
  }>;
  /** First incomplete published lesson — the Continue target. */
  resumeSlug: string | null;
}

/**
 * Student-facing course overview data (Phase 6).
 * Enrollment required; states derive from records + entitlement only.
 */
export async function getCourseLearningView(
  userId: string,
  courseSlug: string,
): Promise<CourseLearningView | { status: "NOT_FOUND" } | { status: "NO_ENROLLMENT" }> {
  const hasPro = await getEntitlementProvider().hasProAccess(userId);

  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      modules: {
        where: { publishState: "PUBLISHED" },
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { publishState: "PUBLISHED" },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  if (!course || course.publishState !== "PUBLISHED") {
    return { status: "NOT_FOUND" };
  }

  const enrollmentRecord = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    include: { progress: true },
  });
  if (!enrollmentRecord) return { status: "NO_ENROLLMENT" };

  const modules = course.modules.map((m) => ({
    id: m.id,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      moduleId: m.id,
      slug: l.slug,
      titleEn: l.titleEn,
      titleAr: l.titleAr,
      type: l.type,
      accessLevel: l.accessLevel,
      publishState: l.publishState,
      durationSeconds: l.durationSeconds,
    })),
  }));

  const records = enrollmentRecord.progress.map((p) => ({
    lessonId: p.lessonId,
    completedAt: p.completedAt,
  }));
  const progress = computeCourseProgress(modules, records);
  const doneIds = new Set(records.filter((r) => r.completedAt).map((r) => r.lessonId));

  let resumeSlug: string | null = null;
  const viewModules = course.modules.map((m) => {
    const published = m.lessons;
    const doneInModule = published.filter((l) => doneIds.has(l.id)).length;
    return {
      id: m.id,
      position: m.position,
      titleEn: m.titleEn,
      titleAr: m.titleAr,
      completedCount: doneInModule,
      totalCount: published.length,
      lessons: published.map((l) => {
        const done = doneIds.has(l.id);
        const locked = l.accessLevel === "PRO" && !hasPro;
        const isResumeTarget = !done && !locked && progress.currentLessonId === l.id;
        if (isResumeTarget && !resumeSlug) resumeSlug = l.slug;
        return {
          id: l.id,
          slug: l.slug,
          titleEn: l.titleEn,
          titleAr: l.titleAr,
          state: done
            ? ("done" as const)
            : locked
              ? ("locked" as const)
              : progress.currentLessonId === l.id
                ? ("current" as const)
                : ("available" as const),
          accessLevel: l.accessLevel as "FREE" | "PRO",
          durationSeconds: l.durationSeconds,
        };
      }),
    };
  });

  // Fallback: everything done/locked but no explicit current — first available.
  if (!resumeSlug) {
    for (const m of viewModules) {
      for (const l of m.lessons) {
        if (l.state === "available" || l.state === "current") {
          resumeSlug = l.slug;
          break;
        }
      }
      if (resumeSlug) break;
    }
  }

  return {
    status: "OK",
    courseSlug: course.slug,
    titleEn: course.titleEn,
    titleAr: course.titleAr,
    summaryEn: course.summaryEn,
    summaryAr: course.summaryAr,
    estimatedHours: course.estimatedHours,
    progress,
    modules: viewModules,
    resumeSlug,
  };
}

/* ------------------------------ Public preview ----------------------------- */

export type PreviewLessonView =
  | {
      status: "OK";
      lessonTitleEn: string;
      lessonTitleAr: string;
      courseTitleEn: string;
      moduleTitleEn: string;
      descriptionEn: string | null;
      descriptionAr: string | null;
      resources: LessonLink[];
      blocks: LessonContent["blocks"];
      durationSeconds: number | null;
    }
  | { status: "NOT_FOUND" }
  | { status: "LOCKED" };

/**
 * Anonymous free-preview view (Phase 6). Published FREE lessons are public
 * per the existing access model (`canViewLesson` with no entitlements);
 * PRO and unpublished content never leaks — only titles/metadata do.
 * No signed video URL is produced here; watching requires an account.
 */
export async function getPreviewLessonView(
  courseSlug: string,
  lessonSlug: string,
): Promise<PreviewLessonView> {
  const lesson = await db.lesson.findFirst({
    where: {
      slug: lessonSlug,
      publishState: "PUBLISHED",
      module: {
        publishState: "PUBLISHED",
        course: { slug: courseSlug, publishState: "PUBLISHED" },
      },
    },
    select: {
      titleEn: true,
      titleAr: true,
      accessLevel: true,
      publishState: true,
      durationSeconds: true,
      contentRef: true,
      module: { select: { titleEn: true, course: { select: { titleEn: true } } } },
    },
  });
  if (!lesson) return { status: "NOT_FOUND" };

  const viewable = canViewLesson({ lesson, modulePublishState: "PUBLISHED" }, false);
  if (!viewable) return { status: "LOCKED" };

  const content = lessonBody(lesson.contentRef);
  return {
    status: "OK",
    lessonTitleEn: lesson.titleEn,
    lessonTitleAr: lesson.titleAr,
    courseTitleEn: lesson.module.course.titleEn,
    moduleTitleEn: lesson.module.titleEn,
    descriptionEn: content.descriptionEn,
    descriptionAr: content.descriptionAr,
    resources: content.resources,
    blocks: content.blocks,
    durationSeconds: lesson.durationSeconds,
  };
}

/* ------------------------- Admin preview (Phase 8) ------------------------- */

export type AdminPreviewView =
  | {
      status: "OK";
      lessonTitleEn: string;
      lessonTitleAr: string;
      courseTitleEn: string;
      moduleTitleEn: string;
      courseSlug: string;
      publishState: string;
      descriptionEn: string | null;
      descriptionAr: string | null;
      blocks: LessonContent["blocks"];
      resources: Array<{ id: string; label: string; url: string }>;
      /** Signed only when a READY video exists � same rules as students. */
      videoUrl: string | null;
    }
  | { status: "NOT_FOUND" };

/**
 * "Preview as student" for ADMINS ONLY (caller must verify role).
 * Renders draft/unpublished content in the real student layout WITHOUT
 * touching progress, enrollment or entitlements � this function performs
 * no writes and grants nothing beyond the response payload.
 */
export async function getAdminPreviewLessonView(
  courseSlug: string,
  lessonSlug: string,
): Promise<AdminPreviewView> {
  const lesson = await db.lesson.findFirst({
    where: {
      slug: lessonSlug,
      module: { course: { slug: courseSlug } },
    },
    select: {
      titleEn: true,
      titleAr: true,
      publishState: true,
      contentRef: true,
      module: {
        select: {
          titleEn: true,
          course: { select: { titleEn: true, slug: true } },
        },
      },
      videos: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 1 },
      resources: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!lesson) return { status: "NOT_FOUND" };

  const body = lessonBody(lesson.contentRef);
  const readyVideo = lesson.videos.find((v) => v.status === "READY");
  const videoUrl = readyVideo ? buildStreamUrl(readyVideo.id).url : null;

  return {
    status: "OK",
    lessonTitleEn: lesson.titleEn,
    lessonTitleAr: lesson.titleAr,
    courseTitleEn: lesson.module.course.titleEn,
    moduleTitleEn: lesson.module.titleEn,
    courseSlug: lesson.module.course.slug,
    publishState: lesson.publishState,
    descriptionEn: body.descriptionEn,
    descriptionAr: body.descriptionAr,
    blocks: body.blocks,
    resources: lesson.resources.map((r) => ({
      id: r.id,
      label: r.label,
      url: `/api/resources/${r.id}`,
    })),
    videoUrl,
  };
}
