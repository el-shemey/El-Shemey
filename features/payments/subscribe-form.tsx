"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { startCheckoutAction, type CheckoutState } from "@/features/payments/actions";

/**
 * Subscribe form (Phase 5).
 * Payment-method selection + honest state feedback. The browser never
 * decides payment success — this only forwards to the server action and
 * reflects the coarse result it returns.
 */

const METHODS = ["CARD", "VODAFONE_CASH", "FAWRY", "INSTAPAY"] as const;
type Method = (typeof METHODS)[number];

const METHOD_HINTS: Record<Method, { icon: string }> = {
  CARD: { icon: "💳" },
  VODAFONE_CASH: { icon: "📱" },
  FAWRY: { icon: "🏪" },
  INSTAPAY: { icon: "🏦" },
};

export function SubscribeForm({
  locale,
  planSlug,
  dict,
}: {
  locale: Locale;
  planSlug: string;
  dict: Dictionary;
}) {
  const t = dict.billing;
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    startCheckoutAction.bind(null, locale, planSlug),
    {},
  );

  return (
    <form action={formAction} className="mt-4">
      <fieldset disabled={pending} className="space-y-2">
        <legend className="text-sm font-medium">{t.chooseMethod}</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METHODS.map((m) => (
            <label
              key={m}
              className="group relative flex cursor-pointer flex-col items-center rounded-sm border border-edge bg-base/70 px-3 py-3 text-center transition-colors has-checked:border-indigo has-checked:bg-raised hover:border-indigo"
            >
              <input
                type="radio"
                name="method"
                value={m}
                defaultChecked={m === "CARD"}
                className="sr-only"
              />
              <span aria-hidden className="text-xl">
                {METHOD_HINTS[m].icon}
              </span>
              <span className="mt-1 text-xs font-semibold text-fg" dir="ltr">
                {t[`method_${m}`]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className={`${buttonStyles({ size: "lg" })} mt-5 w-full sm:w-auto`}
      >
        {pending ? t.starting : t.subscribeCta}
      </button>
      <p className="mt-3 text-xs leading-relaxed text-faint">{t.secureNote}</p>

      {state.code === "PROVIDER_NOT_CONFIGURED" && (
        <p
          role="alert"
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="mt-3 rounded-sm border-s-2 border-warning bg-raised px-3 py-2 text-xs text-warning"
        >
          {t.err_PROVIDER_NOT_CONFIGURED}
        </p>
      )}
      {state.code && state.code !== "PROVIDER_NOT_CONFIGURED" && (
        <p
          role="alert"
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="mt-3 rounded-sm border-s-2 border-error bg-raised px-3 py-2 text-xs text-error"
        >
          {t[`err_${state.code}`] ?? t.err_UNKNOWN}
        </p>
      )}
    </form>
  );
}
