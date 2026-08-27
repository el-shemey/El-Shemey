import { cn } from "@/lib/cn";

/**
 * SHIMMY (شيمي) — the EL-SHEMEY character.
 *
 * A living prompt sprite: a rounded prompt-block body with a speech tail,
 * expressive glowing eyes, stubby floating hands. Not a robot head — a
 * small creature made of language that lives on the grid.
 *
 * Used sparingly: hero, empty states, featured course, success moments.
 */

type Mood = "happy" | "thinking" | "sleepy" | "celebrate";

function Eyes({ mood }: { mood: Mood }) {
  if (mood === "sleepy") {
    return (
      <g
        stroke="#56c2ff"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        className="opacity-90"
      >
        <path d="M61 58q7 6 14 0" />
        <path d="M85 58q7 6 14 0" />
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g className="shimmy-blink">
        {/* looking up-left toward an idea */}
        <ellipse cx="65" cy="55" rx="4" ry="5.5" fill="#9be4ff" />
        <ellipse cx="89" cy="55" rx="4" ry="5.5" fill="#9be4ff" />
        <circle cx="63" cy="52" r="1.6" fill="#0b0d16" />
        <circle cx="87" cy="52" r="1.6" fill="#0b0d16" />
      </g>
    );
  }
  // happy / celebrate
  return (
    <g className="shimmy-blink">
      <ellipse cx="66" cy="57" rx="4" ry="6" fill="#9be4ff" />
      <ellipse cx="90" cy="57" rx="4" ry="6" fill="#9be4ff" />
      <circle cx="67.5" cy="54.5" r="1.5" fill="#ffffff" opacity="0.9" />
      <circle cx="91.5" cy="54.5" r="1.5" fill="#ffffff" opacity="0.9" />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === "sleepy") {
    return (
      <path
        d="M74 76h12"
        stroke="#a7abc8"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (mood === "thinking") {
    return (
      <path
        d="M75 75h9"
        stroke="#a7abc8"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  // a little ">" smile — the prompt is happy
  return (
    <path
      d="M71 73l7 5 7-5"
      stroke="#a7abc8"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

function Arms({ mood }: { mood: Mood }) {
  const hand = "#c9cdf1";
  if (mood === "celebrate") {
    return (
      <g stroke={hand} strokeWidth="5" strokeLinecap="round">
        <path d="M42 60 L26 38" />
        <path d="M118 60 L134 38" />
      </g>
    );
  }
  if (mood === "sleepy") {
    return (
      <g stroke={hand} strokeWidth="5" strokeLinecap="round" opacity="0.8">
        <path d="M42 70 L28 82" />
        <path d="M118 70 L132 84" />
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g stroke={hand} strokeWidth="5" strokeLinecap="round">
        <path d="M42 70 L28 80" />
        {/* hand on chin */}
        <path d="M118 68 L104 76" />
      </g>
    );
  }
  return (
    <g stroke={hand} strokeWidth="5" strokeLinecap="round">
      <path d="M42 68 L27 79" />
      <path d="M118 66 L133 55" />
    </g>
  );
}

export function Shimmy({
  mood = "happy",
  size = 160,
  className,
}: {
  mood?: Mood;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 140"
      width={size}
      height={(size * 140) / 160}
      role="img"
      aria-label={
        mood === "sleepy"
          ? "Shimmy the prompt sprite, sleepy"
          : mood === "thinking"
            ? "Shimmy the prompt sprite, thinking"
            : mood === "celebrate"
              ? "Shimmy the prompt sprite, celebrating"
              : "Shimmy, the EL-SHEMEY prompt sprite"
      }
      className={className}
    >
      {/* ground glow — standing on the grid */}
      <ellipse cx="80" cy="128" rx="36" ry="6" fill="rgb(110 121 255 / 0.18)" />

      {mood === "sleepy" && (
        <g fill="#6b7093" fontFamily="var(--font-mono)" fontSize="11">
          <text x="118" y="34" className="floaty-late">
            z
          </text>
          <text x="128" y="22" className="floaty">
            z
          </text>
        </g>
      )}

      {mood === "celebrate" && (
        <g fill="#f0c24b">
          <path d="M30 26l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" className="floaty" />
          <path
            d="M132 20l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z"
            className="floaty-late"
          />
        </g>
      )}

      {/* tail */}
      <path d="M50 88 L46 106 L66 94 Z" fill="#101623" />

      {/* arms behind body */}
      <Arms mood={mood} />

      {/* body — a living prompt block */}
      <rect x="38" y="28" width="84" height="66" rx="15" fill="#101623" />
      <rect x="38" y="28" width="84" height="66" rx="15" fill="url(#shimmy-sheen)" />
      <rect
        x="38"
        y="28"
        width="84"
        height="66"
        rx="15"
        stroke="#6e79ff"
        strokeWidth="2.5"
        fill="none"
        opacity="0.85"
      />
      <defs>
        <linearGradient
          id="shimmy-sheen"
          x1="38"
          y1="28"
          x2="122"
          y2="94"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1a2233" stopOpacity="0.9" />
          <stop offset="1" stopColor="#0c1017" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* prompt cursor detail on the cheek edge */}
      <rect x="44" y="36" width="7" height="10" rx="2" fill="#6e79ff" opacity="0.5" />

      <Eyes mood={mood} />
      <Mouth mood={mood} />

      {/* cheeks */}
      {(mood === "happy" || mood === "celebrate") && (
        <g fill="#a487ff" opacity="0.45">
          <circle cx="55" cy="70" r="3.2" />
          <circle cx="101" cy="70" r="3.2" />
        </g>
      )}
    </svg>
  );
}

/** Tiny glyph version for the wordmark / compact brand moments. */
export function ShimmyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect
        x="3"
        y="5"
        width="26"
        height="21"
        rx="7"
        fill="#101623"
        stroke="#6e79ff"
        strokeWidth="2"
      />
      <path
        d="M8 25l-2 5 7-4z"
        fill="#101623"
        stroke="#6e79ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="14.5" rx="1.7" ry="2.4" fill="#9be4ff" />
      <ellipse cx="20" cy="14.5" rx="1.7" ry="2.4" fill="#9be4ff" />
      <path
        d="M13 19.5l3 2 3-2"
        stroke="#a7abc8"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
