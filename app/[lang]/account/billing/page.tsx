import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false },
};

/**
 * Student billing area (Phase 7A).
 *
 * Ownership: every query is scoped to the verified session user — no other
 * account's payment/subscription data can ever appear here. Status shown is
 * read from the database (webhook/admin-confirmed truth), never from a
 * frontend redirect. Provider references are truncated identifiers only;
 * no secrets, tokens or provider payloads are exposed.
 */

function money(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${major.toFixed(2)} ${currency}`;
}

export default async function AccountBillingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";
  const t = dict.account;

  const user = await getUser();
  if (!user) redirect(`/${locale}/login?callbackUrl=/${locale}/account/billing`);

  const [subscriptions, payments] = await Promise.all([
    db.subscription.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { plan: { select: { nameEn: true, nameAr: true, interval: true } } },
      take: 10,
    }),
    db.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        method: true,
        status: true,
        amountMinor: true,
        currency: true,
        createdAt: true,
        paidAt: true,
      },
      take: 20,
    }),
  ]);

  const current =
    subscriptions.find(
      (s) =>
        s.status === "ACTIVE" && s.currentPeriodEnd && s.currentPeriodEnd > new Date(),
    ) ?? null;

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/learn`} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-12 sm:px-6">
        <nav aria-label="Account" className="flex gap-2 text-xs text-faint">
          <Link href={`/${locale}/learn`} className="hover:text-electric">
            {dict.learn.dashTitle}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-soft">{t.title}</span>
        </nav>

        <h1
          lang={isAr ? "ar" : "en"}
          dir={isAr ? "rtl" : "ltr"}
          className={`mt-4 text-2xl font-bold tracking-tight ${isAr ? "text-right font-arabic" : ""}`}
        >
          {t.title}
        </h1>

        {/* Current plan / entitlement */}
        <section aria-labelledby="plan-heading" className="mt-8">
          <h2
            id="plan-heading"
            className={`font-mono text-[11px] uppercase tracking-[0.18em] text-faint ${isAr ? "text-right font-arabic" : ""}`}
          >
            {t.currentPlan}
          </h2>
          {current ? (
            <div
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-3 rounded-md border border-success/40 bg-surface p-5 ${isAr ? "text-right font-arabic" : ""}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {isAr ? current.plan.nameAr : current.plan.nameEn}
                </p>
                <span className="font-mono text-xs uppercase text-success">
                  ✓ {current.status}
                </span>
              </div>
              <dl className="mt-3 space-y-1 font-mono text-[11px] tabular-nums text-faint">
                <div className="flex justify-between gap-4">
                  <dt>{t.startDate}</dt>
                  <dd>
                    {current.currentPeriodStart?.toISOString().slice(0, 10) ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{t.expiryDate}</dt>
                  <dd>{current.currentPeriodEnd?.toISOString().slice(0, 10) ?? "—"}</dd>
                </div>
              </dl>
              <p className={`mt-3 text-xs text-success ${isAr ? "font-arabic" : ""}`}>
                ✓ {t.proActive}
              </p>
            </div>
          ) : subscriptions.some((s) => s.status === "PAST_DUE") ? (
            <div
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-3 rounded-md border border-warning/50 bg-surface p-5 ${isAr ? "text-right font-arabic" : ""}`}
            >
              <p className="font-semibold text-warning">{t.pastDueTitle}</p>
              <p className={`mt-1 text-xs text-faint ${isAr ? "font-arabic" : ""}`}>
                {t.pastDueDesc}
              </p>
            </div>
          ) : (
            <div
              dir={isAr ? "rtl" : "ltr"}
              className={`mt-3 rounded-md border border-edge bg-surface p-5 ${isAr ? "text-right font-arabic" : ""}`}
            >
              <p className="font-semibold">{t.noPlanTitle}</p>
              <p className={`mt-1 text-xs text-faint ${isAr ? "font-arabic" : ""}`}>
                {t.noPlanDesc}
              </p>
            </div>
          )}
        </section>

        {/* Payment history */}
        <section aria-labelledby="history-heading" className="mt-10">
          <h2
            id="history-heading"
            className={`border-b border-edge pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faint ${isAr ? "text-right font-arabic" : ""}`}
          >
            {t.history}
          </h2>
          <ul className="divide-y divide-edge">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3"
              >
                <span dir="ltr" className="font-mono text-xs text-soft">
                  {p.method}
                </span>
                <span className="font-mono text-sm tabular-nums" dir="ltr">
                  {money(p.amountMinor, p.currency)}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase ${
                    p.status === "SUCCEEDED"
                      ? "text-success"
                      : p.status === "FAILED"
                        ? "text-error"
                        : "text-warning"
                  }`}
                >
                  {p.status}
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-[11px] tabular-nums text-faint"
                >
                  {(p.paidAt ?? p.createdAt).toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
            {payments.length === 0 && (
              <li className="py-6 text-center text-xs text-faint">{t.noPayments}</li>
            )}
          </ul>
        </section>

        <p
          dir={isAr ? "rtl" : "ltr"}
          className={`mt-8 font-mono text-[10px] leading-relaxed text-faint ${isAr ? "text-right font-arabic" : ""}`}
        >
          {t.disclaimer}
        </p>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
