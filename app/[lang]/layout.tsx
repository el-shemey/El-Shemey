import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { fontVars } from "@/lib/fonts";
import { dirFor, isLocale, LOCALES, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const SITE_NAME = "EL-SHEMEY";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDict(lang);
  const title =
    lang === "ar"
      ? "إل-شمي — تعليم عملي للذكاء الاصطناعي"
      : `${SITE_NAME} — Practical AI education`;
  const description = dict.hero.sub;
  const baseEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  let metadataBase: URL | undefined;
  try {
    metadataBase = baseEnv ? new URL(baseEnv) : new URL("https://el-shemey.com");
  } catch {
    metadataBase = new URL("https://el-shemey.com");
  }
  return {
    metadataBase,
    title: { default: title, template: `%s · ${SITE_NAME}` },
    description,
    alternates: {
      canonical: `/${lang}`,
      languages: { en: "/en", ar: "/ar" },
    },
    openGraph: {
      title,
      description,
      locale: lang === "ar" ? "ar_EG" : "en_US",
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  return (
    <html
      /** Scoped suppression: browser extensions (e.g. LanguageTool) mutate
          <html> pre-hydration. Everything else stays fully checked - see
          docs/DESIGN_REVIEW_CHECKLIST.md "hydration" note. */
      suppressHydrationWarning
      lang={locale}
      dir={dirFor(locale)}
      className={`${fontVars} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-base font-sans text-fg">
        {children}
      </body>
    </html>
  );
}
