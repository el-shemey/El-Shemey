import { cn } from "@/lib/cn";

export type Level = "beginner" | "intermediate" | "advanced";

const levelStyles: Record<Level, { en: string; ar: string; className: string }> = {
  beginner: {
    en: "Beginner",
    ar: "مبتدئ",
    className: "border-beginner/50 text-beginner",
  },
  intermediate: {
    en: "Intermediate",
    ar: "متوسط",
    className: "border-intermediate/50 text-intermediate",
  },
  advanced: {
    en: "Advanced",
    ar: "متقدم",
    className: "border-advanced/50 text-advanced",
  },
};

/** Level badge — small accent coding, never a full card recolor. */
export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  const l = levelStyles[level];
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 border bg-base/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        l.className,
        className,
      )}
    >
      {l.en}
      <span lang="ar" dir="rtl" className="font-arabic tracking-normal">
        · {l.ar}
      </span>
    </span>
  );
}

/** FREE / PRO access stamp — tilted, like a mark stamped onto the world. */
export function AccessStamp({
  kind,
  floating = false,
  className,
}: {
  kind: "FREE" | "PRO";
  floating?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block border-2 bg-base px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] -rotate-2",
        kind === "FREE"
          ? "border-beginner/60 text-beginner"
          : "border-gold/60 text-gold",
        floating && "absolute top-3 end-4",
        className,
      )}
    >
      {kind}
    </span>
  );
}

/** Neutral tag/chip for topics and metadata. */
export function Chip({
  children,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-edge-strong bg-raised px-2.5 py-1 text-xs text-soft",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tag"
          className="-me-1 grid size-4 place-items-center rounded-full text-faint transition-colors hover:bg-hover hover:text-fg"
        >
          <svg aria-hidden viewBox="0 0 8 8" className="size-2 fill-current">
            <path d="M1.4 0 4 2.6 6.6 0 8 1.4 5.4 4 8 6.6 6.6 8 4 5.4 1.4 8 0 6.6 2.6 4 0 1.4Z" />
          </svg>
        </button>
      )}
    </span>
  );
}
