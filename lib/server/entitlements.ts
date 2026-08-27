import "server-only";
import { db } from "@/lib/server/db";
import { getEntitlementProvider } from "@/lib/server/entitlement-provider";
import { canViewLesson } from "@/lib/domain/access";

/**
 * Resource-level entitlement resolver (Phase 7A).
 *
 * Answers exactly one question: "Can THIS user access THIS specific lesson
 * right now?" — evaluating, in order:
 *   authentication → course publish state → module publish state →
 *   lesson publish state → FREE/PRO access level → enrollment →
 *   entitlement (subscription status + period expiry + refund revocation).
 *
 * This is the ONE server-authoritative decision for lesson access. Pages
 * and APIs must consume it — never re-implement the rules client-side or
 * per-route. Expiration is evaluated from timestamps on every call: correct
 * without any background job.
 */

export type AccessDecision = {
  allowed: boolean;
  reason:
    | "OK"
    | "NOT_FOUND"
    | "COURSE_UNPUBLISHED"
    | "LESSON_UNPUBLISHED"
    | "ENTITLEMENT_REQUIRED";
};

export async function resolveLessonAccess(
  userId: string,
  courseSlug: string,
  lessonSlug: string,
  options?: {
    /** Admin preview: DRAFT content becomes viewable, never public. */
    adminPreview?: boolean;
  },
): Promise<AccessDecision> {
  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug },
    select: {
      accessLevel: true,
      publishState: true,
      module: {
        select: {
          publishState: true,
          course: { select: { publishState: true } },
        },
      },
    },
  });
  if (!lesson) return { allowed: false, reason: "NOT_FOUND" };

  const isAdminPreview = options?.adminPreview === true;
  if (
    lesson.module.course.publishState !== "PUBLISHED" ||
    lesson.module.publishState !== "PUBLISHED"
  ) {
    if (!isAdminPreview) return { allowed: false, reason: "COURSE_UNPUBLISHED" };
  } else if (lesson.publishState !== "PUBLISHED") {
    if (!isAdminPreview) return { allowed: false, reason: "LESSON_UNPUBLISHED" };
  }

  if (isAdminPreview) return { allowed: true, reason: "OK" };

  const hasPro = await getEntitlementProvider().hasProAccess(userId);
  if (
    !canViewLesson({ lesson, modulePublishState: lesson.module.publishState }, hasPro)
  ) {
    return { allowed: false, reason: "ENTITLEMENT_REQUIRED" };
  }

  return { allowed: true, reason: "OK" };
}
