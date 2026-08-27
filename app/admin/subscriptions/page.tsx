import { db } from "@/lib/server/db";
import { effectiveStatus } from "@/lib/domain/subscriptions";

export default async function AdminSubscriptionsPage() {
  const subs = await db.subscription.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { email: true } },
      plan: {
        select: { nameEn: true, interval: true, amountMinor: true, currency: true },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { providerRef: true, status: true },
      },
    },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
      <p className="mt-1 text-sm text-faint">
        Statuses are server-authoritative; time-expired ACTIVE rows display as EXPIRED.
      </p>

      <ul className="mt-6 divide-y divide-edge border-y border-edge">
        {subs.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
            <div className="min-w-0 flex-1">
              <p dir="ltr" className="truncate text-sm font-medium">
                {s.user.email}
              </p>
              <p className="text-xs text-faint">
                {s.plan.nameEn} · {s.plan.interval.toLowerCase()}ly ·{" "}
                {(s.plan.amountMinor / 100).toFixed(2)} {s.plan.currency}
                {s.payments[0]
                  ? ` · last: ${s.payments[0].providerRef} (${s.payments[0].status})`
                  : ""}
              </p>
            </div>
            {s.currentPeriodEnd && (
              <span className="font-mono text-[11px] tabular-nums text-faint">
                ends {s.currentPeriodEnd.toISOString().slice(0, 10)}
              </span>
            )}
            <span
              className={`w-24 text-center font-mono text-[10px] uppercase ${
                effectiveStatus(s) === "ACTIVE"
                  ? "text-success"
                  : effectiveStatus(s) === "EXPIRED" || s.status === "CANCELLED"
                    ? "text-error"
                    : "text-warning"
              }`}
            >
              {effectiveStatus(s)}
            </span>
          </li>
        ))}
        {subs.length === 0 && (
          <li className="py-8 text-center text-sm text-faint">
            No subscriptions yet — checkout activates once owner-approved pricing is
            set.
          </li>
        )}
      </ul>
    </div>
  );
}
