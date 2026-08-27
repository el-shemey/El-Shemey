import {
  Constellation,
  CoordinateTag,
  GridSurface,
  SigmoidCurve,
} from "@/components/viz/technical";
import { TechLabel } from "@/components/ui/text";

/**
 * The technical language: coordinate grids, curves, constellations,
 * annotations, code fragments. Supporting layer — never the protagonist.
 */
export function TechnicalShowcase() {
  return (
    <div className="space-y-12">
      <section
        aria-label="Grid surfaces and curves"
        className="grid gap-6 md:grid-cols-2"
      >
        <GridSurface fine className="p-6">
          <div className="relative z-10">
            <CoordinateTag value="fig. 01" />
            <p className="mt-2 text-sm font-semibold">Learning is a sigmoid</p>
            <p className="mt-1 text-xs leading-relaxed text-soft">
              Slow start, steep middle, long mastery tail. Our course pacing follows the
              same curve.
            </p>
            <SigmoidCurve className="mt-4 w-full max-w-[220px]" />
          </div>
        </GridSurface>

        <GridSurface className="p-6">
          <div className="relative z-10">
            <CoordinateTag value="fig. 02" />
            <p className="mt-2 text-sm font-semibold">Concepts connect, quietly</p>
            <p className="mt-1 text-xs leading-relaxed text-faint">
              Prompting → context → tools → agents. One constellation, not a nebula.
            </p>
            <Constellation className="mt-4 w-full max-w-[210px]" />
          </div>
        </GridSurface>
      </section>

      <section aria-label="Code fragment">
        <TechLabel>Code fragments — Plex Mono only, always machinery</TechLabel>
        <pre className="mt-4 overflow-x-auto rounded-md border border-edge bg-hover px-5 py-4 font-mono text-sm leading-relaxed">
          {`POST /api/webhooks/payments   ← Paymob → EL-SHEMEY
X-Paymob-Signature: hmac-sha512
{"type": "subscription.renewed", "period_end": "2026-09-24"}`}
        </pre>
      </section>

      <section aria-label="Usage rules">
        <TechLabel>Rules of the technical layer</TechLabel>
        <ul className="mt-3 grid gap-x-10 gap-y-2 border-y border-edge py-4 text-sm text-soft sm:grid-cols-2">
          <li>· Grids sit behind content at low contrast — never over it.</li>
          <li>
            · Curves and constellations annotate real ideas (progress pacing, topic
            maps).
          </li>
          <li>· Mono type marks machinery: code, data, coordinates — not prose.</li>
          <li>· If a graphic explains nothing, delete it.</li>
        </ul>
      </section>
    </div>
  );
}
