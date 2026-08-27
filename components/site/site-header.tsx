"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";
import { ShimmyGlyph } from "@/components/character/shimmy";
import { HeroBackdrop } from "@/components/viz/technical";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Site header — the frame of the EL-SHEMEY world.
 * Client component for the drawer toggle and locale switching.
 */
export function SiteHeader({
  locale,
  dict,
  activeHref,
}: {
  locale: Locale;
  dict: Dictionary;
  activeHref?: string;
}) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: `/${locale}/courses`, label: dict.nav.courses },
    {
      href: `/${locale}/courses#path`,
      label: dict.nav.learningPath,
      hash: "#path",
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-base/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2"
          aria-label="EL-SHEMEY home"
        >
          <ShimmyGlyph />
          <span className="text-lg font-bold tracking-tight">
            EL-SHEMEY
            <span aria-hidden className="text-violet">
              .
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ms-2 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={activeHref === link.href ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-2 text-sm font-medium text-soft transition-colors hover:bg-hover hover:text-fg",
                activeHref === link.href && "bg-hover font-semibold text-fg",
              )}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="#pricing"
            aria-current={activeHref === "#pricing" ? "page" : undefined}
            className="rounded-sm px-3 py-2 text-sm font-medium text-soft transition-colors hover:bg-hover hover:text-fg"
          >
            {dict.nav.pricing}
          </a>
          <span aria-hidden className="mx-1 h-4 w-px bg-edge-strong" />
          <LanguageSwitcher locale={locale} />
        </nav>

        <div className="ms-auto hidden items-center gap-3 md:flex">
          <Link
            href={`/${locale}/login`}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            {dict.nav.signIn}
          </Link>
          <Link href={`/${locale}/register`} className={buttonStyles({ size: "sm" })}>
            {dict.nav.startFree}
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className="ms-auto inline-flex size-9 items-center justify-center rounded-sm border-2 border-edge-strong text-fg transition-colors hover:border-indigo md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4 stroke-current stroke-[1.5] fill-none"
          >
            {open ? (
              <path d="m3 3 10 10M13 3 3 13" strokeLinecap="round" />
            ) : (
              <path d="M2 4.5h12M2 8h12M2 11.5h12" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-edge bg-surface px-4 pb-5 pt-3 md:hidden"
        >
          <ul className="divide-y divide-edge border-y border-edge">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={activeHref === link.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block py-3 text-base",
                    activeHref === link.href ? "font-semibold text-fg" : "text-soft",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="#pricing"
                onClick={() => setOpen(false)}
                className="block py-3 text-base text-soft"
              >
                {dict.nav.pricing}
              </a>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <LanguageSwitcher locale={locale} />
            <div className="flex gap-2">
              <Link
                href={`/${locale}/login`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                {dict.nav.signIn}
              </Link>
              <Link
                href={`/${locale}/register`}
                className={buttonStyles({ size: "sm" })}
              >
                {dict.nav.startFree}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

/** Language switcher — navigates to the same route in the other locale. */
export function LanguageSwitcher({ locale = "en" }: { locale?: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const rest = pathname.split("/").slice(2).join("/");
  return (
    <div
      role="group"
      aria-label="Language / اللغة"
      className="flex overflow-hidden rounded-sm border border-edge-strong"
    >
      {(["en", "ar"] as const).map((code) => {
        const selected = code === locale;
        return (
          <Link
            key={code}
            href={`/${code}${rest ? `/${rest}` : ""}`}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors",
              selected
                ? "bg-indigo-strong text-white"
                : "bg-transparent text-soft transition-colors hover:bg-hover hover:text-fg",
            )}
          >
            {code}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Hero environment wrapper — mounts the layered grid scene behind the hero.
 */
export function HeroEnvironment({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <HeroBackdrop />
      <div className="relative">{children} </div>
    </div>
  );
}
