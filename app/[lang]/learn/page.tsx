import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { Shimmy } from "@/components/character/shimmy";
import { ProgressBar } from "@/components/ui/progress";
import { buttonStyles } from "@/components/ui/button";
import { getUser } from "@/lib/server/auth/session";
import { getLearnerDashboard } from "@/lib/server/learner";
import { COURSES } from "@/lib/courses";
import { SignOutButton } from "@/features/auth/forms";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDict, type Dictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "My learning",
  robots: { index: false },
};

export default async function LearnDashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict: Dictionary = getDict(locale);
  const isAr = locale === "ar";

  // Server-side authorization: fresh session + revocation check.
  const user = await getUser();
  if (!user) redirect(`/${locale}/login?callbackUrl=/${locale}/learn`);

  const entries = await getLearnerDashboard(user.id);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/learn`} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-12 sm:px-6">
        {/* Greeting + identity */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 ${isAr ? "flex-row-reverse" : ""}`}
        >
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`text-xl font-bold tracking-tight sm:text-2xl ${isAr ? "text-right font-arabic" : ""}`}
          >
            {isAr ? "أهلاً بعودتك" : "Welcome back"}
            {(() => {
              const display = user.name ?? user.email;
              if (!display) return null;
              return <span className="text-electric">, {display.split("@")[0]}</span>;
            })()}
          </p>
          <div className={`flex items-center gap-3 ${isAr ? "flex-row-reverse" : ""}`}>
            <Link
              href={`/${locale}/account/billing`}
              className={`text-xs font-semibold text-faint underline decoration-electric decoration-2 underline-offset-4 hover:text-electric ${isAr ? "font-arabic" : ""}`}
            >
              {dict.learn.billingLink}
            </Link>
            <SignOutButton locale={locale} dict={dict} />
          </div>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          {dict.learn.dashTitle}
        </p>

        {entries.length === 0 ? (
          /* Empty state — honest, with real free destinations */
          <div className="mt-8">
            <div className="rounded-md border-2 border-dashed border-edge-strong bg-surface p-10 text-center">
              <Shimmy mood="thinking" size={120} className="floaty mx-auto" />
              <h1
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={`mt-6 text-2xl font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
              >
                {dict.learn.noCoursesTitle}
              </h1>
              <p
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={`mx-auto mt-3 max-w-sm text-sm leading-relaxed text-faint ${isAr ? "font-arabic" : ""}`}
              >
                {dict.learn.noCoursesDesc}
              </p>
              <Link
                href={`/${locale}/courses`}
                className={`${buttonStyles({ size: "lg" })} mt-8 inline-block`}
              >
                {dict.learn.browseCta}
              </Link>
            </div>

            {/* Recommended free courses (real seed catalog) */}
            <section aria-labelledby="rec-heading" className="mt-10">
              <h2
                id="rec-heading"
                className={`mb-4 border-b border-edge pb-3 text-lg font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
              >
                {dict.learn.recommendedFree}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {COURSES.filter((c) => c.access === "FREE").map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/${locale}/courses/${c.slug}`}
                      className="block h-full rounded-md border border-edge bg-surface p-5 transition-colors hover:border-indigo/50"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-semibold">{c.title[locale]}</p>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-beginner">
                          FREE
                        </span>
                      </div>
                      <p
                        lang={isAr ? "ar" : "en"}
                        dir={isAr ? "rtl" : "ltr"}
                        className={`mt-2 line-clamp-2 text-xs leading-relaxed text-faint ${isAr ? "text-right font-arabic" : ""}`}
                      >
                        {c.description[locale]}
                      </p>
                      <p className="mt-3 font-mono text-[10px] tabular-nums text-faint">
                        {c.lessons} {dict.course.lessons} · {c.hours}{" "}
                        {dict.course.hours}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <>
            {/* CONTINUE LEARNING — primary action */}
            {entries[0]?.currentLessonSlug ? (
              <section aria-labelledby="continue-heading">
                <div className="rounded-md border border-indigo/40 bg-surface p-6 shadow-card surface-grid sm:p-8">
                  <div className="relative z-10">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-electric">
                      {dict.learn.continueLabel}
                    </p>
                    <h1
                      id="continue-heading"
                      lang={isAr ? "ar" : "en"}
                      dir={isAr ? "rtl" : "ltr"}
                      className={`mt-3 text-2xl font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
                    >
                      {entries[0].titleEn}
                    </h1>
                    <ProgressBar
                      value={entries[0].percent}
                      label={entries[0].titleEn}
                      showValue
                      className="mt-5 max-w-sm"
                    />
                    {entries[0].currentLessonTitle && (
                      <p
                        lang={isAr ? "ar" : "en"}
                        dir={isAr ? "rtl" : "ltr"}
                        className={`mt-3 text-sm ${isAr ? "text-right font-arabic text-soft" : "text-soft"}`}
                      >
                        {dict.learn.currentLesson}:{" "}
                        <span className="font-medium text-fg">
                          {entries[0].currentLessonTitle}
                        </span>
                      </p>
                    )}
                    <Link
                      href={`/${locale}/learn/${entries[0].courseSlug}/${entries[0].currentLessonSlug}`}
                      className={`${buttonStyles({ size: "lg" })} mt-6 inline-block`}
                    >
                      {dict.learn.continueCta} →
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Overall learning statistics (derived, never fake) */}
            <section aria-labelledby="stats-heading" className="mt-10">
              <h2 id="stats-heading" className="sr-only">
                {dict.learn.statsCourses}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: String(entries.length), label: dict.learn.statsCourses },
                  {
                    value: String(entries.reduce((n, e) => n + e.completedCount, 0)),
                    label: dict.learn.statsLessonsDone,
                  },
                  {
                    value: String(entries.filter((e) => e.percent >= 100).length),
                    label: dict.learn.statsCompleted,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-md border border-edge bg-surface p-4"
                  >
                    <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                    <p
                      lang={isAr ? "ar" : "en"}
                      dir={isAr ? "rtl" : "ltr"}
                      className={`mt-1 text-xs text-faint ${isAr ? "font-arabic" : ""}`}
                    >
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* My courses */}
            <section aria-labelledby="courses-heading" className="mt-12">
              <h2
                id="courses-heading"
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={`mb-6 border-b border-edge pb-3 text-xl font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
              >
                {dict.learn.myCourses}
              </h2>
              <ul className="space-y-4">
                {entries.map((entry) => (
                  <li key={entry.courseSlug}>
                    <Link
                      href={
                        entry.currentLessonSlug
                          ? `/${locale}/learn/${entry.courseSlug}/${entry.currentLessonSlug}`
                          : `/${locale}/courses/${entry.courseSlug}`
                      }
                      className="block rounded-md border border-edge bg-surface p-5 transition-colors hover:border-indigo/50"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="font-semibold">{entry.titleEn}</p>
                        <p
                          lang="ar"
                          dir="rtl"
                          className="font-arabic text-sm text-violet"
                        >
                          {entry.titleAr}
                        </p>
                      </div>
                      <ProgressBar
                        value={entry.percent}
                        label={`${dict.learn.done}: ${entry.completedCount}/${entry.totalLessons}`}
                        size="sm"
                        className="mt-3"
                      />
                      <p className="mt-2 font-mono text-[11px] tabular-nums text-faint">
                        {dict.learn.lastActive}:{" "}
                        {entry.lastActiveAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
