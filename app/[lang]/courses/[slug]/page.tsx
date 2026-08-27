import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { AccessStamp, LevelBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { SyllabusList } from "@/components/ui/syllabus";
import { Stat, TechLabel } from "@/components/ui/text";
import { Shimmy } from "@/components/character/shimmy";
import { GridSurface } from "@/components/viz/technical";
import { startLearningAction } from "@/features/auth/actions";
import { SubscribeForm } from "@/features/payments/subscribe-form";
import { getUser } from "@/lib/server/auth/session";
import { getEntitlementProvider } from "@/lib/server/entitlement-provider";
import { listActivePlans } from "@/lib/server/payments/service";
import { formatMoney } from "@/lib/money";
import { COURSES, getCourse } from "@/lib/courses";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => COURSES.map((c) => ({ lang, slug: c.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const course = getCourse(slug);
  if (!course) return {};
  const locale = lang as Locale;
  return {
    title: course.title[locale],
    description: course.description[locale],
    keywords: [course.title.en, course.category, course.level.toLowerCase()],
    alternates: { canonical: `/${lang}/courses/${slug}` },
    openGraph: {
      title: course.title[locale],
      description: course.description[locale],
      type: "article",
    },
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const course = getCourse(slug);
  if (!course) notFound();

  const isAr = locale === "ar";
  const user = await getUser();

  const syllabusRows = course.syllabus[locale].map((title, i) => ({
    number: String(i + 1).padStart(2, "0"),
    title,
    titleAr: "",
    access: i < 1 ? ("FREE" as const) : course.access,
    duration: undefined,
    state: i === 0 ? ("current" as const) : ("locked" as const),
  }));

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/courses`} />

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <Link
          href={`/${locale}/courses`}
          className="inline-block text-sm font-semibold text-soft underline decoration-electric decoration-2 underline-offset-4 transition-colors hover:text-electric"
        >
          {isAr ? "← " : ""}
          {dict.course.back}
          {!isAr ? " →" : ""}
        </Link>

        <header className="mt-8 border-b border-edge pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <AccessStamp kind={course.access} />
            <LevelBadge level={course.level} />
            <TechLabel>{CATEGORY_LABEL(course, locale)}</TechLabel>
          </div>

          <h1
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cnH1(isAr)}
          >
            {course.title[locale]}
          </h1>
          {!isAr && (
            <p
              lang="ar"
              dir="rtl"
              className="mt-2 text-right font-arabic text-lg text-violet"
            >
              {course.title.ar}
            </p>
          )}

          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cnDesc(isAr)}
          >
            {course.description[locale]}
          </p>

          <div className="mt-8 flex flex-wrap gap-x-14 gap-y-4 border-y border-edge py-5">
            <Stat value={String(course.modules)} label={dict.course.modules} />
            <Stat value={String(course.lessons)} label={dict.course.lessons} />
            <Stat value={`${course.hours}`} label={dict.course.hours} />
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            {user ? (
              <form action={startLearningAction.bind(null, locale, course.slug)}>
                <button type="submit" className={buttonStyles({ size: "lg" })}>
                  {course.access === "FREE"
                    ? dict.course.startCta
                    : dict.course.previewCta}
                </button>
              </form>
            ) : (
              <Link
                href={`/${locale}/register`}
                className={buttonStyles({ size: "lg" })}
              >
                {dict.auth.registerCta}
              </Link>
            )}
            {course.access === "FREE" && (
              <Link
                href={`/${locale}/courses`}
                className={buttonStyles({ variant: "secondary", size: "lg" })}
              >
                {dict.nav.courses}
              </Link>
            )}
          </div>

          {/* Monetization panel — server-authoritative access state */}
          {course.access === "PRO" && (
            <ProPanel
              locale={locale}
              isAr={isAr}
              dict={dict}
              signedIn={Boolean(user)}
            />
          )}
        </header>

        {/* Syllabus preview */}
        <section aria-labelledby="syllabus-heading" className="py-12">
          <h2 id="syllabus-heading" className="mb-6 text-2xl font-bold tracking-tight">
            {dict.course.syllabus}
          </h2>
          <SyllabusList rows={syllabusRows} />
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cnNote(isAr)}
          >
            {dict.explorer.mapDesc}
          </p>
        </section>

        {/* Character moment */}
        <GridSurface className="p-8">
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-8">
            <Shimmy mood="thinking" size={110} className="floaty" />
            <p
              lang={isAr ? "ar" : "en"}
              dir={isAr ? "rtl" : "ltr"}
              className={cnNote(isAr)}
            >
              {dict.home.whyLead}
            </p>
          </div>
        </GridSurface>
      </main>

      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}

function CATEGORY_LABEL(
  course: NonNullable<ReturnType<typeof getCourse>>,
  locale: Locale,
): string {
  // category label lives in lib/courses; import avoided at module top for brevity
  const labels: Record<string, Record<string, string>> = {
    prompting: { en: "Prompting", ar: "البرومبتات" },
    context: { en: "Context", ar: "السياق" },
    automation: { en: "Automation", ar: "الأتمتة" },
    agents: { en: "Agents", ar: "الوكلاء" },
    rag: { en: "RAG", ar: "أنظمة RAG" },
  };
  return labels[course.category][locale];
}

function cnH1(isAr: boolean) {
  return [
    "mt-4 text-3xl font-bold tracking-tight sm:text-5xl",
    isAr ? "text-right font-arabic leading-[1.25]" : "",
  ].join(" ");
}

function cnDesc(isAr: boolean) {
  return [
    "mt-4 max-w-prose leading-relaxed text-soft",
    isAr ? "text-right font-arabic leading-loose" : "",
  ].join(" ");
}

function cnNote(isAr: boolean) {
  return [
    "mt-6 max-w-prose text-sm leading-relaxed text-faint",
    isAr ? "text-right font-arabic" : "",
  ].join(" ");
}

/**
 * Server-rendered PRO access panel. The access state shown here comes from
 * the EntitlementProvider — the client never decides whether the user owns
 * anything. Prices come from the DB Plan table (owner-managed).
 */
async function ProPanel({
  locale,
  isAr,
  dict,
  signedIn,
}: {
  locale: Locale;
  isAr: boolean;
  dict: ReturnType<typeof getDict>;
  signedIn: boolean;
}) {
  const t = dict.billing;

  const hasPro = signedIn
    ? await getEntitlementProvider().hasProAccess((await getUser())!.id)
    : false;
  if (hasPro) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`mt-8 rounded-md border border-success/40 bg-raised p-6 ${isAr ? "text-right font-arabic" : ""}`}
      >
        <p className="text-sm font-semibold text-success">{t.proActiveTitle}</p>
        <p className="mt-1 text-sm text-soft">{t.proActiveDesc}</p>
      </div>
    );
  }

  const plans = await listActivePlans();
  const monthly = plans.find((p) => p.interval === "MONTH") ?? plans[0];

  if (!signedIn || !monthly) {
    // Guests see the pitch with the register CTA; no active plan → honest notice.
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`mt-8 rounded-md border border-edge bg-base p-6 ${isAr ? "text-right font-arabic" : ""}`}
      >
        <p className="font-semibold">{t.subscribeTitle}</p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-soft">
          {t.subscribeDesc}
        </p>
      </div>
    );
  }

  const price = formatMoney(monthly.amountMinor, monthly.currency, locale);
  const interval = monthly.interval === "MONTH" ? t.intervalMonth : t.intervalYear;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`mt-8 rounded-md border border-indigo/40 bg-base p-6 ${isAr ? "text-right font-arabic" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="font-semibold">{t.subscribeTitle}</p>
        <p className="font-mono text-lg text-electric" dir="ltr">
          {price}
          <span className="text-xs text-faint"> {interval}</span>
        </p>
      </div>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-soft">
        {t.subscribeDesc}
      </p>
      <SubscribeForm locale={locale} planSlug={monthly.slug} dict={dict} />
    </div>
  );
}
