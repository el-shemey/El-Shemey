import { cn } from "@/lib/cn";

export type SyllabusRowData = {
  number: string;
  title: string;
  titleAr: string;
  access?: "FREE" | "PRO";
  duration?: string;
  state?: "done" | "current" | "locked";
};

function StateMark({ state }: { state?: SyllabusRowData["state"] }) {
  if (state === "done") {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-beginner shadow-glow">
        <svg
          aria-hidden
          viewBox="0 0 10 8"
          className="size-2.5 fill-none stroke-base stroke-[2]"
        >
          <path d="m1 4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        aria-hidden
        title="Current lesson"
        className="node-live mt-0.5 size-3 shrink-0 rounded-full bg-electric"
      />
    );
  }
  if (state === "locked") {
    return (
      <svg
        aria-label="Locked"
        role="img"
        viewBox="0 0 12 14"
        className="size-3.5 shrink-0 self-center fill-none stroke-faint stroke-[1.4]"
      >
        <rect x="1.5" y="6" width="9" height="7" rx="1" />
        <path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
      </svg>
    );
  }
  return null;
}

/**
 * Course syllabus — a lit learning path through the module nodes.
 * Completed lessons illuminate; the current node pulses softly.
 */
export function SyllabusList({
  rows,
  className,
}: {
  rows: SyllabusRowData[];
  className?: string;
}) {
  return (
    <ol className={cn("divide-y divide-edge border-y border-edge", className)}>
      {rows.map((row) => (
        <li
          key={row.number}
          className="group flex items-baseline gap-3 py-3.5 transition-colors hover:bg-hover/40"
        >
          <StateMark state={row.state} />
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              row.state === "done"
                ? "text-beginner"
                : row.state === "current"
                  ? "text-electric"
                  : "text-faint",
            )}
          >
            {row.number}
          </span>
          <span
            className={cn(
              "text-sm font-medium transition-transform duration-150 ease-settle group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5",
              row.state === "locked" ? "text-faint" : "text-fg",
            )}
          >
            {row.title}
          </span>
          {row.duration && (
            <span className="hidden font-mono text-xs tabular-nums text-faint sm:inline">
              {row.duration}
            </span>
          )}
          <span
            lang="ar"
            dir="rtl"
            className="ms-auto hidden font-arabic text-sm text-soft sm:inline"
          >
            {row.titleAr}
          </span>
          {row.access && (
            <span
              className={cn(
                "shrink-0 -rotate-2 border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest",
                row.access === "FREE"
                  ? "border-beginner/60 text-beginner"
                  : "border-gold/60 text-gold",
              )}
            >
              {row.access}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Compact lesson row for the in-course player sidebar. */
export function LessonRow({
  title,
  duration,
  state,
  active = false,
}: {
  title: string;
  duration: string;
  state: "done" | "current" | "locked";
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      disabled={state === "locked"}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-start text-sm transition-colors",
        active
          ? "bg-indigo/20 font-semibold text-fg"
          : "text-soft hover:bg-hover hover:text-fg",
        state === "locked" && "cursor-not-allowed opacity-50",
      )}
    >
      <StateMark state={state} />
      <span className="flex-1 truncate">{title}</span>
      <span className="font-mono text-xs tabular-nums text-faint">{duration}</span>
    </button>
  );
}
