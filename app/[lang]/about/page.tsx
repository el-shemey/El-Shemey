import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GridSurface, SigmoidCurve } from "@/components/viz/technical";
import { Shimmy } from "@/components/character/shimmy";
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
    title: dict.about.title,
    description: dict.about.intro,
    alternates: { canonical: `/${lang}/about` },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";

  const tx = (text: string, extra = "") => ({
    lang: isAr ? "ar" : "en",
    dir: isAr ? ("rtl" as const) : ("ltr" as const),
    className: cnTx(extra, isAr),
    children: text,
  });

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/about`} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-12 sm:px-6">
        <TechLabel>EL-SHEMEY · {dict.nav.courses}</TechLabel>
        <h1
          {...tx(
            dict.about.title,
            "mt-4 text-3xl font-bold tracking-tight sm:text-5xl",
          )}
        />
        <p {...tx(dict.about.intro, "mt-6 max-w-prose leading-relaxed text-soft")} />

        {/* Mission */}
        <section aria-labelledby="mission-heading" className="py-14">
          <GridSurface className="p-8">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-8">
              <div className="max-w-md">
                <h2
                  id="mission-heading"
                  {...tx(dict.about.missionTitle, "text-xl font-bold tracking-tight")}
                />
                <p
                  {...tx(
                    dict.about.missionBody,
                    "mt-3 text-sm leading-relaxed text-soft",
                  )}
                />
              </div>
              <Shimmy mood="thinking" size={120} className="floaty" />
              <SigmoidCurve className="w-40 opacity-70" />
            </div>
          </GridSurface>
        </section>

        {/* Values */}
        <section aria-labelledby="values-heading" className="pb-8">
          <h2 id="values-heading" className="mb-6 text-2xl font-bold tracking-tight">
            {dict.about.valuesTitle}
          </h2>
          <ol className="divide-y divide-edge border-y border-edge">
            {dict.about.values.map((v, i) => (
              <li key={v} className="flex items-baseline gap-5 py-5">
                <span className="font-mono text-sm text-violet">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span {...tx(v, "text-base font-medium")} />
              </li>
            ))}
          </ol>
          <p {...tx(dict.about.contactNote, "mt-8 text-sm text-faint")} />
        </section>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}

function cnTx(extra: string, isAr: boolean) {
  return [extra, isAr ? "text-right font-arabic" : ""].filter(Boolean).join(" ");
}
