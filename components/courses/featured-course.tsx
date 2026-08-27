import Link from "next/link";
import { cn } from "@/lib/cn";
import { AccessStamp, LevelBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Shimmy } from "@/components/character/shimmy";
import { CoordinateTag, GridSurface } from "@/components/viz/technical";
import type { CourseSeed } from "@/lib/courses";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The featured destination — a dominant editorial panel, not a card.
 * Shared by the homepage and the course explorer.
 */
export function FeaturedCourse({
  locale,
  dict,
  course,
  ctaHrefBase,
}: {
  locale: Locale;
  dict: Dictionary;
  course: CourseSeed;
  /** e.g. "/en" — detail link becomes `${ctaHrefBase}/courses/${slug}` */
  ctaHrefBase: string;
}) {
  const isAr = locale === "ar";
  return (
    <GridSurface className="overflow-hidden shadow-card">
      <div className="relative z-10 grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <CoordinateTag value="destination 01" />
            <AccessStamp kind={course.access} />
            <LevelBadge level={course.level} />
          </div>

          <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {course.title[locale]}
          </h3>
          {!isAr && (
            <p lang="ar" dir="rtl" className="mt-1 font-arabic text-base text-violet">
              {course.title.ar}
            </p>
          )}

          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-4 max-w-prose text-sm leading-relaxed text-soft",
              isAr && "text-right font-arabic",
            )}
          >
            {course.description[locale]}
          </p>

          <p className="mt-4 font-mono text-xs tabular-nums text-faint">
            {course.modules} {dict.course.modules} · {course.lessons}{" "}
            {dict.course.lessons} · ~{course.hours}
            {dict.course.hours}
          </p>

          {typeof course.progressPercent === "number" && (
            <ProgressBar
              value={course.progressPercent}
              label={course.title.en}
              showValue
              className="mt-4 max-w-xs"
            />
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`${ctaHrefBase}/courses/${course.slug}`}
              className={buttonStyles({})}
            >
              {dict.explorer.featuredCta1}
            </Link>
            <Link href="#explorer" className={buttonStyles({ variant: "secondary" })}>
              {dict.explorer.featuredCta2}
            </Link>
          </div>
        </div>

        {/* Shimmy inspects the featured destination */}
        <div className="relative mx-auto hidden lg:block" aria-hidden>
          <Shimmy mood="thinking" size={150} className="floaty" />
          <CoordinateTag
            value="inspect"
            className="absolute -bottom-1 start-1/2 -translate-x-1/2 rtl:translate-x-1/2"
          />
        </div>
      </div>
    </GridSurface>
  );
}
