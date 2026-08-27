import { cn } from "@/lib/cn";

/** Thin progress bar — indigo→violet light filling a dark track. */
export function ProgressBar({
  value,
  label = "Progress",
  size = "md",
  showValue = false,
  className,
}: {
  value: number;
  label?: string;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn(
          "w-full overflow-hidden rounded-full bg-hover",
          size === "sm" ? "h-0.5" : "h-1",
        )}
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-indigo to-violet shadow-glow transition-[width] duration-500 ease-settle"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && (
        <span className="shrink-0 font-mono text-xs tabular-nums text-soft">
          {clamped}%
        </span>
      )}
    </div>
  );
}

/** Circular progress ring — a small illuminated node of completion. */
export function ProgressRing({
  value,
  size = 56,
  label = "Progress",
  className,
}: {
  value: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
    >
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-hover"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * clamped) / 100} ${c}`}
          className="stroke-electric transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="absolute font-mono text-sm font-semibold tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}
