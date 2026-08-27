"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Shimmy } from "@/components/character/shimmy";

/**
 * LEARN → BUILD → RESULT — the signature EL-SHEMEY hero demonstration.
 *
 * A diagonal cascade across a live technical grid:
 * PROMPT ↘ CONTEXT ↘ AUTOMATION ↘ AGENT ↘ RESULT
 *
 * Arrows draw and lock into place, the pipeline branches, and a concrete
 * useful result lands while the character reacts inside the grid. Quiet
 * repeating loop; reduced motion freezes the final composition statically.
 */

const PROMPT_TEXT_DEFAULT = "رتّبلي العملاء الجدد";

const ARIA_DEFAULT =
  "توضيح تفاعلي: بتتعلم البرومبت والسياق، فتبني أتمتة بوكيل ذكي، وتوصّل لنتيجة حقيقية — عميل جديد اتكتشف ورد عليه تلقائي";
const STEPS_DEFAULT =
  "الخطوة 1: بتتعلم البرومبت والسياق. الخطوة 2: بتبني أتمتة على n8n بوكيل ذكي. الخطوة 3: النتيجة — عميل جديد يتكتشف ويوصله رد تلقائي على الإيميل.";
const PIPELINE = ["n8n", "AI", "Sheets", "Email"] as const;

// Stage hold durations (ms): ignition, cascade build, typing, branch+agent, result hold
const DURATIONS = [900, 2200, 1700, 1700, 4300];

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(callback: () => void) {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function shimmyMood(stage: number): "happy" | "thinking" | "celebrate" {
  if (stage >= 4) return "celebrate";
  if (stage >= 2) return "thinking";
  return "happy";
}

const EASE = "cubic-bezier(0.22,1,0.36,1)";

// Cascade geometry: node centers on a descending diagonal
const CENTERS: Array<[number, number]> = [
  [70, 36],
  [150, 86],
  [232, 136],
  [315, 186],
  [398, 228],
];
const LABELS = ["PROMPT", "CONTEXT", "AUTOMATION", "AGENT", "RESULT"] as const;

/** Arrowhead that locks into place once its segment finishes drawing. */
function ArrowHead({
  x,
  y,
  angle,
  active,
  delayMs,
}: {
  x: number;
  y: number;
  angle: number;
  active: boolean;
  delayMs: number;
}) {
  return (
    <path
      d="M-5 -4.5 L1 0 L-5 4.5"
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
      stroke="#56c2ff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      style={{
        opacity: active ? 0.95 : 0,
        transformBox: "fill-box",
        transition: `opacity 260ms ease ${delayMs}ms`,
      }}
    />
  );
}

function GraphNode({
  cx,
  cy,
  label,
  lit,
  delayMs,
  pulsing = false,
}: {
  cx: number;
  cy: number;
  label: string;
  lit: boolean;
  delayMs: number;
  pulsing?: boolean;
}) {
  return (
    <g style={{ transitionDelay: `${delayMs}ms` }}>
      <circle
        cx={cx}
        cy={cy}
        r={17}
        fill="#56c2ff"
        opacity={lit ? 0.12 : 0}
        className={lit && pulsing ? "node-live" : undefined}
        style={{ transition: `opacity 400ms ease ${delayMs}ms` }}
      />
      <rect
        x={cx - 50}
        y={cy - 13}
        width={100}
        height={26}
        rx={6}
        fill="#10151f"
        stroke={lit ? "#56c2ff" : "#33405a"}
        strokeWidth="1.5"
        style={{
          transition: `fill 300ms ease ${delayMs}ms, stroke 300ms ease ${delayMs}ms`,
          filter: lit ? "drop-shadow(0 0 7px rgb(86 194 255 / 0.3))" : undefined,
        }}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize="10.5"
        fontFamily="var(--font-mono)"
        fill={lit ? "#f4f7fb" : "#5f6b7d"}
        style={{ transition: "fill 300ms ease" }}
      >
        {label}
      </text>
    </g>
  );
}

export function HeroLearningDemo({
  labels,
  promptText = PROMPT_TEXT_DEFAULT,
}: {
  labels?: { aria: string; steps: string };
  promptText?: string;
}) {
  const [stage, setStage] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
  const [typedCount, setTypedCount] = useState(0);
  const [pulsing, setPulsing] = useState(false);

  // Stage machine — quiet loop with a long pause on the result.
  useEffect(() => {
    if (reducedMotion) return;
    const t = setTimeout(() => {
      if (stage === 4) {
        setTypedCount(0);
        setStage(0);
      } else {
        setStage(stage + 1);
      }
    }, DURATIONS[stage]);
    return () => clearTimeout(t);
  }, [stage, reducedMotion]);

  // Typing cadence while the prompt card is on screen (stage 2).
  useEffect(() => {
    if (reducedMotion || stage !== 2) return;
    let i = Math.min(typedCount, promptText.length);
    const iv = setInterval(() => {
      i += 1;
      setTypedCount(i);
      if (i >= promptText.length) clearInterval(iv);
    }, 60);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- typedCount is the resumable cursor
  }, [stage, reducedMotion]);

  // Grid pulses once when the result lands.
  useEffect(() => {
    if (reducedMotion || stage !== 4) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot animation trigger
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 900);
    return () => clearTimeout(t);
  }, [stage, reducedMotion]);

  const s = reducedMotion ? 4 : stage;

  const cascadeLit = s >= 1; // PROMPT → CONTEXT → AUTOMATION
  const agentLit = s >= 3; // AUTOMATION → AGENT + pipeline branch
  const resultLit = s >= 4; // AGENT → RESULT

  const typedShown =
    reducedMotion || s > 2
      ? promptText.length
      : s < 2
        ? 0
        : Math.min(typedCount, promptText.length);

  // Segment definitions along the diagonal
  const segments = [
    { from: 0, to: 1, active: cascadeLit, drawDelay: 0 },
    { from: 1, to: 2, active: cascadeLit, drawDelay: 620 },
    { from: 2, to: 3, active: agentLit, drawDelay: 0 },
    { from: 3, to: 4, active: resultLit, drawDelay: 0 },
  ].map(({ from, to, active, drawDelay }) => {
    const [x1, y1] = CENTERS[from];
    const [x2, y2] = CENTERS[to];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    return {
      d: `M${x1} ${y1} L${x2} ${y2}`,
      active,
      drawDelay,
      arrowX: x2 - ux * 56,
      arrowY: y2 - uy * 56,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      arrowDelay: drawDelay + 520,
    };
  });

  const nodeLit = [
    true, // PROMPT — always the entry point
    cascadeLit,
    cascadeLit,
    agentLit,
    resultLit,
  ];
  const nodeDelays = [0, 520, 1140, 500, 700];

  return (
    <div
      className={cn(
        "relative flex h-full flex-col gap-4 overflow-hidden rounded-md border border-edge bg-surface p-5 shadow-card surface-grid sm:p-6",
        pulsing && "grid-pulse-once",
        s === 0 && !reducedMotion && "demo-restart",
      )}
      role="img"
      aria-label={labels?.aria ?? ARIA_DEFAULT}
    >
      <span className="sr-only">{labels?.steps ?? STEPS_DEFAULT}</span>

      {/* HUD annotations — sparse, meaningful */}
      <p
        aria-hidden
        className={cn(
          "absolute end-5 top-3 font-mono text-[10px] tracking-[0.14em] transition-colors duration-300",
          resultLit ? "text-beginner" : "text-faint",
        )}
      >
        {resultLit ? "RESULT: COMPLETE" : "PATH: PROMPT → AGENT"}
      </p>
      <p
        aria-hidden
        className="absolute start-5 top-3 hidden font-mono text-[10px] tracking-[0.14em] text-faint md:block"
      >
        NODE 01 · {s >= 2 ? "PROCESSING" : "READY"}
      </p>

      {/* Diagonal cascade map */}
      <svg viewBox="0 0 452 252" fill="none" className="mx-auto mt-4 w-full max-w-md">
        {segments.map((seg, i) => (
          <path
            key={`seg-${i}`}
            d={seg.d}
            stroke="#56c2ff"
            strokeWidth="1.75"
            strokeLinecap="round"
            pathLength={100}
            opacity={0.9}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: seg.active ? 0 : 100,
              transition: `stroke-dashoffset 550ms ${EASE}`,
              transitionDelay: `${seg.drawDelay}ms`,
            }}
          />
        ))}

        {/* arrows lock into place after each segment draws */}
        {segments.map((seg, i) => (
          <ArrowHead
            key={`arrow-${i}`}
            x={seg.arrowX}
            y={seg.arrowY}
            angle={seg.angle}
            active={seg.active}
            delayMs={seg.arrowDelay}
          />
        ))}

        {/* pipeline branch annotation under AUTOMATION → AGENT */}
        {agentLit && (
          <text
            x={273}
            y={168}
            fontSize="8.5"
            fill="rgb(154 165 180 / 0.75)"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            n8n · AI · Sheets · Email
          </text>
        )}

        {LABELS.map((label, i) => (
          <GraphNode
            key={label}
            cx={CENTERS[i][0]}
            cy={CENTERS[i][1]}
            label={label}
            lit={nodeLit[i]}
            delayMs={nodeDelays[i]}
            pulsing={i === 0 && s === 0}
          />
        ))}

        {/* technical sparkles — success only */}
        {resultLit && (
          <g className="animate-settle">
            <path
              d="M180 20l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2-5.2-1.8 5.2-1.8z"
              fill="#f0c24b"
            />
            <path
              d="M60 130l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z"
              fill="#a487ff"
              className="animate-settle-late"
            />
          </g>
        )}
      </svg>

      {/* Prompt card */}
      <div className="rounded-sm border border-edge bg-raised px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          prompt.txt
        </p>
        <p lang="ar" dir="rtl" className="mt-1 min-h-6 font-arabic text-sm text-fg">
          {s >= 2 ? promptText.slice(0, typedShown) : ""}
          {s >= 2 && typedShown < promptText.length && (
            <span
              aria-hidden
              className="caret-blink ms-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-electric"
            />
          )}
        </p>
      </div>

      {/* Pipeline branch */}
      <div className="flex items-center gap-2" dir="ltr">
        {PIPELINE.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-faint">
                →
              </span>
            )}
            <span
              className={cn(
                "rounded-xs border px-2.5 py-1 font-mono text-[11px] transition-all duration-300",
                agentLit
                  ? "border-indigo/60 bg-indigo/10 text-electric shadow-glow"
                  : "border-edge text-faint",
              )}
              style={{ transitionDelay: reducedMotion ? "0ms" : `${i * 220}ms` }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      {/* Result — slot reserved so the loop never shifts layout */}
      <div className="h-[62px]">
        <div
          role={resultLit ? "status" : undefined}
          aria-hidden={!resultLit}
          className={cn(
            "flex h-full items-center gap-3 rounded-sm border border-beginner/40 bg-raised px-4 py-3 transition-all duration-300",
            resultLit ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-beginner shadow-glow">
            <svg
              aria-hidden
              viewBox="0 0 10 8"
              className="size-3 fill-none stroke-base stroke-[2]"
            >
              <path d="m1 4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="min-w-0 flex-1">
            <span
              dir="ltr"
              className="block truncate font-mono text-xs font-semibold text-fg"
            >
              New lead detected
            </span>
            <span
              lang="ar"
              dir="rtl"
              className="block truncate font-arabic text-xs text-soft"
            >
              تم إرسال رد تلقائي على الإيميل
            </span>
          </p>
        </div>
      </div>

      {/* Shimmy standing on the panel floor + signature caption */}
      <div className="mt-auto flex items-end justify-between gap-3">
        <Shimmy
          mood={shimmyMood(s)}
          size={64}
          className="pointer-events-none -mb-2 shrink-0 opacity-95"
        />
        <p className="pb-1 text-end font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
          EL-SHEMEY · Learn → Build → Result
        </p>
      </div>
    </div>
  );
}
