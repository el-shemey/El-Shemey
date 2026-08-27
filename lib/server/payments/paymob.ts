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
 * Paymob Accept adapter (Phase 7B).
 *
 * Implemented from the OFFICIAL Paymob Accept integration contract:
 *   1. POST /api/auth/tokens                { api_key }            → auth token
 *   2. POST /api/ecommerce/orders           { auth_token, amount_cents,
 *        merchant_order_id, currency, items }                      → order.id
 *   3. POST /api/acceptance/payment_keys    { auth_token, amount_cents,
 *        order_id, billing_data, currency, integration_id }        → payment key
 *   4. Redirect customer to:
 *        {BASE}/api/acceptance/iframes/{IFRAME_ID}?payment_token={key}
 *
 * Webhook (server-to-server): JSON body { type, obj }; the transaction HMAC
 * arrives as `?hmac=` and is HMAC-SHA512 over obj fields concatenated in the
 * EXACT documented order (see TRANSACTION_HMAC_FIELDS below). Comparison is
 * constant-time.
 *
 * CREDENTIAL BOUNDARY: without PAYMOB_API_KEY + PAYMOB_INTEGRATION_ID +
 * PAYMOB_HMAC_SECRET (+ PAYMOB_IFRAME_ID) every operation throws
 * ProviderNotConfiguredError — no fake success paths exist. Sandbox vs
 * production differ ONLY by the configured base URL (PAYMOB_MODE).
 *
 * ⚠ 7B GATE: code follows the published contract but is NOT verified against
 * a live sandbox transaction yet. Field order/response shapes must be
 * confirmed with a real sandbox payment before production keys are enabled.
 */

export const PAYMOB_BASE_SANDBOX = "https://acceptstaging.paymob.com";
export const PAYMOB_BASE_PRODUCTION = "https://accept.paymob.com";

/** Documented transaction HMAC field order (Accept "HMAC calculation"). */
const TRANSACTION_HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

export interface PaymobConfig {
  apiKey: string;
  integrationId: number;
  iframeId: string;
  hmacSecret: string;
  baseUrl: string;
  mode: "sandbox" | "production";
}

export function getPaymobConfig(): PaymobConfig | null {
  const apiKey = process.env.PAYMOB_API_KEY;
  const integrationRaw = process.env.PAYMOB_INTEGRATION_ID;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  if (!apiKey || !integrationRaw || !hmacSecret || !iframeId) return null;

  const integrationId = Number(integrationRaw);
  if (!Number.isInteger(integrationId) || integrationId <= 0) return null;

  const mode = process.env.PAYMOB_MODE === "production" ? "production" : "sandbox";
  const baseUrl = mode === "production" ? PAYMOB_BASE_PRODUCTION : PAYMOB_BASE_SANDBOX;
  return { apiKey, integrationId, iframeId, hmacSecret, baseUrl, mode };
}

/** Concatenates documented fields; missing values contribute empty strings. */
export function buildTransactionHmacPayload(obj: Record<string, unknown>): string {
  let concatenated = "";
  for (const path of TRANSACTION_HMAC_FIELDS) {
    let value: unknown = obj;
    for (const part of path.split(".")) {
      value =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[part]
          : undefined;
      if (value === undefined) break;
    }
    // Booleans are rendered by Paymob as true/false literals in the string.
    concatenated += value === undefined || value === null ? "" : String(value);
  }
  return concatenated;
}

export function computeTransactionHmac(secret: string, payload: string): string {
  return createHmac("sha512", secret).update(payload).digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a.toLowerCase(), "utf8");
  const bb = Buffer.from(b.toLowerCase(), "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

interface PaymobTransaction {
  id?: number;
  pending?: boolean;
  success?: boolean;
  is_refunded?: boolean;
  is_voided?: boolean;
  error_occured?: boolean | string | null;
  amount_cents?: number;
  currency?: string;
  integration_id?: number;
  order?: { id?: number; merchant_order_id?: string };
}

/**
 * Maps a verified Paymob transaction into domain target status.
 * Precedence per contract: voided → CANCELLED, refunded → REFUNDED,
 * pending → PENDING, success → SUCCEEDED, otherwise FAILED.
 */
export function mapTransactionStatus(
  tx: PaymobTransaction,
): VerifiedWebhook["targetStatus"] | null {
  if (tx.is_voided === true) return "CANCELLED";
  if (tx.is_refunded === true) return "REFUNDED";
  if (tx.pending === true) return "PENDING";
  if (tx.success === true) return "SUCCEEDED";
  if (tx.success === false) return "FAILED";
  return null;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class PaymobAdapter implements PaymentProviderAdapter {
  readonly id = "paymob";

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  get configured() {
    return getPaymobConfig() !== null;
  }

  private requireConfig(): PaymobConfig {
    const config = getPaymobConfig();
    if (!config) throw new ProviderNotConfiguredError(this.id);
    return config;
  }

  /** Official checkout chain: auth token → order → payment key → iframe URL. */
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const config = this.requireConfig();

    // merchant_order_id: our deterministic idempotency anchor (≤100 chars).
    const merchantOrderId = input.idempotencyKey.slice(0, 100);
    const amountCents = input.amountMinor; // EGP piastres == minor units

    const authRes = await this.fetchImpl(`${config.baseUrl}/api/auth/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: config.apiKey }),
    });
    if (!authRes.ok) throw new Error(`PAYMOB_AUTH_FAILED:${authRes.status}`);
    const { token: authToken } = (await authRes.json()) as { token: string };

    const orderRes = await this.fetchImpl(`${config.baseUrl}/api/ecommerce/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: input.currency,
        merchant_order_id: merchantOrderId,
        items: [
          {
            name: `EL-SHEMEY ${input.planSlug}`,
            amount_cents: amountCents,
            quantity: 1,
          },
        ],
      }),
    });
    if (!orderRes.ok) throw new Error(`PAYMOB_ORDER_FAILED:${orderRes.status}`);
    const order = (await orderRes.json()) as { id: number };

    const keyRes = await this.fetchImpl(
      `${config.baseUrl}/api/acceptance/payment_keys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: authToken,
          amount_cents: amountCents,
          order_id: order.id,
          currency: input.currency,
          integration_id: config.integrationId,
          // Minimal billing data required by Accept; identity comes from our
          // own records — never from the client.
          billing_data: {
            first_name: "EL-SHEMEY",
            last_name: "Learner",
            email: `learner+${input.userId}@internal.elshemey.local`,
            phone_number: "+20000000000",
            country: "EG",
            city: "Cairo",
            street: "—",
            building: "—",
            floor: "—",
            apartment: "—",
            state: "—",
            postal_code: "—",
          },
        }),
      },
    );
    if (!keyRes.ok) throw new Error(`PAYMOB_PAYMENT_KEY_FAILED:${keyRes.status}`);
    const { token: paymentToken } = (await keyRes.json()) as { token: string };

    return {
      redirectUrl:
        `${config.baseUrl}/api/acceptance/iframes/${config.iframeId}` +
        `?payment_token=${encodeURIComponent(paymentToken)}`,
      providerRef: merchantOrderId,
    };
  }

  /**
   * Verifies `?hmac=` over the raw body's transaction object using
   * constant-time comparison, validates the integration (merchant/product),
   * maps status, and surfaces amount/currency for downstream tamper checks.
   */
  async verifyAndParseWebhook(
    rawBody: string,
    _headers: Headers,
    requestUrl: string,
  ): Promise<VerifiedWebhook | null> {
    const config = this.requireConfig();

    // The HMAC arrives as a query parameter on the webhook URL.
    let received: string | null = null;
    try {
      received = new URL(requestUrl).searchParams.get("hmac");
    } catch {
      return null;
    }
    if (!received) return null;

    let parsed: { type?: string; obj?: unknown };
    try {
      parsed = JSON.parse(rawBody) as typeof parsed;
    } catch {
      return null; // malformed payload
    }
    if (!parsed || typeof parsed !== "object" || !parsed.obj) return null;
    const obj = parsed.obj as Record<string, unknown>;

    const expected = computeTransactionHmac(
      config.hmacSecret,
      buildTransactionHmacPayload(obj),
    );
    if (!constantTimeEqualHex(expected, received)) return null;

    const tx = obj as PaymobTransaction;
    const targetStatus = mapTransactionStatus(tx);
    if (!targetStatus) return null;

    // Merchant/product validation: the transaction must belong to OUR
    // configured integration — anything else is not ours to apply.
    if (tx.integration_id !== undefined && tx.integration_id !== config.integrationId) {
      return null;
    }

    return {
      externalEventId: `paymob-txn-${tx.id ?? rawBody.length}`,
      type: parsed.type ?? "TRANSACTION",
      providerRef:
        tx.order?.merchant_order_id != null
          ? String(tx.order.merchant_order_id)
          : undefined,
      targetStatus,
      amountMinor: typeof tx.amount_cents === "number" ? tx.amount_cents : undefined,
      currency: typeof tx.currency === "string" ? tx.currency : undefined,
      payload: parsed,
    };
  }
}
