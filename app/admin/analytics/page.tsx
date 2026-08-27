import Link from "next/link";
import { db } from "@/lib/server/db";
import {
  coursePerformanceReport,
  revenueSummary,
} from "@/lib/server/analytics-reports";
import { eventCountsSince } from "@/lib/server/analytics";
import { isFakePayEnabled } from "@/lib/server/payments/fakepay";

/**
 * Analytics (Phase 9) — real data only.
 * Learning: course performance from enrollments + completion rows.
 * Revenue: integer minor-unit arithmetic; dominant currency labeled.
 * Behavior: aggregated AnalyticsEvent counts.
 */

const PERIODS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: -1 },
];

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const active = PERIODS.find((p) => p.key === (period ?? "30")) ?? PERIODS[1];
  const days = active.days;

  const [performance, revenue, eventCounts] = await Promise.all([
    coursePerformanceReport(days > 0 ? days : 365),
    revenueSummary(days > 0 ? days : "all"),
    eventCountsSince(days > 0 ? days : 365),
  ]);

  // Conversion: succeeded / (succeeded + failed) where meaningful.
  const attempts = revenue.succeededCount + revenue.failedCount;
  const conversion =
    attempts > 0 ? Math.round((revenue.succeededCount / attempts) * 100) : null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-faint">
        Real data from the platform database. Watch-time metrics are not shown — the
        current model stores position/completion, not verified watch time.
      </p>

      {/* Period switch */}
      <div className="mt-6 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/analytics?period=${p.key}`}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase ${
              p.key === active.key
                ? "border-indigo bg-indigo/15 text-electric"
                : "border-edge text-faint hover:border-indigo"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Revenue */}
      <section aria-labelledby="rev-heading" className="mt-8">
        <h2
          id="rev-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Collected payments ({active.label.toLowerCase()}) — currency{" "}
          {revenue.currency}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              v: money(revenue.grossSuccessfulMinor, revenue.currency),
              l: "Gross successful",
            },
            { v: money(revenue.refundedMinor, revenue.currency), l: "Refunded" },
            { v: money(revenue.netMinor, revenue.currency), l: "Net collected" },
            { v: String(revenue.succeededCount), l: "Successful" },
            { v: String(revenue.failedCount), l: "Failed" },
            { v: conversion === null ? "—" : `${conversion}%`, l: "Success rate" },
          ].map((m) => (
            <div key={m.l} className="rounded-md border border-edge bg-surface p-3">
              <p dir="ltr" className="text-lg font-bold tabular-nums">
                {m.v}
              </p>
              <p className="mt-0.5 text-[11px] text-faint">{m.l}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-faint">
          Active subscriptions: {revenue.activeSubscriptions} · Pending payments:{" "}
          {revenue.pendingCount}
          {isFakePayEnabled() ? " · fakepay dev mode active" : ""}
          {" · Not accounting-grade recognition."}
        </p>
      </section>

      {/* Course performance */}
      <section aria-labelledby="perf-heading" className="mt-10">
        <h2
          id="perf-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Course performance ({active.label.toLowerCase()})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-edge">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-raised">
                {[
                  "Course",
                  "Enrolled",
                  "Active",
                  "Avg progress",
                  "Lessons done",
                  "Completed",
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-edge px-3 py-2 text-start font-mono text-[10px] uppercase tracking-widest text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performance.map((row) => (
                <tr key={row.courseId} className="odd:bg-surface even:bg-base">
                  <td className="border-b border-edge px-3 py-2">
                    <Link
                      href={`/admin/courses/${row.courseId}`}
                      className="hover:text-electric"
                    >
                      {row.titleEn}
                    </Link>
                  </td>
                  <td className="border-b border-edge px-3 py-2 tabular-nums">
                    {row.enrollments}
                  </td>
                  <td className="border-b border-edge px-3 py-2 tabular-nums">
                    {row.activeLearners}
                  </td>
                  <td className="border-b border-edge px-3 py-2 tabular-nums">
                    {row.avgProgressPercent}%
                  </td>
                  <td className="border-b border-edge px-3 py-2 tabular-nums">
                    {row.completedLessons}/{row.publishedLessons}
                  </td>
                  <td className="border-b border-edge px-3 py-2 tabular-nums">
                    {row.completedCourseCount}
                  </td>
                </tr>
              ))}
              {performance.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-faint">
                    No courses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[10px] text-faint">
          Avg progress = completed lessons ÷ (enrollments × published lessons). Drop-off
          per lesson requires per-lesson open events — available once student-page
          analytics events accumulate.
        </p>
      </section>

      {/* Event counts */}
      <section aria-labelledby="ev-heading" className="mt-10">
        <h2
          id="ev-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Product events ({active.label.toLowerCase()})
        </h2>
        <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
          {eventCounts.map((e) => (
            <li key={e.eventName} className="flex justify-between px-4 py-2 text-xs">
              <span dir="ltr" className="font-mono text-soft">
                {e.eventName}
              </span>
              <span className="tabular-nums text-faint">{e.count}</span>
            </li>
          ))}
          {eventCounts.length === 0 && (
            <li className="px-4 py-4 text-center text-xs text-faint">
              No events in this window yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
