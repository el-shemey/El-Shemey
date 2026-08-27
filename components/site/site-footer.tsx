import Link from "next/link";
import { cn } from "@/lib/cn";
import { LanguageSwitcher } from "@/components/site/site-header";
import { ShimmyGlyph } from "@/components/character/shimmy";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Compact premium footer. Legal copy explicitly marked as pending review. */
export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const isAr = locale === "ar";
  const cols = [
    [
      { label: dict.home.footerCourses, href: `/${locale}/courses` },
      { label: dict.nav.learningPath, href: `/${locale}/courses#path` },
      { label: dict.home.footerPricing, href: `/${locale}/#pricing` },
    ],
    [
      { label: dict.home.footerAbout, href: "#" },
      { label: dict.home.footerHelp, href: "#" },
    ],
    [
      { label: dict.home.footerPrivacy, href: "#" },
      { label: dict.home.footerTerms, href: "#" },
    ],
  ];

  return (
    <footer className="border-t border-edge bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="flex items-center gap-2">
            <ShimmyGlyph />
            <span className="text-lg font-bold tracking-tight">
              EL-SHEMEY
              <span aria-hidden className="text-violet">
                .
              </span>
            </span>
          </div>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={cn(
              "mt-3 max-w-xs text-sm leading-relaxed text-faint",
              isAr && "font-arabic",
            )}
          >
            {dict.home.footerTagline}
          </p>
          <div className="mt-5">
            <LanguageSwitcher locale={locale} />
          </div>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {cols.map((col, i) => (
            <ul key={i} className="space-y-2.5">
              {col.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-soft transition-colors hover:text-electric"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </div>

      <div className="border-t border-edge px-4 py-4 sm:px-6">
        <p
          lang={isAr ? "ar" : "en"}
          dir={isAr ? "rtl" : "ltr"}
          className={cn(
            "mx-auto max-w-6xl font-mono text-[11px] text-faint",
            isAr && "font-arabic",
          )}
        >
          © 2026 EL-SHEMEY · {dict.home.footerLegal}
        </p>
      </div>
    </footer>
  );
}
