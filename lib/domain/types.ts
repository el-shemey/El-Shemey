/**
 * Pure domain types for the learning model (Phase 3).
 *
 * These are intentionally framework- and Prisma-agnostic: the UI and tests
 * operate on these shapes; repositories translate to/from Prisma models
 * (lib/server/learning-repo.ts).
 */

export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type AccessLevel = "FREE" | "PRO";
export type PublishState = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LessonType = "LESSON" | "QUIZ" | "PROJECT";

/** Ordered lesson as seen by the domain (already sorted by module → position). */
export interface LessonRef {
  id: string;
  moduleId: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  type: LessonType;
  accessLevel: AccessLevel;
  publishState: PublishState;
  durationSeconds?: number | null;
}

/** A module with its lessons already ordered. */
export interface ModuleRef {
  id: string;
  titleEn: string;
  titleAr: string;
  publishState: PublishState;
  lessons: LessonRef[];
}

/** Completion record as stored in LessonProgress. */
export interface ProgressRecord {
  lessonId: string;
  completedAt: Date | null;
}

/** Derived aggregate — computed, never stored. */
export interface CourseProgress {
  totalLessons: number;
  publishedLessons: number;
  completedCount: number;
  /** 0–100, derived from published lessons only. */
  percent: number;
  currentLessonId: string | null;
  nextLessonId: string | null;
  activeModuleId: string | null;
  lastActivityAt: Date | null;
}
