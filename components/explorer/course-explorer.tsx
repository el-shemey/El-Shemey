"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { CourseCard } from "@/components/ui/course-card";
import { SearchField } from "@/components/ui/form";
import type { Access, CourseSeed, Level } from "@/lib/courses";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type LevelFilter = "all" | Level;
type AccessFilter = "all" | Access;

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-indigo bg-indigo/15 text-electric shadow-glow"
          : "border-edge text-soft hover:border-edge-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Course explorer island — search + level/access filters over typed seeds.
 * Distinctive by composition: results render as destinations on the map.
 */
export function CourseExplorer({
  locale,
  dict,
  courses,
}: {
  locale: Locale;
  dict: Dictionary;
  courses: CourseSeed[];
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [access, setAccess] = useState<AccessFilter>("all");

  const levels: Array<{ id: Level; label: string }> = [
    { id: "beginner", label: dict.explorer.beginner },
    { id: "intermediate", label: dict.explorer.intermediate },
    { id: "advanced", label: dict.explorer.advanced },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (level !== "all" && c.level !== level) return false;
      if (access !== "all" && c.access !== access) return false;
      if (!q) return true;
      return (
        c.title.en.toLowerCase().includes(q) ||
        c.title.ar.includes(query.trim()) ||
        c.description.en.toLowerCase().includes(q) ||
        c.description.ar.includes(query.trim())
      );
    });
  }, [courses, query, level, access]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-sm">
          <SearchField
            label={dict.explorer.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={dict.explorer.search}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div
            role="group"
            aria-label={dict.explorer.levelLabel}
            className="flex flex-wrap items-center gap-2"
          >
            {
              !(
                level === "all" && (
                  <span className="me-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {dict.explorer.levelLabel}
                  </span>
                )
              )
            }
            <FilterChip
              label={dict.explorer.all}
              active={level === "all"}
              onClick={() => setLevel("all")}
            />
            {levels.map((l) => (
              <FilterChip
                key={l.id}
                label={l.label}
                active={level === l.id}
                onClick={() => setLevel(l.id)}
              />
            ))}
          </div>

          <div
            role="group"
            aria-label={dict.explorer.accessLabel}
            className="flex items-center gap-2"
          >
            <span className="me-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              {dict.explorer.accessLabel}
            </span>
            <FilterChip
              label="FREE"
              active={access === "FREE"}
              onClick={() => setAccess(access === "FREE" ? "all" : "FREE")}
            />
            <FilterChip
              label="PRO"
              active={access === "PRO"}
              onClick={() => setAccess(access === "PRO" ? "all" : "PRO")}
            />
          </div>
        </div>
      </div>

      {/* Results meta */}
      <p
        className="mt-8 border-b border-edge pb-3 font-mono text-xs text-faint"
        role="status"
      >
        {filtered.length} {dict.explorer.resultsSuffix}
      </p>

      {/* Destinations */}
      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard
              key={course.slug}
              href={`/${locale}/courses/${course.slug}`}
              title={course.title[locale]}
              titleAr={course.title.ar}
              description={course.description[locale]}
              level={course.level}
              access={course.access}
              modules={course.modules}
              lessons={course.lessons}
              hours={course.hours}
              progressPercent={course.progressPercent}
              continueLabel={course.progressPercent != null ? undefined : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-md border-2 border-dashed border-edge-strong bg-surface px-6 py-14 text-center">
          <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-soft">
            {dict.explorer.emptyTitle}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-faint">
            {dict.explorer.emptyDesc}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLevel("all");
              setAccess("all");
            }}
            className="mt-6 rounded-sm border-2 border-edge-strong px-5 py-2.5 text-sm font-semibold transition-colors hover:border-indigo hover:bg-hover"
          >
            {dict.explorer.emptyAction}
          </button>
        </div>
      )}
    </div>
  );
}
