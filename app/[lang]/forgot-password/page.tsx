import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { ForgotPasswordFlow } from "@/features/auth/forms";
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
    title: getDict(lang).auth.forgotTitle,
    robots: { index: false },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";

  return (
    <>
      <SiteHeader locale={locale} dict={dict} />
      <main className="mx-auto grid w-full max-w-md flex-1 content-center px-4 py-16">
        <div className="rounded-md border border-edge bg-surface p-8 shadow-card">
          <h1
            id="auth-title"
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`text-center text-2xl font-bold tracking-tight ${isAr ? "font-arabic" : ""}`}
          >
            {dict.auth.forgotTitle}
          </h1>
          <p
            lang={isAr ? "ar" : "en"}
            dir={isAr ? "rtl" : "ltr"}
            className={`mb-8 mt-2 text-center text-sm text-faint ${isAr ? "font-arabic" : ""}`}
          >
            {dict.auth.forgotSub}
          </p>
          <ForgotPasswordFlow locale={locale} dict={dict} />
        </div>
      </main>
    </>
  );
}
