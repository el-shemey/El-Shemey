import type { CourseProgress, LessonRef, ProgressRecord } from "./types";

/**
 * Pure progress domain (Phase 3).
 *
 * Design rules:
 *  - LessonProgress rows are the source of truth (completedAt presence).
 *  - Percentages/counts are DERIVED here — never stored redundantly.
 *  - Completion is idempotent: duplicates bump `completionEvents` only.
 *  - Records referencing unknown lessons are ignored (defensive against
 *    content deletion without progress cleanup).
 */

/** Flatten a course tree into the canonical lesson order. */
export function orderedLessons(modules: Array<{ lessons: LessonRef[] }>): LessonRef[] {
  return modules.flatMap((m) => m.lessons);
}

/**
 * Idempotent completion: returns the record to persist and whether this
 * call was a duplicate. The completedAt timestamp of the FIRST completion
 * is preserved forever; retries/duplicates only increment the event count
 * (analytics signal, never a truth change).
 */
export function applyCompletion(
  existing: ProgressRecord | undefined,
  now: Date,
): {
  record: Required<ProgressRecord> & { completionEvents: number };
  wasDuplicate: boolean;
} {
  if (!existing) {
    return {
      record: {
        lessonId: "",
        completedAt: now,
        completionEvents: 1,
      },
      wasDuplicate: false,
    };
  }
  const first = existing.completedAt ?? now;
  return {
    record: {
      lessonId: existing.lessonId,
      completedAt: first,
      completionEvents: 1 + (existing.completedAt ? 1 : 0),
    },
    wasDuplicate: Boolean(existing.completedAt),
  };
}

/** Filter out orphaned progress records (lesson no longer in the tree). */
export function reconcileRecords(
  lessons: LessonRef[],
  records: ProgressRecord[],
): ProgressRecord[] {
  const known = new Set(lessons.map((l) => l.id));
  return records.filter((r) => known.has(r.lessonId));
}

/** Derive the full course progress aggregate. */
export function computeCourseProgress(
  modules: Array<{ id: string; lessons: LessonRef[] }>,
  rawRecords: ProgressRecord[],
): CourseProgress {
  const flat = orderedLessons(modules);
  const records = reconcileRecords(flat, rawRecords);
  const completed = new Set(
    records.filter((r) => r.completedAt).map((r) => r.lessonId),
  );

  const publishedLessons = flat.filter((l) => l.publishState === "PUBLISHED").length;
  const completedCount = flat.filter(
    (l) => completed.has(l.id) && l.publishState === "PUBLISHED",
  ).length;

  // Current lesson = first PUBLISHED lesson not completed.
  // Drafts are never selectable as current/next — they cannot be completed.
  const publishedFlat = flat.filter((l) => l.publishState === "PUBLISHED");
  const current = publishedFlat.find((l) => !completed.has(l.id)) ?? null;
  const currentIndex = current ? publishedFlat.indexOf(current) : -1;
  const next = currentIndex >= 0 ? (publishedFlat[currentIndex + 1] ?? null) : null;

  // Active module = module of the current lesson (fallback: last module).
  const activeModuleId =
    current?.moduleId ?? (flat.length > 0 ? flat[flat.length - 1].moduleId : null);

  const lastActivityAt = records.reduce<Date | null>((acc, r) => {
    if (!r.completedAt) return acc;
    return !acc || r.completedAt > acc ? r.completedAt : acc;
  }, null);

  return {
    totalLessons: flat.length,
    publishedLessons,
    completedCount,
    percent:
      publishedLessons === 0
        ? 0
        : Math.round((completedCount / publishedLessons) * 100),
    currentLessonId: current?.id ?? null,
    nextLessonId: next?.id ?? null,
    activeModuleId,
    lastActivityAt,
  };
}
