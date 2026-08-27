import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { buttonStyles } from "@/components/ui/button";
import { getUser } from "@/lib/server/auth/session";
import { getOwnPaymentView } from "@/lib/server/payments/service";
import { formatMoney } from "@/lib/money";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

/**
 * Payment status page (Phase 5).
 *
 * The state shown here is read server-side from the database — never from
 * query params, browser state or a client-side "success" callback. It
 * updates on navigation/refresh as the provider webhook lands.
 */

export const metadata: Metadata = { title: "Payment status" };

export default async function BillingStatusPage({
  params,
}: {
  params: Promise<{ lang: string; paymentId: string }>;
}) {
  const { lang, paymentId } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDict(locale);
  const isAr = locale === "ar";
  const t = dict.billing;

  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  // Ownership enforced: another user's payment id → notFound.
  const view = await getOwnPaymentView(user.id, paymentId);
  if (!view.found) notFound();

  const amount = formatMoney(view.amountMinor, view.currency, locale);

  let title: string;
  let desc: string;
  let tone: "ok" | "pending" | "error";
  switch (view.status) {
    case "SUCCEEDED":
      title = t.statusSucceededTitle;
      desc = t.statusSucceededDesc;
      tone = "ok";
      break;
    case "FAILED":
    case "EXPIRED":
      title = t.statusFailedTitle;
      desc = t.statusFailedDesc;
      tone = "error";
      break;
    case "CANCELLED":
      title = t.statusCancelledTitle;
      desc = t.statusCancelledDesc;
      tone = "error";
      break;
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      title = t.statusRefundedTitle;
      desc = t.statusRefundedDesc;
      tone = "error";
      break;
    default:
      title = t.statusPendingTitle;
      desc = t.statusPendingDesc;
      tone = "pending";
  }

  const toneClass =
    tone === "ok"
      ? "border-success text-success"
      : tone === "pending"
        ? "border-warning text-warning"
        : "border-error text-error";

  return (
    <>
      <SiteHeader locale={locale} dict={dict} activeHref={`/${locale}/courses`} />
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-16 sm:px-6">
        <div
          dir={isAr ? "rtl" : "ltr"}
          className={`rounded-md border border-edge bg-base p-8 ${isAr ? "text-right font-arabic" : ""}`}
        >
          <div
            className={`inline-block rounded-sm border-s-4 bg-raised px-3 py-1 text-xs font-semibold ${toneClass}`}
          >
            {title}
          </div>
          <p className="mt-5 leading-relaxed text-soft">{desc}</p>
          <p className="mt-2 font-mono text-sm text-faint" dir="ltr">
            {amount}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {tone === "ok" && (
              <Link href={`/${locale}/learn`} className={buttonStyles()}>
                {t.continueCta}
              </Link>
            )}
            {tone === "pending" && (
              <Link
                href={`/${locale}/billing/${paymentId}`}
                className={buttonStyles({ variant: "secondary" })}
              >
                {t.refreshCta}
              </Link>
            )}
            {tone === "error" && (
              <Link
                href={`/${locale}/courses`}
                className={buttonStyles({ variant: "secondary" })}
              >
                {t.backToCoursesCta}
              </Link>
            )}
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
