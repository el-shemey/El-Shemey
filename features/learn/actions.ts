"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/session";
import { completeLesson, saveLessonPosition } from "@/lib/server/learning-repo";

/**
 * Lesson completion (Phase 6).
 *
 * SECURITY:
 *  - userId is derived exclusively from the verified server session.
 *    Client payloads can never supply, override, or spoof it.
 *  - The learning repository re-validates lesson existence, publication
 *    state and entitlement server-side before any progress is written.
 *  - Completion is idempotent: duplicate submissions preserve the original
 *    completion timestamp and only bump the analytics event counter.
 *
 * Errors are intentionally swallowed into a silent no-op state change —
 * the UI simply re-renders its previous truth. No internal details leak.
 */
export async function completeLessonAction(
  locale: string,
  courseSlug: string,
  lessonSlug: string,
): Promise<void> {
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  try {
    await completeLesson({
      userId: user.id,
      courseSlug,
      lessonSlug,
    });
  } catch {
    // LESSON_NOT_FOUND / ACCESS_DENIED / transient DB issues —
    // nothing mutates; the learner sees unchanged state.
  }

  revalidatePath(`/${locale}/learn/${courseSlug}/${lessonSlug}`);
  revalidatePath(`/${locale}/learn`);
}

/**
 * Playback position save (resume support). Fire-and-forget from the player:
 * failures are silent — position is convenience data, never authorization.
 */
export async function saveLessonPositionAction(
  courseSlug: string,
  lessonSlug: string,
  positionSeconds: number,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  if (!Number.isFinite(positionSeconds)) return;
  try {
    await saveLessonPosition(user.id, courseSlug, lessonSlug, positionSeconds);
  } catch {
    // LESSON_NOT_FOUND / NO_ENROLLMENT / transient DB — nothing to surface.
  }
}
