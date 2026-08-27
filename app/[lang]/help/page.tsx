import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { TechLabel } from "@/components/ui/text";
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
  const dict = getDict(lang);
  return {
    title: dict.help.title,
    description: dict.help.intro,
    alternates: { canonical: `/${lang}/help` },
  };
}

export default async function HelpPage({
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
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/help`} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-12 sm:px-6">
        <TechLabel>EL-SHEMEY · Help</TechLabel>
        <h1
          lang={isAr ? "ar" : "en"}
          dir={isAr ? "rtl" : "ltr"}
          className={`mt-4 text-3xl font-bold tracking-tight sm:text-5xl ${
            isAr ? "text-right font-arabic" : ""
          }`}
        >
          {dict.help.title}
        </h1>
        <p
          lang={isAr ? "ar" : "en"}
          dir={isAr ? "rtl" : "ltr"}
          className={`mt-4 leading-relaxed text-soft ${isAr ? "text-right font-arabic" : ""}`}
        >
          {dict.help.intro}
        </p>

        <dl className="mt-10 divide-y divide-edge border-y border-edge">
          {dict.help.faq.map((item) => (
            <div key={item.q} className="py-6">
              <dt
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={`font-semibold ${isAr ? "text-right font-arabic" : ""}`}
              >
                {item.q}
              </dt>
              <dd
                lang={isAr ? "ar" : "en"}
                dir={isAr ? "rtl" : "ltr"}
                className={`mt-2 max-w-prose text-sm leading-relaxed text-soft ${
                  isAr ? "text-right font-arabic" : ""
                }`}
              >
                {item.a}
              </dd>
            </div>
          ))}
        </dl>

        <p
          lang={isAr ? "ar" : "en"}
          dir={isAr ? "rtl" : "ltr"}
          className={`mt-10 text-sm text-faint ${isAr ? "text-right font-arabic" : ""}`}
        >
          {dict.help.moreHelp}
        </p>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
