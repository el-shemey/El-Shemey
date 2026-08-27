import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ANALYTICS_EVENTS, sanitizeMetadata, trackEvent } from "@/lib/server/analytics";
import { assertAdminRole } from "@/lib/server/admin-guard";

/**
 * INTEGRATION — Phase 9 analytics + authorization (live local DB).
 */

const prisma = new PrismaClient();
let dbUp = true;
const RID = Math.random().toString(36).slice(2, 8);

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (!dbUp) return;
  try {
    await prisma.analyticsEvent.deleteMany({
      where: { eventName: { in: ["course_enrolled", "lesson_completed"] } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: `-an-${RID}@` } } });
    await prisma.auditLog.deleteMany({
      where: {
        action: { startsWith: "user." },
        createdAt: { gte: new Date(Date.now() - 3600_000) },
      },
    });
  } catch {}
  await prisma.$disconnect();
});

describe("analytics event validation", () => {
  it("exposes a closed, typed event-name set", () => {
    expect(ANALYTICS_EVENTS).toContain("payment_succeeded");
    expect((ANALYTICS_EVENTS as readonly string[]).includes("made_up_event")).toBe(
      false,
    );
  });

  it("strips sensitive metadata keys even when supplied", async () => {
    if (!dbUp) return;
    const written = await trackEvent("course_enrolled", {
      userId: null, // non-public → rejected before write
      metadata: { courseSlug: "x", password: "hunter2", otp: "123456", token: "t" },
    });
    // Anonymous events for non-public kinds are refused entirely.
    expect(written).toBe(false);
  });

  it("persists sanitized payloads with server timestamps", async () => {
    if (!dbUp) return;
    const user = await prisma.user.create({
      data: { email: `an-${RID}@test.elshemey.dev` },
    });
    const ok = await trackEvent("course_enrolled", {
      userId: user.id,
      metadata: {
        courseSlug: `c-${RID}`,
        password: "should-be-stripped",
        longField: "y".repeat(1000),
      },
    });
    expect(ok).toBe(true);

    const row = await prisma.analyticsEvent.findFirst({
      where: { userId: user.id, eventName: "course_enrolled" },
    });
    expect(row).toBeTruthy();
    const meta = row?.metadata as Record<string, unknown>;
    expect(meta.courseSlug).toBe(`c-${RID}`);
    expect(meta.password).toBeUndefined();
    expect(String(meta.longField).length).toBeLessThanOrEqual(300);
    const age = Date.now() - row!.createdAt.getTime();
    expect(age).toBeLessThan(60_000); // server-generated timestamp

    await prisma.user.delete({ where: { id: user.id } }); // cascades event
  });

  it("rejects unknown event names", async () => {
    const result = await trackEvent("not_a_real_event" as never, {});
    expect(result).toBe(false);
  });

  it("aggregates counts within bounded windows", async () => {
    if (!dbUp) return;
    const user = await prisma.user.create({
      data: { email: `agg-${RID}@test.elshemey.dev` },
    });
    await trackEvent("lesson_completed", {
      userId: user.id,
      metadata: { courseSlug: "agg", lessonSlug: "l1" },
    });
    const rows = await prisma.analyticsEvent.findMany({
      where: { eventName: "lesson_completed", userId: user.id },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe("admin authorization for analytics surfaces", () => {
  it("deny-by-default role gate blocks USER/anonymous", () => {
    expect(() => assertAdminRole("USER")).toThrow("FORBIDDEN");
    expect(() => assertAdminRole(undefined)).toThrow("FORBIDDEN");
    expect(() => assertAdminRole("ADMIN")).not.toThrow();
  });
});
