import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { HeroExperience } from "@/components/showcase/hero-experience";
import {
  BuildOutcomes,
  CourseCardsRow,
  FinalCta,
  PathSection,
  PricingPreview,
  WhyBuild,
} from "@/components/home/home-sections";
import { FeaturedCourse } from "@/components/courses/featured-course";
import { TechLabel, Stat } from "@/components/ui/text";
import { COURSES, FEATURED_SLUG, getCourse } from "@/lib/courses";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ar" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDict(lang);
  return {
    title: dict.home.whyKicker + " · EL-SHEMEY",
    alternates: { canonical: `/${lang}` },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const featured = getCourse(FEATURED_SLUG)!;

  const totals = COURSES.reduce(
    (acc, c) => ({
      lessons: acc.lessons + c.lessons,
      hours: acc.hours + c.hours,
    }),
    { lessons: 0, hours: 0 },
  );

  const supportingSlugs = COURSES.filter((c) => c.slug !== FEATURED_SLUG).map(
    (c) => c.slug,
  );

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}`} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 sm:px-6">
        {/* 1 — Hero */}
        <HeroExperience locale={locale} dict={dict} />

        {/* 2 — Why / practical philosophy */}
        <WhyBuild locale={locale} dict={dict} />

        {/* 3 — Featured course (dominant) */}
        <section aria-labelledby="dest-heading" className="scroll-mt-20 py-16">
          <TechLabel>{dict.home.featKicker}</TechLabel>
          <h2 id="dest-heading" className="sr-only">
            {dict.explorer.title}
          </h2>
          <div className="mt-4">
            <FeaturedCourse
              locale={locale}
              dict={dict}
              course={featured}
              ctaHrefBase={`/${locale}`}
            />
          </div>

          {/* Supporting destinations */}
          <div className="mt-12">
            <TechLabel>{dict.home.moreKicker}</TechLabel>
            <div className="mt-5">
              <CourseCardsRow locale={locale} dict={dict} slugs={supportingSlugs} />
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-12 flex flex-wrap gap-x-14 gap-y-4 border-y border-edge py-5">
            <Stat value={String(COURSES.length)} label={dict.explorer.statsCourses} />
            <Stat value={String(totals.lessons)} label={dict.explorer.statsLessons} />
            <Stat value={`${totals.hours}+`} label={dict.explorer.statsHours} />
          </div>
        </section>

        {/* 4 — Knowledge path */}
        <PathSection locale={locale} dict={dict} />

        {/* 5 — What you can build */}
        <BuildOutcomes locale={locale} dict={dict} />

        {/* 6+7 — Free vs Pro / pricing preview */}
        <PricingPreview locale={locale} dict={dict} />

        {/* 8 — Final CTA */}
        <FinalCta locale={locale} dict={dict} />
      </main>

      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
