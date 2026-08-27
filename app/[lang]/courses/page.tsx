import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { FeaturedCourse } from "@/components/courses/featured-course";
import { CourseExplorer } from "@/components/explorer/course-explorer";
import { PathSection } from "@/components/home/home-sections";
import { Stat, TechLabel } from "@/components/ui/text";
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
    title: dict.explorer.title,
    description: dict.explorer.intro,
    alternates: { canonical: `/${lang}/courses` },
  };
}

export default async function CoursesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";
  const featured = getCourse(FEATURED_SLUG)!;

  const totals = COURSES.reduce(
    (acc, c) => ({ lessons: acc.lessons + c.lessons, hours: acc.hours + c.hours }),
    { lessons: 0, hours: 0 },
  );

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/courses`} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6">
        {/* Explorer header */}
        <header className="border-b-2 border-edge-strong pb-10">
          <TechLabel>{dict.explorer.kicker}</TechLabel>
          <h1
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cnTitle(isAr)}
          >
            {dict.explorer.title}
          </h1>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cnIntro(isAr)}
          >
            {dict.explorer.intro}
          </p>

          <div className="mt-8 flex flex-wrap gap-x-14 gap-y-4 border-y border-edge py-5">
            <Stat value={String(COURSES.length)} label={dict.explorer.statsCourses} />
            <Stat value={String(totals.lessons)} label={dict.explorer.statsLessons} />
            <Stat value={`${totals.hours}+`} label={dict.explorer.statsHours} />
          </div>
        </header>

        {/* Featured destination */}
        <section aria-labelledby="featured-heading" className="py-14">
          <h2 id="featured-heading" className="sr-only">
            {dict.home.featKicker}
          </h2>
          <TechLabel>{dict.home.featKicker}</TechLabel>
          <div className="mt-4">
            <FeaturedCourse
              locale={locale}
              dict={dict}
              course={featured}
              ctaHrefBase={`/${locale}`}
            />
          </div>
        </section>

        {/* Search + filters + collection */}
        <section
          id="explorer"
          aria-label={dict.explorer.kicker}
          className="scroll-mt-20 py-6"
        >
          <CourseExplorer locale={locale} dict={dict} courses={COURSES} />
        </section>

        {/* Knowledge grid */}
        <PathSection locale={locale} dict={dict} id="path" />
      </main>

      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}

function cnTitle(isAr: boolean) {
  return [
    "mt-3 text-3xl font-bold tracking-tight sm:text-5xl",
    isAr ? "text-right font-arabic leading-[1.25]" : "",
  ].join(" ");
}

function cnIntro(isAr: boolean) {
  return [
    "mt-4 max-w-prose leading-relaxed text-soft",
    isAr ? "text-right font-arabic leading-loose" : "",
  ].join(" ");
}
