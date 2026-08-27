import { TechLabel } from "@/components/ui/text";
import { Shimmy } from "@/components/character/shimmy";

const colors = [
  { token: "--color-base", hex: "#0B0D16", role: "The void — page background" },
  { token: "--color-surface", hex: "#12141F", role: "First layer — panels, sections" },
  { token: "--color-raised", hex: "#1A1D2E", role: "Raised — cards, character body" },
  { token: "--color-hover", hex: "#232741", role: "Hover / recessed wells" },
  { token: "--color-edge-strong", hex: "#3B4060", role: "Strong structure lines" },
  { token: "--color-fg", hex: "#EEEDF8", role: "Primary text — moonlight white" },
  { token: "--color-soft", hex: "#A7ABC8", role: "Secondary text" },
  { token: "--color-indigo", hex: "#6E79FF", role: "Primary accent — actions" },
  { token: "--color-violet", hex: "#A487FF", role: "Arabic voice, flourishes" },
  { token: "--color-electric", hex: "#56C2FF", role: "Live nodes, focus, links" },
  { token: "--color-beginner", hex: "#35D49E", role: "Beginner level · FREE · done" },
  { token: "--color-intermediate", hex: "#6E8CFF", role: "Intermediate level" },
  { token: "--color-advanced", hex: "#FF8A5C", role: "Advanced level" },
  { token: "--color-gold", hex: "#F0C24B", role: "PRO · achievements — rare" },
];

const spacing = [4, 8, 12, 16, 24, 32, 48, 64];

export function BrandFoundation() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
      <div>
        <TechLabel>Color — darkness carries the world, indigo lights it</TechLabel>
        <ul className="mt-4 divide-y divide-edge border-y border-edge">
          {colors.map((c) => (
            <li key={c.token} className="flex items-center gap-4 py-2.5">
              <span
                aria-hidden
                className="size-8 shrink-0 rounded-xs border border-edge-strong"
                style={{ backgroundColor: c.hex }}
              />
              <span className="w-44 shrink-0 font-mono text-xs text-fg">{c.token}</span>
              <span className="hidden w-20 shrink-0 font-mono text-xs text-faint sm:inline">
                {c.hex}
              </span>
              <span className="text-sm text-soft">{c.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-10">
        <div className="rounded-md border border-edge bg-surface p-4 text-center surface-grid">
          <Shimmy mood="happy" size={110} className="mx-auto" />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Shimmy · شيمي — lives here
          </p>
        </div>

        <div>
          <TechLabel>Spacing scale</TechLabel>
          <ul className="mt-3 space-y-1.5">
            {spacing.map((s) => (
              <li key={s} className="flex items-center gap-3">
                <span className="w-8 text-end font-mono text-xs text-faint">{s}</span>
                <span
                  aria-hidden
                  className="h-2.5 rounded-full bg-linear-to-r from-indigo to-violet"
                  style={{ width: s * 2.4 }}
                />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <TechLabel>Semantic states</TechLabel>
          <div className="mt-3 space-y-2">
            <p className="border-s-4 border-success bg-surface px-3 py-2 text-xs">
              Lesson completed.
            </p>
            <p className="border-s-4 border-warning bg-surface px-3 py-2 text-xs">
              Payment retrying tomorrow.
            </p>
            <p className="border-s-4 border-error bg-surface px-3 py-2 text-xs">
              That link has expired.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
