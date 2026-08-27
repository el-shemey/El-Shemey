import { db } from "@/lib/server/db";
import { approveRefundAction, rejectRefundAction } from "@/features/admin/actions";

const STATUSES = ["PENDING", "PROCESSED", "REJECTED", "FAILED"] as const;

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const refunds = await db.refund.findMany({
    where: status ? { status: status as (typeof STATUSES)[number] } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      payment: { include: { user: { select: { email: true } } } },
      admin: { select: { email: true } },
    },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Refunds</h1>
      <p className="mt-1 max-w-prose text-sm text-faint">
        Single-admin approval policy. Approval refunds the payment record, cancels the
        linked subscription and writes an audit entry.
      </p>

      <form className="mt-4 flex flex-wrap gap-2">
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

      <ul className="mt-6 space-y-3">
        {refunds.map((r) => (
          <li key={r.id} className="rounded-md border border-edge bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium tabular-nums">
                  {(r.amountMinor / 100).toFixed(2)} {r.currency}
                </p>
                <p dir="ltr" className="font-mono text-[11px] text-faint">
                  payment {r.paymentId.slice(-8)} · {r.payment.user?.email ?? "—"} · ref{" "}
                  {r.payment.providerRef}
                </p>
                <p className="mt-1 text-xs text-soft">Reason: {r.reason}</p>
                <p className="font-mono text-[10px] text-faint">
                  requested {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  {r.admin ? ` · actor ${r.admin.email}` : ""}
                </p>
              </div>
              <span
                className={`font-mono text-[10px] uppercase ${r.status === "PENDING" ? "text-warning" : r.status === "PROCESSED" ? "text-success" : "text-error"}`}
              >
                {r.status}
              </span>
              {r.status === "PENDING" && (
                <div className="flex gap-2">
                  <form action={approveRefundAction.bind(null, r.id)}>
                    <button
                      type="submit"
                      className="rounded-sm bg-indigo px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-strong"
                    >
                      Approve refund
                    </button>
                  </form>
                  <form
                    action={rejectRefundAction.bind(
                      null,
                      r.id,
                      "Rejected from admin panel",
                    )}
                  >
                    <button
                      type="submit"
                      className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-error hover:text-error"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </div>
          </li>
        ))}
        {refunds.length === 0 && (
          <li className="py-8 text-center text-sm text-faint">No refunds recorded.</li>
        )}
      </ul>
    </div>
  );
}
