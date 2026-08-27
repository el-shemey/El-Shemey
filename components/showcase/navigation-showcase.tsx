import { LanguageSwitcher } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { LessonRow } from "@/components/ui/syllabus";
import { TechLabel } from "@/components/ui/text";

export function NavigationShowcase() {
  return (
    <div className="space-y-12">
      {/* Anatomy of the real header above */}
      <section aria-label="Header anatomy">
        <TechLabel>
          Anatomy — the header at the top of this page: wordmark · primary nav ·
          language · auth CTA. Active page gets paper-deep ground + aria-current.
        </TechLabel>
        <ul className="mt-4 grid gap-x-10 gap-y-2 border-y border-edge py-4 font-mono text-xs text-soft sm:grid-cols-2">
          <li>1 · Wordmark — ink, yellow full stop as the only flourish</li>
          <li>2 · Primary links — quiet until hovered, solid when active</li>
          <li>3 · Language switcher — EN/AR segmented, aria-pressed</li>
          <li>4 · Sign in / Start free — ghost then yellow primary</li>
        </ul>
      </section>

      {/* Language switcher + mobile drawer reproduction */}
      <section
        aria-label="Language and mobile"
        className="grid gap-8 lg:grid-cols-[auto_1fr]"
      >
        <div>
          <TechLabel>Language switcher</TechLabel>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-faint">
            In production this navigates between <code className="font-mono">/en</code>{" "}
            and <code className="font-mono">/ar</code> routes — never a client-side text
            swap.
          </p>
        </div>

        {/* Mobile drawer reproduced inside a device frame */}
        <div className="max-w-xs">
          <TechLabel>Mobile drawer — intentional, not shrunk</TechLabel>
          <div className="mt-3 rounded-lg border-2 border-edge-strong bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <span className="text-sm font-bold tracking-tight">
                EL-SHEMEY
                <span aria-hidden className="text-violet">
                  .
                </span>
              </span>
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-sm border-2 border-edge-strong"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-3.5 stroke-current stroke-[1.5] fill-none"
                >
                  <path d="M2 4.5h12M2 8h12M2 11.5h12" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <nav aria-label="Mobile example" className="px-4 py-3">
              <ul className="divide-y divide-edge border-y border-edge text-sm">
                <li>
                  <a
                    href="#"
                    aria-current="page"
                    className="block py-2.5 font-semibold"
                  >
                    Design
                  </a>
                </li>
                <li>
                  <a href="#" className="block py-2.5 text-soft">
                    Explore
                  </a>
                </li>
                <li>
                  <a href="#" className="block py-2.5 text-soft">
                    Pricing
                  </a>
                </li>
              </ul>
              <div className="flex items-center justify-between pt-3">
                <LanguageSwitcher />
                <Button size="sm">Start free</Button>
              </div>
            </nav>
          </div>
        </div>
      </section>

      {/* Keyboard & focus notes */}
      <section aria-label="Keyboard behavior">
        <TechLabel>Keyboard behavior</TechLabel>
        <ul className="mt-3 space-y-2 border-s-2 border-edge ps-5 text-sm leading-relaxed text-soft">
          <li>
            <kbd className="rounded-xs border border-edge-strong bg-surface px-1.5 py-0.5 font-mono text-xs">
              Tab
            </kbd>{" "}
            reaches every control; focus ring is a 2px electric outline, offset 2px.
          </li>
          <li>
            <kbd className="rounded-xs border border-edge-strong bg-surface px-1.5 py-0.5 font-mono text-xs">
              Esc
            </kbd>{" "}
            closes dialogs, dropdowns and the mobile drawer.
          </li>
          <li>
            Dropdowns announce expanded state; toasts announce politely via a live
            region.
          </li>
          <li>
            The player sidebar keeps tab order aligned with lesson order — try one:
          </li>
        </ul>
        <div className="mt-3 max-w-sm">
          <LessonRow
            title="System prompts that stick"
            duration="15:10"
            state="current"
            active
          />
        </div>
      </section>
    </div>
  );
}
