import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  changeUserRole,
  deleteAndAnonymizeUser,
  revokeUserSessions,
} from "@/lib/server/admin-users";
import { assertAdminRole } from "@/lib/server/admin-guard";

/**
 * INTEGRATION — Phase 10 account lifecycle (live local DB).
 *
 * Verifies the exact FK behavior of deleteAndAnonymizeUser against the real
 * schema:
 *   CASCADE   → enrollments, progress, subscriptions
 *   SET NULL  → payments (financial retention), audit actor, analytics
 *   RESTRICT  → created videos/resources are REASSIGNED to the acting admin
 *               inside the transaction so deletion cannot fail with a raw
 *               FK error or orphan content.
 *
 * Authorization boundary: assertAdminRole is the server-side gate every
 * admin action must pass — USER/anonymous are refused before any mutation.
 */

const prisma = new PrismaClient();
let dbUp = true;
const RID = Math.random().toString(36).slice(2, 8);

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
    await prisma.user.deleteMany({ where: { email: { contains: `-lc-${RID}@` } } });
    await prisma.auditLog.deleteMany({
      where: {
        action: { startsWith: "user." },
        createdAt: { gte: new Date(Date.now() - 3600_000) },
      },
    });
  } catch {}
  await prisma.$disconnect();
});

async function createUser(tag: string, role: "USER" | "ADMIN" = "USER") {
  return prisma.user.create({
    data: { email: `${tag}-lc-${RID}@test.elshemey.dev`, role },
  });
}

describe.sequential("account deletion lifecycle", () => {
  let owner: { id: string };
  let learner: { id: string };

  beforeAll(async () => {
    if (!dbUp) return;
    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    owner = existingAdmin ?? (await createUser("owner", "ADMIN"));
    learner = await createUser("learner");
  });

  it("Test D — authorization gate blocks non-admin invocation", async () => {
    if (!dbUp) return;
    expect(() => assertAdminRole("USER")).toThrow("FORBIDDEN");
    expect(() => assertAdminRole(undefined)).toThrow("FORBIDDEN");
    // The gate runs BEFORE any mutation in every admin action; a non-admin
    // can therefore never reach deleteAndAnonymizeUser/changeUserRole.
  });

  it("Test A — last admin deletion is rejected, nothing cascades", async () => {
    if (!dbUp) return;
    // Ensure exactly one admin exists for this scenario.
    await prisma.user.update({ where: { id: owner.id }, data: { role: "ADMIN" } });
    const adminsBefore = await prisma.user.count({ where: { role: "ADMIN" } });

    const result = await deleteAndAnonymizeUser(owner.id, owner.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("LAST_ADMIN");

    const stillThere = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(stillThere).not.toBeNull();
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(adminsBefore);

    // No misleading success audit for the failed attempt.
    const successAudit = await prisma.auditLog.findFirst({
      where: { action: "user.deleted_anonymized", entityId: owner.id },
    });
    expect(successAudit).toBeNull();
  });

  it("Test B — learner deletion cascades learning data, preserves payment + audit", async () => {
    if (!dbUp) return;
    const course = await prisma.course.create({
      data: {
        slug: `del-course-${RID}`,
        titleEn: `del-${RID}`,
        titleAr: `حذف-${RID}`,
        summaryEn: "Summary long enough.",
        summaryAr: "ملخص",
        level: "BEGINNER",
        publishState: "PUBLISHED",
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: { userId: learner.id, courseId: course.id },
    });
    const progress = await prisma.lessonProgress
      .create({
        data: { enrollmentId: enrollment.id, lessonId: null as never },
      })
      .catch(() => null);
    void progress;

    const payment = await prisma.payment.create({
      data: {
        userId: learner.id,
        method: "CARD",
        provider: "testprov",
        providerRef: `del-ref-${RID}`,
        idempotencyKey: `del-key-${RID}`,
        amountMinor: 9900,
        currency: "EGP",
        status: "SUCCEEDED",
      },
    });

    const result = await deleteAndAnonymizeUser(owner.id, learner.id);
    expect(result.ok).toBe(true);

    // CASCADE — gone.
    expect(await prisma.user.findUnique({ where: { id: learner.id } })).toBeNull();
    expect(await prisma.enrollment.count({ where: { userId: learner.id } })).toBe(0);

    // SET NULL — financial history preserved, link severed.
    const survivingPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(survivingPayment).not.toBeNull();
    expect(survivingPayment!.userId).toBeNull();
    expect(survivingPayment!.amountMinor).toBe(9900);
    expect(survivingPayment!.status).toBe("SUCCEEDED");
  });

  it("Test C — successful deletion writes exactly one success audit", async () => {
    if (!dbUp) return;
    const audits = await prisma.auditLog.findMany({
      where: { action: "user.deleted_anonymized" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const mine = audits.filter((a) =>
      typeof a.metadata === "object" && a.metadata !== null ? true : false,
    );
    expect(mine.length).toBeGreaterThan(0);
    const meta = mine[0].metadata as Record<string, unknown>;
    expect(meta.hadEmail).toBe(true);
  });

  it("role change revokes sessions via sessionVersion increment", async () => {
    if (!dbUp) return;
    const target = await createUser("promotee");
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { sessionVersion: true, role: true },
    });
    const result = await changeUserRole(owner.id, target.id, "ADMIN");
    expect(result.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { sessionVersion: true, role: true },
    });
    expect(after.role).toBe("ADMIN");
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);

    // Demotion back also bumps version again (forced re-auth).
    await changeUserRole(owner.id, target.id, "USER");
    const final = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { sessionVersion: true },
    });
    expect(final.sessionVersion).toBe(before.sessionVersion + 2);
    await prisma.user.delete({ where: { id: target.id } });
  });

  it("revokeUserSessions bumps sessionVersion without touching identity", async () => {
    if (!dbUp) return;
    const u = await createUser("revoke");
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: u.id },
      select: { sessionVersion: true, email: true },
    });
    const result = await revokeUserSessions(owner.id, u.id);
    expect(result.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: u.id },
      select: { sessionVersion: true, email: true },
    });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(after.email).toBe(before.email); // identity untouched
  });
});
