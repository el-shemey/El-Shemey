import { getEntitlementProvider } from "@/lib/server/entitlement-provider";
import { trackEvent } from "@/lib/server/analytics";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  applyCompletion,
  canViewLesson,
  computeCourseProgress,
  type EntitlementProvider,
} from "@/lib/domain";
import type { ProgressRecord } from "@/lib/domain/types";
import {
  completeLessonInputSchema,
  startEnrollmentInputSchema,
  type CompleteLessonInput,
  type StartEnrollmentInput,
} from "@/lib/domain/schemas";

/**
 * Server-side data access for the learning domain (Phase 3).
 *
 * Rules:
 *  - Server-only (guarded by `server-only` in ./db).
 *  - All inputs pass Zod validation before touching the database.
 *  - Authorization: Phase 3 has no auth, so userId must be supplied by the
 *    future caller; Phase 4 will derive it from a verified session — never
 *    from client input.
 *  - Entitlements flow exclusively through the injected EntitlementProvider.
 */

/** Published course tree (modules + lessons ordered) for the public site. */
export async function getPublishedCourseTree(
  slug: string,
  entitlements: EntitlementProvider = getEntitlementProvider(),
) {
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      category: true,
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!course || course.publishState !== "PUBLISHED") return null;

  const hasPro = false; // anonymous public view — no entitlement exists
  const modules = course.modules.map((m) => ({
    id: m.id,
    titleEn: m.titleEn,
    titleAr: m.titleAr,
    publishState: m.publishState,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      moduleId: l.moduleId,
      slug: l.slug,
      titleEn: l.titleEn,
      titleAr: l.titleAr,
      type: l.type,
      accessLevel: l.accessLevel,
      publishState: l.publishState,
      durationSeconds: l.durationSeconds,
      viewable: canViewLesson(
        { lesson: l, modulePublishState: m.publishState },
        hasPro,
      ),
    })),
  }));
  return { course, modules };
}

export async function startEnrollment(raw: StartEnrollmentInput) {
  const input = startEnrollmentInputSchema.parse(raw);
  const course = await db.course.findUnique({
    where: { slug: input.courseSlug, publishState: "PUBLISHED" },
    select: { id: true },
  });
  if (!course) throw new Error("COURSE_NOT_FOUND");

  const enrollment = await db.enrollment.upsert({
    // Idempotent: re-starting an already-started course is a no-op.
    where: { userId_courseId: { userId: input.userId, courseId: course.id } },
    create: { userId: input.userId, courseId: course.id },
    update: { lastActiveAt: new Date() },
  });
  await trackEvent("course_enrolled", {
    userId: input.userId,
    metadata: { courseSlug: input.courseSlug },
  });
  return enrollment;
}

/**
 * Mark a lesson complete. Server-authoritative and idempotent:
 * duplicate events increment completionEvents but never move completedAt.
 */
export async function completeLesson(
  raw: CompleteLessonInput,
  entitlements: EntitlementProvider = getEntitlementProvider(),
) {
  const input = completeLessonInputSchema.parse(raw);

  const lesson = await db.lesson.findFirst({
    where: {
      slug: input.lessonSlug,
      module: {
        course: { slug: input.courseSlug, publishState: "PUBLISHED" },
        publishState: "PUBLISHED",
      },
      publishState: "PUBLISHED",
    },
    include: { module: { select: { id: true, courseId: true, publishState: true } } },
  });
  if (!lesson) throw new Error("LESSON_NOT_FOUND");

  const hasPro = await entitlements.hasProAccess(input.userId);
  if (
    !canViewLesson({ lesson, modulePublishState: lesson.module.publishState }, hasPro)
  ) {
    throw new Error("ACCESS_DENIED");
  }

  const enrollment = await db.enrollment.upsert({
    where: {
      userId_courseId: { userId: input.userId, courseId: lesson.module.courseId },
    },
    create: { userId: input.userId, courseId: lesson.module.courseId },
    update: { lastActiveAt: new Date(), lastLessonId: lesson.id },
  });

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.lessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id },
      },
    });
    const { record, wasDuplicate } = applyCompletion(
      existing
        ? { lessonId: existing.lessonId, completedAt: existing.completedAt }
        : undefined,
      new Date(),
    );

    const saved = await tx.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        completedAt: record.completedAt,
        completionEvents: record.completionEvents,
      },
      update: {
        completedAt: record.completedAt,
        completionEvents: record.completionEvents,
      },
    });

    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { lastActiveAt: new Date(), lastLessonId: lesson.id },
    });

    return { progress: saved, wasDuplicate };
  });

  // Analytics (Phase 9): completion + course-completion milestones.
  if (!result.wasDuplicate) {
    const publishedCount = await db.lesson.count({
      where: {
        moduleId: lesson.module.courseId,
        publishState: "PUBLISHED",
      },
    });
    const completedCount = await db.lessonProgress.count({
      where: {
        enrollmentId: enrollment.id,
        completedAt: { not: null },
        lesson: { publishState: "PUBLISHED" },
      },
    });
    await trackEvent("lesson_completed", {
      userId: input.userId,
      metadata: { courseSlug: input.courseSlug, lessonSlug: input.lessonSlug },
    });
    if (publishedCount > 0 && completedCount >= publishedCount) {
      await trackEvent("course_completed", {
        userId: input.userId,
        metadata: { courseSlug: input.courseSlug },
      });
    }
  }
  return result;
}

/**
 * Persist playback position (resume support). Server-authoritative,
 * idempotent, never touches completion state — completion is a separate
 * explicit event.
 *
 * AUTHORIZATION: the lesson must be viewable by THIS user (publish states +
 * entitlement). Position writes for locked/unpublished lessons are refused
 * — progress can never be forged for inaccessible content.
 */
export async function saveLessonPosition(
  userId: string,
  courseSlug: string,
  lessonSlug: string,
  positionSeconds: number,
  entitlements: EntitlementProvider = getEntitlementProvider(),
) {
  const pos = Math.max(0, Math.min(Math.floor(positionSeconds), 86_400));
  const lesson = await db.lesson.findFirst({
    where: {
      slug: lessonSlug,
      module: { course: { slug: courseSlug, publishState: "PUBLISHED" } },
    },
    include: {
      module: {
        select: {
          courseId: true,
          publishState: true,
          course: { select: { publishState: true } },
        },
      },
    },
  });
  if (!lesson) throw new Error("LESSON_NOT_FOUND");

  const hasPro = await entitlements.hasProAccess(userId);
  if (
    !canViewLesson(
      {
        lesson,
        modulePublishState: lesson.module.publishState,
      },
      hasPro,
    )
  ) {
    throw new Error("ACCESS_DENIED");
  }

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.module.courseId } },
  });
  if (!enrollment) throw new Error("NO_ENROLLMENT");

  await db.lessonProgress.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id },
    },
    create: {
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      positionSeconds: pos,
    },
    update: { positionSeconds: pos },
  });
}

/** Derived progress for a learner's enrollment (private learner state). */
export async function getEnrollmentProgress(userId: string, courseSlug: string) {
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!course) return null;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    include: { progress: true },
  });
  if (!enrollment) return null;

  const records: ProgressRecord[] = enrollment.progress.map(
    (p: { lessonId: string; completedAt: Date | null }) => ({
      lessonId: p.lessonId,
      completedAt: p.completedAt,
    }),
  );

  return computeCourseProgress(course.modules, records);
}
