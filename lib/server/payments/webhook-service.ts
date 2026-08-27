import "server-only";
import { db } from "@/lib/server/db";
import { canApplyPaymentStatus } from "@/lib/domain/payments";
import { isSubscriptionActive } from "@/lib/domain/subscriptions";
import type { VerifiedWebhook } from "@/lib/server/payments/contract";
import { audit } from "@/lib/server/admin-guard";
import { trackEvent } from "@/lib/server/analytics";
import type { PaymentStatus, SubscriptionStatus } from "@prisma/client";

/**
 * Webhook application service (Phases 5 + 7A).
 *
 * TRUST MODEL: only a provider adapter's VERIFIED event reaches this
 * function. Browser redirects, query params and client state never do.
 *
 * SECURITY CONTRACT (enforced here, in order):
 *  1. idempotency      — unique (provider, externalEventId), replays no-op
 *  2. known reference  — provider+providerRef must resolve to a Payment
 *  3. amount/currency  — verified payload values must match the stored
 *                        Payment (tamper rejection)
 *  4. state transition — domain machine validates the move
 *  5. atomic apply     — payment update + subscription transition + audit
 *                        inside one transaction
 *
 * Payments are EVENTS; access derives ONLY from subscription state.
 */

export type WebhookApplyResult =
  | "applied"
  | "deduplicated"
  | "unknown_payment"
  | "illegal_transition"
  | "amount_mismatch";

/** Adds one calendar interval, clamping end-of-month (Jan 31 → Feb 28). */
function addInterval(from: Date, interval: "MONTH" | "YEAR"): Date {
  const d = new Date(from);
  if (interval === "YEAR") {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  }
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(Math.min(day, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())));
  return d;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export async function applyVerifiedPaymentEvent(
  provider: string,
  verified: VerifiedWebhook,
): Promise<WebhookApplyResult> {
  // 1) Idempotency anchor first: unique (provider, externalEventId).
  try {
    await db.paymentEvent.create({
      data: {
        provider,
        externalEventId: verified.externalEventId,
        type: verified.type,
        payload: verified.payload
          ? (JSON.parse(JSON.stringify(verified.payload)) as object)
          : undefined,
      },
    });
  } catch {
    return "deduplicated";
  }

  // 2) Known reference.
  const payment = verified.providerRef
    ? await db.payment.findUnique({
        where: {
          provider_providerRef: { provider, providerRef: verified.providerRef },
        },
        include: { subscription: { include: { plan: true } } },
      })
    : null;

  if (!payment) {
    await audit(null, "webhook.unknown_payment", "Payment", undefined, {
      provider,
      eventType: verified.type,
    });
    return "unknown_payment";
  }

  // 3) Amount/currency tamper rejection (when the verified payload carries
  // them — real adapters MUST populate these per the security contract).
  if (
    verified.amountMinor !== undefined &&
    verified.amountMinor !== payment.amountMinor
  ) {
    await audit(null, "webhook.amount_mismatch", "Payment", payment.id, {
      provider,
      expected: payment.amountMinor,
      received: verified.amountMinor,
    });
    return "amount_mismatch";
  }
  if (
    verified.currency !== undefined &&
    verified.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    await audit(null, "webhook.currency_mismatch", "Payment", payment.id, {
      provider,
      expected: payment.currency,
      received: verified.currency,
    });
    return "amount_mismatch";
  }

  // 4) State transition validation (payment machine + subscription machine).
  const nextStatus = verified.targetStatus as PaymentStatus;
  if (!canApplyPaymentStatus(payment.status as PaymentStatus, nextStatus)) {
    return "illegal_transition";
  }

  const sub = payment.subscription;
  let subFrom: SubscriptionStatus | null = null;
  let subTo: SubscriptionStatus | null = null;

  if (sub && (nextStatus === "SUCCEEDED" || nextStatus === "REFUNDED")) {
    const { canTransition } = await import("@/lib/domain/subscriptions");
    const effective = isSubscriptionActive(sub)
      ? "ACTIVE"
      : (sub.status as SubscriptionStatus);
    const target: SubscriptionStatus =
      nextStatus === "SUCCEEDED" ? "ACTIVE" : "REFUNDED";
    // Self-transition (already ACTIVE + renewal) is legal for SUCCEEDED.
    if (effective !== target && !canTransition(effective, target)) {
      return "illegal_transition";
    }
    if (effective !== target) {
      subFrom = effective;
    }
    subTo = target;
  }

  // 5) Atomic apply.
  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        paidAt:
          nextStatus === "SUCCEEDED" ? (payment.paidAt ?? new Date()) : payment.paidAt,
        refundedAt:
          nextStatus === "REFUNDED"
            ? (payment.refundedAt ?? new Date())
            : payment.refundedAt,
        ...(verified.payload
          ? { rawPayload: JSON.parse(JSON.stringify(verified.payload)) as object }
          : {}),
      },
    });

    if (!sub || !subTo) return;

    if (nextStatus === "SUCCEEDED") {
      // First activation starts the period; renewals stack on the current
      // period end when still in the future (never silently shortened).
      const now = new Date();
      const base =
        sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd > now
          ? sub.currentPeriodEnd
          : now;
      const periodEnd = addInterval(base, sub.plan.interval);
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          provider,
          providerSubRef: payment.externalSubscriptionId ?? sub.providerSubRef,
          currentPeriodStart:
            sub.currentPeriodStart && sub.status === "ACTIVE"
              ? sub.currentPeriodStart
              : now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    if (nextStatus === "REFUNDED" || nextStatus === "PARTIALLY_REFUNDED") {
      // REFUNDED policy: immediate terminal revocation. Entitlements derive
      // from subscription state only — access dies on the next check.
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "REFUNDED", cancelAtPeriodEnd: false },
      });
    }
  });

  await audit(
    null,
    `webhook.applied.${nextStatus.toLowerCase()}`,
    "Payment",
    payment.id,
    {
      provider,
      eventType: verified.type,
      ...(subFrom && subTo ? { subFrom, subTo } : {}),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    },
  );

  // Product analytics for payment milestones (Phase 9).
  if (nextStatus === "SUCCEEDED") {
    await trackEvent("payment_succeeded", {
      userId: payment.userId,
      metadata: {
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        provider,
      },
    });
  }
  if (nextStatus === "FAILED") {
    await trackEvent("payment_failed", {
      userId: payment.userId,
      metadata: { provider },
    });
  }

  return "applied";
}
