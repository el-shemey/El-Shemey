/**
 * Payment provider CONTRACT (Phase 7B) — dependency-free leaf module.
 *
 * Both the registry (provider.ts) and every adapter (paymob.ts, fakepay.ts)
 * import from here. Keeping this file import-free prevents adapter↔registry
 * circular initialization while preserving one shared definition.
 */

export interface CheckoutInput {
  userId: string;
  paymentId: string;
  planSlug: string;
  amountMinor: number;
  currency: string;
  method: "CARD" | "VODAFONE_CASH" | "FAWRY" | "INSTAPAY";
  idempotencyKey: string;
}

export interface CheckoutSession {
  /** Where to send the customer. UX only — never a confirmation source. */
  redirectUrl: string;
  /** Provider-side reference for reconciliation. */
  providerRef: string;
}

export interface VerifiedWebhook {
  externalEventId: string;
  type: string;
  providerRef?: string;
  targetStatus:
    | "PENDING"
    | "REQUIRES_ACTION"
    | "SUCCEEDED"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED";
  payload: unknown;
  /**
   * Webhook security contract (Phase 7A): when the provider's verified
   * payload carries transaction amount/currency, adapters MUST surface them
   * here. applyVerifiedPaymentEvent() validates them against the stored
   * Payment — amount/currency tampering in a signed payload is rejected.
   */
  amountMinor?: number;
  currency?: string;
}

export interface PaymentProviderAdapter {
  readonly id: string;
  readonly configured: boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyAndParseWebhook(
    rawBody: string,
    headers: Headers,
    /** Full request URL (some providers sign via query params, e.g. Paymob). */
    requestUrl: string,
  ): Promise<VerifiedWebhook | null>;
}

/** Thrown when an adapter is requested without its required configuration. */
export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`PAYMENT_PROVIDER_NOT_CONFIGURED:${providerId}`);
  }
}
