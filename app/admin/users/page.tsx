import Link from "next/link";
import { db } from "@/lib/server/db";

/**
 * Admin Users (Phase 9): searchable, filterable list with links to the
 * per-user detail. No sensitive fields are ever selected.
 */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "admins", label: "Admins" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Unverified" },
  { key: "subscribed", label: "Subscribed" },
  { key: "enrolled", label: "Enrolled" },
] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const { q, filter, page } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filter)?.key ?? "all";
  const query = q?.trim().toLowerCase() ?? "";
  const pageNum = Math.max(1, Math.min(Number(page) || 1, 500));
  const pageSize = 50;

  const conditions = [];
  if (query) conditions.push({ email: { contains: query } });
  if (activeFilter === "admins") conditions.push({ role: "ADMIN" as const });
  if (activeFilter === "verified") conditions.push({ emailVerified: { not: null } });
  if (activeFilter === "unverified") conditions.push({ emailVerified: null });
  if (activeFilter === "subscribed") {
    conditions.push({ subscriptions: { some: { status: "ACTIVE" as const } } });
  }
  if (activeFilter === "enrolled") {
    conditions.push({ enrollments: { some: {} } });
  }
  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { enrollments: true, subscriptions: true, payments: true } },
      },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-faint">
        Password hashes, OTPs, session tokens and payment credentials are never
        displayed.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by email…"
          aria-label="Search users"
          dir="ltr"
          className="w-64 rounded-sm border border-edge bg-base px-3 py-2 text-sm focus:border-indigo"
        />
        <input type="hidden" name="filter" value={activeFilter} />
        <button
          type="submit"
          className="rounded-sm bg-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-strong"
        >
          Search
        </button>
        <div className="ms-auto flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/users?filter=${f.key}`}
              className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase ${
                activeFilter === f.key
                  ? "border-indigo text-electric"
                  : "border-edge text-faint hover:border-indigo"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      <p
        className="mt-4 border-b border-edge pb-2 font-mono text-xs text-faint"
        role="status"
      >
        {total} user(s){query ? ` matching "${query}"` : ""} · page {pageNum}/
        {totalPages}
      </p>

      <ul className="divide-y divide-edge">
        {users.map((u) => (
          <li key={u.id}>
            <Link
              href={`/admin/users/${u.id}`}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 py-3 transition-colors hover:bg-hover/40"
            >
              <span dir="ltr" className="min-w-0 flex-1 truncate text-sm font-medium">
                {u.email ?? u.phone ?? u.id}
              </span>
              <span
                className={`font-mono text-[10px] uppercase ${u.emailVerified ? "text-beginner" : "text-warning"}`}
              >
                {u.emailVerified ? "verified" : "unverified"}
              </span>
              {u.role === "ADMIN" && (
                <span className="border border-gold/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-gold">
                  admin
                </span>
              )}
              <span className="font-mono text-[11px] tabular-nums text-faint">
                {u._count.enrollments} enr · {u._count.payments} pay
              </span>
              <span className="font-mono text-[11px] tabular-nums text-faint">
                {u.createdAt.toISOString().slice(0, 10)}
              </span>
            </Link>
          </li>
        ))}
        {users.length === 0 && (
          <li className="py-8 text-center text-sm text-faint">No users match.</li>
        )}
      </ul>

      {/* Pagination */}
      <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
        {pageNum > 1 ? (
          <Link
            href={`/admin/users?q=${encodeURIComponent(query)}&filter=${activeFilter}&page=${pageNum - 1}`}
            className="text-xs font-semibold text-soft hover:text-electric"
          >
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {pageNum < totalPages && (
          <Link
            href={`/admin/users?q=${encodeURIComponent(query)}&filter=${activeFilter}&page=${pageNum + 1}`}
            className="text-xs font-semibold text-soft hover:text-electric"
          >
            Older →
          </Link>
        )}
      </nav>
    </div>
  );
}
