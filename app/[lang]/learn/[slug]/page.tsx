import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { ProgressBar } from "@/components/ui/progress";
import { buttonStyles } from "@/components/ui/button";
import { getUser } from "@/lib/server/auth/session";
import { getCourseLearningView, getLearnerDashboard } from "@/lib/server/learner";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Course",
  robots: { index: false },
};

/**
 * Course learning overview (Phase 6): curriculum tree with per-lesson state
 * (done / current / available / locked), progress, and the Continue target.
 * All states derive server-side; locked lessons expose titles only.
 */
export default async function LearnCourseOverviewPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";
  const t = dict.learn;

  const user = await getUser();
  if (!user) redirect(`/${locale}/login?callbackUrl=/${locale}/learn/${slug}`);

  // Not enrolled → public detail page owns the Start-course flow.
  const enrolled = (await getLearnerDashboard(user.id)).some(
    (e) => e.courseSlug === slug,
  );
  if (!enrolled) redirect(`/${locale}/courses/${slug}`);

  const view = await getCourseLearningView(user.id, slug);
  if (view.status === "NOT_FOUND") notFound();

  if (view.status === "NO_ENROLLMENT") {
    redirect(`/${locale}/courses/${slug}`);
  }

  const doneCount = view.progress.completedCount;
  const totalCount = view.progress.publishedLessons;
  const currentModuleIndex = view.modules.findIndex(
    (m) => m.id === view.progress.activeModuleId,
  );

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/learn`} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-12 sm:px-6">
        <Link
          href={`/${locale}/learn`}
          className="text-xs text-faint hover:text-electric"
        >
          ← {t.dashTitle}
        </Link>

        {/* Header */}
        <header className="mt-4 border-b border-edge pb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
            {t.overviewTitle}
          </p>
          <h1
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`mt-3 text-3xl font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
          >
            {isAr ? view.titleAr : view.titleEn}
          </h1>
          {!isAr && (
            <p lang="ar" dir="rtl" className="mt-1 text-right font-arabic text-violet">
              {view.titleAr}
            </p>
          )}

          <div className="mt-6 max-w-md">
            <ProgressBar value={view.progress.percent} label={view.titleEn} showValue />
            <p
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-2 font-mono text-[11px] tabular-nums text-faint ${isAr ? "font-arabic" : ""}`}
            >
              {doneCount} / {totalCount} · {view.progress.percent}% ·{" "}
              {totalCount - doneCount} {t.remaining}
            </p>
          </div>

          {currentModuleIndex >= 0 && (
            <p
              lang={isAr ? "ar" : "en"}
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-2 text-xs ${isAr ? "text-right font-arabic text-faint" : "text-faint"}`}
            >
              {t.currentModule}:{" "}
              <span className="text-electric">
                {isAr ? "وحدة" : "Module"}{" "}
                {String(currentModuleIndex + 1).padStart(2, "0")}
              </span>
            </p>
          )}

          {view.resumeSlug && (
            <Link
              href={`/${locale}/learn/${slug}/${view.resumeSlug}`}
              className={`${buttonStyles({ size: "lg" })} mt-6 inline-block`}
            >
              {doneCount > 0 ? t.continueCourseCta : t.startCourseCta} →
            </Link>
          )}

          {/* Course complete — restrained, momentum-focused */}
          {totalCount > 0 && doneCount === totalCount && (
            <div
              role="status"
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-6 rounded-md border border-success/40 bg-raised p-5 ${isAr ? "text-right font-arabic" : ""}`}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success">
                ✓ {t.courseCompleteTitle}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/${locale}/courses`} className={buttonStyles()}>
                  {t.exploreMoreCta}
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* Curriculum tree */}
        <section aria-labelledby="tree-heading" className="mt-10">
          <h2
            id="tree-heading"
            className={`mb-5 border-b border-edge pb-3 text-xl font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
          >
            {t.curriculum}
          </h2>

          <ol className="space-y-8">
            {view.modules.map((m, mi) => {
              const isActive = m.id === view.progress.activeModuleId;
              return (
                <li key={m.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex items-baseline gap-3">
                      <span
                        aria-hidden
                        className={`font-mono text-sm tabular-nums ${
                          isActive ? "text-electric" : "text-faint"
                        }`}
                      >
                        {String(m.position ?? mi + 1).padStart(2, "0")}
                      </span>
                      <h3
                        lang={isAr ? "ar" : "en"}
                        dir={isAr ? "rtl" : "ltr"}
                        className={`text-sm font-semibold ${isActive ? "text-fg" : "text-soft"} ${isAr ? "text-right font-arabic" : ""}`}
                      >
                        {isAr ? m.titleAr : m.titleEn}
                      </h3>
                    </div>
                    {/* Module progress — derived, never stored */}
                    <p
                      dir={isAr ? "rtl" : "ltr"}
                      className={`font-mono text-[10px] tabular-nums text-faint ${isAr ? "font-arabic" : ""}`}
                    >
                      {m.completedCount}/{m.totalCount}
                      {m.totalCount > 0 &&
                        ` · ${Math.round((m.completedCount / m.totalCount) * 100)}%`}
                    </p>
                  </div>
                  <div
                    aria-hidden
                    className="ms-6 mt-2 h-1 overflow-hidden rounded-full bg-raised"
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        m.completedCount === m.totalCount && m.totalCount > 0
                          ? "bg-beginner"
                          : "bg-gradient-to-r from-indigo to-electric"
                      }`}
                      style={{
                        width:
                          m.totalCount > 0
                            ? `${(m.completedCount / m.totalCount) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <ol className="ms-6 mt-2 space-y-1 border-s border-edge ps-4">
                    {m.lessons.map((l) => {
                      const glyph =
                        l.state === "done"
                          ? "✓"
                          : l.state === "current"
                            ? "▶"
                            : l.state === "locked"
                              ? "🔒"
                              : "○";
                      const sr =
                        l.state === "done"
                          ? t.done
                          : l.state === "current"
                            ? t.curriculumCurrentSr
                            : l.state === "locked"
                              ? t.curriculumLockedSr
                              : null;
                      const inner = (
                        <>
                          <span aria-hidden className="w-4 shrink-0 text-center">
                            {glyph}
                          </span>
                          {sr && <span className="sr-only">{sr}: </span>}
                          <span className="truncate">
                            {isAr ? l.titleAr : l.titleEn}
                          </span>
                          {l.accessLevel === "PRO" && (
                            <span className="ms-auto shrink-0 font-mono text-[9px] uppercase text-gold">
                              pro
                            </span>
                          )}
                        </>
                      );
                      if (l.state === "locked") {
                        return (
                          <li key={l.id}>
                            <div
                              aria-disabled="true"
                              className={`flex flex-wrap items-baseline gap-2 px-2 py-1.5 text-xs text-faint ${isAr ? "flex-row-reverse text-right font-arabic" : ""}`}
                            >
                              <span aria-hidden>🔒</span>
                              <span className="truncate">
                                {isAr ? l.titleAr : l.titleEn}
                              </span>
                              <span className="font-mono text-[9px] uppercase tracking-wide text-gold">
                                {t.availableWithPro}
                              </span>
                            </div>
                          </li>
                        );
                      }
                      return (
                        <li key={l.id}>
                          <Link
                            href={`/${locale}/learn/${slug}/${l.slug}`}
                            aria-current={l.state === "current" ? "true" : undefined}
                            className={`flex items-baseline gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-hover hover:text-fg ${
                              l.state === "current"
                                ? "bg-indigo/15 font-semibold text-fg"
                                : "text-soft"
                            } ${isAr ? "flex-row-reverse text-right font-arabic" : ""}`}
                          >
                            {inner}
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </>
  );
}
