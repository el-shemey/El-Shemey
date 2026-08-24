# EL-SHEMEY — Payments Architecture

> Phase 0 design. Provider-agnostic core; Paymob as first implementation.

## 1. Requirements Recap

- Monthly + yearly PRO subscription.
- Egypt/MENA-compatible payment methods (cards; wallets desirable).
- Full lifecycle: success, renewal, cancellation, expiration, failed payment, refunds, webhook-driven updates.
- Prices configurable (DB-backed `Plan` + config), never hardcoded in components.
- Provider swappable without touching product code.

## 2. Provider Selection

| Option | Egypt cards | Wallets | Subscriptions | Webhooks | Verdict |
|---|---|---|---|---|---|
| **Paymob** | Yes | Yes (Vodafone Cash etc.) | Via tokens/recurring engine | HMAC-signed | ✅ Primary |
| Kashier | Yes | Partial | Partial | Signed | Alternative |
| Stripe | No (not directly in Egypt) | No | Excellent | Excellent | Future intl expansion adapter |
| Fawry | Yes | Yes | Weak recurring | Limited | Fallback consideration |

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

| Scenario | Behavior |
|---|---|
| First payment succeeds | status=ACTIVE, period set, welcome email, instant access |
| Renewal succeeds | period extended, receipt email |
| Renewal fails | status=PAST_DUE, grace window 7 days, dunning email sequence (day 0/3/6), retry per provider |
| Grace expires | status=EXPIRED, entitlement revoked automatically by date-based check |
| User cancels | cancelAtPeriodEnd=true, access until currentPeriodEnd, confirmation email, win-back offer [future] |
| Refund approved | status=REFUNDED, access revoked immediately, event logged |
| Plan change | MVP: cancel+resubscribe. True proration post-MVP |

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
