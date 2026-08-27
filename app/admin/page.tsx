import Link from "next/link";
import { db } from "@/lib/server/db";

/** Module-scope helper so the render body stays pure for the compiler. */
function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 86_400_000);
}

function Metric({
  value,
  label,
  tone = "",
  href,
}: {
  value: number | string;
  label: string;
  tone?: string;
  href?: string;
}) {
  const inner = (
    <div className="h-full rounded-md border border-edge bg-surface p-4 transition-colors hover:border-indigo/60">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-faint">{label}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * Command center (Phase 9): WHO is learning, WHAT performs, HOW payments run,
 * WHAT needs attention — all derived live from database state.
 */
export default async function AdminOverview() {
  const weekAgo = sevenDaysAgo();

  const [
    users,
    newUsers7d,
    verifiedUsers,
    admins,
    activeSubs,
    cancelledSubs,
    pendingPayments,
    failedPayments,
    refundedPayments,
    succeededPayments,
    refundsPending,
    totalCourses,
    publishedCourses,
    totalLessons,
    publishedLessons,
    lessonCompletions,
    videosProcessing,
    videosFailed,
    recentEnrollments,
    recentRegistrations,
  ] = await Promise.all([
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { role: "USER", createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { emailVerified: { not: null }, role: "USER" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({ where: { status: "CANCELLED" } }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.payment.count({ where: { status: "FAILED" } }),
    db.payment.count({ where: { status: "REFUNDED" } }),
    db.payment.count({ where: { status: "SUCCEEDED" } }),
    db.refund.count({ where: { status: "PENDING" } }),
    db.course.count(),
    db.course.count({ where: { publishState: "PUBLISHED" } }),
    db.lesson.count(),
    db.lesson.count({ where: { publishState: "PUBLISHED" } }),
    db.lessonProgress.count({ where: { completedAt: { not: null } } }),
    db.videoAsset.count({ where: { status: "PROCESSING" } }),
    db.videoAsset.count({ where: { status: "FAILED" } }),
    db.enrollment.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        user: { select: { email: true } },
        course: { select: { titleEn: true } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { email: true, createdAt: true },
    }),
  ]);

  const unverified = users - verifiedUsers;

  const attention: Array<{ label: string; href: string }> = [];
  if (failedPayments > 0)
    attention.push({
      label: `${failedPayments} failed payment(s)`,
      href: "/admin/payments?status=FAILED",
    });
  if (refundsPending > 0)
    attention.push({
      label: `${refundsPending} refund(s) awaiting action`,
      href: "/admin/refunds",
    });
  if (videosFailed > 0)
    attention.push({
      label: `${videosFailed} failed video(s)`,
      href: "/admin/media?status=FAILED",
    });
  if (videosProcessing > 0)
    attention.push({
      label: `${videosProcessing} video(s) processing`,
      href: "/admin/media?status=PROCESSING",
    });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Command center</h1>
      <p className="mt-1 text-sm text-faint">
        Live operational state — derived from the database, nothing cached. Deep dives:{" "}
        <Link
          href="/admin/analytics"
          className="underline decoration-electric underline-offset-4 hover:text-electric"
        >
          Analytics
        </Link>
        {" · "}
        <Link
          href="/admin/content-health"
          className="underline decoration-electric underline-offset-4 hover:text-electric"
        >
          Content health
        </Link>
        {" · "}
        <Link
          href="/admin/system"
          className="underline decoration-electric underline-offset-4 hover:text-electric"
        >
          System
        </Link>
      </p>

      {/* Quick actions */}
      <section aria-labelledby="quick-heading" className="mt-8">
        <h2
          id="quick-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/courses#new-course"
            className="rounded-sm bg-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-strong"
          >
            + New course
          </Link>
          <Link
            href="/admin/courses"
            className="rounded-sm border border-edge-strong px-4 py-2 text-sm font-semibold hover:border-indigo"
          >
            + New lesson
          </Link>
          <Link
            href="/admin/media"
            className="rounded-sm border border-edge-strong px-4 py-2 text-sm font-semibold hover:border-indigo"
          >
            ⬆ Upload media
          </Link>
        </div>
      </section>

      {/* Needs attention */}
      <section aria-labelledby="attention-heading" className="mt-8">
        <h2
          id="attention-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="mt-3 rounded-sm border border-success/40 bg-surface px-4 py-3 text-sm">
            ✓ Nothing needs your action right now.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-sm border border-warning/50 bg-surface px-4 py-3 text-sm transition-colors hover:border-warning"
                >
                  ⚠ {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* USERS */}
      <section aria-labelledby="users-heading" className="mt-10">
        <h2
          id="users-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Users
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric value={users} label="Students" href="/admin/users" />
          <Metric
            value={`+${newUsers7d}`}
            label="New (7 days)"
            href="/admin/users"
            tone="text-electric"
          />
          <Metric
            value={verifiedUsers}
            label="Verified"
            href="/admin/users?filter=verified"
            tone="text-beginner"
          />
          <Metric
            value={unverified}
            label="Unverified"
            href="/admin/users?filter=unverified"
            tone="text-warning"
          />
          <Metric value={admins} label="Admins" href="/admin/users?filter=admins" />
        </div>
        {recentRegistrations.length > 0 && (
          <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface font-mono text-[11px]">
            {recentRegistrations.map((u) => (
              <li key={u.email ?? ""} className="flex justify-between px-4 py-2">
                <span dir="ltr">{u.email}</span>
                <span className="text-faint">
                  {u.createdAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* LEARNING */}
      <section aria-labelledby="learn-heading" className="mt-10">
        <h2
          id="learn-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Learning
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric
            value={`${publishedCourses}/${totalCourses}`}
            label="Published courses"
            href="/admin/courses"
          />
          <Metric
            value={`${publishedLessons}/${totalLessons}`}
            label="Published lessons"
            href="/admin/search?filter=published"
          />
          <Metric
            value={lessonCompletions}
            label="Lesson completions"
            tone="text-beginner"
            href="/admin/analytics"
          />
          <Metric
            value={activeSubs}
            label="Active subscriptions"
            href="/admin/subscriptions"
          />
        </div>
        {recentEnrollments.length > 0 && (
          <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
            {recentEnrollments.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap justify-between gap-2 px-4 py-2 text-xs"
              >
                <span dir="ltr" className="font-mono text-faint">
                  {e.user.email}
                </span>
                <span className="text-soft">{e.course.titleEn}</span>
                <span className="text-faint">
                  {e.startedAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PAYMENTS */}
      <section aria-labelledby="pay-heading" className="mt-10">
        <h2
          id="pay-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Payments
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            value={pendingPayments}
            label="Pending"
            href="/admin/payments?status=PENDING"
            tone="text-warning"
          />
          <Metric
            value={succeededPayments}
            label="Successful"
            href="/admin/payments?status=SUCCEEDED"
            tone="text-beginner"
          />
          <Metric
            value={failedPayments}
            label="Failed"
            href="/admin/payments?status=FAILED"
            tone="text-error"
          />
          <Metric
            value={refundedPayments}
            label="Refunded"
            href="/admin/payments?status=REFUNDED"
          />
          <Metric
            value={activeSubs}
            label="Active subs"
            href="/admin/subscriptions"
            tone="text-electric"
          />
          <Metric
            value={cancelledSubs}
            label="Cancelled subs"
            href="/admin/subscriptions"
          />
        </div>
      </section>

      <p className="mt-10 font-mono text-[11px] text-faint">
        Revenue detail lives in Analytics — integer minor-unit arithmetic with explicit
        currency.
      </p>
    </div>
  );
}
