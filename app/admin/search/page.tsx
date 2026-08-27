import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";

/**
 * Content search + health (Phase 8).
 * All filtering is server-side (indexed queries), never client-side table scans.
 */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "free", label: "FREE" },
  { key: "pro", label: "PRO" },
  { key: "missing-video", label: "Missing video" },
  { key: "missing-ar", label: "Missing Arabic title" },
  { key: "missing-en", label: "Missing English title" },
] as const;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filter)?.key ?? "all";
  const query = q?.trim() ?? "";

  const conditions: Prisma.LessonWhereInput[] = [];
  if (query) {
    conditions.push({
      OR: [
        { titleEn: { contains: query, mode: "insensitive" } },
        { titleAr: { contains: query } },
      ],
    });
  }
  if (activeFilter === "published") conditions.push({ publishState: "PUBLISHED" });
  if (activeFilter === "draft") conditions.push({ publishState: "DRAFT" });
  if (activeFilter === "free") conditions.push({ accessLevel: "FREE" });
  if (activeFilter === "pro") conditions.push({ accessLevel: "PRO" });
  if (activeFilter === "missing-video") {
    conditions.push({ videos: { none: { status: "READY", archivedAt: null } } });
  }
  if (activeFilter === "missing-ar") {
    conditions.push({ titleAr: { equals: "" } });
  }
  if (activeFilter === "missing-en") {
    conditions.push({ titleEn: { equals: "" } });
  }
  const lessonWhere: Prisma.LessonWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const lessons = await db.lesson.findMany({
    where: lessonWhere,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleAr: true,
      accessLevel: true,
      publishState: true,
      type: true,
      durationSeconds: true,
      module: {
        select: { course: { select: { slug: true, titleEn: true } } },
      },
      _count: { select: { videos: true, resources: true } },
    },
  });

  const courses =
    query || ["published", "draft"].includes(activeFilter)
      ? await db.course.findMany({
          where: {
            ...(query
              ? {
                  OR: [
                    { titleEn: { contains: query, mode: "insensitive" as const } },
                    { titleAr: { contains: query } },
                  ],
                }
              : {}),
            ...(activeFilter === "published"
              ? { publishState: "PUBLISHED" as const }
              : {}),
            ...(activeFilter === "draft" ? { publishState: "DRAFT" as const } : {}),
          },
          take: 20,
          select: { id: true, slug: true, titleEn: true, publishState: true },
        })
      : [];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Content search</h1>
      <p className="mt-1 text-sm text-faint">
        Server-side search across courses and lessons with quality filters.
      </p>

      {/* Health quick-links */}
      <div className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
        {[
          ["missing-video", "Missing video"],
          ["missing-ar", "Missing Arabic"],
          ["missing-en", "Missing English"],
          ["draft", "Drafts"],
          ["free", "FREE"],
          ["pro", "PRO"],
        ].map(([key, labelText]) => (
          <Link
            key={key}
            href={`/admin/search?filter=${key}`}
            className={`rounded-sm border px-2 py-1 transition-colors hover:border-indigo ${
              activeFilter === key
                ? "border-indigo text-electric"
                : "border-edge text-faint"
            }`}
          >
            {labelText}
          </Link>
        ))}
      </div>

      <form method="get" className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search titles…"
          aria-label="Search content"
          className="w-72 rounded-sm border border-edge bg-base px-3 py-2 text-sm placeholder:text-faint focus:border-indigo"
        />
        <input type="hidden" name="filter" value={activeFilter} />
        <button
          type="submit"
          className="rounded-sm bg-indigo px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-strong"
        >
          Search
        </button>
      </form>

      {/* Courses */}
      {courses.length > 0 && (
        <section aria-labelledby="cs-heading" className="mt-8">
          <h2
            id="cs-heading"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
          >
            Courses ({courses.length})
          </h2>
          <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <Link
                  href={`/admin/courses/${c.id}`}
                  className="text-sm hover:text-electric"
                >
                  {c.titleEn}
                </Link>
                <span className="font-mono text-[10px] uppercase text-faint">
                  {c.publishState.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lessons */}
      <section aria-labelledby="ls-heading" className="mt-8">
        <h2
          id="ls-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Lessons ({lessons.length})
        </h2>
        <ul className="mt-3 divide-y divide-edge rounded-md border border-edge bg-surface">
          {lessons.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <Link
                href={`/admin/lessons/${l.id}`}
                className="min-w-0 flex-1 truncate text-sm hover:text-electric"
              >
                {l.titleEn}
                <span
                  lang="ar"
                  dir="rtl"
                  className="ms-2 font-arabic text-xs text-violet"
                >
                  {l.titleAr}
                </span>
              </Link>
              <span className="font-mono text-[9px] uppercase text-gold">
                {l.accessLevel.toLowerCase()}
              </span>
              <span
                className={`font-mono text-[9px] uppercase ${l.publishState === "PUBLISHED" ? "text-beginner" : "text-warning"}`}
              >
                {l.publishState.toLowerCase()}
              </span>
              <span dir="ltr" className="font-mono text-[9px] text-faint">
                {l.module.course.titleEn}
              </span>
            </li>
          ))}
          {lessons.length === 0 && (
            <li className="py-6 text-center text-xs text-faint">No matches.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
