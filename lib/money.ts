import type { Locale } from "@/lib/i18n/config";

/**
 * Money formatting from integer minor units (client-safe, pure).
 * Floating point never touches stored amounts — parsing happens only here,
 * at the render boundary.
 */
export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: Locale,
): string {
  const major = amountMinor / 100;
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
  return currency === "EGP"
    ? locale === "ar"
      ? `${formatted} جنيه`
      : `EGP ${formatted}`
    : `${formatted} ${currency}`;
}
