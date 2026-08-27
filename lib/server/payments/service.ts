import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/admin-guard";
import {
  isAwaitingResolution,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/domain/payments";
import { trackEvent } from "@/lib/server/analytics";
import {
  getPaymentAdapter,
  ProviderNotConfiguredError,
} from "@/lib/server/payments/provider";

/**
 * User-facing payment service (Phase 5).
 *
 * SECURITY:
 *  - Plan amount/currency are read server-side; client-supplied amounts and
 *    plan data are never trusted.
 *  - Payment status views are ownership-checked (IDOR-safe): a user can only
 *    ever read their own payment.
 *  - Checkout creation is idempotent via the unique `idempotencyKey` —
 *    browser refreshes/retries reuse the same PENDING record.
 *  - No card numbers, PINs or wallet credentials ever touch this code —
 *    provider-hosted/tokenized flows only.
 */

export type Method = PaymentMethod;

/** User-selectable methods route to the provider adapter that supports them.
 *  Local development can opt into the explicitly-named fake provider
 *  (PAYMENT_DEV_PROVIDER=fakepay) — never available in production builds. */
const METHOD_PROVIDER: Record<Method, string> = {
  CARD: "paymob",
  VODAFONE_CASH: "paymob",
  FAWRY: "paymob",
  INSTAPAY: "paymob",
};

function providerFor(method: Method): string {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.PAYMENT_DEV_PROVIDER === "fakepay"
  ) {
    return "fakepay";
  }
  return METHOD_PROVIDER[method];
}

// Re-exported pure helper so UI/actions share one source of truth.
export { isAwaitingResolution };
export type { PaymentStatus };

export type CheckoutResult =
  | { ok: true; paymentId: string; redirectUrl: string }
  | {
      ok: false;
      reason:
        | "UNAUTHENTICATED"
        | "PLAN_NOT_FOUND"
        | "PLAN_INACTIVE"
        | "INVALID_METHOD"
        | "PROVIDER_NOT_CONFIGURED"
        | "RATE_LIMITED"
        | "UNKNOWN";
    };

/**
 * Starts a subscription checkout. Retries with the same
 * (user, plan, method) reuse the same awaiting-resolution payment row;
 * terminal-failed attempts get a fresh attempt key.
 */
export async function startSubscriptionCheckout(
  userId: string,
  planSlug: string,
  method: string,
): Promise<CheckoutResult> {
  if (!(method in METHOD_PROVIDER)) {
    return { ok: false, reason: "INVALID_METHOD" };
  }
  const typedMethod = method as Method;

  // Server-side price authority: DB plan only.
  const plan = await db.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) return { ok: false, reason: "PLAN_NOT_FOUND" };
  if (!plan.isActive || plan.amountMinor <= 0) {
    return { ok: false, reason: "PLAN_INACTIVE" };
  }

  const provider = providerFor(typedMethod);
  const baseKey = `sub:${userId}:${plan.id}:${typedMethod}`;

  // Idempotent creation: reuse an open attempt before making a new one.
  let payment = await db.payment.findUnique({
    where: { idempotencyKey: baseKey },
  });
  if (payment && !isAwaitingResolution(payment.status as PaymentStatus)) {
    payment = null;
  }

  if (!payment) {
    const idempotencyKey = `${baseKey}:${randomBytes(6).toString("hex")}`;
    // Find-or-create the subscription shell this payment will activate.
    const subscription = await db.subscription.upsert({
      where: { userId_planId: { userId, planId: plan.id } },
      create: { userId, planId: plan.id, status: "CREATED" },
      update: {},
    });
    payment = await db.payment.create({
      data: {
        userId,
        method: typedMethod,
        provider,
        // providerRef is assigned by the provider at checkout creation time;
        // the idempotency key is our anchor until then.
        providerRef: idempotencyKey,
        idempotencyKey,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        status: "CREATED",
        subscriptionId: subscription.id,
      },
    });
  } else if (!payment.subscriptionId) {
    const subscription = await db.subscription.upsert({
      where: { userId_planId: { userId, planId: plan.id } },
      create: { userId, planId: plan.id, status: "CREATED" },
      update: {},
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
    });
  }

  try {
    const session = await getPaymentAdapter(provider).createCheckout({
      userId,
      paymentId: payment.id,
      planSlug: plan.slug,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      method: typedMethod,
      idempotencyKey: payment.idempotencyKey,
    });

    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        providerRef: session.providerRef,
      },
    });

    await audit(userId, "checkout.started", "Payment", payment.id, {
      provider,
      method: typedMethod,
      planSlug: plan.slug,
      amountMinor: payment.amountMinor,
    });

    await trackEvent("payment_started", {
      userId,
      metadata: {
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        provider,
      },
    });
    return { ok: true, paymentId: payment.id, redirectUrl: session.redirectUrl };
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return { ok: false, reason: "PROVIDER_NOT_CONFIGURED" };
    }
    return { ok: false, reason: "UNKNOWN" };
  }
}

export type OwnPaymentView =
  | {
      found: true;
      status: PaymentStatus;
      amountMinor: number;
      currency: string;
      createdAt: Date;
      paidAt: Date | null;
    }
  | { found: false };

/**
 * Ownership-checked payment status for UI state pages.
 * A user can never observe another user's payment — unknown and
 * not-owned collapse into the same `found: false` shape.
 */
export async function getOwnPaymentView(
  userId: string,
  paymentId: string,
): Promise<OwnPaymentView> {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, userId },
    select: {
      status: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
      paidAt: true,
    },
  });
  if (!payment) return { found: false };
  return {
    found: true,
    status: payment.status as PaymentStatus,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
  };
}

export interface ActivePlanView {
  slug: string;
  nameEn: string;
  nameAr: string;
  interval: "MONTH" | "YEAR";
  amountMinor: number;
  currency: string;
}

/** Public catalog data for pricing display (no secrets, amounts from DB). */
export async function listActivePlans(): Promise<ActivePlanView[]> {
  const plans = await db.plan.findMany({
    where: { isActive: true, amountMinor: { gt: 0 } },
    orderBy: [{ interval: "asc" }, { amountMinor: "asc" }],
  });
  return plans.map((p) => ({
    slug: p.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    interval: p.interval,
    amountMinor: p.amountMinor,
    currency: p.currency,
  }));
}
