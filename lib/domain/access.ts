import type { LessonRef } from "./types";

/**
 * Entitlement boundary (Phase 3).
 *
 * The client NEVER decides access. Everything flows through this interface.
 * Phase 5 will provide the real implementation backed by subscriptions;
 * today the only implementation is the no-entitlement default.
 */
export interface EntitlementProvider {
  /** Whether this learner currently holds PRO access. */
  hasProAccess(userId: string): Promise<boolean>;
}

/** Phase 3 default: nobody has PRO (no subscription system exists yet). */
export const noEntitlements: EntitlementProvider = {
  async hasProAccess() {
    return false;
  },
};

export interface LessonAccessInput {
  lesson: Pick<LessonRef, "accessLevel" | "publishState">;
  modulePublishState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

/**
 * Single source of truth for lesson visibility.
 * Rules:
 *  - DRAFT content is never public (even with PRO).
 *  - ARCHIVED content is hidden from new learners.
 *  - FREE lessons are previewable by everyone.
 *  - PRO lessons require an entitlement from the provider.
 */
export function canViewLesson(
  input: LessonAccessInput,
  hasProAccess: boolean,
): boolean {
  const { lesson, modulePublishState } = input;
  if (lesson.publishState !== "PUBLISHED" || modulePublishState !== "PUBLISHED") {
    return false;
  }
  if (lesson.accessLevel === "FREE") return true;
  return hasProAccess;
}
