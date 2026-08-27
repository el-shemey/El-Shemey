import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProviderAdapter,
  type VerifiedWebhook,
  ProviderNotConfiguredError,
} from "@/lib/server/payments/contract";

/**
 * FakePay — EXPLICIT development/test provider (Phase 7B).
 *
 * RULES (non-negotiable):
 *  - Named "fakepay": it must NEVER be mistaken for Paymob or any real PSP.
 *  - Enabled ONLY when NODE_ENV !== "production" AND FAKEPAY_ENABLED=1
 *    (double-checked here as defense in depth).
 *  - Exists so the full checkout → webhook → entitlement loop can run on
 *    localhost without real credentials. It exercises the SAME domain state
 *    machine, idempotency and audit paths as a real adapter.
 *  - It can never mark a payment succeeded on its own: success arrives only
 *    through its signed webhook, exactly like production providers.
 */

export function isFakePayEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.FAKEPAY_ENABLED === "1";
}

/** Deterministic dev signing key for the fake provider's webhooks. */
const FAKEPAY_SECRET =
  process.env.FAKEPAY_WEBHOOK_SECRET ?? "fakepay-dev-secret-not-production";

export function signFakeWebhook(payload: string): string {
  return createHmac("sha256", FAKEPAY_SECRET).update(payload).digest("hex");
}

export class FakePayAdapter implements PaymentProviderAdapter {
  readonly id = "fakepay";

  get configured() {
    return isFakePayEnabled();
  }

  private requireEnabled(): void {
    if (!isFakePayEnabled()) throw new ProviderNotConfiguredError(this.id);
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    this.requireEnabled();
    // Dev "hosted page" route: a human visits it and the local dev tooling
    // fires the signed fake webhook. The checkout response itself never
    // implies success — exactly like a real provider's redirect.
    return {
      redirectUrl:
        `/dev/fakepay?order=${encodeURIComponent(input.idempotencyKey)}` +
        `&amount=${input.amountMinor}&currency=${encodeURIComponent(input.currency)}`,
      providerRef: input.idempotencyKey,
    };
  }

  /** Verifies the fake HMAC-SHA256 signature over the raw body. */
  async verifyAndParseWebhook(
    rawBody: string,
    _headers: Headers,
    requestUrl: string,
  ): Promise<VerifiedWebhook | null> {
    this.requireEnabled();

    let sig: string | null = null;
    try {
      sig = new URL(requestUrl).searchParams.get("sig");
    } catch {
      return null;
    }
    if (!sig) return null;

    let parsed: { type?: string; obj?: Record<string, unknown> };
    try {
      parsed = JSON.parse(rawBody) as typeof parsed;
    } catch {
      return null;
    }
    if (!parsed?.obj) return null;

    const expected = signFakeWebhook(rawBody);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const o = parsed.obj as {
      amount_cents?: number;
      currency?: string;
      merchant_order_id?: string;
      success?: boolean;
      pending?: boolean;
      is_refunded?: boolean;
      id?: string;
    };

    const targetStatus = o.is_refunded
      ? "REFUNDED"
      : o.pending
        ? "PENDING"
        : o.success
          ? "SUCCEEDED"
          : "FAILED";

    return {
      externalEventId: `${this.id}-${o.id ?? rawBody.length}-${targetStatus}`,
      type: parsed.type ?? "FAKE_TRANSACTION",
      providerRef: o.merchant_order_id,
      targetStatus,
      amountMinor: typeof o.amount_cents === "number" ? o.amount_cents : undefined,
      currency: typeof o.currency === "string" ? o.currency : undefined,
      payload: parsed,
    };
  }
}
