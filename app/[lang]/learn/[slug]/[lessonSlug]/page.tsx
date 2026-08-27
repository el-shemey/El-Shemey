import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { Shimmy } from "@/components/character/shimmy";
import { ProgressBar } from "@/components/ui/progress";
import { buttonStyles } from "@/components/ui/button";
import { completeLessonAction } from "@/features/learn/actions";
import { LessonPlayer } from "@/components/video/lesson-player";
import { SiteFooter } from "@/components/site/site-footer";
import { getUser } from "@/lib/server/auth/session";
import { getLessonView, getPreviewLessonView } from "@/lib/server/learner";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Lesson",
  robots: { index: false },
};

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; lessonSlug: string }>;
}) {
  const { lang, slug, lessonSlug } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";

  // Fresh server-side authorization (middleware gate is presence-only).
  const user = await getUser();
  if (!user) {
    // Free-preview path: published FREE lessons are public per the access
    // model — content renders, but video + progress require an account.
    const preview = await getPreviewLessonView(slug, lessonSlug);
    if (preview.status === "NOT_FOUND") notFound();
    if (preview.status === "LOCKED") {
      redirect(`/${locale}/login?callbackUrl=/${locale}/learn/${slug}/${lessonSlug}`);
    }
    const body = isAr ? preview.descriptionAr : preview.descriptionEn;
    return (
      <>
        <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/learn`} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-12 sm:px-6">
          <nav aria-label="Course path" className="flex gap-2 text-xs text-faint">
            <Link href={`/${locale}/courses/${slug}`} className="hover:text-electric">
              {preview.courseTitleEn}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-soft">{preview.moduleTitleEn}</span>
          </nav>
          <h1
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`mt-6 text-2xl font-bold tracking-tight sm:text-3xl ${isAr ? "text-right font-arabic" : ""}`}
          >
            {isAr ? preview.lessonTitleAr : preview.lessonTitleEn}
          </h1>

          <div
            role="status"
            dir={isAr ? "rtl" : "ltr"}
            className={`mt-6 rounded-md border border-gold/40 bg-surface p-5 ${isAr ? "text-right font-arabic" : ""}`}
          >
            <p className="text-sm font-semibold">{dict.learn.previewNoteTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-faint">
              {dict.learn.previewNoteDesc}
            </p>
            <Link
              href={`/${locale}/register`}
              className={`${buttonStyles()} mt-4 inline-block`}
            >
              {dict.auth.registerCta}
            </Link>
          </div>

          {preview.blocks.length > 0 ? (
            <LessonBlocks blocks={preview.blocks} isAr={isAr} />
          ) : (
            body && (
              <div
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={`mt-8 max-w-prose space-y-4 leading-relaxed text-soft ${isAr ? "text-right font-arabic leading-loose" : ""}`}
              >
                {body.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )
          )}
        </main>
        <SiteFooter locale={locale} dict={dict} />
      </>
    );
  }

  const view = await getLessonView(user.id, locale, slug, lessonSlug);

  /* ------------------------- Guarded states ------------------------------ */

  if (view.status === "NO_ENROLLMENT") {
    // Direct-URL access without enrollment → public detail page owns the
    // Start-course flow; nothing of this lesson leaks.
    redirect(`/${locale}/courses/${slug}`);
  }

  if (view.status === "LESSON_NOT_FOUND") notFound();

  if (view.status === "LOCKED") {
    return (
      <>
        <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/learn`} />
        <main className="mx-auto grid w-full max-w-md flex-1 content-center px-4 py-20">
          <div className="rounded-md border border-gold/40 bg-surface p-10 text-center shadow-card">
            <Shimmy mood="thinking" size={110} className="floaty mx-auto" />
            <h1
              lang={isAr ? "ar" : "en"}
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-6 text-xl font-bold tracking-tight ${isAr ? "font-arabic" : ""}`}
            >
              {dict.learn.lockedTitle}
            </h1>
            <p
              lang={isAr ? "ar" : "en"}
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-3 text-sm leading-relaxed text-soft ${isAr ? "font-arabic" : ""}`}
            >
              {dict.learn.lockedDesc}
            </p>
            <Link
              href={`/${locale}/#pricing`}
              className="mt-8 inline-block rounded-sm bg-indigo px-7 py-3 text-sm font-semibold text-white hover:bg-indigo-strong"
            >
              {dict.learn.upgradeCta}
            </Link>
            <p className="mt-6">
              <Link
                href={`/${locale}/learn`}
                className="text-xs font-semibold underline decoration-electric underline-offset-4 hover:text-electric"
              >
                ← {dict.learn.dashTitle}
              </Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  /* --------------------------- Player render ----------------------------- */
  const v = view;
  if (v.status !== "OK") {
    // Exhaustive guard — all non-OK states handled above.
    notFound();
  }

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/learn`} />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="min-w-0">
          {/* Breadcrumbs */}
          <nav
            aria-label="Course path"
            className="flex flex-wrap items-baseline gap-x-2 text-xs text-faint"
          >
            <Link href={`/${locale}/learn`} className="hover:text-electric">
              {dict.learn.dashTitle}
            </Link>
            <span aria-hidden>/</span>
            <span>{v.courseTitleEn}</span>
            <span aria-hidden>/</span>
            <span className="text-soft">{v.moduleTitleEn}</span>
          </nav>

          {/* Video area — authorization already enforced server-side */}
          <section aria-label="Video player" className="mt-5">
            {v.video.allowed ? (
              <LessonPlayer
                src={v.video.playbackUrl}
                courseSlug={slug}
                lessonSlug={lessonSlug}
                resumeAt={v.resumeAt}
                alreadyCompleted={v.completed}
                completionThreshold={v.completionThreshold ?? undefined}
                strings={{
                  errorTitle: dict.learn.videoErrorTitle,
                  errorRetry: dict.learn.videoErrorRetry,
                  completeUnlocked: isAr
                    ? "اكتملت نسبة كافية — تقدر تحدد الدرس كمكتمل"
                    : "Enough watched — you can mark the lesson complete",
                }}
              />
            ) : (
              <div
                role="status"
                className="grid aspect-video w-full place-items-center rounded-md border border-edge bg-surface p-6 text-center"
              >
                <div>
                  {v.video.reason === "ACCESS_DENIED" ? (
                    <>
                      <Shimmy
                        mood="thinking"
                        size={90}
                        className="floaty mx-auto opacity-80"
                      />
                      <p className="mt-3 text-sm font-semibold">
                        {dict.learn.videoDeniedTitle}
                      </p>
                      <p
                        className={`mt-1 text-xs text-faint ${isAr ? "font-arabic" : ""}`}
                      >
                        {dict.learn.videoDeniedDesc}
                      </p>
                    </>
                  ) : (
                    <>
                      <Shimmy
                        mood="sleepy"
                        size={90}
                        className="floaty mx-auto opacity-80"
                      />
                      <p className="mt-3 text-sm font-semibold">
                        {dict.learn.videoPendingTitle}
                      </p>
                      <p
                        className={`mt-1 text-xs text-faint ${isAr ? "font-arabic" : ""}`}
                      >
                        {dict.learn.videoPendingDesc}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Lesson header */}
          <h1
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`mt-8 text-2xl font-bold tracking-tight sm:text-3xl ${
              isAr ? "text-right font-arabic" : ""
            }`}
          >
            {v.lessonTitleEn}
          </h1>
          <p
            lang="ar"
            dir="rtl"
            className="mt-2 text-right font-arabic text-lg text-violet"
          >
            {v.lessonTitleAr}
          </p>

          {/* Completed banner — subtle momentum, not spectacle */}
          {v.completed && (
            <p
              role="status"
              className={`mt-4 inline-block rounded-sm border border-success/40 bg-raised px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-success ${isAr ? "font-arabic" : ""}`}
            >
              ✓ {dict.learn.done}
            </p>
          )}

          {/* Lesson body — structured blocks first, legacy paragraphs fallback */}
          {v.blocks.length > 0 ? (
            <LessonBlocks blocks={v.blocks} isAr={isAr} />
          ) : (
            (() => {
              const body = isAr ? v.descriptionAr : v.descriptionEn;
              if (!body) {
                return (
                  <div className="mt-6 rounded-sm border-s-2 border-line bg-raised px-4 py-3">
                    <p
                      lang={isAr ? "ar" : "en"}
                      dir={isAr ? "rtl" : "ltr"}
                      className={`text-xs leading-relaxed text-faint ${isAr ? "font-arabic" : ""}`}
                    >
                      {dict.learn.contentPending}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  lang={isAr ? "ar" : "en"}
                  dir={isAr ? "rtl" : "ltr"}
                  className={`mt-6 max-w-prose space-y-4 leading-relaxed text-soft ${isAr ? "text-right font-arabic leading-loose" : ""}`}
                >
                  {body.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              );
            })()
          )}

          {/* Resources & downloads */}
          {(v.resources.length > 0 || v.attachments.length > 0) && (
            <section aria-labelledby="res-heading" className="mt-8">
              <h2
                id="res-heading"
                className={`font-mono text-[11px] uppercase tracking-[0.18em] text-faint ${isAr ? "text-right font-arabic" : ""}`}
              >
                {dict.learn.resources}
              </h2>
              <ul className="mt-3 space-y-2">
                {[...v.resources, ...v.attachments].map((r) => (
                  <li key={r.url}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      dir="ltr"
                      className="inline-flex items-center gap-2 rounded-sm border border-edge bg-surface px-3 py-2 text-sm text-soft transition-colors hover:border-indigo hover:text-fg"
                    >
                      <span aria-hidden>↗</span> {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Course complete — restrained celebration */}
          {v.completed && v.courseCompleted && (
            <div
              role="status"
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-8 rounded-md border border-success/40 bg-raised p-6 text-center ${isAr ? "text-right font-arabic" : ""}`}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success">
                ✓ {dict.learn.courseCompleteTitle}
              </p>
              <p
                lang={isAr ? "ar" : "en"}
                className={`mt-2 text-sm font-semibold ${isAr ? "font-arabic" : ""}`}
              >
                {dict.learn.courseCompleteDesc}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/${locale}/learn/${slug}`}
                  className={buttonStyles({ variant: "secondary" })}
                >
                  {dict.learn.reviewCourseCta}
                </Link>
                <Link href={`/${locale}/courses`} className={buttonStyles()}>
                  {dict.learn.exploreMoreCta}
                </Link>
              </div>
            </div>
          )}

          {/* Completion + navigation */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-6">
            <Link
              href={`/${locale}/learn/${slug}`}
              className={`text-xs font-semibold text-faint underline decoration-electric decoration-2 underline-offset-4 hover:text-electric ${isAr ? "font-arabic" : ""}`}
            >
              {dict.learn.backToCourse}
            </Link>

            {v.prevHref ? (
              <Link
                href={v.prevHref}
                className="rounded-sm border-2 border-edge-strong px-4 py-2.5 text-sm font-semibold transition-colors hover:border-indigo"
              >
                ← {dict.learn.prev}
              </Link>
            ) : (
              <span aria-hidden className="w-24" />
            )}

            {/* Smart next: server-resolved first OPEN lesson — never locked */}
            {v.completed && v.nextAvailableHref ? (
              <Link
                href={v.nextAvailableHref}
                className="rounded-sm bg-indigo px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-strong"
              >
                {dict.learn.next} →
              </Link>
            ) : null}

            {!v.completed && (
              <form action={completeLessonAction.bind(null, locale, slug, lessonSlug)}>
                <button
                  type="submit"
                  className="rounded-sm bg-beginner px-6 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-0.5"
                >
                  ✓ {dict.learn.markComplete}
                  {v.nextAvailableHref ? ` · ${dict.learn.next} →` : ""}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Curriculum sidebar */}
        <aside
          aria-label={dict.learn.curriculum}
          className="lg:sticky lg:top-20 h-fit rounded-md border border-edge bg-surface p-4"
        >
          <details open className="group lg:open" data-open-mobile>
            <summary className="cursor-pointer list-none font-mono text-[11px] uppercase tracking-[0.18em] text-faint [&::-webkit-details-marker]:hidden lg:pointer-events-none">
              {dict.learn.curriculum}
            </summary>
            <ol className="mt-3 space-y-4">
              {groupCurriculum(v.curriculum).map((group, gi) => {
                const containsCurrent = group.items.some((i) => i.state === "current");
                return (
                  <li key={group.moduleId}>
                    {/* Module header — collapse/expand, current module open */}
                    <details
                      open={containsCurrent || gi === 0}
                      className="group/module"
                    >
                      <summary
                        className={`flex cursor-pointer list-none items-center justify-between rounded-sm px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-hover [&::-webkit-details-marker]:hidden ${
                          containsCurrent ? "text-electric" : "text-faint"
                        }`}
                      >
                        <span>
                          {isAr ? "وحدة" : "Module"} {String(gi + 1).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden
                          className="text-faint group-open/module:hidden"
                        >
                          +
                        </span>
                        <span
                          aria-hidden
                          className="text-faint hidden group-open/module:inline"
                        >
                          –
                        </span>
                      </summary>
                      <ol className="mt-1 divide-y divide-edge">
                        {group.items.map((item) => {
                          const active = item.state === "current";
                          const glyph =
                            item.state === "done"
                              ? "✓"
                              : item.state === "current"
                                ? "▶"
                                : item.state === "locked"
                                  ? "🔒"
                                  : "○";
                          const sr =
                            item.state === "done"
                              ? dict.learn.done
                              : item.state === "current"
                                ? dict.learn.curriculumCurrentSr
                                : item.state === "locked"
                                  ? dict.learn.curriculumLockedSr
                                  : null;
                          return (
                            <li key={item.id}>
                              <Link
                                href={item.state === "locked" ? "#" : item.href}
                                aria-current={active ? "true" : undefined}
                                aria-disabled={
                                  item.state === "locked" ? "true" : undefined
                                }
                                className={`flex items-baseline gap-2 rounded-sm px-2 py-2 text-xs transition-colors ${
                                  active
                                    ? "bg-indigo/15 font-semibold text-fg"
                                    : item.state === "locked"
                                      ? "cursor-not-allowed text-faint"
                                      : "text-soft hover:bg-hover hover:text-fg"
                                }`}
                              >
                                <span aria-hidden className="w-3 shrink-0 text-center">
                                  {glyph}
                                </span>
                                {sr && <span className="sr-only">{sr}: </span>}
                                <span className="truncate">{item.titleEn}</span>
                                {item.durationSeconds != null && (
                                  <span
                                    dir="ltr"
                                    className="ms-auto shrink-0 font-mono text-[9px] tabular-nums text-faint"
                                  >
                                    {formatDuration(item.durationSeconds)}
                                  </span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ol>
          </details>

          <div className="mt-5 border-t border-edge pt-4">
            <ProgressBar
              value={v.progress.percent}
              label={dict.learn.curriculum}
              size="sm"
              showValue
            />
            <p className="mt-2 font-mono text-[10px] tabular-nums text-faint">
              {v.progress.completedCount}/{v.progress.publishedLessons}{" "}
              {dict.learn.done}
            </p>
          </div>
        </aside>
      </main>
    </>
  );
}

function groupCurriculum<T extends { moduleId: string }>(
  items: T[],
): Array<{ moduleId: string; items: T[] }> {
  const groups: Array<{ moduleId: string; items: T[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.moduleId === item.moduleId) {
      last.items.push(item);
    } else {
      groups.push({ moduleId: item.moduleId, items: [item] });
    }
  }
  return groups;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function LessonBlocks({
  blocks,
  isAr,
}: {
  blocks: import("@/lib/content").LessonBlock[];
  isAr: boolean;
}) {
  const dir = isAr ? "rtl" : "ltr";
  const lang = isAr ? "ar" : "en";
  const text = (b: { en: string; ar?: string }) => (isAr && b.ar ? b.ar : b.en);
  const arabic = (b: { en: string; ar?: string }) => Boolean(isAr && b.ar);

  return (
    <div className="mt-6 max-w-prose space-y-5">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "p":
            return (
              <p
                key={i}
                lang={lang}
                dir={dir}
                className={`leading-relaxed text-soft ${arabic(block) ? "text-right font-arabic leading-loose" : ""}`}
              >
                {text(block)}
              </p>
            );
          case "h":
            return (
              <h3
                key={i}
                lang={lang}
                dir={dir}
                className={`pt-2 text-lg font-bold tracking-tight text-fg ${arabic(block) ? "text-right font-arabic" : ""}`}
              >
                {text(block)}
              </h3>
            );
          case "code":
            return (
              <pre
                key={i}
                dir="ltr"
                className="overflow-x-auto rounded-md border border-edge bg-base p-4 font-mono text-xs leading-relaxed text-electric"
              >
                <code data-lang={block.lang}>{block.code}</code>
              </pre>
            );
          case "callout":
          case "tip":
          case "warning": {
            const tone =
              block.kind === "warning"
                ? "border-warning/60 text-warning"
                : block.kind === "tip"
                  ? "border-success/60 text-success"
                  : "border-indigo/50 text-soft";
            return (
              <aside
                key={i}
                lang={lang}
                dir={dir}
                className={`rounded-sm border-s-2 bg-raised px-4 py-3 text-sm leading-relaxed ${tone} ${arabic(block) ? "text-right font-arabic" : ""}`}
              >
                {text(block)}
              </aside>
            );
          }
          case "checklist":
            return (
              <ul
                key={i}
                dir={dir}
                className={`space-y-2 ${isAr ? "ps-0 pe-1 text-right" : ""}`}
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    className={`flex items-start gap-2.5 text-sm text-soft ${isAr ? "flex-row-reverse font-arabic" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-xs border text-[9px] ${
                        item.done
                          ? "border-beginner bg-beginner/20 text-beginner"
                          : "border-edge-strong text-transparent"
                      }`}
                    >
                      ?
                    </span>
                    <span>{text(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "exercise":
            return (
              <div
                key={i}
                lang={lang}
                dir={dir}
                className={`rounded-md border border-dashed border-indigo/50 bg-surface p-5 ${arabic(block) ? "text-right font-arabic" : ""}`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo">
                  Exercise
                </p>
                <p className="mt-2 text-sm leading-relaxed text-soft">{text(block)}</p>
              </div>
            );
          case "image":
            return (
              // eslint-disable-next-line @next/next/no-img-element -- remote lesson media, explicit dimensions unknown
              <img
                key={i}
                src={block.url}
                alt={isAr && block.altAr ? block.altAr : block.altEn}
                loading="lazy"
                className="w-full rounded-md border border-edge"
              />
            );
          case "quote":
            return (
              <blockquote
                key={i}
                lang={lang}
                dir={dir}
                className={`border-s-2 border-violet/60 bg-raised px-5 py-3 text-sm italic leading-relaxed text-soft ${arabic(block) ? "text-right font-arabic" : ""}`}
              >
                {text(block)}
                {block.attribution && (
                  <footer className="mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">
                    — {block.attribution}
                  </footer>
                )}
              </blockquote>
            );
          case "divider":
            return <hr key={i} aria-hidden className="my-6 border-edge" />;
          case "table":
            return (
              <div
                key={i}
                dir="ltr"
                className="overflow-x-auto rounded-md border border-edge"
              >
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {block.headers.map((h, j) => (
                        <th
                          key={j}
                          className="border-b border-edge bg-raised px-3 py-2 text-start font-mono text-[10px] uppercase tracking-widest text-faint"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="odd:bg-surface even:bg-base">
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className="border-b border-edge px-3 py-2 text-soft"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
