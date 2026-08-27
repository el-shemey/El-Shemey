/**
 * Payment provider ADAPTER REGISTRY (Phases 5 + 7B).
 *
 * The contract (interfaces + ProviderNotConfiguredError) lives in
 * `contract.ts` — a dependency-free leaf module that adapters import
 * directly, preventing adapter↔registry circular initialization.
 *
 * SECURITY/INTEGRITY CONTRACT:
 *  - Adapters map NATIVE provider statuses into domain PaymentStatus values.
 *  - Webhook signature verification is mandatory; browser redirects are
 *    never a confirmation source.
 *  - No credentials may be hardcoded; everything comes from server-only env.
 *  - The Paymob adapter implements the official Accept contract but is NOT
 *    production-verified until a real sandbox transaction succeeds.
 */

import { PaymobAdapter } from "@/lib/server/payments/paymob";
import { FakePayAdapter, isFakePayEnabled } from "@/lib/server/payments/fakepay";
import {
  ProviderNotConfiguredError,
  type PaymentProviderAdapter,
} from "@/lib/server/payments/contract";

export {
  ProviderNotConfiguredError,
  type PaymentProviderAdapter,
} from "@/lib/server/payments/contract";

/** Manual fallback (business-approved offline payments, e.g. bank transfer).
 *  Creates PENDING records; only admin approval moves them to SUCCEEDED,
 *  and every approval writes an AuditLog entry. No provider calls at all. */
class ManualAdapter implements PaymentProviderAdapter {
  readonly id = "manual";
  get configured() {
    return true;
  }
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      redirectUrl: `/en/help#manual-payment-${input.idempotencyKey}`,
      providerRef: input.idempotencyKey,
    };
  }
  async verifyAndParseWebhook(): Promise<null> {
    return null; // manual flow has no webhooks; admins confirm explicitly
  }
}

const adapters: Record<string, PaymentProviderAdapter> = {
  paymob: new PaymobAdapter(),
  manual: new ManualAdapter(),
};

export function getPaymentAdapter(provider: string): PaymentProviderAdapter {
  // EXPLICIT test/dev-only provider ("fakepay" — deliberately NOT named like
  // any real PSP). Resolved dynamically and gated by isFakePayEnabled(),
  // which requires non-production runtime AND an explicit opt-in flag. It
  // can never activate in a production deployment.
  if (provider === "fakepay") {
    if (!isFakePayEnabled()) throw new ProviderNotConfiguredError("fakepay");
    return new FakePayAdapter();
  }
  const adapter = adapters[provider];
  if (!adapter) throw new ProviderNotConfiguredError(provider);
  return adapter;
}

type CheckoutInput = import("@/lib/server/payments/contract").CheckoutInput;
type CheckoutSession = import("@/lib/server/payments/contract").CheckoutSession;
