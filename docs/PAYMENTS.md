# EL-SHEMEY — Payments Architecture

> Phase 0 design. Provider-agnostic core; Paymob as first implementation.

## 1. Requirements Recap

- Monthly + yearly PRO subscription.
- Egypt/MENA-compatible payment methods (cards; wallets desirable).
- Full lifecycle: success, renewal, cancellation, expiration, failed payment, refunds, webhook-driven updates.
- Prices configurable (DB-backed `Plan` + config), never hardcoded in components.
- Provider swappable without touching product code.

## 2. Provider Selection

| Option     | Egypt cards                | Wallets                  | Subscriptions               | Webhooks    | Verdict                       |
| ---------- | -------------------------- | ------------------------ | --------------------------- | ----------- | ----------------------------- |
| **Paymob** | Yes                        | Yes (Vodafone Cash etc.) | Via tokens/recurring engine | HMAC-signed | ✅ Primary                    |
| Kashier    | Yes                        | Partial                  | Partial                     | Signed      | Alternative                   |
| Stripe     | No (not directly in Egypt) | No                       | Excellent                   | Excellent   | Future intl expansion adapter |
| Fawry      | Yes                        | Yes                      | Weak recurring              | Limited     | Fallback consideration        |

**Decision:** Paymob first. **[OPEN]** Owner must confirm merchant account approval timeline and payout terms before Phase 5 begins. Recurring billing with Egyptian PSPs is the riskiest integration area — a manual-renewal fallback flow (payment link emails) is designed but not built unless needed.

## 3. Architecture

```
config/plans.ts  ──seed──►  Plan table
                              │
User selects plan on /pricing │ (amount validated server-side)
                              ▼
                 POST checkout (Server Action)
                              │
              PaymentProvider.createCheckoutSession()
                              │
                    Redirect to hosted payment page
                              │
                     User pays at provider
                              │
        Provider ──signed webhook──► /api/webhooks/payments/[provider]
                              │
             verify signature → dedup event ID → apply state machine
                              │
              Subscription updated → SubscriptionEvent logged
                              │
             Entitlements derived server-side on next request
```

### Adapter interface

```ts
// lib/payments/provider.ts
export interface PaymentProvider {
  readonly id: string; // "paymob"
  createCheckoutSession(input: {
    userId: string;
    planId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; sessionId: string }>;
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentWebhookEvent | null>;
}

export type PaymentWebhookEvent =
  | { type: "subscription.activated"; providerSubId: string; periodEnd: Date }
  | { type: "subscription.renewed"; periodEnd: Date }
  | { type: "payment.failed"; willRetry: boolean }
  | { type: "subscription.canceled"; atPeriodEnd: boolean }
  | { type: "refund.succeeded" };
```

Product code depends only on this interface and the normalized event union. Adding Stripe later = new adapter file + mapping, zero product changes.

## 4. Subscription State Machine

Defined in ARCHITECTURE.md §6. Implementation rules:

- Transitions live in one module (`features/subscriptions/state-machine.ts`) with an exhaustive legal-transition map. Illegal transitions are rejected and alert (possible forgery or bug).
- Every accepted webhook appends a `SubscriptionEvent` and updates at most one `Subscription` row inside a transaction.
- Idempotency: `WebhookEvent` unique on `(provider, eventId)`; duplicate deliveries are acknowledged but ignored.
- Ordering tolerance: events carry provider timestamps; stale events (older than last processed for that subscription) are recorded but not applied.

## 5. Lifecycle Behaviors

| Scenario               | Behavior                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| First payment succeeds | status=ACTIVE, period set, welcome email, instant access                                           |
| Renewal succeeds       | period extended, receipt email                                                                     |
| Renewal fails          | status=PAST_DUE, grace window 7 days, dunning email sequence (day 0/3/6), retry per provider       |
| Grace expires          | status=EXPIRED, entitlement revoked automatically by date-based check                              |
| User cancels           | cancelAtPeriodEnd=true, access until currentPeriodEnd, confirmation email, win-back offer [future] |
| Refund approved        | status=REFUNDED, access revoked immediately, event logged                                          |
| Plan change            | MVP: cancel+resubscribe. True proration post-MVP                                                   |

## 6. Checkout UX

- Hosted provider page (PCI scope stays minimal). No card fields on our domain in MVP.
- Currency & pricing display from config; yearly shows monthly-equivalent + savings.
- Post-checkout return page polls nothing: state arrives via webhook; return page shows "confirming your payment…" then reflects state on refresh/navigation (webhooks typically land in seconds).
- Failure path returns user to pricing with a clear, human message.

## 7. Money Handling Rules

- Integer minor units everywhere server-side; format only at render.
- Server validates selected plan exists, is active, and uses its DB amount — client-supplied amounts never trusted.
- Revenue reporting derives from `SubscriptionEvent` of type `payment.*` (MVP); a dedicated `Payment` table arrives when multi-payment-per-subscription reporting is needed.

## 8. Testing Strategy

- Unit tests for state machine (all transitions + illegal transitions).
- Integration tests simulating full webhook sequences: happy path, duplicate delivery, out-of-order delivery, failed renewal → recovery, refund.
- Contract test against Paymob sandbox before launch; recorded fixtures for CI.
- Manual UAT checklist with real sandbox transactions before enabling production keys.

---

## 9. Phase 5 implementation status

Implemented (server-authoritative, provider-independent):

- **State machine** (lib/domain/payments.ts): CREATED ? PENDING/REQUIRES_ACTION ? SUCCEEDED /
  FAILED / EXPIRED / CANCELLED; refunds only from SUCCEEDED/PARTIALLY_REFUNDED. Terminal states
  never reopen. Only SUCCEEDED may influence entitlements.
- **Provider boundary** (lib/server/payments/provider.ts): PaymentProviderAdapter with
  createCheckout / verifyAndParseWebhook. Paymob adapter is an INTEGRATION SEAM � it refuses to
  operate until real merchant credentials exist and the flow is implemented from official docs.
  A manual adapter exists for admin-approved offline payments.
- **Webhook receiver** (pp/api/webhooks/payments/[provider]): raw-body signature verification,
  event dedup via unique (provider, externalEventId), transition validation inside one
  transaction with entitlement-affecting subscription updates, unknown-payment recording +
  audit, safe logging. Client redirects/query params are never a confirmation source.
- **Subscriptions**: activation/renewal stack periods from the plan interval; refund ? immediate
  CANCELLED; expiry derived from timestamps, never silently extended.
- **Checkout service** (lib/server/payments/service.ts): server-side plan pricing,
  idempotent payment creation via unique idempotencyKey, ownership-checked status views.

**PRODUCTION CREDENTIALS REQUIRED BEFORE LIVE BILLING** (none exist yet):
PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_HMAC_SECRET + verified merchant account.
Until then the UI honestly reports that online payments are being finalized.

---

## 10. Phase 7B � Paymob adapter implementation status

**Implemented behind the existing PaymentProviderAdapter interface
(\lib/server/payments/paymob.ts\). Architecture complete; NOT live.**

### Checkout flow (official Accept contract)

1. \POST /api/auth/tokens\ (api_key) ? auth token
2. \POST /api/ecommerce/orders\ (amount_cents, **merchant_order_id = our idempotency key**, currency)
3. \POST /api/acceptance/payment_keys\ (integration_id, order_id, billing_data)
4. Redirect student to \/api/acceptance/iframes/{IFRAME_ID}?payment_token=�\

### Webhook security contract (enforced in code, in this order)

| #   | Control                                                                    | Where           |
| --- | -------------------------------------------------------------------------- | --------------- |
| 1   | HMAC-SHA512 over documented transaction field order; constant-time compare | adapter         |
| 2   | Malformed payload rejection                                                | adapter         |
| 3   | Merchant/product validation (\integration_id\ must be ours)                | adapter         |
| 4   | Amount/currency tamper rejection vs stored Payment                         | webhook-service |
| 5   | Event dedup: unique (provider, externalEventId)                            | webhook-service |
| 6   | Payment + subscription state-machine validation                            | domain          |
| 7   | Atomic apply (payment + subscription in one transaction)                   | webhook-service |
| 8   | Audit with from?to states, amounts (no secrets)                            | admin-guard     |

Status mapping: \is_voided?CANCELLED � is_refunded?REFUNDED � pending?PENDING � success?SUCCEEDED � else FAILED\.

### Credential boundary

Without \PAYMOB_API_KEY / PAYMOB_INTEGRATION_ID / PAYMOB_HMAC_SECRET / PAYMOB_IFRAME_ID\
the adapter throws \ProviderNotConfiguredError\ � the UI honestly reports that online
payments are being finalized. No fake success paths exist anywhere.

### Local development

An explicitly named fake provider (**fakepay**) exists for the full loop on localhost:
double-gated (\NODE_ENV !== production\ AND \FAKEPAY_ENABLED=1\, plus optional
\PAYMENT_DEV_PROVIDER=fakepay\ routing). It exercises the identical state machine,
idempotency and audit paths, and its webhooks are HMAC-signed like a real provider.
It is never registered in production builds and never presented as Paymob.

### 7B GATE � remaining before production keys

One successful SANDBOX transaction verified end-to-end (checkout ? webhook ? entitlement),
confirming response shapes and the transaction-HMAC field order against the live API.
