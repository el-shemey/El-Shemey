import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { SyllabusList } from "@/components/ui/syllabus";
import { HeroEnvironment } from "@/components/site/site-header";
import { HeroLearningDemo } from "@/components/viz/hero-learning-demo";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const syllabus = [
  { number: "01", title: "Introduction", titleAr: "مقدمة", access: "FREE" as const },
  {
    number: "02",
    title: "Claude Fundamentals",
    titleAr: "أساسيات كلاود",
    access: "FREE" as const,
  },
  {
    number: "03",
    title: "Context Engineering",
    titleAr: "هندسة السياق",
    access: "PRO" as const,
  },
  {
    number: "04",
    title: "Real-world Workflows",
    titleAr: "سير عمل حقيقي",
    access: "PRO" as const,
  },
];

/**
 * The EL-SHEMEY hero: a direct outcome promise, backed by the
 * LEARN → BUILD → RESULT demonstration. Locale-aware.
 */
export function HeroExperience({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const isAr = locale === "ar";
  return (
    <HeroEnvironment className="overflow-hidden rounded-lg border border-edge shadow-card">
      <div className="relative z-10 grid gap-10 px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16">
        {/* Copy */}
        <div className="flex flex-col items-start">
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`animate-settle font-mono text-xs tracking-[0.14em] text-electric ${
              isAr ? "font-arabic" : ""
            }`}
          >
            {dict.hero.eyebrow}
          </p>

          <h1
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cnH1(isAr)}
          >
            {dict.hero.h1Pre}{" "}
            <span className="relative inline-block whitespace-nowrap">
              {dict.hero.h1Hl}
              <svg
                aria-hidden
                viewBox="0 0 220 14"
                preserveAspectRatio="none"
                fill="none"
                className="absolute -bottom-1 start-0 h-3 w-full"
              >
                <path
                  d="M4 10 C 50 3, 120 2, 216 7"
                  stroke="#56c2ff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <path
                  d="M4 10 C 50 3, 120 2, 216 7"
                  stroke="#56c2ff"
                  strokeWidth="10"
                  strokeLinecap="round"
                  opacity="0.18"
                />
              </svg>
            </span>
            {dict.hero.h1Post}
          </h1>

          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`mt-6 max-w-md animate-settle-late text-base leading-relaxed text-soft sm:text-lg ${
              isAr ? "text-right font-arabic leading-loose" : ""
            }`}
          >
            {dict.hero.sub}
          </p>

          <div className="mt-9 flex flex-wrap gap-4 animate-settle-last">
            <Link href={`/${locale}/register`} className={buttonStyles({ size: "lg" })}>
              {dict.hero.ctaPrimary}
            </Link>
            <Link
              href={`/${locale}/courses`}
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              {dict.hero.ctaSecondary}
            </Link>
          </div>

          <p className="mt-8 font-mono text-xs text-faint">{dict.hero.micro}</p>
        </div>

        {/* LEARN → BUILD → RESULT */}
        <div className="self-center" aria-label={dict.home.pathKicker}>
          <HeroLearningDemo
            labels={{ aria: dict.hero.demoAria, steps: dict.hero.demoSr }}
            promptText={dict.hero.demoPrompt}
          />
        </div>
      </div>

      {/* Syllabus strip */}
      <div className="relative z-10 border-t border-edge bg-base/60 px-6 py-5 sm:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`shrink-0 font-mono text-[11px] tracking-[0.14em] text-faint ${
              isAr ? "font-arabic" : ""
            }`}
          >
            Claude Mastery — {dict.nav.startFree}
          </p>
          <SyllabusList
            rows={syllabus}
            className="border-y-0 divide-y divide-edge lg:flex-1 [&>li]:py-2.5"
          />
        </div>
      </div>
    </HeroEnvironment>
  );
}

function cnH1(isAr: boolean) {
  return [
    "mt-5 animate-settle-late font-bold tracking-tight text-3xl sm:text-[2.75rem] sm:leading-[1.15]",
    isAr ? "text-right font-arabic leading-[1.25]" : "leading-[1.08]",
  ].join(" ");
}
