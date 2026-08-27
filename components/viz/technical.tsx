import { cn } from "@/lib/cn";

/**
 * The technical layer of the EL-SHEMEY universe: coordinate grids,
 * curves, constellations, annotations. Always aria-hidden, always
 * subordinate to content.
 */

/** Panel sitting on the EL-SHEMEY grid. */
export function GridSurface({
  children,
  fine = false,
  dissolve = false,
  className,
}: {
  children?: React.ReactNode;
  fine?: boolean;
  dissolve?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative border border-edge bg-surface",
        fine ? "surface-grid-fine" : "surface-grid",
        dissolve && "grid-dissolve",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Logistic (sigmoid) curve — the shape of learning progress. */
export function SigmoidCurve({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 120"
      fill="none"
      className={cn("text-edge-strong", className)}
    >
      <path
        d="M16 104h192M24 12v100"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      <path
        d="M24 106 C 70 106, 80 100, 96 78 C 112 56, 122 22, 168 18 L 208 17"
        stroke="#6e79ff"
        strokeWidth="1.5"
      />
      <circle cx="96" cy="78" r="3" fill="#56c2ff" />
      <circle cx="96" cy="78" r="6" fill="#56c2ff" opacity="0.25" />
    </svg>
  );
}

/** Neural constellation — a few precise points, not a sci-fi nebula. */
export function Constellation({ className }: { className?: string }) {
  const points: Array<[number, number]> = [
    [20, 70],
    [58, 30],
    [110, 55],
    [150, 18],
    [186, 62],
  ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 210 90"
      fill="none"
      className={cn("text-edge-strong", className)}
    >
      <path
        d="M20 70 58 30l52 25 40-37 36 44"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="1.5 4"
      />
      {points.map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="2.5"
          fill="#12141f"
          stroke="#6e79ff"
          strokeWidth="1.2"
        />
      ))}
      <circle cx="150" cy="18" r="3.5" fill="#56c2ff" />
      <circle cx="150" cy="18" r="7" fill="#56c2ff" opacity="0.2" />
    </svg>
  );
}

/** Coordinate marker like "[fig. 01]" used as an index ornament. */
export function CoordinateTag({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("font-mono text-xs text-faint", className)}>
      [{value}]
    </span>
  );
}

/**
 * The hero environment: layered technical depth — visible coordinate grid,
 * X/Y axes with ticks, faint constellation, one thin sigmoid, coordinate
 * labels, and a neutral vignette for atmosphere. No colored washes: the
 * grid stays recognizable; indigo remains an accent, never a background.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* base coordinate grid */}
      <div className="absolute inset-0 surface-grid" />
      <div className="absolute inset-0 surface-grid-fine opacity-60" />

      {/* axes, ticks, coordinate labels */}
      <svg
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        className="absolute inset-0 h-full w-full"
      >
        <line
          x1="0"
          y1="330"
          x2="800"
          y2="330"
          stroke="rgb(244 247 251 / 0.10)"
          strokeWidth="1"
        />
        <line
          x1="120"
          y1="0"
          x2="120"
          y2="500"
          stroke="rgb(244 247 251 / 0.08)"
          strokeWidth="1"
        />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={`tx-${i}`}
            x1={40 + i * 68}
            y1={327}
            x2={40 + i * 68}
            y2={333}
            stroke="rgb(244 247 251 / 0.22)"
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`ty-${i}`}
            x1={117}
            y1={30 + i * 62}
            x2={123}
            y2={30 + i * 62}
            stroke="rgb(244 247 251 / 0.18)"
          />
        ))}
        <text
          x={132}
          y={344}
          fontSize="9"
          fill="rgb(154 165 180 / 0.5)"
          fontFamily="var(--font-mono)"
        >
          origin
        </text>
        <text
          x={700}
          y={322}
          fontSize="9"
          fill="rgb(154 165 180 / 0.4)"
          fontFamily="var(--font-mono)"
        >
          x →
        </text>
        <text
          x={128}
          y={26}
          fontSize="9"
          fill="rgb(154 165 180 / 0.4)"
          fontFamily="var(--font-mono)"
        >
          y ↑
        </text>

        {/* faint neural connections + tiny nodes */}
        <path
          d="M560 90 l48 -28 52 20 M608 62 l14 66 M622 128 l44 18"
          stroke="rgb(88 114 245 / 0.16)"
          strokeWidth="1"
          strokeDasharray="1.5 4"
        />
        {[
          [560, 90],
          [608, 62],
          [660, 82],
          [622, 128],
          [666, 146],
        ].map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="2"
            fill="#0a0e14"
            stroke="rgb(86 194 255 / 0.4)"
          />
        ))}

        {/* one thin sigmoid, barely there */}
        <path
          d="M40 452 C 150 450, 200 430, 260 380 C 320 332, 350 300, 420 296"
          stroke="rgb(164 135 255 / 0.14)"
          strokeWidth="1"
        />

        {/* corner coordinate labels */}
        <text
          x={24}
          y={472}
          fontSize="9"
          fill="rgb(95 107 125 / 0.7)"
          fontFamily="var(--font-mono)"
        >
          00 · 00
        </text>
        <text
          x={736}
          y={40}
          fontSize="9"
          fill="rgb(95 107 125 / 0.55)"
          fontFamily="var(--font-mono)"
        >
          12 · 07
        </text>
      </svg>

      {/* atmospheric depth vignette — darkness at the edges, never color */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 38%, transparent 40%, rgb(2 3 6 / 0.55) 100%)",
        }}
      />
    </div>
  );
}
