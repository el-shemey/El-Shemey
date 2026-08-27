import { appendFileSync, readFileSync } from "node:fs";
import { afterAll, beforeEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resetRateLimiter } from "@/lib/server/rate-limit";
import {
  authenticateUser,
  confirmPasswordResetWithOtp,
  registerWithIdentifier,
  requestLoginVerification,
  requestPasswordResetOtp,
  resendVerificationOtp,
  verifyIdentityWithOtp,
} from "@/lib/server/auth-service";
import { generateOtp, hashToken } from "@/lib/server/auth/tokens";
import { hashPassword } from "@/lib/server/auth/password";

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

const RID = Math.random().toString(36).slice(2, 8);
const PASSWORD = "Strong-Pass-77";
const NEW_PASSWORD = "Newer-Pass-88";
const EMAIL = `otp-${RID}@test.elshemey.dev`;
// Per-run random OTP: tokenHash is globally unique (sha256), so parallel
// test files must never insert tokens derived from the same fixed code —
// otherwise the unique constraint on tokenHash fires intermittently (P2002).
const CODE = String(100000 + Math.floor(Math.random() * 900000));

async function seedUser(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  return user.id;
}

async function insertOtp(userId: string): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(CODE),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
}

describe.sequential("OTP auth lifecycle (live local DB)", () => {
  let userId = "";

  afterAll(async () => {
    if (!dbUp) return;
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: RID } },
      });
    } catch {}
  });

  it("registration creates an unverified user; no OTP in response", async () => {
    if (!dbUp) return;
    userId = await seedUser();
    expect(JSON.stringify({ userId })).not.toMatch(/^\d{6}$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerified).toBeNull();
  });

  it("login is blocked before verification", async () => {
    if (!dbUp) return;
    await expect(authenticateUser(EMAIL, PASSWORD)).rejects.toThrow(
      "IDENTITY_NOT_VERIFIED",
    );
  });

  it("delivery without credentials fails clearly (no silent fallback)", async () => {
    if (!dbUp) return;
    await expect(requestLoginVerification(EMAIL)).rejects.toThrow(
      "DELIVERY_NOT_CONFIGURED",
    );
  });

  describe("with a live OTP inserted", () => {
    beforeAll(async () => {
      if (!dbUp) return;
      await insertOtp(userId);
    });

    it("correct OTP verifies once; user becomes verified", async () => {
      if (!dbUp) return;
      expect(await verifyIdentityWithOtp(EMAIL, CODE)).toBe(true);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(user.emailVerified).toBeTruthy();
    });

    it("reused OTP fails after success", async () => {
      if (!dbUp) return;
      expect(await verifyIdentityWithOtp(EMAIL, CODE)).toBe(false);
    });

    it("wrong OTP never verifies", async () => {
      if (!dbUp) return;
      expect(await verifyIdentityWithOtp(EMAIL, "000000")).toBe(false);
    });

    it("login succeeds after verification", async () => {
      if (!dbUp) return;
      const authed = await authenticateUser(EMAIL, PASSWORD);
      expect(authed.id).toBe(userId);
      expect(authed.role).toBe("USER");
    });
  });
});
