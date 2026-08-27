import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/admin-guard";
import { canApplyPaymentStatus } from "@/lib/domain/payments";
import { computeCompleteness as computeCompletenessPure } from "@/lib/domain/admin";
import { getVideoStorage } from "@/lib/server/video/storage";
import type { PaymentStatus } from "@prisma/client";

/**
 * Owner operations data access (Phase 5).
 * All functions assume the caller already passed requireRole("ADMIN").
 */

export function computeCompleteness(course: {
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  _count: { modules: number };
  modules: Array<{ _count: { lessons: number } }>;
}) {
  return computeCompletenessPure({
    titleEn: course.titleEn,
    titleAr: course.titleAr,
    summaryEn: course.summaryEn,
    summaryAr: course.summaryAr,
    moduleCount: course._count.modules,
    lessonCount: course.modules.reduce((n, m) => n + m._count.lessons, 0),
  });
}

export async function listCoursesAdmin() {
  return db.course.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { modules: true } },
      modules: { include: { _count: { select: { lessons: true } } } },
    },
  });
}

export async function setCoursePublishState(
  actorId: string,
  courseId: string,
  next: "PUBLISHED" | "DRAFT" | "ARCHIVED",
): Promise<{ ok: boolean; reason?: string }> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      _count: { select: { modules: true } },
      modules: { include: { _count: { select: { lessons: true } } } },
    },
  });
  if (!course) return { ok: false, reason: "NOT_FOUND" };

  if (next === "PUBLISHED") {
    const completeness = computeCompleteness(course);
    if (!completeness.readyToPublish) {
      return { ok: false, reason: `INCOMPLETE:${completeness.missing.join(",")}` };
    }
    // Every module must have at least one published lesson.
    const publishableModule = course.modules.some(
      (m) => m._count.lessons > 0 && m.publishState !== "DRAFT",
    );
    if (!publishableModule) {
      return { ok: false, reason: "NO_PUBLISHED_LESSONS" };
    }
  }

  const publishedAt =
    next === "PUBLISHED" ? (course.publishedAt ?? new Date()) : course.publishedAt;
  await db.course.update({
    where: { id: courseId },
    data: { publishState: next, publishedAt },
  });
  await audit(actorId, `course.${next.toLowerCase()}`, "Course", courseId);
  return { ok: true };
}

/* ------------------------------- Videos --------------------------------- */

export async function listVideosAdmin(filter?: { status?: string }) {
  return db.videoAsset.findMany({
    where: filter?.status
      ? {
          status: filter.status as
            "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "ARCHIVED",
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      lesson: { select: { titleEn: true, titleAr: true } },
      createdBy: { select: { email: true } },
    },
  });
}

export async function assignVideoToLesson(
  actorId: string,
  videoId: string,
  lessonId: string | null,
) {
  const asset = await db.videoAsset.findUnique({ where: { id: videoId } });
  if (!asset) return { ok: false, reason: "NOT_FOUND" };

  // Single playable video per lesson: attaching a READY video archives any
  // other READY video currently on the lesson (replace semantics).
  if (lessonId) {
    await db.videoAsset.updateMany({
      where: { lessonId, status: "READY", archivedAt: null, id: { not: videoId } },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
  }

  await db.videoAsset.update({
    where: { id: videoId },
    data: { lessonId, archivedAt: null },
  });
  await audit(
    actorId,
    lessonId ? "video.assigned" : "video.unassigned",
    "VideoAsset",
    videoId,
    { lessonId },
  );
  return { ok: true };
}

/** Publish = READY (playable for authorized learners). */
export async function setVideoPublishState(
  actorId: string,
  videoId: string,
  next: "READY" | "ARCHIVED",
) {
  const asset = await db.videoAsset.findUnique({ where: { id: videoId } });
  if (!asset || (asset.status !== "READY" && asset.status !== "ARCHIVED")) {
    return { ok: false, reason: "NOT_PUBLISHABLE" };
  }
  await db.videoAsset.update({
    where: { id: videoId },
    data: {
      status: next,
      archivedAt: next === "ARCHIVED" ? (asset.archivedAt ?? new Date()) : null,
    },
  });
  await audit(
    actorId,
    `video.${next === "READY" ? "published" : "unpublished"}`,
    "VideoAsset",
    videoId,
  );
  return { ok: true };
}

/** Delete removes the DB row AND the stored bytes. Irreversible by design. */
export async function deleteVideo(actorId: string, videoId: string) {
  const asset = await db.videoAsset.findUnique({ where: { id: videoId } });
  if (!asset) return { ok: false, reason: "NOT_FOUND" };
  await db.videoAsset.delete({ where: { id: videoId } });
  await getVideoStorage()
    .delete(asset.storageRef)
    .catch(() => {});
  await audit(actorId, "video.deleted", "VideoAsset", videoId);
  return { ok: true };
}

export async function archiveVideo(actorId: string, videoId: string) {
  await db.videoAsset.update({
    where: { id: videoId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await audit(actorId, "video.archived", "VideoAsset", videoId);
}

/* ------------------------- Payments / refunds ---------------------------- */

export async function approveRefund(
  adminId: string,
  refundId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: { payment: { include: { subscription: true } } },
  });
  if (!refund || refund.status !== "PENDING") {
    return { ok: false, reason: "NOT_PENDING" };
  }

  const paymentStatus = refund.payment.status as PaymentStatus;
  if (!canApplyPaymentStatus(paymentStatus, "REFUNDED")) {
    return { ok: false, reason: "PAYMENT_NOT_REFUNDABLE" };
  }

  // Subscription machine gate (Phase 7A): the revocation must be legal from
  // the subscription's CURRENT effective state.
  const { canTransition } = await import("@/lib/domain/subscriptions");
  const sub = refund.payment.subscription;
  let subFrom: string | null = null;
  if (sub) {
    const isActive =
      sub.status === "ACTIVE" &&
      sub.currentPeriodEnd &&
      sub.currentPeriodEnd > new Date();
    subFrom = isActive ? "ACTIVE" : sub.status;
    if (!canTransition(subFrom as Parameters<typeof canTransition>[0], "REFUNDED")) {
      return { ok: false, reason: "SUBSCRIPTION_NOT_REFUNDABLE" };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refundId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    await tx.payment.update({
      where: { id: refund.paymentId },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    if (refund.payment.subscriptionId) {
      await tx.subscription.update({
        where: { id: refund.payment.subscriptionId },
        data: { status: "REFUNDED", cancelAtPeriodEnd: false },
      });
    }
  });

  await audit(adminId, "refund.approved", "Refund", refundId, {
    amountMinor: refund.amountMinor,
    currency: refund.currency,
    paymentId: refund.paymentId,
    ...(subFrom ? { subFrom, subTo: "REFUNDED" } : {}),
  });
  return { ok: true };
}

export async function rejectRefund(
  adminId: string,
  refundId: string,
  reason: string,
): Promise<void> {
  await db.refund.update({ where: { id: refundId }, data: { status: "REJECTED" } });
  await audit(adminId, "refund.rejected", "Refund", refundId, {
    reason: reason.slice(0, 300),
  });
}

/** Manual-payment confirmation: explicit admin action with full audit.
 *  Only then does the payment reach SUCCEEDED (and entitlement flow). */
export async function confirmManualPayment(
  adminId: string,
  paymentId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: true },
  });
  if (!payment) return { ok: false, reason: "NOT_FOUND" };
  if (payment.provider !== "manual") return { ok: false, reason: "NOT_MANUAL" };
  if (!canApplyPaymentStatus(payment.status as PaymentStatus, "SUCCEEDED")) {
    return { ok: false, reason: "ILLEGAL_TRANSITION" };
  }

  const { canTransition } = await import("@/lib/domain/subscriptions");
  const sub = payment.subscription;
  let subFrom: string | null = null;
  if (sub) {
    subFrom = sub.status;
    if (!canTransition(subFrom as Parameters<typeof canTransition>[0], "ACTIVE")) {
      return { ok: false, reason: "SUBSCRIPTION_NOT_ACTIVATABLE" };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCEEDED", paidAt: new Date() },
    });
    if (payment.subscriptionId) {
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000),
        },
      });
    }
  });
  await audit(adminId, "payment.manualConfirmed", "Payment", paymentId, {
    ...(subFrom ? { subFrom, subTo: "ACTIVE" } : {}),
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  });
  return { ok: true };
}
