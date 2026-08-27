import { Button } from "@/components/ui/button";

/**
 * Pricing composition study — asymmetric, EGP currency, placeholder amounts.
 * Real prices require explicit owner approval (DECISIONS.md D09).
 */
export function PricingShowcase() {
  return (
    <div>
      <p className="mb-8 inline-block border-2 border-dashed border-warning px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-warning">
        Placeholder study — amounts set by explicit owner approval, never invented
      </p>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Monthly — quiet */}
        <article className="rounded-md border border-edge bg-surface p-6 sm:p-8">
          <h4 className="font-mono text-xs uppercase tracking-[0.22em] text-soft">
            Monthly
          </h4>
          <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-2xl font-medium text-faint">EGP</span>
            <span className="text-4xl font-bold tracking-tight">PRICE TBD</span>
          </p>
          <p className="mt-2 text-sm text-faint">
            per month · cancel anytime ·{" "}
            <span lang="ar" dir="rtl" className="font-arabic">
              إلغاء في أي وقت
            </span>
          </p>
          <hr className="my-6 border-edge" />
          <ul className="space-y-3 text-sm leading-relaxed text-soft">
            {[
              ["Full premium library", "المكتبة الكاملة"],
              ["Arabic & English lessons", "بالعربي والإنجليزي"],
              ["New courses as they ship", "كورسات جديدة أول بأول"],
            ].map(([en, ar]) => (
              <li key={en} className="flex items-baseline justify-between gap-3">
                <span>{en}</span>
                <span lang="ar" dir="rtl" className="font-arabic text-faint">
                  {ar}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-8 w-full">
            Choose monthly
          </Button>
        </article>

        {/* Yearly — emphasized */}
        <article className="relative rounded-md border-2 border-edge-strong bg-surface p-6 shadow-lift sm:p-8">
          <span className="absolute -top-3 start-8 rotate-[-1.5deg] bg-indigo px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] text-fg">
            BEST VALUE
          </span>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h4 className="font-mono text-xs uppercase tracking-[0.22em] text-soft">
                Yearly
              </h4>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-3xl font-medium text-faint">EGP</span>
                <span className="text-5xl font-bold tracking-tight">PRICE TBD</span>
              </p>
              <p className="mt-2 text-sm text-faint">
                per year — exact math once priced
              </p>
            </div>
            <p
              lang="ar"
              dir="rtl"
              className="font-arabic text-sm font-semibold text-violet"
            >
              الاشتراك السنوي — وفّر أكتر
            </p>
          </div>
          <hr className="my-6 border-edge" />
          <ul className="space-y-3 text-sm leading-relaxed text-soft">
            {[
              ["Everything in monthly", "كل مزايا الشهري"],
              [
                "Priority access to new automation projects",
                "أولوية الوصول للمشاريع الجديدة",
              ],
              [
                "Downloadable prompt libraries & templates",
                "مكتبات برومبتات جاهزة للتحميل",
              ],
              ["Price locked for your renewal period", "سعر ثابت طوال فترة تجديدك"],
            ].map(([en, ar]) => (
              <li key={en} className="flex items-baseline justify-between gap-3">
                <span>{en}</span>
                <span lang="ar" dir="rtl" className="font-arabic text-faint">
                  {ar}
                </span>
              </li>
            ))}
          </ul>
          <Button size="lg" className="mt-8 w-full sm:w-auto">
            Choose yearly
          </Button>
        </article>
      </div>

      <p className="mt-6 max-w-prose text-sm leading-relaxed text-soft">
        Free learners always keep the free lesson tier, progress tracking, and account
        features. Subscribing adds depth and breadth — it never takes the free floor
        away.
      </p>
    </div>
  );
}
