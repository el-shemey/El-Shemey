/** Pure admin role gate — deny by default. */
export function assertAdminRole(role: "USER" | "ADMIN" | undefined | null): void {
  if (role !== "ADMIN") throw new Error("FORBIDDEN");
}

/**
 * Course publication completeness (Phase 5 admin).
 * A course may not be published unless every structural check passes.
 */
export interface CompletenessInput {
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  moduleCount: number;
  lessonCount: number;
}

export interface Completeness {
  hasMetadata: boolean;
  hasArabic: boolean;
  hasEnglish: boolean;
  hasModules: boolean;
  hasLessons: boolean;
  readyToPublish: boolean;
  missing: string[];
}

export function computeCompleteness(c: CompletenessInput): Completeness {
  const checks = {
    hasMetadata: Boolean(c.summaryEn && c.summaryEn.length > 20),
    hasArabic: Boolean(c.titleAr && c.summaryAr),
    hasEnglish: Boolean(c.titleEn && c.summaryEn),
    hasModules: c.moduleCount > 0,
    hasLessons: c.lessonCount > 0,
  };
  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return { ...checks, readyToPublish: missing.length === 0, missing };
}
