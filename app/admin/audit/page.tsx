import { db } from "@/lib/server/db";

/**
 * Audit log viewer (Phase 9).
 * Filters: action substring, actor id, entity type, date range. Paginated,
 * newest first. Metadata rendered as escaped text (never HTML).
 */

function safeDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    actor?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const pageNum = Math.max(1, Math.min(Number(sp.page) || 1, 500));
  const pageSize = 100;

  const conditions = [];
  if (sp.q) conditions.push({ action: { contains: sp.q } });
  if (sp.actor)
    conditions.push({ OR: [{ actorId: sp.actor }, { entityId: sp.actor }] });
  if (sp.entity) conditions.push({ entityType: sp.entity });
  const from = safeDate(sp.from);
  if (from) conditions.push({ createdAt: { gte: from } });
  const to = safeDate(sp.to);
  if (to) conditions.push({ createdAt: { lte: to } });

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const qs = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) {
      if (v) params.set(k, v);
    }
    return `/admin/audit?${params.toString()}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-faint">
        Append-only security &amp; administrative history. Metadata is displayed as
        plain text — never executable.
      </p>

      <form
        method="get"
        className="mt-6 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
      >
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Action contains…"
          aria-label="Filter by action"
          dir="ltr"
          className="rounded-sm border border-edge bg-base px-3 py-2 text-sm focus:border-indigo"
        />
        <input
          name="actor"
          defaultValue={sp.actor}
          placeholder="Actor or entity ID"
          aria-label="Filter by actor or entity"
          dir="ltr"
          className="rounded-sm border border-edge bg-base px-3 py-2 font-mono text-xs focus:border-indigo"
        />
        <input
          name="entity"
          defaultValue={sp.entity}
          placeholder="Entity type (User/Payment…)"
          aria-label="Filter by entity type"
          dir="ltr"
          className="rounded-sm border border-edge bg-base px-3 py-2 text-sm focus:border-indigo"
        />
        <input
          name="from"
          type="date"
          defaultValue={sp.from}
          aria-label="From date"
          className="rounded-sm border border-edge bg-base px-3 py-2 text-xs focus:border-indigo"
        />
        <input
          name="to"
          type="date"
          defaultValue={sp.to}
          aria-label="To date"
          className="rounded-sm border border-edge bg-base px-3 py-2 text-xs focus:border-indigo"
        />
        <button
          type="submit"
          className="rounded-sm bg-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-strong sm:col-span-5"
        >
          Apply filters
        </button>
      </form>

      <p
        className="mt-4 border-b border-edge pb-2 font-mono text-xs text-faint"
        role="status"
      >
        {total} event(s) · page {pageNum}/{totalPages}
      </p>

      <ul className="divide-y divide-edge rounded-md border border-edge bg-surface font-mono text-[11px]">
        {rows.map((a) => {
          const meta = a.metadata ? JSON.stringify(a.metadata) : null;
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <span className="font-semibold text-fg">{a.action}</span>
              <span dir="ltr" className="text-faint">
                {a.entityType}
                {a.entityId ? `#${a.entityId.slice(-8)}` : ""}
              </span>
              {meta && (
                <span dir="ltr" className="w-full truncate text-faint" title={meta}>
                  {meta}
                </span>
              )}
              <span className="ms-auto text-faint">{a.actor?.email ?? "system"}</span>
              <span className="tabular-nums text-faint">
                {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="py-8 text-center text-sm text-faint">No events match.</li>
        )}
      </ul>

      <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
        {pageNum > 1 ? (
          <a
            href={qs({ page: String(pageNum - 1) })}
            className="text-xs font-semibold text-soft hover:text-electric"
          >
            ← Newer
          </a>
        ) : (
          <span />
        )}
        {pageNum < totalPages && (
          <a
            href={qs({ page: String(pageNum + 1) })}
            className="text-xs font-semibold text-soft hover:text-electric"
          >
            Older →
          </a>
        )}
      </nav>
    </div>
  );
}
