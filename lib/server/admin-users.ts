import "server-only";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/admin-guard";
/**
 * Admin user-management mutations (Phase 9).
 *
 * Every function assumes requireRole("ADMIN") was enforced by the caller.
 * - Revoke sessions: bumps sessionVersion → all JWTs invalidate on next use
 *   (existing Phase 4 revocation architecture; no token table needed).
 * - Role change: explicit, audited, and cannot demote the LAST admin.
 * - No passwords, OTPs or tokens are ever readable through these paths.
 */

export async function revokeUserSessions(
  adminId: string,
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, sessionVersion: true, email: true },
  });
  if (!target) return { ok: false, reason: "NOT_FOUND" };

  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
  await audit(adminId, "user.sessions_revoked", "User", userId, {
    emailDomain: target.email?.split("@")[1] ?? null,
  });
  void z;
  return { ok: true };
}

const roleSchema = z.object({ role: z.enum(["USER", "ADMIN"]) });

/** Promotes to ADMIN only via explicit confirm in the UI; audited both ways. */
export async function changeUserRole(
  adminId: string,
  userId: string,
  nextRole: unknown,
): Promise<{ ok: boolean; reason?: string }> {
  const parsed = roleSchema.safeParse({ role: nextRole });
  if (!parsed.success) return { ok: false, reason: "INVALID_ROLE" };
  const next = parsed.data.role;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  if (target.role === next) return { ok: false, reason: "ALREADY_IN_ROLE" };

  // Guardrail: demotion must never remove the last remaining admin.
  if (target.role === "ADMIN" && next === "USER") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, reason: "LAST_ADMIN" };
  }

  await db.user.update({ where: { id: userId }, data: { role: next } });
  await audit(adminId, `user.role_changed.${next.toLowerCase()}`, "User", userId, {
    from: target.role,
    to: next,
  });

  // Role changes must take effect immediately: revoke existing sessions.
  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
  return { ok: true };
}

/* --------------------- Account & data lifecycle (P10) ---------------------- */

/**
 * GDPR/privacy-aligned account deletion (admin-initiated).
 *
 * RETENTION POLICY (documented in docs/OPERATIONS.md):
 *  - DELETED: enrollments, progress, sessions (via sessionVersion), profile
 *    identifiers, analytics events (anonymized by FK SET NULL on user delete).
 *  - PRESERVED: Payment rows (financial retention � userId is set null via
 *    FK), AuditLog entries (actorId set null; action history retained),
 *    Refund records.
 *
 * The user row itself is deleted only after PII-bearing children that would
 * block deletion are handled. Email/phone are unique ? we must fully delete
 * the User row for the identifier to be reusable; financial rows survive
 * with a severed link (retained amount/status/currency/timestamps).
 */
export async function deleteAndAnonymizeUser(
  adminId: string,
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  if (target.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, reason: "LAST_ADMIN" };
  }

  // Content ownership must survive the user: created videos/resources are
  // reassigned to the acting admin INSIDE the transaction (their FKs are
  // Restrict — without reassignment, deletion would fail with a raw FK error
  // and content would be orphaned or lost).
  const createdResources = await db.resourceFile.count({
    where: { createdById: userId },
  });
  const createdVideos = await db.videoAsset.count({
    where: { createdById: userId },
  });

  await db.$transaction(async (tx) => {
    if (createdResources > 0) {
      await tx.resourceFile.updateMany({
        where: { createdById: userId },
        data: { createdById: adminId },
      });
    }
    if (createdVideos > 0) {
      await tx.videoAsset.updateMany({
        where: { createdById: userId },
        data: { createdById: adminId },
      });
    }
    await tx.user.delete({ where: { id: userId } });
  });

  // Audit AFTER successful deletion: failed attempts never claim success.
  await audit(adminId, "user.deleted_anonymized", "User", userId, {
    hadEmail: Boolean(target.email),
    wasAdmin: target.role === "ADMIN",
    resourcesReassigned: createdResources,
    videosReassigned: createdVideos,
  });
  return { ok: true };
}
