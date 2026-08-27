import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";
import { CourseCard } from "@/components/ui/course-card";
import { KnowledgeMap, type MapNode } from "@/components/viz/knowledge-map";
import { Shimmy } from "@/components/character/shimmy";
import { GridSurface, SigmoidCurve } from "@/components/viz/technical";
import { COURSES, PATH_NODE_IDS, CATEGORY_LABELS } from "@/lib/courses";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { TechLabel } from "@/components/ui/text";

/* ------------------------------------------------------------------ */
/* Section 3 — Practical learning philosophy                           */
/* ------------------------------------------------------------------ */

export function WhyBuild({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const isAr = locale === "ar";
  return (
    <section aria-labelledby="why-heading" className="scroll-mt-20 py-16">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <TechLabel>{dict.home.whyKicker}</TechLabel>
          <h2
            id="why-heading"
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-3 text-3xl font-bold tracking-tight sm:text-4xl",
              isAr && "text-right font-arabic",
            )}
          >
            {dict.home.whyTitle}
          </h2>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-4 max-w-prose text-soft",
              isAr && "text-right font-arabic leading-loose",
            )}
          >
            {dict.home.whyLead}
          </p>

          {/* The loop — numbered editorial steps with a connecting spine */}
          <ol className="relative mt-10 space-y-8 border-s border-edge ps-8">
            {dict.home.steps.map((step) => (
              <li key={step.n} className="relative">
                <span
                  aria-hidden
                  className="absolute -start-[41px] top-0 grid size-[18px] place-items-center rounded-full border border-indigo/60 bg-base font-mono text-[9px] text-electric"
                >
                  {step.n.slice(1)}
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet">
                  {step.n}
                </p>
                <h3
                  lang={isAr ? "ar" : "en"}
                  dir={isAr ? "rtl" : "ltr"}
                  className={cn("mt-1 font-semibold", isAr && "text-right font-arabic")}
                >
                  {step.t}
                </h3>
                <p
                  lang={isAr ? "ar" : "en"}
                  dir={isAr ? "rtl" : "ltr"}
                  className={cn(
                    "mt-1 max-w-md text-sm leading-relaxed text-soft",
                    isAr && "text-right font-arabic",
                  )}
                >
                  {step.d}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* The pacing curve */}
        <GridSurface className="h-fit p-6 lg:sticky lg:top-24">
          <div className="relative z-10">
            <TechLabel>fig. pacing</TechLabel>
            <SigmoidCurve className="mt-6 w-full max-w-[260px]" />
            <p
              lang={isAr ? "ar" : "en"}
              dir={isAr ? "rtl" : "ltr"}
              className={cn(
                "mt-6 max-w-xs text-xs leading-relaxed text-faint",
                isAr && "text-right font-arabic",
              )}
            >
              {dict.home.curveNote}
            </p>
          </div>
        </GridSurface>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 4 — Supporting course cards                                 */
/* ------------------------------------------------------------------ */

/** Supporting course cards under the featured panel. */
export function CourseCardsRow({
  locale,
  dict,
  slugs,
}: {
  locale: Locale;
  dict: Dictionary;
  slugs: string[];
}) {
  const courses = COURSES.filter((c) => slugs.includes(c.slug));
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <CourseCard
          key={course.slug}
          href={`/${locale}/courses/${course.slug}`}
          title={course.title[locale]}
          titleAr={course.title.ar}
          description={course.description[locale]}
          level={course.level}
          access={course.access}
          modules={course.modules}
          lessons={course.lessons}
          hours={course.hours}
          progressPercent={course.progressPercent}
          continueLabel={dict.explorer.featuredCta1}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section 5 — Knowledge path                                          */
/* ------------------------------------------------------------------ */

export function PathSection({
  locale,
  dict,
  id = "path",
}: {
  locale: Locale;
  dict: Dictionary;
  id?: string;
}) {
  const isAr = locale === "ar";

  const nodes: MapNode[] = [
    ...PATH_NODE_IDS.map((id, i) => {
      const course = COURSES.find((c) => c.category === id);
      return {
        id,
        title: course ? course.title[locale] : CATEGORY_LABELS[id][locale],
        hint: dict.home.pathHints[id],
        meta: course ? `${course.lessons} ${dict.course.lessons}` : undefined,
        access: course?.access,
        state: i === 0 ? ("available" as const) : ("locked" as const),
        href: course ? `/${locale}/courses/${course.slug}` : "#",
      };
    }),
    {
      id: "build",
      title: isAr ? "ابنِ مشروعك" : "Build your project",
      hint: dict.home.pathHints.build,
      state: "locked" as const,
      href: "#",
    },
  ];

  return (
    <section id={id} aria-labelledby="path-heading" className="scroll-mt-20 py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <TechLabel>{dict.home.pathKicker}</TechLabel>
          <h2
            id="path-heading"
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-3 text-3xl font-bold tracking-tight",
              isAr && "text-right font-arabic",
            )}
          >
            {dict.home.pathTitle}
          </h2>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-4 max-w-prose text-soft",
              isAr && "text-right font-arabic leading-relaxed",
            )}
          >
            {dict.home.pathDesc}
          </p>
        </div>

        <aside aria-label={dict.home.pathKicker}>
          <KnowledgeMap nodes={nodes} />
          <Shimmy mood="thinking" size={72} className="floaty mt-6 opacity-90" />
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 6 — What you can build                                      */
/* ------------------------------------------------------------------ */

const OUTCOME_ICONS = [
  // chat / support
  "M4 6h24v16H14l-6 5v-5H4z M10 12h12 M10 16h8",
  // lead / automation bolt
  "M17 3 7 15h7l-2 9 11-13h-7l1-8z",
  // research / doc
  "M8 4h14v22H8z M12 10h8M12 15h8M12 20h5",
];

export function BuildOutcomes({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const isAr = locale === "ar";
  return (
    <section aria-labelledby="build-heading" className="scroll-mt-20 py-16">
      <TechLabel>{dict.home.buildKicker}</TechLabel>
      <h2
        id="build-heading"
        lang={isAr ? "ar" : "en"}
        dir={isAr ? "rtl" : "ltr"}
        className={cn(
          "mt-3 text-3xl font-bold tracking-tight sm:text-4xl",
          isAr && "text-right font-arabic",
        )}
      >
        {dict.home.buildTitle}
      </h2>

      <ol className="mt-10 divide-y divide-edge border-y border-edge">
        {dict.home.buildItems.map((item, i) => (
          <li key={item.t} className="group flex items-center gap-6 py-6">
            <svg
              aria-hidden
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="size-9 shrink-0 text-faint transition-colors duration-200 group-hover:text-electric"
            >
              <path d={OUTCOME_ICONS[i % OUTCOME_ICONS.length]} />
            </svg>
            <div className="min-w-0">
              <h3
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={cn("font-semibold", isAr && "font-arabic")}
              >
                {item.t}
              </h3>
              <p
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={cn("mt-0.5 text-sm text-soft", isAr && "font-arabic")}
              >
                {item.d}
              </p>
            </div>
            <span
              aria-hidden
              className="ms-auto font-mono text-xs text-faint transition-transform duration-200 ease-settle group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
            >
              →
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sections 7+8 — Free vs Pro + pricing preview                        */
/* ------------------------------------------------------------------ */

export function PricingPreview({
  locale,
  dict,
  id = "pricing",
}: {
  locale: Locale;
  dict: Dictionary;
  id?: string;
}) {
  const isAr = locale === "ar";
  const ar = () =>
    isAr ? { lang: "ar", dir: "rtl", className: "text-right font-arabic" } : {};

  return (
    <section id={id} aria-labelledby="pricing-heading" className="scroll-mt-20 py-16">
      <TechLabel>{dict.home.priceKicker}</TechLabel>
      <h2
        id="pricing-heading"
        {...ar()}
        className={cn(
          "mt-3 mb-10 text-3xl font-bold tracking-tight",
          isAr && "font-arabic",
        )}
      >
        {dict.home.priceTitle}
      </h2>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Free */}
        <article className="rounded-md border border-edge bg-surface p-6 sm:p-8">
          <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-soft">
            {dict.home.freeName}
          </h3>
          <p className="mt-5 text-4xl font-bold tracking-tight">0 EGP</p>
          <p className="mt-2 text-sm text-faint">{dict.home.perMonth}</p>
          <hr className="my-6 border-edge" />
          <ul className="space-y-3 text-sm leading-relaxed text-soft">
            {dict.home.freeFeatures.map((f) => (
              <li key={f} className="flex items-baseline justify-between gap-3">
                <span {...ar()}>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/${locale}/register`}
            className={cn(buttonStyles({ variant: "secondary" }), "mt-8 w-full")}
          >
            {dict.hero.ctaPrimary}
          </Link>
        </article>

        {/* Pro */}
        <article className="relative rounded-md border-2 border-edge-strong bg-surface p-6 shadow-lift sm:p-8">
          <span className="absolute -top-3 start-8 rotate-[-1.5deg] bg-gold px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] text-base">
            {dict.home.bestValue}
          </span>
          <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-soft">
            {dict.home.proName} · {dict.home.yearly}
          </h3>
          <p className="mt-5 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-3xl font-medium text-faint">EGP</span>
            <span className="text-5xl font-bold tracking-tight">{dict.home.tbd}</span>
          </p>
          <p className="mt-2 text-sm text-faint">{dict.home.perYear}</p>
          <hr className="my-6 border-edge" />
          <ul className="space-y-3 text-sm leading-relaxed text-soft">
            {dict.home.proFeatures.map((f) => (
              <li key={f} className="flex items-baseline justify-between gap-3">
                <span {...ar()}>{f}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            title={dict.home.tbd}
            className={cn(buttonStyles({}), "mt-8 w-full opacity-70 sm:w-auto")}
          >
            {dict.home.choose} · {dict.home.tbd}
          </button>
        </article>
      </div>

      <p
        {...ar()}
        className={cn(
          "mt-6 max-w-prose text-sm leading-relaxed text-faint",
          isAr && "font-arabic",
        )}
      >
        {dict.home.priceNote}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 9 — Final CTA                                               */
/* ------------------------------------------------------------------ */

export function FinalCta({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const isAr = locale === "ar";
  return (
    <section aria-labelledby="final-heading" className="py-20">
      <GridSurface className="surface-grid p-10 text-center shadow-card sm:p-14">
        <div className="relative z-10 mx-auto max-w-xl">
          <Shimmy mood="celebrate" size={96} className="mx-auto floaty" />
          <h2
            id="final-heading"
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-6 text-3xl font-bold tracking-tight sm:text-4xl",
              isAr && "font-arabic",
            )}
          >
            {dict.home.finalTitle}
          </h2>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn("mt-4 text-soft", isAr && "font-arabic")}
          >
            {dict.home.finalSub}
          </p>
          <Link
            href={`/${locale}/register`}
            className={cn(buttonStyles({ size: "lg" }), "mt-8")}
          >
            {dict.home.cta}
          </Link>
        </div>
      </GridSurface>
    </section>
  );
}
