import Link from "next/link";
import { db } from "@/lib/server/db";
import { confirmManualPaymentAction } from "@/features/admin/actions";

const STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] as const;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; method?: string }>;
}) {
  const { status, method } = await searchParams;
  const payments = await db.payment.findMany({
    where: {
      ...(status ? { status: status as (typeof STATUSES)[number] } : {}),
      ...(method
        ? { method: method as "CARD" | "VODAFONE_CASH" | "FAWRY" | "INSTAPAY" }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      subscription: { select: { planId: true } },
    },
    take: 100,
  });

  const [total, succeeded, pending, failed, refunded, activeSubscriptions] =
    await db.$transaction([
      db.payment.count(),
      db.payment.count({ where: { status: "SUCCEEDED" } }),
      db.payment.count({ where: { status: "PENDING" } }),
      db.payment.count({ where: { status: "FAILED" } }),
      db.payment.count({ where: { status: "REFUNDED" } }),
      db.subscription.count({
        where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      }),
    ]);
  const stats = { total, succeeded, pending, failed, refunded, activeSubscriptions };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Billing overview</h1>

      {/* Live totals — derived from the database, nothing cached */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total payments", value: stats.total },
          { label: "Succeeded", value: stats.succeeded, tone: "text-success" },
          { label: "Pending", value: stats.pending, tone: "text-warning" },
          { label: "Failed", value: stats.failed, tone: "text-error" },
          { label: "Refunded", value: stats.refunded, tone: "text-faint" },
          {
            label: "Active subs",
            value: stats.activeSubscriptions,
            tone: "text-electric",
          },
        ].map((m) => (
          <div key={m.label} className="rounded-md border border-edge bg-surface p-3">
            <p className={`text-xl font-bold tabular-nums ${m.tone ?? ""}`}>
              {m.value}
            </p>
            <p className="mt-0.5 text-[11px] text-faint">{m.label}</p>
          </div>
        ))}
      </div>

      <form className="mt-6 flex flex-wrap gap-2">
        {["", ...STATUSES].map((s) => (
          <button
            key={s || "all"}
            name="status"
            value={s}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase ${
              (status ?? "") === s
                ? "border-indigo bg-indigo/15 text-electric"
                : "border-edge text-faint"
            }`}
          >
            {s || "ALL"}
          </button>
        ))}
      </form>

      <ul className="mt-6 divide-y divide-edge border-y border-edge">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
            <div className="min-w-0 flex-1">
              <p dir="ltr" className="truncate font-mono text-xs">
                {p.provider}/{p.method} · {p.providerRef}
              </p>
              <p className="text-xs text-faint">
                {p.user?.email ?? "—"} ·{" "}
                {new Date(p.createdAt).toISOString().slice(0, 16).replace("T", " ")}
              </p>
            </div>
            <span className="font-mono text-sm tabular-nums">
              {(p.amountMinor / 100).toFixed(2)} {p.currency}
            </span>
            <span
              className={`w-24 text-center font-mono text-[10px] uppercase ${
                p.status === "SUCCEEDED"
                  ? "text-success"
                  : p.status === "FAILED"
                    ? "text-error"
                    : "text-warning"
              }`}
            >
              {p.status}
            </span>
            {p.provider === "manual" && p.status === "PENDING" && (
              <form action={confirmManualPaymentAction.bind(null, p.id)}>
                <button
                  type="submit"
                  className="rounded-sm bg-indigo px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-strong"
                >
                  Confirm received
                </button>
              </form>
            )}
          </li>
        ))}
        {payments.length === 0 && (
          <li className="py-8 text-center text-sm text-faint">No payments yet.</li>
        )}
      </ul>
      <Link
        href="/admin/refunds"
        className="mt-6 inline-block text-sm font-semibold underline decoration-electric underline-offset-4"
      >
        Refund management →
      </Link>
    </div>
  );
}
