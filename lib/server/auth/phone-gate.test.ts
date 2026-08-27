import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resetRateLimiter } from "@/lib/server/rate-limit";
import { hashToken } from "@/lib/server/auth/tokens";
import { hashPassword } from "@/lib/server/auth/password";
import {
  confirmPasswordResetWithOtp,
  registerWithIdentifier,
  requestPasswordResetOtp,
  resendVerificationOtp,
  verifyIdentityWithOtp,
} from "@/lib/server/auth-service";
import { SmsDeliveryNotConfiguredError, isPhoneAuthEnabled } from "@/lib/server/delivery";

/**
 * Regression for C2 — phone auth production gate.
 *
 * A. Production phone registration rejected
 * B. Production phone OTP/reset rejected
 * C. No phone enumeration
 * D. Email registration still works (dev)
 * E. Email verification still works (dev, via hashed OTP)
 * F. Existing OTP security (hashed at rest) — covered via existing suites, spot-check here
 * G. No OTP/token in responses
 * H. Development behavior: phone allowed via dev outbox
 */

const prisma = new PrismaClient();
let dbUp = true;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if ((await prisma.course.count()) === 0) throw new Error("seed missing");
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  if (dbUp) resetRateLimiter();
});

function withProdEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.PHONE_AUTH_ENABLED;
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "production";
  delete process.env.PHONE_AUTH_ENABLED;
  return fn().finally(() => {
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = prevNode;
    if (prevFlag === undefined) delete process.env.PHONE_AUTH_ENABLED;
    else process.env.PHONE_AUTH_ENABLED = prevFlag;
  });
}

function withDevEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.PHONE_AUTH_ENABLED;
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "development";
  delete process.env.PHONE_AUTH_ENABLED;
  return fn().finally(() => {
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = prevNode;
    if (prevFlag === undefined) delete process.env.PHONE_AUTH_ENABLED;
    else process.env.PHONE_AUTH_ENABLED = prevFlag;
  });
}

describe("C2 phone gate", () => {
  it("isPhoneAuthEnabled: production disabled by default, development enabled", async () => {
    await withProdEnv(async () => {
      expect(isPhoneAuthEnabled()).toBe(false);
    });
    await withDevEnv(async () => {
      expect(isPhoneAuthEnabled()).toBe(true);
    });
    // explicit flag overrides
    process.env.PHONE_AUTH_ENABLED = "1";
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "production";
    expect(isPhoneAuthEnabled()).toBe(true);
    process.env.PHONE_AUTH_ENABLED = "0";
    expect(isPhoneAuthEnabled()).toBe(false);
    delete process.env.PHONE_AUTH_ENABLED;
  });

  it("A. production phone registration is rejected (no DB side-effect)", async () => {
    if (!dbUp) return;
    const phone = `+2010${String(Math.floor(1000000 + Math.random() * 9000000))}`;
    const countBefore = await prisma.user.count({ where: { phone } });
    await withProdEnv(async () => {
      await expect(
        registerWithIdentifier({ identifier: phone, password: "Strong-Pass-77" }),
      ).rejects.toThrow(SmsDeliveryNotConfiguredError);
      await expect(
        registerWithIdentifier({ identifier: phone, password: "Strong-Pass-77" }),
      ).rejects.toThrow("DELIVERY_NOT_CONFIGURED:SMS");
    });
    const countAfter = await prisma.user.count({ where: { phone } });
    expect(countAfter).toBe(countBefore);
  });

  it("B. production phone OTP/reset flows rejected", async () => {
    if (!dbUp) return;
    const phone = `+2011${String(Math.floor(1000000 + Math.random() * 9000000))}`;
    await withProdEnv(async () => {
      await expect(resendVerificationOtp(phone)).rejects.toThrow(SmsDeliveryNotConfiguredError);
      await expect(requestPasswordResetOtp(phone)).rejects.toThrow(SmsDeliveryNotConfiguredError);
      await expect(verifyIdentityWithOtp(phone, "123456")).rejects.toThrow(
        SmsDeliveryNotConfiguredError,
      );
      await expect(confirmPasswordResetWithOtp(phone, "123456", "Newer-Pass-88")).rejects.toThrow(
        SmsDeliveryNotConfiguredError,
      );
    });
  });

  it("C. no phone enumeration in production (existing vs non-existing same error)", async () => {
    if (!dbUp) return;
    // Create a phone user directly (bypass gate via dev env)
    const phoneExisting = `+2012${String(Math.floor(1000000 + Math.random() * 9000000))}`;
    await withDevEnv(async () => {
      await prisma.user.create({
        data: { phone: phoneExisting, passwordHash: await hashPassword("Strong-Pass-77") },
      });
    });
    const phoneNonExisting = `+2013${String(Math.floor(1000000 + Math.random() * 9000000))}`;
    await withProdEnv(async () => {
      const errExisting = await registerWithIdentifier({
        identifier: phoneExisting,
        password: "Strong-Pass-77",
      }).catch((e) => e);
      const errNonExisting = await registerWithIdentifier({
        identifier: phoneNonExisting,
        password: "Strong-Pass-77",
      }).catch((e) => e);
      expect(errExisting.message).toBe(errNonExisting.message);
      expect(errExisting.message).toContain("DELIVERY_NOT_CONFIGURED:SMS");
    });
    await prisma.user.deleteMany({ where: { phone: phoneExisting } });
  });

  it("D. email registration still works (development dev outbox path)", async () => {
    if (!dbUp) return;
    await withDevEnv(async () => {
      const email = `c2-email-${Math.random().toString(36).slice(2, 6)}@test.dev`;
      const result = await registerWithIdentifier({
        identifier: email,
        password: "Strong-Pass-77",
      });
      expect(result.channel).toBe("EMAIL");
      expect(result.identifier).toBe(email.toLowerCase());
      expect(result.masked).toContain("***@");
      // Cleanup — scoped to this user only
      const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (u) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    });
  });

  it("E. email verification still works via hashed OTP (no plaintext leak)", async () => {
    if (!dbUp) return;
    const email = `c2-verify-${Math.random().toString(36).slice(2, 6)}@test.dev`;
    const code = String(100000 + Math.floor(Math.random() * 900000));
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword("Strong-Pass-77") },
    });
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hashToken(code), expiresAt: new Date(Date.now() + 600000) },
    });
    expect(await verifyIdentityWithOtp(email, code)).toBe(true);
    const fetched = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fetched.emailVerified).toBeTruthy();
    // reuse fails (single-use)
    expect(await verifyIdentityWithOtp(email, code)).toBe(false);
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("G. no OTP/token appears in registration response", async () => {
    if (!dbUp) return;
    await withDevEnv(async () => {
      const email = `c2-noleak-${Math.random().toString(36).slice(2, 6)}@test.dev`;
      const result = await registerWithIdentifier({
        identifier: email,
        password: "Strong-Pass-77",
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/"otp"/i);
      expect(serialized).not.toMatch(/"code"\s*:/);
      expect(serialized).not.toMatch(/"token"/i);
      expect(serialized).not.toMatch(/"hash"/i);
      const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (u) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    });
  });

  it("H. development phone registration allowed via dev outbox (no production fallback)", async () => {
    if (!dbUp) return;
    await withDevEnv(async () => {
      const phone = `+2014${String(Math.floor(1000000 + Math.random() * 9000000))}`;
      const result = await registerWithIdentifier({
        identifier: phone,
        password: "Strong-Pass-77",
      });
      expect(result.channel).toBe("SMS");
      expect(result.identifier).toBe(phone);
      // Verify OTP row was created (hashed, not plaintext)
      const u = await prisma.user.findUniqueOrThrow({ where: { phone } });
      const tokens = await prisma.emailVerificationToken.findMany({ where: { userId: u.id } });
      // SMS uses emailVerificationToken table per purpose mapping (VERIFY_IDENTITY)
      expect(tokens.length).toBe(1);
      expect(tokens[0].tokenHash).toHaveLength(64);
      await prisma.user.delete({ where: { id: u.id } });
    });
  });
});
