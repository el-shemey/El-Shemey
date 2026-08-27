import Link from "next/link";
import { cn } from "@/lib/cn";
import { AccessStamp, LevelBadge, Level } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";

export type CourseCardProps = {
  href?: string;
  title: string;
  titleAr: string;
  description: string;
  level: Level;
  access?: "FREE" | "PRO";
  modules: number;
  lessons: number;
  hours: number;
  progressPercent?: number;
  continueLabel?: string;
};

const levelEdge: Record<Level, string> = {
  beginner: "hover:border-beginner/60",
  intermediate: "hover:border-intermediate/60",
  advanced: "hover:border-advanced/60",
};

/**
 * A destination in the EL-SHEMEY universe.
 * Dark layered surface; level color appears only as a thin light line.
 */
export function CourseCard({
  href = "#",
  title,
  titleAr,
  description,
  level,
  access,
  modules,
  lessons,
  hours,
  progressPercent,
  continueLabel,
}: CourseCardProps) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-md border border-edge bg-surface p-5 shadow-card transition-[border-color,transform,box-shadow] duration-200 ease-settle hover:-translate-y-1 hover:shadow-lift",
        levelEdge[level],
      )}
    >
      {/* level light-line */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-px opacity-40 transition-opacity duration-200 group-hover:opacity-100",
          level === "beginner" && "bg-beginner",
          level === "intermediate" && "bg-intermediate",
          level === "advanced" && "bg-advanced",
        )}
      />
      {access && <AccessStamp kind={access} floating />}

      <div className="flex items-center justify-between border-b border-edge pb-3">
        <LevelBadge level={level} />
        {typeof progressPercent === "number" && (
          <span className="font-mono text-[11px] tabular-nums text-soft">
            {progressPercent}%
          </span>
        )}
      </div>

      <h4 className="mt-4 text-xl font-bold tracking-tight">{title}</h4>
      <p lang="ar" dir="rtl" className="mt-1 text-right font-arabic text-sm text-soft">
        {titleAr}
      </p>
      <p className="mt-3 min-h-10 text-sm leading-relaxed text-soft">{description}</p>
      <p className="mt-4 border-t border-edge pt-3 font-mono text-xs tabular-nums text-faint">
        {modules} modules · {lessons} lessons · ~{hours}h
      </p>

      {typeof progressPercent === "number" && (
        <ProgressBar
          value={progressPercent}
          label={`${title} progress`}
          className="mt-4"
          size="sm"
        />
      )}

      <Link
        href={href}
        className="mt-4 inline-block text-sm font-semibold text-fg underline decoration-electric decoration-2 underline-offset-4 transition-colors hover:text-electric"
      >
        {continueLabel ?? (access === "PRO" ? "See syllabus" : "Start course")} →
      </Link>
    </article>
  );
}
