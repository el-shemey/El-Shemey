import "server-only";
import { db } from "@/lib/server/db";
import { sanitizeLessonBlocks } from "@/lib/content";
import { audit } from "@/lib/server/admin-guard";
import { getVideoStorage } from "@/lib/server/video/storage";

/**
 * Owner content management (courses/modules/lessons) — self-hosted CMS phase.
 * Every function assumes requireRole("ADMIN") was enforced by the caller.
 *
 * Design rules:
 *  - Slugs are server-generated from titles (owner never types slugs).
 *  - Ordering is positional swaps inside a transaction (no gaps/dupes).
 *  - Attachments/resources live in Lesson.contentRef (the documented
 *    structured-content boundary) until the Phase 8 content pipeline.
 */

/* ------------------------- Course meta (Phase 8) -------------------------- */

export interface CourseMeta {
  objectives?: { en: string[]; ar: string[] };
  prerequisites?: { en: string[]; ar: string[] };
  instructor?: { en?: string; ar?: string };
  coverUrl?: string;
}

const MAX_META_LINES = 12;

/** Newline-separated lines → cleaned array (Phase 8 objectives). */
function toLineList(value: string): string[] {
  return value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_META_LINES)
    .map((x) => x.slice(0, 300));
}

/** Parses untrusted Course.meta into a validated shape (never throws). */
export function parseCourseMeta(raw: unknown): CourseMeta {
  if (!raw || typeof raw !== "object") return {};
  const m = raw as Record<string, unknown>;
  const lines = (v: unknown): string[] | undefined =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .slice(0, MAX_META_LINES)
          .map((x) => x.slice(0, 300))
      : undefined;
  const instructor =
    m.instructor && typeof m.instructor === "object"
      ? {
          en:
            typeof (m.instructor as Record<string, unknown>).en === "string"
              ? ((m.instructor as Record<string, unknown>).en as string).slice(0, 600)
              : undefined,
          ar:
            typeof (m.instructor as Record<string, unknown>).ar === "string"
              ? ((m.instructor as Record<string, unknown>).ar as string).slice(0, 600)
              : undefined,
        }
      : undefined;
  const coverUrl =
    typeof m.coverUrl === "string" && /^https:\/\/[^\s"'<>]+$/.test(m.coverUrl)
      ? m.coverUrl
      : undefined;
  return {
    objectives:
      m.objectives && typeof m.objectives === "object"
        ? {
            en: lines((m.objectives as Record<string, unknown>).en) ?? [],
            ar: lines((m.objectives as Record<string, unknown>).ar) ?? [],
          }
        : undefined,
    prerequisites:
      m.prerequisites && typeof m.prerequisites === "object"
        ? {
            en: lines((m.prerequisites as Record<string, unknown>).en) ?? [],
            ar: lines((m.prerequisites as Record<string, unknown>).ar) ?? [],
          }
        : undefined,
    instructor,
    coverUrl,
  };
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return base || "item";
}

async function uniqueCourseSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // Deterministic uniqueness loop (bounded).
  for (;;) {
    const exists = await db.course.findUnique({ where: { slug } });
    if (!exists) return slug;
    n += 1;
    slug = `${base}-${n}`;
    if (n > 200) throw new Error("SLUG_GENERATION_FAILED");
  }
}

/* --------------------------------- Courses -------------------------------- */

export interface CourseEditorData {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  level: string;
  accessLevel: string;
  publishState: string;
  estimatedHours: number | null;
  seoTitleEn: string | null;
  seoDescEn: string | null;
  meta: CourseMeta;
  modules: Array<{
    id: string;
    position: number;
    titleEn: string;
    titleAr: string;
    publishState: string;
    lessons: Array<{
      id: string;
      slug: string;
      position: number;
      titleEn: string;
      titleAr: string;
      type: string;
      accessLevel: string;
      publishState: string;
      durationSeconds: number | null;
      hasReadyVideo: boolean;
    }>;
  }>;
}

export async function getCourseEditor(
  courseId: string,
): Promise<CourseEditorData | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: {
              videos: { where: { archivedAt: null }, select: { status: true } },
            },
          },
        },
      },
    },
  });
  if (!course) return null;

  return {
    id: course.id,
    slug: course.slug,
    titleEn: course.titleEn,
    titleAr: course.titleAr,
    summaryEn: course.summaryEn,
    summaryAr: course.summaryAr,
    descriptionEn: course.descriptionEn,
    descriptionAr: course.descriptionAr,
    level: course.level,
    accessLevel: course.accessLevel,
    publishState: course.publishState,
    estimatedHours: course.estimatedHours,
    seoTitleEn: course.seoTitleEn,
    seoDescEn: course.seoDescEn,
    meta: parseCourseMeta(course.meta),
    modules: course.modules.map((m) => ({
      id: m.id,
      position: m.position,
      titleEn: m.titleEn,
      titleAr: m.titleAr,
      publishState: m.publishState,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        slug: l.slug,
        position: l.position,
        titleEn: l.titleEn,
        titleAr: l.titleAr,
        type: l.type,
        accessLevel: l.accessLevel,
        publishState: l.publishState,
        durationSeconds: l.durationSeconds,
        hasReadyVideo: l.videos.some((v) => v.status === "READY"),
      })),
    })),
  };
}

export async function createCourse(input: {
  titleEn: string;
  titleAr: string;
  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}): Promise<{ ok: boolean; courseId?: string; reason?: string }> {
  if (!input.titleEn.trim() || !input.titleAr.trim()) {
    return { ok: false, reason: "MISSING_TITLES" };
  }
  const slug = await uniqueCourseSlug(slugify(input.titleEn));
  const course = await db.course.create({
    data: {
      slug,
      titleEn: input.titleEn.trim().slice(0, 160),
      titleAr: input.titleAr.trim().slice(0, 160),
      level: input.level ?? "BEGINNER",
      accessLevel: "PRO",
      publishState: "DRAFT",
    },
  });
  return { ok: true, courseId: course.id };
}

const COURSE_FIELD_LIMITS = {
  titleEn: 160,
  titleAr: 160,
  summaryEn: 400,
  summaryAr: 400,
  descriptionEn: 5000,
  descriptionAr: 5000,
} as const;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
}

export async function updateCourse(
  courseId: string,
  raw: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string }> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { ok: false, reason: "NOT_FOUND" };

  const titleEn = clip(raw.titleEn, COURSE_FIELD_LIMITS.titleEn);
  const titleAr = clip(raw.titleAr, COURSE_FIELD_LIMITS.titleAr);
  if (!titleEn || !titleAr) return { ok: false, reason: "MISSING_TITLES" };

  const level =
    raw.level === "BEGINNER" || raw.level === "INTERMEDIATE" || raw.level === "ADVANCED"
      ? raw.level
      : course.level;
  const accessLevel = raw.accessLevel === "FREE" ? "FREE" : "PRO";

  // Phase 8 meta: newline-separated lines → arrays; cover must be https.
  // The builder form submits all meta fields together; when present, the
  // whole meta object is rewritten (single source, no partial merges).
  const prevMeta = parseCourseMeta(course.meta);
  const toLines = (v: unknown): string[] =>
    typeof v === "string"
      ? v
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, MAX_META_LINES)
          .map((x) => x.slice(0, 300))
      : [];
  const hasMeta = [
    "objectivesEn",
    "objectivesAr",
    "prerequisitesEn",
    "prerequisitesAr",
    "instructorEn",
    "instructorAr",
    "coverUrl",
  ].some((k) => k in raw);
  const coverUrl =
    typeof raw.coverUrl === "string" &&
    /^https:\/\/[^\s"'<>]+$/.test(raw.coverUrl.trim())
      ? raw.coverUrl.trim()
      : prevMeta.coverUrl;

  const hoursRaw = Number(raw.estimatedHours);
  const estimatedHours =
    Number.isFinite(hoursRaw) && hoursRaw > 0 && hoursRaw <= 1000
      ? Math.round(hoursRaw)
      : course.estimatedHours;

  await db.course.update({
    where: { id: courseId },
    data: {
      titleEn,
      titleAr,
      summaryEn: clip(raw.summaryEn, COURSE_FIELD_LIMITS.summaryEn),
      summaryAr: clip(raw.summaryAr, COURSE_FIELD_LIMITS.summaryAr),
      descriptionEn: clip(raw.descriptionEn, COURSE_FIELD_LIMITS.descriptionEn),
      descriptionAr: clip(raw.descriptionAr, COURSE_FIELD_LIMITS.descriptionAr),
      seoTitleEn: clip(raw.seoTitleEn, 200),
      seoDescEn: clip(raw.seoDescEn, 400),
      level,
      accessLevel,
      estimatedHours,
      ...(hasMeta
        ? {
            meta: {
              objectives: {
                en: toLines(raw.objectivesEn),
                ar: toLines(raw.objectivesAr),
              },
              prerequisites: {
                en: toLines(raw.prerequisitesEn),
                ar: toLines(raw.prerequisitesAr),
              },
              instructor: {
                en: clip(raw.instructorEn, 600) ?? "",
                ar: clip(raw.instructorAr, 600) ?? "",
              },
              coverUrl,
            } satisfies CourseMeta,
          }
        : {}),
    },
  });
  return { ok: true };
}

/* -------------------------------- Modules --------------------------------- */

export async function createModule(
  courseId: string,
  input: { titleEn: string; titleAr: string },
): Promise<{ ok: boolean; reason?: string }> {
  if (!input.titleEn.trim() || !input.titleAr.trim()) {
    return { ok: false, reason: "MISSING_TITLES" };
  }
  const count = await db.module.count({ where: { courseId } });
  await db.module.create({
    data: {
      courseId,
      position: count + 1,
      titleEn: input.titleEn.trim().slice(0, 160),
      titleAr: input.titleAr.trim().slice(0, 160),
      publishState: "DRAFT",
    },
  });
  return { ok: true };
}

export async function renameModule(
  moduleId: string,
  input: { titleEn: string; titleAr: string },
): Promise<void> {
  await db.module.update({
    where: { id: moduleId },
    data: {
      titleEn: input.titleEn.trim().slice(0, 160),
      titleAr: input.titleAr.trim().slice(0, 160) || input.titleEn.trim().slice(0, 160),
    },
  });
}

/** Positional swap move; direction ±1. Transactional and clamped.
 *  Uses a temporary out-of-band position to satisfy the unique constraint. */
export async function moveModule(
  courseId: string,
  moduleId: string,
  direction: 1 | -1,
): Promise<{ ok: boolean }> {
  const modules = await db.module.findMany({
    where: { courseId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const index = modules.findIndex((m) => m.id === moduleId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= modules.length) {
    return { ok: false };
  }
  const tempPosition = modules.length + 1;
  await db.$transaction([
    db.module.update({
      where: { id: modules[index].id },
      data: { position: tempPosition },
    }),
    db.module.update({
      where: { id: modules[target].id },
      data: { position: modules[index].position },
    }),
    db.module.update({
      where: { id: modules[index].id },
      data: { position: modules[target].position },
    }),
  ]);
  return { ok: true };
}

/* -------------------------------- Lessons ---------------------------------- */

export async function createLesson(
  moduleId: string,
  input: { titleEn: string; titleAr?: string },
): Promise<{ ok: boolean; lessonId?: string; reason?: string }> {
  if (!input.titleEn.trim()) return { ok: false, reason: "MISSING_TITLE" };
  const mod = await db.module.findUnique({ where: { id: moduleId } });
  if (!mod) return { ok: false, reason: "NOT_FOUND" };

  const count = await db.lesson.count({ where: { moduleId } });
  const position = count + 1;
  const baseSlug = slugify(input.titleEn);
  let slug = baseSlug;
  let n = 1;
  for (;;) {
    const exists = await db.lesson.findUnique({
      where: { moduleId_slug: { moduleId, slug } },
    });
    if (!exists) break;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const lesson = await db.lesson.create({
    data: {
      moduleId,
      slug,
      position,
      titleEn: input.titleEn.trim().slice(0, 200),
      titleAr: (input.titleAr?.trim() || input.titleEn.trim()).slice(0, 200),
      type: "LESSON",
      accessLevel: "PRO",
      publishState: "DRAFT",
    },
  });
  return { ok: true, lessonId: lesson.id };
}

export interface LessonEditorData {
  id: string;
  moduleId: string;
  moduleTitleEn: string;
  courseId: string;
  courseTitleEn: string;
  courseSlug: string;
  slug: string;
  position: number;
  titleEn: string;
  titleAr: string;
  type: string;
  accessLevel: string;
  publishState: string;
  durationSeconds: number | null;
  contentRef: {
    descriptionEn?: string;
    descriptionAr?: string;
    summaryEn?: string;
    summaryAr?: string;
    objectivesEn?: string[];
    objectivesAr?: string[];
    completionThreshold?: number;
    resources?: Array<{ label: string; url: string }>;
    attachments?: Array<{ label: string; url: string }>;
    blocks?: ReturnType<typeof sanitizeLessonBlocks>;
  } | null;
  videos: Array<{
    id: string;
    title: string;
    status: string;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
    width: number | null;
    height: number | null;
  }>;
}

export async function getLessonEditor(
  lessonId: string,
): Promise<LessonEditorData | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: {
          titleEn: true,
          courseId: true,
          course: { select: { id: true, titleEn: true, slug: true } },
        },
      },
      videos: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!lesson) return null;

  let contentRef: LessonEditorData["contentRef"] = null;
  if (lesson.contentRef && typeof lesson.contentRef === "object") {
    const c = lesson.contentRef as Record<string, unknown>;
    contentRef = {
      descriptionEn: typeof c.descriptionEn === "string" ? c.descriptionEn : undefined,
      descriptionAr: typeof c.descriptionAr === "string" ? c.descriptionAr : undefined,
      summaryEn: typeof c.summaryEn === "string" ? c.summaryEn : undefined,
      summaryAr: typeof c.summaryAr === "string" ? c.summaryAr : undefined,
      objectivesEn: Array.isArray(c.objectivesEn)
        ? (c.objectivesEn as string[])
        : undefined,
      objectivesAr: Array.isArray(c.objectivesAr)
        ? (c.objectivesAr as string[])
        : undefined,
      completionThreshold:
        typeof c.completionThreshold === "number" ? c.completionThreshold : undefined,
      resources: Array.isArray(c.resources)
        ? (c.resources as Array<{ label: string; url: string }>)
        : undefined,
      attachments: Array.isArray(c.attachments)
        ? (c.attachments as Array<{ label: string; url: string }>)
        : undefined,
      blocks: c.blocks !== undefined ? sanitizeLessonBlocks(c.blocks) : undefined,
    };
  }

  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    moduleTitleEn: lesson.module.titleEn,
    courseId: lesson.module.course.id,
    courseTitleEn: lesson.module.course.titleEn,
    courseSlug: lesson.module.course.slug,
    slug: lesson.slug,
    position: lesson.position,
    titleEn: lesson.titleEn,
    titleAr: lesson.titleAr,
    type: lesson.type,
    accessLevel: lesson.accessLevel,
    publishState: lesson.publishState,
    durationSeconds: lesson.durationSeconds,
    contentRef,
    videos: lesson.videos.map((v) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      durationSeconds: v.durationSeconds,
      fileSizeBytes: v.fileSizeBytes !== null ? Number(v.fileSizeBytes) : null,
      width: v.width,
      height: v.height,
    })),
  };
}

const LESSON_CONTENT_MAX = 20_000;

export async function updateLesson(
  lessonId: string,
  raw: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, reason: "NOT_FOUND" };

  const titleEn = typeof raw.titleEn === "string" ? raw.titleEn.trim() : "";
  if (!titleEn) return { ok: false, reason: "MISSING_TITLE" };
  const titleAr =
    typeof raw.titleAr === "string" && raw.titleAr.trim()
      ? raw.titleAr.trim()
      : titleEn;

  const type = raw.type === "QUIZ" || raw.type === "PROJECT" ? raw.type : "LESSON";
  // The FREE/PRO switch doubles as the preview flag: FREE = public preview.
  const accessLevel = raw.accessLevel === "FREE" ? "FREE" : "PRO";
  const publishState = raw.publishState === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  const durationRaw = Number(raw.durationSeconds);
  const durationSeconds =
    Number.isFinite(durationRaw) && durationRaw > 0 && durationRaw <= 86_400
      ? Math.floor(durationRaw)
      : null;

  // Structured content boundary (DATABASE_DESIGN.md): description +
  // resources/attachments are stored under contentRef.
  const prev =
    lesson.contentRef && typeof lesson.contentRef === "object"
      ? (lesson.contentRef as Record<string, unknown>)
      : {};
  const parseLinks = (value: unknown) => {
    let v = value;
    if (typeof v === "string") {
      try {
        v = JSON.parse(v) as unknown;
      } catch {
        return undefined;
      }
    }
    return Array.isArray(v)
      ? v
          .map((r) => r as Record<string, unknown>)
          .filter(
            (r): r is { label: string; url: string } =>
              typeof r.label === "string" &&
              typeof r.url === "string" &&
              /^https?:\/\/[^\s]+$/.test(r.url) &&
              r.label.trim().length > 0,
          )
          .slice(0, 20)
          .map((r) => ({ label: r.label.slice(0, 120), url: r.url }))
      : undefined;
  };

  const contentRef = {
    ...prev,
    descriptionEn:
      typeof raw.descriptionEn === "string"
        ? raw.descriptionEn.slice(0, LESSON_CONTENT_MAX)
        : prev.descriptionEn,
    descriptionAr:
      typeof raw.descriptionAr === "string"
        ? raw.descriptionAr.slice(0, LESSON_CONTENT_MAX)
        : prev.descriptionAr,
    resources: parseLinks(raw.resourcesJson) ?? prev.resources,
    attachments: parseLinks(raw.attachmentsJson) ?? prev.attachments,
    // Phase 8: summary/objectives bilingual + completion threshold.
    summaryEn:
      typeof raw.summaryEn === "string" ? raw.summaryEn.slice(0, 400) : prev.summaryEn,
    summaryAr:
      typeof raw.summaryAr === "string" ? raw.summaryAr.slice(0, 400) : prev.summaryAr,
    objectivesEn:
      typeof raw.objectivesEn === "string"
        ? toLineList(raw.objectivesEn)
        : prev.objectivesEn,
    objectivesAr:
      typeof raw.objectivesAr === "string"
        ? toLineList(raw.objectivesAr)
        : prev.objectivesAr,
    ...(raw.completionThresholdPercent !== undefined
      ? {
          completionThreshold: (() => {
            const t = Number(raw.completionThresholdPercent);
            return Number.isFinite(t) && t >= 10 && t <= 100
              ? Math.round(t) / 100
              : undefined;
          })(),
        }
      : {}),
    // Structured blocks (Phase 8) — same sanitizer as the render path.
    ...(raw.blocksJson !== undefined
      ? { blocks: sanitizeLessonBlocks(raw.blocksJson) }
      : {}),
  };

  await db.lesson.update({
    where: { id: lessonId },
    data: {
      titleEn: titleEn.slice(0, 200),
      titleAr: titleAr.slice(0, 200),
      type,
      accessLevel,
      publishState,
      durationSeconds,
      contentRef: contentRef as object,
    },
  });
  return { ok: true };
}

export async function moveLesson(
  moduleId: string,
  lessonId: string,
  direction: 1 | -1,
): Promise<{ ok: boolean }> {
  const lessons = await db.lesson.findMany({
    where: { moduleId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const index = lessons.findIndex((l) => l.id === lessonId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= lessons.length) {
    return { ok: false };
  }
  const tempPosition = lessons.length + 1;
  await db.$transaction([
    db.lesson.update({
      where: { id: lessons[index].id },
      data: { position: tempPosition },
    }),
    db.lesson.update({
      where: { id: lessons[target].id },
      data: { position: lessons[index].position },
    }),
    db.lesson.update({
      where: { id: lessons[index].id },
      data: { position: lessons[target].position },
    }),
  ]);
  return { ok: true };
}

/* ==================== Phase 8 � Content Factory ops ====================== */

/* ------------------------------ Deletion ---------------------------------- */

export async function deleteLesson(
  actorId: string,
  lessonId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, moduleId: true, resources: { select: { storageRef: true } } },
  });
  if (!lesson) return { ok: false, reason: "NOT_FOUND" };

  await db.$transaction(async (tx) => {
    // LessonProgress + ResourceFile rows cascade via FK.
    await tx.lesson.delete({ where: { id: lessonId } });
    // Re-pack remaining sibling positions without gaps.
    const siblings = await tx.lesson.findMany({
      where: { moduleId: lesson.moduleId },
      orderBy: { position: "asc" },
    });
    for (const [i, s] of siblings.entries()) {
      if (s.position !== i + 1) {
        await tx.lesson.update({ where: { id: s.id }, data: { position: i + 1 } });
      }
    }
  });

  // Stored resource bytes are removed best-effort after the row cascade.
  for (const r of lesson.resources) {
    await getVideoStorage()
      .delete(r.storageRef)
      .catch(() => {});
  }
  await audit(actorId, "lesson.deleted", "Lesson", lessonId);
  return { ok: true };
}

export async function deleteModule(
  actorId: string,
  moduleId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const mod = await db.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { id: true } } },
  });
  if (!mod) return { ok: false, reason: "NOT_FOUND" };
  const courseId = mod.course.id;

  await db.$transaction(async (tx) => {
    await tx.module.delete({ where: { id: moduleId } }); // lessons cascade
    const siblings = await tx.module.findMany({
      where: { courseId },
      orderBy: { position: "asc" },
    });
    for (const [i, s] of siblings.entries()) {
      if (s.position !== i + 1) {
        await tx.module.update({ where: { id: s.id }, data: { position: i + 1 } });
      }
    }
  });

  await audit(actorId, "module.deleted", "Module", moduleId);
  return { ok: true };
}

/** Course deletion is a last resort: requires DRAFT or ARCHIVED state. */
export async function deleteCourse(
  actorId: string,
  courseId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { ok: false, reason: "NOT_FOUND" };
  if (course.publishState === "PUBLISHED") {
    return { ok: false, reason: "PUBLISHED_COURSE_MUST_BE_UNPUBLISHED_FIRST" };
  }
  await db.course.delete({ where: { id: courseId } }); // modules/lessons/resources cascade
  await audit(actorId, "course.deleted", "Course", courseId);
  return { ok: true };
}

/* ---------------------------- Duplication --------------------------------- */

async function uniqueLessonSlug(moduleId: string, baseSlug: string): Promise<string> {
  let slug = `${baseSlug}-copy`;
  let n = 2;
  for (;;) {
    const exists = await db.lesson.findUnique({
      where: { moduleId_slug: { moduleId, slug } },
    });
    if (!exists) return slug;
    n += 1;
    slug = `${baseSlug}-copy-${n}`;
    if (n > 100) throw new Error("SLUG_GENERATION_FAILED");
  }
}

export async function duplicateLesson(
  actorId: string,
  lessonId: string,
): Promise<{ ok: boolean; lessonId?: string; reason?: string }> {
  const source = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      moduleId: true,
      slug: true,
      type: true,
      accessLevel: true,
      titleEn: true,
      titleAr: true,
      durationSeconds: true,
      contentRef: true,
    },
  });
  if (!source) return { ok: false, reason: "NOT_FOUND" };

  const count = await db.lesson.count({ where: { moduleId: source.moduleId } });
  const slug = await uniqueLessonSlug(source.moduleId, source.slug);

  // Copies structure and content only: NO progress records, NO video
  // ownership transfer (video stays attached to the original lesson).
  const copy = await db.lesson.create({
    data: {
      moduleId: source.moduleId,
      slug,
      position: count + 1,
      type: source.type,
      accessLevel: source.accessLevel,
      publishState: "DRAFT", // duplicates always start as drafts
      titleEn: `${source.titleEn} (copy)`.slice(0, 200),
      titleAr: `${source.titleAr} (????)`.slice(0, 200),
      durationSeconds: source.durationSeconds,
      contentRef:
        source.contentRef && typeof source.contentRef === "object"
          ? (JSON.parse(JSON.stringify(source.contentRef)) as object)
          : undefined,
    },
  });

  await audit(actorId, "lesson.duplicated", "Lesson", copy.id, { sourceId: lessonId });
  return { ok: true, lessonId: copy.id };
}

export async function duplicateModule(
  actorId: string,
  moduleId: string,
): Promise<{ ok: boolean; moduleId?: string; reason?: string }> {
  const source = await db.module.findUnique({
    where: { id: moduleId },
    include: { lessons: { orderBy: { position: "asc" } } },
  });
  if (!source) return { ok: false, reason: "NOT_FOUND" };

  const count = await db.module.count({ where: { courseId: source.courseId } });
  const copy = await db.module.create({
    data: {
      courseId: source.courseId,
      position: count + 1,
      titleEn: `${source.titleEn} (copy)`.slice(0, 160),
      titleAr: `${source.titleAr} (????)`.slice(0, 160),
      publishState: "DRAFT",
    },
  });

  // Preserve lesson order; slugs are unique per module so they carry over.
  for (const [i, l] of source.lessons.entries()) {
    await db.lesson.create({
      data: {
        moduleId: copy.id,
        slug: l.slug,
        position: i + 1,
        type: l.type,
        accessLevel: l.accessLevel,
        publishState: "DRAFT",
        titleEn: l.titleEn,
        titleAr: l.titleAr,
        durationSeconds: l.durationSeconds,
        contentRef:
          l.contentRef && typeof l.contentRef === "object"
            ? (JSON.parse(JSON.stringify(l.contentRef)) as object)
            : undefined,
      },
    });
  }

  await audit(actorId, "module.duplicated", "Module", copy.id, { sourceId: moduleId });
  return { ok: true, moduleId: copy.id };
}

export async function duplicateCourse(
  actorId: string,
  courseId: string,
): Promise<{ ok: boolean; courseId?: string; reason?: string }> {
  const source = await db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!source) return { ok: false, reason: "NOT_FOUND" };

  const slug = await uniqueCourseSlug(`${slugify(source.titleEn)}-copy`);
  const copy = await db.course.create({
    data: {
      slug,
      level: source.level,
      accessLevel: source.accessLevel,
      publishState: "DRAFT",
      titleEn: `${source.titleEn} (copy)`.slice(0, 160),
      titleAr: `${source.titleAr} (????)`.slice(0, 160),
      summaryEn: source.summaryEn,
      summaryAr: source.summaryAr,
      descriptionEn: source.descriptionEn,
      descriptionAr: source.descriptionAr,
      seoTitleEn: source.seoTitleEn,
      seoTitleAr: source.seoTitleAr,
      seoDescEn: source.seoDescEn,
      seoDescAr: source.seoDescAr,
      categoryId: source.categoryId,
      estimatedHours: source.estimatedHours,
      meta:
        source.meta && typeof source.meta === "object"
          ? (JSON.parse(JSON.stringify(source.meta)) as object)
          : undefined,
    },
  });

  // Deep-copy structure/content; videos stay attached to the ORIGINAL lessons
  // (explicit duplication of media ownership is a separate admin action).
  let mPos = 0;
  for (const m of source.modules) {
    mPos += 1;
    const newModule = await db.module.create({
      data: {
        courseId: copy.id,
        position: mPos,
        titleEn: m.titleEn,
        titleAr: m.titleAr,
        publishState: "DRAFT",
      },
    });
    let lPos = 0;
    for (const l of m.lessons) {
      lPos += 1;
      await db.lesson.create({
        data: {
          moduleId: newModule.id,
          slug: l.slug,
          position: lPos,
          type: l.type,
          accessLevel: l.accessLevel,
          publishState: "DRAFT",
          titleEn: l.titleEn,
          titleAr: l.titleAr,
          durationSeconds: l.durationSeconds,
          contentRef:
            l.contentRef && typeof l.contentRef === "object"
              ? (JSON.parse(JSON.stringify(l.contentRef)) as object)
              : undefined,
        },
      });
    }
  }

  await audit(actorId, "course.duplicated", "Course", copy.id, { sourceId: courseId });
  return { ok: true, courseId: copy.id };
}

/* --------------------- Move lesson between modules ------------------------ */

export async function moveLessonToModule(
  actorId: string,
  lessonId: string,
  targetModuleId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, moduleId: true, slug: true },
  });
  const target = await db.module.findUnique({ where: { id: targetModuleId } });
  if (!lesson || !target) return { ok: false, reason: "NOT_FOUND" };
  if (lesson.moduleId === targetModuleId) return { ok: true };

  const conflict = await db.lesson.findFirst({
    where: { moduleId: targetModuleId, slug: lesson.slug },
  });

  await db.$transaction(async (tx) => {
    // Close the gap in the source module.
    const sourceSiblings = await tx.lesson.findMany({
      where: { moduleId: lesson.moduleId },
      orderBy: { position: "asc" },
    });
    const idx = sourceSiblings.findIndex((l) => l.id === lessonId);
    for (let i = idx + 1; i < sourceSiblings.length; i += 1) {
      await tx.lesson.update({
        where: { id: sourceSiblings[i].id },
        data: { position: i }, // shift down by one
      });
    }

    // Slug collision in the target module ? derive a safe unique slug.
    let slug = lesson.slug;
    if (conflict) {
      let n = 2;
      for (;;) {
        slug = `${lesson.slug}-m${n}`;
        const exists = await tx.lesson.findFirst({
          where: { moduleId: targetModuleId, slug },
        });
        if (!exists) break;
        n += 1;
        if (n > 100) throw new Error("SLUG_GENERATION_FAILED");
      }
    }

    const count = await tx.lesson.count({ where: { moduleId: targetModuleId } });
    await tx.lesson.update({
      where: { id: lessonId },
      data: { moduleId: targetModuleId, position: count + 1, slug },
    });
  });

  await audit(actorId, "lesson.moved", "Lesson", lessonId, {
    from: lesson.moduleId,
    to: targetModuleId,
  });
  return { ok: true };
}

/* ---------------- Lesson completeness & publish gating -------------------- */

export interface LessonCompleteness {
  readyToPublish: boolean;
  missing: string[];
}

/**
 * Publish gating by lesson type. QUIZ/PROJECT do not require a video;
 * every type requires bilingual titles + course/module assignment +
 * published module. Content body requires at least one language present
 * (legacy paragraph or structured blocks).
 */
export async function getLessonCompleteness(
  lessonId: string,
): Promise<(LessonCompleteness & { lessonType: string }) | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      type: true,
      titleEn: true,
      titleAr: true,
      durationSeconds: true,
      contentRef: true,
      module: {
        select: { publishState: true, course: { select: { publishState: true } } },
      },
      videos: { where: { archivedAt: null }, select: { status: true } },
    },
  });
  if (!lesson) return null;

  const missing: string[] = [];
  if (!lesson.titleEn?.trim()) missing.push("english_title");
  if (!lesson.titleAr?.trim()) missing.push("arabic_title");

  const c = extractContentRefText(lesson.contentRef);
  const hasBody = Boolean(c.en || c.ar || c.blocks > 0);
  if (!hasBody && lesson.type !== "QUIZ") missing.push("content");

  if (lesson.type === "LESSON" || lesson.type === "PROJECT") {
    const hasVideo = lesson.videos.some((v) => v.status === "READY");
    if (!hasVideo) missing.push("video");
    if (!lesson.durationSeconds) missing.push("duration");
  }
  if (lesson.module.publishState === "DRAFT") missing.push("module_unpublished");
  if (lesson.module.course.publishState === "DRAFT") missing.push("course_unpublished");

  return { readyToPublish: missing.length === 0, missing, lessonType: lesson.type };
}

function extractContentRefText(contentRef: unknown): {
  en: string | null;
  ar: string | null;
  blocks: number;
} {
  if (!contentRef || typeof contentRef !== "object") {
    return { en: null, ar: null, blocks: 0 };
  }
  const c = contentRef as Record<string, unknown>;
  return {
    en: typeof c.descriptionEn === "string" ? c.descriptionEn : null,
    ar: typeof c.descriptionAr === "string" ? c.descriptionAr : null,
    blocks: Array.isArray(c.blocks) ? c.blocks.length : 0,
  };
}

/**
 * Explicit lesson publish/unpublish with server-side gating.
 * An incomplete lesson can never reach PUBLISHED � the gate is here,
 * not in the UI.
 */
export async function setLessonPublishState(
  actorId: string,
  lessonId: string,
  next: "PUBLISHED" | "DRAFT",
): Promise<{ ok: boolean; reason?: string; missing?: string[] }> {
  const completeness = await getLessonCompleteness(lessonId);
  if (!completeness) return { ok: false, reason: "NOT_FOUND" };

  if (next === "PUBLISHED") {
    if (!completeness.readyToPublish) {
      return { ok: false, reason: "INCOMPLETE", missing: completeness.missing };
    }
    // Also require every ancestor to be published (course ? module ? lesson).
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { publishState: true } } },
    });
    if (lesson?.module.publishState !== "PUBLISHED") {
      return { ok: false, reason: "MODULE_NOT_PUBLISHED" };
    }
  }

  const previous = (
    await db.lesson.findUnique({
      where: { id: lessonId },
      select: { publishState: true },
    })
  )?.publishState;

  await db.lesson.update({ where: { id: lessonId }, data: { publishState: next } });
  await audit(
    actorId,
    next === "PUBLISHED" ? "lesson.published" : "lesson.unpublished",
    "Lesson",
    lessonId,
    { from: previous ?? "UNKNOWN", to: next, lessonType: completeness.lessonType },
  );
  void extractContentRefText;
  return { ok: true };
}

/* ------------------------- Lesson resource files -------------------------- */

export interface ResourceFileView {
  id: string;
  label: string;
  mimeType: string | null;
  sizeBytes: number | null;
  position: number;
  createdAt: Date;
}

export async function listLessonResources(
  lessonId: string,
): Promise<ResourceFileView[]> {
  const rows = await db.resourceFile.findMany({
    where: { lessonId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes !== null ? Number(r.sizeBytes) : null,
    position: r.position,
    createdAt: r.createdAt,
  }));
}

/** Registers an uploaded resource row (storage write handled by the route). */
export async function createResourceFile(input: {
  actorId: string;
  lessonId: string;
  label: string;
  storageRef: string;
  mimeType: string | null;
  sizeBytes: number;
}): Promise<{ ok: boolean; resourceId?: string; reason?: string }> {
  const lesson = await db.lesson.findUnique({ where: { id: input.lessonId } });
  if (!lesson) return { ok: false, reason: "NOT_FOUND" };
  const position = await db.resourceFile.count({ where: { lessonId: input.lessonId } });
  const row = await db.resourceFile.create({
    data: {
      lessonId: input.lessonId,
      label: input.label.slice(0, 200),
      storageRef: input.storageRef,
      mimeType: input.mimeType?.slice(0, 100) ?? null,
      sizeBytes: BigInt(Math.floor(input.sizeBytes)),
      position: position + 1,
      createdById: input.actorId,
    },
  });
  await audit(input.actorId, "resource.created", "ResourceFile", row.id);
  return { ok: true, resourceId: row.id };
}

/** Deletes the row and the stored bytes. Authorization is caller-enforced. */
export async function deleteResourceFile(
  actorId: string,
  resourceId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const row = await db.resourceFile.findUnique({ where: { id: resourceId } });
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  await db.resourceFile.delete({ where: { id: resourceId } });
  await getVideoStorage()
    .delete(row.storageRef)
    .catch(() => {});
  await audit(actorId, "resource.deleted", "ResourceFile", resourceId);
  return { ok: true };
}
