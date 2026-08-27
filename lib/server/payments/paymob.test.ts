import { afterEach, describe, expect, it } from "vitest";
import {
  PAYMOB_BASE_SANDBOX,
  PaymobAdapter,
  buildTransactionHmacPayload,
  computeTransactionHmac,
  getPaymobConfig,
  mapTransactionStatus,
} from "@/lib/server/payments/paymob";
import { isFakePayEnabled } from "@/lib/server/payments/fakepay";

/**
 * Unit — Phase 7B Paymob adapter + FakePay isolation.
 * Deterministic fixtures only: NO real credentials exist and none are
 * required. Network is injected/mocked.
 */

const ENV_KEYS = [
  "PAYMOB_API_KEY",
  "PAYMOB_INTEGRATION_ID",
  "PAYMOB_HMAC_SECRET",
  "PAYMOB_IFRAME_ID",
  "PAYMOB_MODE",
] as const;
const _SAVED: Record<string, string | undefined> = {};

function setPaymobEnv(mode: string = "sandbox") {
  process.env.PAYMOB_API_KEY = "test-api-key";
  process.env.PAYMOB_INTEGRATION_ID = "12345";
  process.env.PAYMOB_HMAC_SECRET = "test-hmac-secret";
  process.env.PAYMOB_IFRAME_ID = "777";
  process.env.PAYMOB_MODE = mode;
}

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

function transaction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 918273,
    amount_cents: 10000,
    created_at: "2026-08-25T10:00:00Z",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    integration_id: 12345,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: false,
    is_voided: false,
    owner: 111,
    pending: false,
    source_data: { pan: "2346", sub_type: "MasterCard", type: "c" },
    success: true,
    order: { id: 554433, merchant_order_id: "sub-user1-plan1-CARD" },
    ...overrides,
  };
}

function signedBody(obj: Record<string, unknown>, secret = "test-hmac-secret") {
  const body = JSON.stringify({ type: "TRANSACTION", obj });
  const hmac = computeTransactionHmac(secret, buildTransactionHmacPayload(obj));
  return { body, url: `https://site.local/api/webhooks/payments/paymob?hmac=${hmac}` };
}

describe("credential boundary", () => {
  it("refuses to operate without credentials — no fake success", async () => {
    const adapter = new PaymobAdapter();
    expect(adapter.configured).toBe(false);
    await expect(
      adapter.createCheckout({
        userId: "u1",
        paymentId: "p1",
        planSlug: "pro",
        amountMinor: 10000,
        currency: "EGP",
        method: "CARD",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow("PAYMENT_PROVIDER_NOT_CONFIGURED");
    await expect(
      adapter.verifyAndParseWebhook("{}", new Headers(), "?hmac=x"),
    ).rejects.toThrow("PAYMENT_PROVIDER_NOT_CONFIGURED");
  });

  it("mode selects sandbox vs production base URL; default sandbox", () => {
    setPaymobEnv("sandbox");
    expect(getPaymobConfig()!.baseUrl).toBe(PAYMOB_BASE_SANDBOX);
    setPaymobEnv("production");
    const config = getPaymobConfig()!;
    expect(config.baseUrl).toContain("accept.paymob.com");
    expect(config.mode).toBe("production");
  });

  it("invalid integration id → treated as unconfigured", () => {
    process.env.PAYMOB_API_KEY = "k";
    process.env.PAYMOB_INTEGRATION_ID = "not-a-number";
    process.env.PAYMOB_HMAC_SECRET = "s";
    process.env.PAYMOB_IFRAME_ID = "i";
    expect(getPaymobConfig()).toBeNull();
  });
});

describe("checkout creation (mocked network)", () => {
  it("runs auth → order → payment key → iframe URL; merchant_order_id = idempotency key", async () => {
    setPaymobEnv("sandbox");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const json = url.includes("/api/auth/tokens")
        ? { token: "AUTH" }
        : url.includes("/api/ecommerce/orders")
          ? { id: 42 }
          : { token: "PAYKEY" };
      return new Response(JSON.stringify(json), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new PaymobAdapter(fakeFetch);
    const session = await adapter.createCheckout({
      userId: "u1",
      paymentId: "p1",
      planSlug: "pro-monthly",
      amountMinor: 10000,
      currency: "EGP",
      method: "CARD",
      idempotencyKey: "sub:u1:p1:CARD:key123",
    });

    expect(calls).toHaveLength(3);
    const orderBody = JSON.parse(String(calls[1].init.body)) as Record<string, unknown>;
    expect(orderBody.merchant_order_id).toBe("sub:u1:p1:CARD:key123");
    expect(orderBody.amount_cents).toBe(10000); // integer minor units
    const keyBody = JSON.parse(String(calls[2].init.body)) as Record<string, unknown>;
    expect(keyBody.integration_id).toBe(12345);
    expect(keyBody.order_id).toBe(42);
    expect(keyBody.amount_cents).toBe(10000);
    expect(session.providerRef).toBe("sub:u1:p1:CARD:key123");
    expect(session.redirectUrl).toContain("/api/acceptance/iframes/777?payment_token=");
  });

  it("provider HTTP failure surfaces as an error, never as success", async () => {
    setPaymobEnv("sandbox");
    const failing = (async () =>
      new Response("{}", { status: 401 })) as unknown as typeof fetch;
    const adapter = new PaymobAdapter(failing);
    await expect(
      adapter.createCheckout({
        userId: "u1",
        paymentId: "p1",
        planSlug: "p",
        amountMinor: 100,
        currency: "EGP",
        method: "CARD",
        idempotencyKey: "kk",
      }),
    ).rejects.toThrow("PAYMOB_AUTH_FAILED");
  });
});

describe("webhook verification", () => {
  it("verifies a correctly signed transaction and maps SUCCEEDED", async () => {
    setPaymobEnv();
    const adapter = new PaymobAdapter();
    const { body, url } = signedBody(transaction());
    const verified = await adapter.verifyAndParseWebhook(body, new Headers(), url);
    expect(verified).not.toBeNull();
    expect(verified!.targetStatus).toBe("SUCCEEDED");
    expect(verified!.providerRef).toBe("sub-user1-plan1-CARD");
    // Amount/currency surfaced for the domain tamper check:
    expect(verified!.amountMinor).toBe(10000);
    expect(verified!.currency).toBe("EGP");
  });

  it("rejects INVALID signature (constant-time compare)", async () => {
    setPaymobEnv();
    const adapter = new PaymobAdapter();
    const obj = transaction();
    const bad = computeTransactionHmac(
      "wrong-secret",
      buildTransactionHmacPayload(obj),
    );
    const verified = await adapter.verifyAndParseWebhook(
      JSON.stringify({ type: "TRANSACTION", obj }),
      new Headers(),
      `https://x/?hmac=${bad}`,
    );
    expect(verified).toBeNull();
  });

  it("rejects tampered payload signed for different content (replay/tamper)", async () => {
    setPaymobEnv();
    const adapter = new PaymobAdapter();
    const { body, url } = signedBody(transaction({ amount_cents: 1 }));
    void body;
    // Signature valid for amount=1 payload but sent over amount=10000 payload:
    const tampered = JSON.stringify({
      type: "TRANSACTION",
      obj: transaction(),
    });
    const result = await adapter.verifyAndParseWebhook(tampered, new Headers(), url);
    expect(result).toBeNull();
  });

  it("rejects malformed payloads and missing hmac", async () => {
    setPaymobEnv();
    const adapter = new PaymobAdapter();
    expect(
      await adapter.verifyAndParseWebhook(
        "not-json{",
        new Headers(),
        "https://x/?hmac=a",
      ),
    ).toBeNull();
    const { body } = signedBody(transaction());
    expect(
      await adapter.verifyAndParseWebhook(body, new Headers(), "https://x/"),
    ).toBeNull();
  });

  it("rejects transactions from another merchant integration", async () => {
    setPaymobEnv();
    const adapter = new PaymobAdapter();
    const { body, url } = signedBody(transaction({ integration_id: 999 }));
    expect(await adapter.verifyAndParseWebhook(body, new Headers(), url)).toBeNull();
  });

  it.each([
    ["pending", transaction({ pending: true, success: false }), "PENDING"],
    ["failed", transaction({ success: false }), "FAILED"],
    ["refunded", transaction({ is_refunded: true }), "REFUNDED"],
    ["voided", transaction({ is_voided: true, success: true }), "CANCELLED"],
  ])("maps %s transactions to %s", async (_name, tx, expected) => {
    setPaymobEnv();
    const adapter = new PaymobAdapter();
    const { body, url } = signedBody(tx);
    const verified = await adapter.verifyAndParseWebhook(body, new Headers(), url);
    expect(verified?.targetStatus).toBe(expected);
  });

  it("status mapper returns null when nothing matches", () => {
    expect(mapTransactionStatus({})).toBeNull();
  });
});

describe("FakePay isolation", () => {
  it("is disabled by default (no opt-in flag)", () => {
    const saved = process.env.FAKEPAY_ENABLED;
    delete process.env.FAKEPAY_ENABLED;
    expect(isFakePayEnabled()).toBe(false);
    if (saved !== undefined) process.env.FAKEPAY_ENABLED = saved;
  });
});

describe("production-mode boundary (regression)", () => {
  it("FakePay is refused even when FAKEPAY_ENABLED=1 if NODE_ENV=production", async () => {
    const savedEnv = process.env.NODE_ENV as string | undefined;
    const savedFlag = process.env.FAKEPAY_ENABLED;
    // vitest types NODE_ENV readonly; the runtime boundary test mutates it.
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    process.env.FAKEPAY_ENABLED = "1";
    try {
      const { isFakePayEnabled: recheck } =
        await import("@/lib/server/payments/fakepay");
      expect(recheck()).toBe(false);
    } finally {
      if (savedEnv === undefined)
        delete (process.env as { NODE_ENV?: string }).NODE_ENV;
      else (process.env as { NODE_ENV?: string }).NODE_ENV = savedEnv;
      if (savedFlag === undefined) delete process.env.FAKEPAY_ENABLED;
      else process.env.FAKEPAY_ENABLED = savedFlag;
    }
  });
});
