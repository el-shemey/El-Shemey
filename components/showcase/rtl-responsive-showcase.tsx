import { Button } from "@/components/ui/button";
import { FormField, Input, SearchField } from "@/components/ui/form";
import { AccessStamp, LevelBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { TechLabel } from "@/components/ui/text";

/**
 * RTL is architectural: logical properties (ps/pe, start/end), mirrored
 * intent, native Arabic typography — not a flipped English screen.
 */
export function RtlResponsiveShowcase() {
  return (
    <div className="space-y-14">
      {/* RTL composition */}
      <section aria-label="RTL composition">
        <TechLabel>
          A fully mirrored composition — same components, Arabic-native layout
        </TechLabel>

        <div
          dir="rtl"
          lang="ar"
          className="mt-4 rounded-md border border-edge-strong bg-surface shadow-card"
        >
          {/* Mirrored mini-header */}
          <div className="flex items-center justify-between border-b border-edge px-5 py-3">
            <span className="text-base font-bold tracking-tight font-arabic">
              الشيمي
              <span aria-hidden className="text-violet">
                .
              </span>
            </span>
            <nav
              aria-label="تنقل تجريبي"
              className="flex items-center gap-4 text-sm text-soft"
            >
              <span
                aria-current="page"
                className="rounded-sm bg-hover px-2 py-1 font-semibold"
              >
                استكشف
              </span>
              <span>الأسعار</span>
            </nav>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p
                className="font-mono text-xs tracking-[0.18em] text-advanced"
                style={{ direction: "ltr", textAlign: "end" }}
              >
                ISSUE Nº 01
              </p>
              <h3 className="mt-3 font-arabic text-3xl font-bold leading-snug sm:text-4xl">
                اتعلّم الذكاء الاصطناعي{" "}
                <span className="relative inline-block whitespace-nowrap">
                  بالممارسة
                  <svg
                    aria-hidden
                    viewBox="0 0 220 14"
                    preserveAspectRatio="none"
                    fill="none"
                    className="absolute -bottom-2 right-0 h-3 w-full text-violet"
                  >
                    <path
                      d="M216 10 C 170 3, 100 2, 4 7"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                .
              </h3>
              <p className="mt-4 max-w-md font-arabic leading-loose text-soft">
                كورسات منظمة في البرومبتات والأتمتة والوكلاء الأذكياء — ابدأ مجانًا،
                واشترك لما تحب تفتح المكتبة كلها.
              </p>

              <div className="mt-6 flex flex-wrap gap-4">
                <Button size="lg">ابدأ مجانًا</Button>
                <Button variant="secondary" size="lg">
                  تصفّح الكورسات
                </Button>
              </div>

              <div className="mt-8 grid max-w-md gap-4 sm:grid-cols-2">
                <FormField label="البريد الإلكتروني" htmlFor="rtl-email">
                  <Input id="rtl-email" type="email" placeholder="you@example.com" />
                </FormField>
                <div>
                  <span className="mb-1.5 block text-sm font-medium">
                    ابحث في المكتبة
                  </span>
                  <SearchField label="ابحث عن كورس" />
                </div>
              </div>
            </div>

            {/* Mirrored card fragment */}
            <aside
              className="w-full max-w-xs justify-self-start lg:justify-self-end"
              aria-label="بطاقة كورس"
            >
              <article className="relative rounded-md border border-edge-strong bg-base p-5 shadow-card">
                <AccessStamp kind="FREE" floating />
                <LevelBadge level="beginner" />
                <h4 className="mt-4 font-arabic text-lg font-bold">هندسة البرومبتات</h4>
                <p className="mt-2 font-arabic text-sm leading-relaxed text-soft">
                  برومبتات صامدة في الشغل الحقيقي — سياق، قيود، ومخرجات مرتبة.
                </p>
                <p
                  className="mt-3 font-mono text-xs tabular-nums text-faint"
                  style={{ direction: "ltr", textAlign: "start" }}
                >
                  6 modules · 24 lessons · ~9h
                </p>
                <ProgressBar
                  value={82}
                  showValue
                  label="تقدم الكورس"
                  className="mt-4"
                />
                <p className="mt-3 font-arabic text-sm font-semibold underline decoration-electric decoration-2 underline-offset-4">
                  كمّل الدرس ٢٠ ←
                </p>
              </article>
            </aside>
          </div>
        </div>
      </section>

      {/* Responsive rules */}
      <section aria-label="Responsive behavior">
        <TechLabel>
          Responsive rules — designed per breakpoint, never desktop shrunk
        </TechLabel>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-edge text-left font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                <th scope="col" className="py-3 pe-4 font-medium">
                  Breakpoint
                </th>
                <th scope="col" className="py-3 pe-4 font-medium">
                  Navigation
                </th>
                <th scope="col" className="py-3 pe-4 font-medium">
                  Course grid
                </th>
                <th scope="col" className="py-3 font-medium">
                  Primary action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {[
                [
                  "Mobile ≤ 640px",
                  "Drawer under hamburger",
                  "Single column",
                  "Full-width, thumb-reachable",
                ],
                [
                  "Tablet 641–1024px",
                  "Bar + condensed links",
                  "Two columns",
                  "Inline in header",
                ],
                [
                  "Desktop > 1024px",
                  "Full bar with language switcher",
                  "Three columns / editorial splits",
                  "Header CTA",
                ],
              ].map(([bp, nav, grid, cta]) => (
                <tr key={bp}>
                  <td className="py-3 pe-4 font-mono text-xs">{bp}</td>
                  <td className="py-3 pe-4 text-soft">{nav}</td>
                  <td className="py-3 pe-4 text-soft">{grid}</td>
                  <td className="py-3 text-soft">{cta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-5 space-y-2 border-s-2 border-edge ps-5 text-sm leading-relaxed text-soft">
          <li>· Touch targets ≥ 44px; hover effects always pair with focus states.</li>
          <li>
            · Type stays fluid between 16–20px body on small screens; display sizes step
            down deliberately.
          </li>
          <li>
            · Arabic line-height runs looser (leading-loose) than English at every
            breakpoint.
          </li>
          <li>
            · Test by resizing this page — every section above reflows, nothing merely
            shrinks.
          </li>
        </ul>
      </section>
    </div>
  );
}
