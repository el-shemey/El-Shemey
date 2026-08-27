import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/server/db";
import {
  changeUserRoleAction,
  deleteUserAction,
  revokeSessionsAction,
} from "@/features/admin/actions";
import { ConfirmSubmit } from "@/features/admin/forms";

/**
 * User detail (Phase 9): identity, verification, enrollments + progress
 * summary, payments, subscriptions, recent audit events — and the two
 * privileged mutations (revoke sessions / change role), each audited.
 * No passwords, OTPs, tokens or payment credentials are ever displayed.
 */

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      role: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      sessionVersion: true,
      enrollments: {
        include: {
          course: { select: { titleEn: true, slug: true } },
          progress: {
            where: { completedAt: { not: null } },
            select: { lessonId: true },
          },
        },
        orderBy: { lastActiveAt: "desc" },
        take: 20,
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          method: true,
          status: true,
          amountMinor: true,
          currency: true,
          createdAt: true,
        },
      },
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
          plan: { select: { nameEn: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const auditRows = await db.auditLog.findMany({
    where: { OR: [{ actorId: user.id }, { entityType: "User", entityId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <div className="max-w-3xl">
      <Link href="/admin/users" className="text-xs text-faint hover:text-electric">
        ← Users
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-6">
        <div>
          <h1 dir="ltr" className="truncate text-2xl font-bold tracking-tight">
            {user.name ?? user.email ?? user.phone ?? user.id}
          </h1>
          <p dir="ltr" className="font-mono text-[11px] text-faint">
            {user.email ?? "—"} · joined {user.createdAt.toISOString().slice(0, 10)} ·{" "}
            <span className={user.role === "ADMIN" ? "text-gold" : ""}>
              {user.role.toLowerCase()}
            </span>{" "}
            ·{" "}
            <span className={user.emailVerified ? "text-beginner" : "text-warning"}>
              {user.emailVerified ? "verified" : "unverified"}
            </span>
          </p>
        </div>

        {/* Privileged mutations */}
        <div className="flex flex-col items-end gap-2">
          <form action={revokeSessionsAction.bind(null, user.id)}>
            <ConfirmSubmit
              label="Revoke all sessions"
              message={`Force-sign-out ${user.email ?? "this user"} on every device?`}
              className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-warning hover:text-warning"
            />
          </form>
          <form
            action={changeUserRoleAction.bind(
              null,
              user.id,
              user.role === "ADMIN" ? "USER" : "ADMIN",
            )}
          >
            <ConfirmSubmit
              label={user.role === "ADMIN" ? "Demote to USER" : "Promote to ADMIN"}
              message={
                user.role === "ADMIN"
                  ? `Remove admin rights from ${user.email ?? "this user"}? They will be signed out.`
                  : `Grant ADMIN (full platform control) to ${user.email ?? "this user"}?`
              }
              className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold text-faint hover:border-error hover:text-error"
            />
          </form>
          {user.role !== "ADMIN" && (
            <form action={deleteUserAction.bind(null, user.id)}>
              <ConfirmSubmit
                label="Delete account (GDPR)"
                message={`Permanently delete ${user.email ?? "this user"}: removes profile, enrollments and progress. Payment & audit records are retained per policy. IRREVERSIBLE.`}
                className="rounded-sm border border-error/50 px-3 py-1.5 text-xs font-semibold text-error"
              />
            </form>
          )}
        </div>
      </header>

      {/* Enrollments & progress */}
      <section aria-labelledby="enr-heading" className="mt-8">
        <h2
          id="enr-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Enrollments ({user.enrollments.length})
        </h2>
        <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
          {user.enrollments.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-xs"
            >
              <span>{e.course.titleEn}</span>
              <span className="tabular-nums text-faint">
                {e.progress.length} lessons completed
              </span>
              <span className="font-mono text-faint">
                {e.lastActiveAt.toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
          {user.enrollments.length === 0 && (
            <li className="px-4 py-3 text-xs text-faint">No enrollments.</li>
          )}
        </ul>
      </section>

      {/* Payments + subscriptions */}
      <section aria-labelledby="pay-heading" className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2
            id="pay-heading"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
          >
            Payments
          </h2>
          <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
            {user.payments.map((p) => (
              <li key={p.id} className="flex justify-between px-4 py-2 text-xs">
                <span className="font-mono">{p.method}</span>
                <span dir="ltr" className="tabular-nums">
                  {(p.amountMinor / 100).toFixed(2)} {p.currency}
                </span>
                <span
                  className={
                    p.status === "SUCCEEDED"
                      ? "text-success"
                      : p.status === "FAILED"
                        ? "text-error"
                        : "text-warning"
                  }
                >
                  {p.status.toLowerCase()}
                </span>
              </li>
            ))}
            {user.payments.length === 0 && (
              <li className="px-4 py-3 text-xs text-faint">No payments.</li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Subscriptions
          </h2>
          <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
            {user.subscriptions.map((s) => (
              <li key={s.id} className="flex justify-between px-4 py-2 text-xs">
                <span>{s.plan.nameEn}</span>
                <span className={s.status === "ACTIVE" ? "text-success" : "text-faint"}>
                  {s.status.toLowerCase()}
                </span>
              </li>
            ))}
            {user.subscriptions.length === 0 && (
              <li className="px-4 py-3 text-xs text-faint">No subscriptions.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Recent audit */}
      <section aria-labelledby="aud-heading" className="mt-8">
        <h2
          id="aud-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Recent related events
        </h2>
        <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface font-mono text-[11px]">
          {auditRows.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
              <span className="text-soft">{a.action}</span>
              <span className="text-faint">
                {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </li>
          ))}
          {auditRows.length === 0 && (
            <li className="px-4 py-3 text-faint">No related events.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
