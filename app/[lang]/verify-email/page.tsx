import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { Shimmy } from "@/components/character/shimmy";
import { VerifyAnyIdentifierForm } from "@/features/auth/forms";
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
  return {
    title: getDict(lang).auth.verifyPendingTitle,
    robots: { index: false },
  };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ identifier?: string }>;
}) {
  const [{ lang }, { identifier }] = await Promise.all([params, searchParams]);
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";

  return (
    <>
      <SiteHeader locale={locale} dict={dict} />
      <main className="mx-auto grid w-full max-w-md flex-1 content-center px-4 py-16">
        <div className="rounded-md border border-edge bg-surface p-8 shadow-card">
          <Shimmy
            mood="thinking"
            size={72}
            className="mx-auto -mt-16 mb-4 rounded-full border-4 border-base bg-surface"
          />
          <h1
            id="auth-title"
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`text-center text-2xl font-bold tracking-tight ${isAr ? "font-arabic" : ""}`}
          >
            {dict.auth.verifyPendingTitle}
          </h1>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`mb-8 mt-2 text-center text-sm text-faint ${isAr ? "font-arabic" : ""}`}
          >
            {dict.auth.verifyPendingDesc}
          </p>
          <VerifyAnyIdentifierForm
            locale={locale}
            dict={dict}
            initialIdentifier={identifier ?? ""}
          />
        </div>
      </main>
    </>
  );
}
