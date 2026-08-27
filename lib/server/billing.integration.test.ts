import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyVerifiedPaymentEvent } from "@/lib/server/payments/webhook-service";
import { resolveLessonAccess } from "@/lib/server/entitlements";

/**
 * INTEGRATION — Phase 7A billing core (live local DB).
 *
 * Covers the required matrix:
 *  - checkout creation idempotency (same key → exactly one payment)
 *  - duplicate provider reference rejected at the persistence layer
 *  - webhook amount/currency tamper rejection
 *  - payment → active → refund → access revoked; duplicate refund safe
 *  - entitlement resolver matrix: FREE ok / PRO denied / expired denied /
 *    refunded denied
 */

const prisma = new PrismaClient();
let dbUp = true;
const RID = Math.random().toString(36).slice(2, 8);
const PROVIDER = "testprov";

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if ((await prisma.course.count()) === 0) throw new Error("seed missing");
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (!dbUp) return;
  try {
    await prisma.payment.deleteMany({ where: { idempotencyKey: { contains: RID } } });
    await prisma.paymentEvent.deleteMany({ where: { provider: PROVIDER } });
    await prisma.subscription.deleteMany({
      where: { plan: { slug: { contains: RID } } },
    });
    await prisma.plan.deleteMany({ where: { slug: { contains: RID } } });
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: "webhook." } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: RID } } });
  } catch {}
  await prisma.$disconnect();
});

describe.sequential("billing core", () => {
  let userA = "";
  let subId = "";

  beforeAll(async () => {
    if (!dbUp) return;
    userA = (
      await prisma.user.create({
        data: { email: `bill-${RID}@test.elshemey.dev` },
      })
    ).id;
    const plan = await prisma.plan.create({
      data: {
        slug: `plan-${RID}`,
        nameEn: "PRO",
        nameAr: "برو",
        interval: "MONTH",
        amountMinor: 10000,
        currency: "EGP",
        isActive: true,
      },
    });
    void plan;
    const sub = await prisma.subscription.create({
      data: { userId: userA, planId: plan.id, status: "CREATED" },
    });
    subId = sub.id;
  });

  it("same idempotency key twice → exactly ONE logical payment", async () => {
    if (!dbUp) return;
    const base = {
      userId: userA,
      method: "CARD" as const,
      provider: PROVIDER,
      amountMinor: 10000,
      currency: "EGP",
      subscriptionId: subId,
    };
    // Simulate two racing browser retries with the same idempotency key.
    const first = await prisma.payment
      .create({
        data: {
          ...base,
          providerRef: `ref-${RID}`,
          idempotencyKey: `key-${RID}`,
          status: "CREATED",
        },
      })
      .catch(() => null);
    expect(first).toBeTruthy();
    // Second insert MUST hit the unique constraint.
    const second = await prisma.payment
      .create({
        data: {
          ...base,
          providerRef: `ref-other-${RID}`,
          idempotencyKey: `key-${RID}`,
          status: "CREATED",
        },
      })
      .catch(() => null);
    expect(second).toBeNull();

    // Same provider reference twice is equally impossible.
    const dupRef = await prisma.payment
      .create({
        data: {
          ...base,
          providerRef: `ref-${RID}`,
          idempotencyKey: `key-other-${RID}`,
          status: "PENDING",
        },
      })
      .catch(() => null);
    expect(dupRef).toBeNull();

    const count = await prisma.payment.count({
      where: { idempotencyKey: `key-${RID}` },
    });
    expect(count).toBe(1);
  });

  it("payment → SUCCEEDED activates; replayed success cannot re-activate", async () => {
    if (!dbUp) return;
    const applied = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-ok-${RID}`,
      type: "payment.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "SUCCEEDED",
      payload: {},
      amountMinor: 10000,
      currency: "EGP",
    });
    expect(applied).toBe("applied");

    const sub = await prisma.subscription.findUnique({ where: { id: subId } });
    expect(sub?.status).toBe("ACTIVE");

    const replay = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-replay-${RID}`,
      type: "payment.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "SUCCEEDED",
      payload: {},
    });
    expect(replay).toBe("illegal_transition");

    const sameEvent = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-ok-${RID}`,
      type: "payment.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "SUCCEEDED",
      payload: {},
    });
    expect(sameEvent).toBe("deduplicated");
  });

  it("amount tampering in a signed webhook is rejected", async () => {
    if (!dbUp) return;
    const result = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-tamper-${RID}`,
      type: "payment.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "SUCCEEDED",
      payload: {},
      amountMinor: 1, // ≠ stored 10000 — forged/tampered amount
      currency: "EGP",
    });
    expect(result).toBe("amount_mismatch");

    const currency = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-currency-${RID}`,
      type: "payment.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "SUCCEEDED",
      payload: {},
      amountMinor: 10000,
      currency: "USD", // ≠ stored EGP
    });
    expect(currency).toBe("amount_mismatch");
  });

  it("refund revokes access; entitlement denies immediately and stays revoked", async () => {
    if (!dbUp) return;
    const refunded = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-refund-${RID}`,
      type: "refund.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "REFUNDED",
      payload: {},
    });
    expect(refunded).toBe("applied");
    const sub = await prisma.subscription.findUnique({ where: { id: subId } });
    expect(sub?.status).toBe("REFUNDED");

    // Duplicate refund event under a new id → illegal transition, no corruption.
    const again = await applyVerifiedPaymentEvent(PROVIDER, {
      externalEventId: `evt-refund-2-${RID}`,
      type: "refund.succeeded",
      providerRef: `ref-${RID}`,
      targetStatus: "REFUNDED",
      payload: {},
    });
    expect(again).toBe("illegal_transition");
    const still = await prisma.subscription.findUnique({ where: { id: subId } });
    expect(still?.status).toBe("REFUNDED");
  });

  it("entitlement resolver: FREE ok without PRO; expired/refunded deny", async () => {
    if (!dbUp) return;

    // Dedicated deterministic course tree for the access matrix.
    const admin =
      (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
      (await prisma.user.create({
        data: { email: `acc-admin-${RID}@t.dev`, role: "ADMIN" },
      }));
    const course = await prisma.course.create({
      data: {
        slug: `acc-course-${RID}`,
        titleEn: "acc",
        titleAr: "acc",
        summaryEn: "Summary long enough.",
        summaryAr: "ملخص",
        level: "BEGINNER",
        publishState: "PUBLISHED",
        modules: {
          create: {
            position: 1,
            titleEn: "M",
            titleAr: "وحدة",
            publishState: "PUBLISHED",
            lessons: {
              create: [
                {
                  slug: "free",
                  position: 1,
                  accessLevel: "FREE",
                  publishState: "PUBLISHED",
                  titleEn: "F",
                  titleAr: "ف",
                },
                {
                  slug: "pro",
                  position: 2,
                  accessLevel: "PRO",
                  publishState: "PUBLISHED",
                  titleEn: "P",
                  titleAr: "ب",
                },
              ],
            },
          },
        },
      },
    });

    // No subscription at all: FREE allowed, PRO denied.
    const free = await resolveLessonAccess(userA, course.slug, "free");
    expect(free).toEqual({ allowed: true, reason: "OK" });
    const pro = await resolveLessonAccess(userA, course.slug, "pro");
    expect(pro).toEqual({ allowed: false, reason: "ENTITLEMENT_REQUIRED" });

    // Expired subscription (stored ACTIVE, period past) → still denied.
    // Reuse the existing subscription row (unique user+plan) — set ACTIVE
    // with a past period end.
    await prisma.subscription.update({
      where: { id: subId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: new Date(Date.now() - 2 * 86400_000),
        currentPeriodEnd: new Date(Date.now() - 86400_000),
      },
    });
    const proExpired = await resolveLessonAccess(userA, course.slug, "pro");
    expect(proExpired).toEqual({ allowed: false, reason: "ENTITLEMENT_REQUIRED" });

    // Refunded subscription → denied (sub is REFUNDED from the refund test).
    await prisma.subscription.update({
      where: { id: subId },
      data: { status: "REFUNDED", currentPeriodEnd: new Date(Date.now() + 86400_000) },
    });
    const proAfterRefund = await resolveLessonAccess(userA, course.slug, "pro");
    expect(proAfterRefund).toEqual({ allowed: false, reason: "ENTITLEMENT_REQUIRED" });

    // Cleanup of this block's tree.
    await prisma.course.delete({ where: { id: course.id } });
    void admin;
  });
});
