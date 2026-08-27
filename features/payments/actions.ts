"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/session";
import { startSubscriptionCheckout } from "@/lib/server/payments/service";

/**
 * Payment server actions (Phase 5).
 *
 * userId always comes from the verified session — never a client payload.
 * Results are coarse reason codes only; no provider details, amounts or
 * internal identifiers leak beyond what the UI already knows.
 */

export type CheckoutState = {
  ok?: boolean;
  code?:
    | "PLAN_NOT_FOUND"
    | "PLAN_INACTIVE"
    | "INVALID_METHOD"
    | "PROVIDER_NOT_CONFIGURED"
    | "RATE_LIMITED"
    | "UNAUTHENTICATED"
    | "UNKNOWN";
};

const METHODS = ["CARD", "VODAFONE_CASH", "FAWRY", "INSTAPAY"] as const;

export async function startCheckoutAction(
  locale: string,
  planSlug: string,
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  const method = String(formData.get("method") ?? "");
  if (!(METHODS as readonly string[]).includes(method)) {
    return { code: "INVALID_METHOD" };
  }

  let result;
  try {
    result = await startSubscriptionCheckout(user.id, planSlug, method);
  } catch {
    return { code: "UNKNOWN" };
  }

  if (result.ok) {
    // The redirect URL is provider-hosted UX only — never a confirmation
    // source. Real state arrives via the signed provider webhook.
    redirect(result.redirectUrl);
  }
  return { code: result.reason };
}
