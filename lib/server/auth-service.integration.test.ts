import { afterAll, beforeEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resetRateLimiter } from "@/lib/server/rate-limit";
import { generateOtp, hashToken } from "@/lib/server/auth/tokens";
import { hashPassword } from "@/lib/server/auth/password";
import {
  authenticateUser,
  confirmPasswordResetWithOtp,
  registerWithIdentifier,
  requestLoginVerification,
  requestPasswordResetOtp,
  resendVerificationOtp,
  verifyIdentityWithOtp,
} from "@/lib/server/auth-service";

/**
 * INTEGRATION — identifier-based OTP auth lifecycle (live local DB).
 *
 * No SMTP/SMS credentials exist here, so issuing throws DELIVERY_NOT_CONFIGURED
 * (correct behavior: no silent fallback). For state-machine coverage we create
 * unverified users directly via Prisma and insert hashed OTPs, then exercise
 * the domain functions.
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

const RID = Math.random().toString(36).slice(2, 8);
const PASSWORD = "Strong-Pass-77";
const NEW_PASSWORD = "Newer-Pass-88";
// Per-run random OTPs: tokenHash is globally unique (sha256), so parallel
// test files inserting tokens from the same fixed code intermittently hit
// the tokenHash unique constraint (P2002) depending on worker scheduling.
const CODE = String(100000 + Math.floor(Math.random() * 900000));
const EXPIRED_CODE = String(100000 + Math.floor(Math.random() * 900000));
const WRONG_CODE_A = String(100000 + Math.floor(Math.random() * 900000));
const WRONG_CODE_B = String(100000 + Math.floor(Math.random() * 900000));

/** Creates a user with hashed password but NO emailVerified flag. */
async function createUnverifiedUser(email: string): Promise<{ id: string }> {
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash },
  });
  return { id: user.id };
}

describe.sequential("OTP auth lifecycle", () => {
  let userIdA = "";
  let userIdB = "";
  const EMAIL_A = `otp-a-${RID}@test.elshemey.dev`;
  const EMAIL_B = `otp-b-${RID}@test.elshemey.dev`;

  beforeAll(async () => {
    if (!dbUp) return;
    const a = await createUnverifiedUser(EMAIL_A);
    const b = await createUnverifiedUser(EMAIL_B);
    userIdA = a.id;
    userIdB = b.id;
  });

  afterAll(async () => {
    if (!dbUp) return;
    try {
      await prisma.user.deleteMany({ where: { email: { contains: RID } } });
      await prisma.emailVerificationToken.deleteMany({});
      await prisma.passwordResetToken.deleteMany({});
    } catch {}
  });

  /* ---- Production registration path ---- */

  it("registration throws DELIVERY_NOT_CONFIGURED without credentials", async () => {
    if (!dbUp) return;
    await expect(
      registerWithIdentifier({
        identifier: `reg-${RID}@test.elshemey.dev`,
        password: PASSWORD,
      }),
    ).rejects.toThrow("DELIVERY_NOT_CONFIGURED");
  });

  it("login blocked for unverified account", async () => {
    if (!dbUp) return;
    // Create an unverified user with correct password hash
    const pwHash = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: {
        email: `unv-${RID}@test.elshemey.dev`,
        passwordHash: pwHash,
      },
    });
    await expect(
      authenticateUser(`unv-${RID}@test.elshemey.dev`, PASSWORD),
    ).rejects.toThrow("IDENTITY_NOT_VERIFIED");
  });

  it("requestLoginVerification throws DELIVERY_NOT_CONFIGURED (no creds)", async () => {
    if (!dbUp) return;
    await expect(requestLoginVerification(EMAIL_A)).rejects.toThrow(
      "DELIVERY_NOT_CONFIGURED",
    );
  });

  /* ---- Verification state machine with live OTP rows ---- */

  it("correct OTP verifies once; reuse fails; wrong OTP fails", async () => {
    if (!dbUp) return;
    // Insert valid token
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userIdA } });
    await prisma.emailVerificationToken.create({
      data: {
        userId: userIdA,
        tokenHash: hashToken(CODE),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    // Correct code verifies
    expect(await verifyIdentityWithOtp(EMAIL_A, CODE)).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userIdA } });
    expect(user.emailVerified).toBeTruthy();

    // Reuse fails (single-use)
    expect(await verifyIdentityWithOtp(EMAIL_A, CODE)).toBe(false);

    // Wrong code fails
    expect(await verifyIdentityWithOtp(EMAIL_A, WRONG_CODE_A)).toBe(false);

    // No active codes remain after success (siblings cleared)
    const remaining = await prisma.emailVerificationToken.count({
      where: { userId: userIdA, usedAt: null },
    });
    expect(remaining).toBe(0);
  });

  it("expired OTP fails", async () => {
    if (!dbUp) return;
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userIdA } });
    await prisma.emailVerificationToken.create({
      data: {
        userId: userIdA,
        tokenHash: hashToken(EXPIRED_CODE),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(await verifyIdentityWithOtp(EMAIL_A, EXPIRED_CODE)).toBe(false);
  });

  it("cross-user isolation: B's code cannot verify A", async () => {
    if (!dbUp) return;
    // Insert code for B only
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userIdB } });
    await prisma.emailVerificationToken.create({
      data: {
        userId: userIdB,
        tokenHash: hashToken(WRONG_CODE_B),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    // A tries to use B's code — should fail
    expect(await verifyIdentityWithOtp(EMAIL_A, WRONG_CODE_B)).toBe(false);
  });

  /* ---- Password reset flow ---- */

  it("reset OTP flow: correct code changes password + revokes sessions", async () => {
    if (!dbUp) return;
    const oldVersion = (await prisma.user.findUniqueOrThrow({ where: { id: userIdA } }))
      .sessionVersion;

    await prisma.passwordResetToken.deleteMany({ where: { userId: userIdA } });
    await prisma.passwordResetToken.create({
      data: {
        userId: userIdA,
        tokenHash: hashToken(CODE),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    expect(await confirmPasswordResetWithOtp(EMAIL_A, CODE, NEW_PASSWORD)).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: userIdA } });
    expect(after.sessionVersion).toBe(oldVersion + 1);

    await expect(authenticateUser(EMAIL_A, PASSWORD)).rejects.toThrow();
    await expect(authenticateUser(EMAIL_A, NEW_PASSWORD)).resolves.toBeTruthy();
  });

  it("reset OTP single-use: reuse fails", async () => {
    if (!dbUp) return;
    expect(await confirmPasswordResetWithOtp(EMAIL_A, CODE, "Again-Pass-1")).toBe(
      false,
    );
  });
});
