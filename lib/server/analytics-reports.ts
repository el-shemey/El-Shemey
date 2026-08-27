import "server-only";
import { db } from "@/lib/server/db";

/**
 * Learning analytics reports (Phase 9).
 *
 * DATA HONESTY: every number is derived from real rows; metrics the current
 * model cannot support (e.g. true watch time) are simply absent. Progress
 * percentages are derived via computeCourseProgress-equivalent math at the
 * lesson-completion level (completed/published), which is what the domain
 * stores authoritatively.
 */

export interface CoursePerformanceRow {
  courseId: string;
  slug: string;
  titleEn: string;
  publishState: string;
  enrollments: number;
  activeLearners: number;
  completedLessons: number;
  publishedLessons: number;
  /** completed lessons / (enrollments × published lessons), clamped 0–100 */
  avgProgressPercent: number;
  /** learners who completed every published lesson of the course */
  completedCourseCount: number;
}

export async function coursePerformanceReport(
  days: number,
): Promise<CoursePerformanceRow[]> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 3650) * 86_400_000);

  const courses = await db.course.findMany({
    select: {
      id: true,
      slug: true,
      titleEn: true,
      publishState: true,
      modules: {
        where: { publishState: "PUBLISHED" },
        select: {
          _count: { select: { lessons: { where: { publishState: "PUBLISHED" } } } },
        },
      },
      enrollments: {
        where: { startedAt: { gte: since } },
        include: {
          progress: {
            where: {
              completedAt: { not: null },
              lesson: { publishState: "PUBLISHED" },
            },
            select: { lessonId: true, enrollmentId: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return courses.map((course) => {
    const publishedLessons = course.modules.reduce((n, m) => n + m._count.lessons, 0);
    const enrollments = course.enrollments.length;

    // Active learner = any progress row in window.
    const activeLearners = new Set(
      course.enrollments.flatMap((e) => e.progress.map((p) => p.enrollmentId)),
    ).size;

    let completedLessons = 0;
    const perEnrollmentDone: number[] = [];
    for (const e of course.enrollments) {
      const unique = new Set(e.progress.map((p) => p.lessonId)).size;
      completedLessons += unique;
      perEnrollmentDone.push(unique);
    }

    const avgProgressPercent =
      enrollments > 0 && publishedLessons > 0
        ? Math.min(
            100,
            Math.round(
              (perEnrollmentDone.reduce((a, b) => a + b, 0) /
                (enrollments * publishedLessons)) *
                100,
            ),
          )
        : 0;

    const completedCourseCount =
      publishedLessons > 0
        ? perEnrollmentDone.filter((d) => d >= publishedLessons).length
        : 0;

    return {
      courseId: course.id,
      slug: course.slug,
      titleEn: course.titleEn,
      publishState: course.publishState,
      enrollments,
      activeLearners,
      completedLessons,
      publishedLessons,
      avgProgressPercent,
      completedCourseCount,
    };
  });
}

/* ----------------------------- Revenue analytics --------------------------- */

export interface RevenueSummary {
  periodDays: number | "all";
  grossSuccessfulMinor: number;
  refundedMinor: number;
  netMinor: number;
  currency: string;
  succeededCount: number;
  failedCount: number;
  pendingCount: number;
  refundedCount: number;
  activeSubscriptions: number;
}

/**
 * Financial summary from Payment rows. Integer minor-unit arithmetic only;
 * mixed-currency payments are grouped by their own currency and the dominant
 * currency is reported explicitly (no FX pretending). NOT accounting-grade
 * revenue recognition — labeled "collected payments".
 */
export async function revenueSummary(
  periodDays: number | "all",
): Promise<RevenueSummary> {
  const gte =
    periodDays === "all" ? undefined : new Date(Date.now() - periodDays * 86_400_000);
  const range = { createdAt: gte ? { gte } : {} };

  const [succeeded, refundedRows, failed, pending, activeSubscriptions] =
    await Promise.all([
      db.payment.findMany({
        where: { status: "SUCCEEDED", ...range },
        select: { amountMinor: true, currency: true },
      }),
      db.payment.findMany({
        where: { status: "REFUNDED", ...range },
        select: { amountMinor: true, currency: true },
      }),
      db.payment.count({ where: { status: "FAILED", ...range } }),
      db.payment.count({ where: { status: "PENDING", ...range } }),
      db.subscription.count({
        where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      }),
    ]);

  // Group by currency; report the dominant one explicitly (no FX pretending).
  const byCurrency = new Map<string, { gross: number; refunded: number; n: number }>();
  for (const p of succeeded) {
    const cur = byCurrency.get(p.currency) ?? { gross: 0, refunded: 0, n: 0 };
    cur.gross += p.amountMinor;
    cur.n += 1;
    byCurrency.set(p.currency, cur);
  }
  for (const p of refundedRows) {
    const cur = byCurrency.get(p.currency) ?? { gross: 0, refunded: 0, n: 0 };
    cur.refunded += p.amountMinor;
    byCurrency.set(p.currency, cur);
  }
  let currency = "EGP";
  let grossMinor = 0;
  let refundMinorTotal = 0;
  let maxVolume = -1;
  for (const [cur, v] of byCurrency.entries()) {
    if (v.gross + v.refunded > maxVolume) {
      maxVolume = v.gross + v.refunded;
      currency = cur;
      grossMinor = v.gross;
      refundMinorTotal = v.refunded;
    }
  }

  return {
    periodDays,
    grossSuccessfulMinor: grossMinor,
    refundedMinor: refundMinorTotal,
    netMinor: grossMinor - refundMinorTotal,
    currency,
    succeededCount: succeeded.length,
    failedCount: failed,
    pendingCount: pending,
    refundedCount: refundedRows.length,
    activeSubscriptions,
  };
}
