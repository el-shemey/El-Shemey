import { db } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { generateOtp, safeTokenEquals } from "@/lib/server/auth/tokens";
import { getMailProvider } from "@/lib/server/mail-providers";
import { buildOtpMessage } from "@/lib/server/delivery";
import {
  requireRealMailProvider,
  DeliveryNotConfiguredError,
} from "@/lib/server/mail-providers";
import {
  isPhoneAuthEnabled,
  requireRealSmsProvider,
  SmsDeliveryNotConfiguredError,
} from "@/lib/server/delivery";
import type { Prisma } from "@prisma/client";
import { getRateLimiter } from "@/lib/server/rate-limit";
import { maskIdentifier, normalizeIdentifier } from "@/lib/server/identity";
import { registerSchema } from "@/features/auth/schemas";

/**
 * Authentication domain service — identifier-based OTP edition.
 *
 * Identity rules:
 *  - A user registers with EMAIL or PHONE (+password).
 *  - Email stored canonical-lowercase; phone stored E.164.
 *  - Unverified accounts cannot sign in; they complete an OTP challenge.
 *
 * OTP security:
 *  - 6-digit CSPRNG codes, SHA-256 hashed at rest, single-use, expiring.
 *  - New issue invalidates previous active codes for that purpose+user.
 *  - Attempt throttling per identifier via the rate-limit boundary.
 *
 * Enumeration safety: every public response is constant regardless of
 * account existence; delivery only happens when an account exists.
 */

export class AuthError extends Error {
  constructor(
    public code:
      "RATE_LIMITED" | "INVALID_CREDENTIALS" | "IDENTITY_NOT_VERIFIED" | "INVALID_CODE",
  ) {
    super(code);
  }
}

const CODE_TTL_MINUTES = 10;
const VERIFY_ATTEMPTS_LIMIT = 5;
const ATTEMPT_WINDOW_MINUTES = 10;

type Purpose = "VERIFY_IDENTITY" | "RESET_PASSWORD";
type Kind = "emailVerificationToken" | "passwordResetToken";

const kindFor: Record<Purpose, Kind> = {
  VERIFY_IDENTITY: "emailVerificationToken",
  RESET_PASSWORD: "passwordResetToken",
};

type AuthEventType =
  | "REGISTER_SUCCESS"
  | "REGISTER_DUPLICATE_IGNORED"
  | "OTP_ISSUED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_RATE_LIMITED"
  | "IDENTITY_VERIFIED"
  | "VERIFY_RESENT"
  | "RESET_REQUESTED"
  | "RESET_COMPLETED";

async function audit(
  type: AuthEventType,
  data: { identifier?: string; userId?: string; outcome?: string },
) {
  try {
    await db.authEvent.create({
      data: {
        type,
        // Identifier may be an email or an E.164 phone; both are canonical.
        email: data.identifier?.includes("@") ? data.identifier : null,
        userId: data.userId ?? null,
        outcome: data.outcome ?? "OK",
      },
    });
  } catch {
    // Audit must never break the auth flow.
  }
}

/* ------------------------------ User lookup ------------------------------ */

async function findByIdentifier(canonical: {
  channel: "EMAIL" | "SMS";
  value: string;
}) {
  return canonical.channel === "EMAIL"
    ? db.user.findUnique({ where: { email: canonical.value } })
    : db.user.findUnique({ where: { phone: canonical.value } });
}

function isVerified(
  user: { emailVerified: Date | null; phoneVerified: Date | null },
  channel: "EMAIL" | "SMS",
): boolean {
  return channel === "EMAIL"
    ? Boolean(user.emailVerified)
    : Boolean(user.phoneVerified);
}

/* ------------------------------ Registration ----------------------------- */

export interface RegisterResult {
  channel: "EMAIL" | "SMS";
  identifier: string;
  /** Safe display form for the verification page. */
  masked: string;
}

export async function registerWithIdentifier(raw: {
  name?: string;
  identifier: string;
  password: string;
}): Promise<RegisterResult> {
  const input = registerSchema.parse({
    name: raw.name,
    identifier: raw.identifier,
    password: raw.password,
  });

  const rl = await getRateLimiter().consume(`register:${input.identifier}`, 3, 60 * 60);
  if (!rl.allowed) throw new AuthError("RATE_LIMITED");

  const id = normalizeIdentifier(input.identifier);
  if (id.channel === "SMS" && !isPhoneAuthEnabled()) {
    throw new SmsDeliveryNotConfiguredError();
  }
  const existing = await findByIdentifier(id);
  if (existing && isVerified(existing, id.channel)) {
    await audit("REGISTER_DUPLICATE_IGNORED", { identifier: id.value });
    return {
      channel: id.channel,
      identifier: id.value,
      masked: maskIdentifier(id.channel, id.value),
    }; // silent
  }

  const passwordHash = await hashPassword(input.password);

  const userData = {
    name: input.name ?? null,
    passwordHash,
    ...(id.channel === "EMAIL" ? { email: id.value } : { phone: id.value }),
  };

  const user = existing
    ? // Unverified account re-registering with same identifier: refresh creds.
      await db.user.update({
        where: { id: existing.id },
        data: userData,
      })
    : await db.user.create({ data: userData });

  await issueOtp(user.id, id, "VERIFY_IDENTITY");
  await audit("REGISTER_SUCCESS", { identifier: id.value, userId: user.id });
  return {
    channel: id.channel,
    identifier: id.value,
    masked: maskIdentifier(id.channel, id.value),
  };
}

/* ------------------------------- OTP issuing ------------------------------ */

async function issueOtp(
  userId: string,
  id: { channel: "EMAIL" | "SMS"; value: string },
  purpose: Purpose,
): Promise<string /*masked*/> {
  const { code, hash } = generateOtp();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  const kind = kindFor[purpose];

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (kind === "emailVerificationToken") {
      await tx.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
      await tx.emailVerificationToken.create({
        data: { userId, tokenHash: hash, expiresAt },
      });
    } else {
      await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
      await tx.passwordResetToken.create({
        data: { userId, tokenHash: hash, expiresAt },
      });
    }
  });

  const messageText = buildOtpMessage(purpose, code, CODE_TTL_MINUTES, "en");

  // Real delivery path: refuses to operate without configured credentials.
  if (id.channel === "SMS") {
    const sms = requireRealSmsProvider();
    await sms.sendSms(id.value, messageText);
  } else {
    const mail = requireRealMailProvider();
    await mail.send({
      to: id.value,
      subject: `Your EL-SHEMEY verification code: ${code}`,
      locale: "en",
      kind: purpose === "RESET_PASSWORD" ? "PASSWORD_RESET" : "VERIFY_EMAIL",
      otp: code,
      otpExpiresMinutes: CODE_TTL_MINUTES,
    });
  }

  await audit("OTP_ISSUED", { identifier: id.value, userId, outcome: purpose });
  return maskIdentifier(id.channel, id.value);
}

/* ---------------------------- OTP verification ---------------------------- */

export async function requestLoginVerification(
  identifierRaw: string,
): Promise<RegisterResult> {
  const id = normalizeIdentifier(identifierRaw);
  if (id.channel === "SMS" && !isPhoneAuthEnabled()) {
    throw new SmsDeliveryNotConfiguredError();
  }
  const rl = await getRateLimiter().consume(`otp-req:${id.value}`, 3, 15 * 60);
  if (!rl.allowed) throw new AuthError("RATE_LIMITED");

  const user = await findByIdentifier(id);
  if (!user || isVerified(user, id.channel))
    return {
      channel: id.channel,
      identifier: id.value,
      masked: maskIdentifier(id.channel, id.value),
    };

  await issueOtp(user.id, id, "VERIFY_IDENTITY");
  await audit("OTP_ISSUED", { identifier: id.value, userId: user.id });
  return {
    channel: id.channel,
    identifier: id.value,
    masked: maskIdentifier(id.channel, id.value),
  };
}

export async function verifyIdentityWithOtp(
  identifierRaw: string,
  code: string,
): Promise<boolean> {
  const id = normalizeIdentifier(identifierRaw);
  if (id.channel === "SMS" && !isPhoneAuthEnabled()) {
    throw new SmsDeliveryNotConfiguredError();
  }

  const rl = await getRateLimiter().consume(
    `otp-verify:${id.value}`,
    VERIFY_ATTEMPTS_LIMIT,
    ATTEMPT_WINDOW_MINUTES * 60,
  );
  if (!rl.allowed) throw new AuthError("RATE_LIMITED");

  const user = await findByIdentifier(id);
  if (!user || isVerified(user, id.channel)) return false;

  const ok = await consumeOtp(kindFor.VERIFY_IDENTITY, user.id, code);
  if (!ok) return false;

  await db.user.update({
    where: { id: user.id },
    data:
      id.channel === "EMAIL"
        ? { emailVerified: new Date() }
        : { phoneVerified: new Date() },
  });
  await audit("IDENTITY_VERIFIED", { identifier: id.value, userId: user.id });
  return true;
}

export async function resendVerificationOtp(
  identifierRaw: string,
): Promise<RegisterResult> {
  const id = normalizeIdentifier(identifierRaw);
  if (id.channel === "SMS" && !isPhoneAuthEnabled()) {
    throw new SmsDeliveryNotConfiguredError();
  }
  const rl = await getRateLimiter().consume(`otp-resend:${id.value}`, 3, 60 * 60);
  if (!rl.allowed) throw new AuthError("RATE_LIMITED");

  const user = await findByIdentifier(id);
  if (!user || isVerified(user, id.channel)) {
    return {
      channel: id.channel,
      identifier: id.value,
      masked: maskIdentifier(id.channel, id.value),
    };
  }
  await issueOtp(user.id, id, "VERIFY_IDENTITY");
  await audit("VERIFY_RESENT", { identifier: id.value, userId: user.id });
  return {
    channel: id.channel,
    identifier: id.value,
    masked: maskIdentifier(id.channel, id.value),
  };
}

/* ---------------------------- Password reset ----------------------------- */

export async function requestPasswordResetOtp(
  identifierRaw: string,
): Promise<RegisterResult> {
  const id = normalizeIdentifier(identifierRaw);
  if (id.channel === "SMS" && !isPhoneAuthEnabled()) {
    throw new SmsDeliveryNotConfiguredError();
  }
  const rl = await getRateLimiter().consume(`reset:${id.value}`, 3, 60 * 60);
  if (!rl.allowed) throw new AuthError("RATE_LIMITED");

  const user = await findByIdentifier(id);
  if (!user || !user.passwordHash)
    return {
      channel: id.channel,
      identifier: id.value,
      masked: maskIdentifier(id.channel, id.value),
    };

  await issueOtp(user.id, id, "RESET_PASSWORD");
  await audit("RESET_REQUESTED", { identifier: id.value, userId: user.id });
  return {
    channel: id.channel,
    identifier: id.value,
    masked: maskIdentifier(id.channel, id.value),
  };
}

export async function confirmPasswordResetWithOtp(
  identifierRaw: string,
  code: string,
  newPassword: string,
): Promise<boolean> {
  const id = normalizeIdentifier(identifierRaw);
  if (id.channel === "SMS" && !isPhoneAuthEnabled()) {
    throw new SmsDeliveryNotConfiguredError();
  }

  const user = await findByIdentifier(id);
  if (!user || !user.passwordHash) return false;

  const rl = await getRateLimiter().consume(
    `reset-confirm:${id.value}`,
    VERIFY_ATTEMPTS_LIMIT,
    ATTEMPT_WINDOW_MINUTES * 60,
  );
  if (!rl.allowed) throw new AuthError("RATE_LIMITED");

  const ok = await consumeOtp(kindFor.RESET_PASSWORD, user.id, code);
  if (!ok) return false;

  // Completing an OTP reset PROVES control of the channel — mark it verified.
  // Without this, a phone/email user who resets via OTP stays "unverified"
  // and cannot sign in despite demonstrating ownership (Phase 10 fix).
  const verifiedPatch =
    id.channel === "EMAIL"
      ? { emailVerified: new Date() }
      : { phoneVerified: new Date() };

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        sessionVersion: { increment: 1 },
        ...verifiedPatch,
      },
    }),
    db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit("RESET_COMPLETED", { identifier: id.value, userId: user.id });
  return true;
}

/* ------------------------------ Login support ----------------------------- */

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
  sessionVersion: number;
}

export async function authenticateUser(
  identifierRaw: string,
  password: string,
  /** Client IP (from trusted proxy headers). Prevents cross-user lockout:
   *  without it, a single shared bucket lets any 10 failed logins platform-
   *  wide block EVERYONE for 15 minutes. */
  ip?: string,
): Promise<AuthenticatedUser> {
  const id = normalizeIdentifier(identifierRaw);
  const limiter = getRateLimiter();

  const perIp = await limiter.consume(`login:ip:${ip ?? "unknown"}`, 10, 15 * 60);
  const perAccount = await limiter.consume(`login:acct:${id.value}`, 5, 15 * 60);
  if (!perIp.allowed || !perAccount.allowed) {
    await audit("LOGIN_RATE_LIMITED", { identifier: id.value, outcome: "BLOCKED" });
    throw new AuthError("RATE_LIMITED");
  }

  const user = await findByIdentifier(id);
  const ok =
    user?.passwordHash != null && (await verifyPassword(user.passwordHash, password));

  if (!user || !ok) {
    await audit("LOGIN_FAILED", {
      identifier: id.value,
      outcome: "INVALID_CREDENTIALS",
    });
    throw new AuthError("INVALID_CREDENTIALS");
  }
  if (!isVerified(user, id.channel)) {
    await audit("LOGIN_FAILED", { identifier: id.value, outcome: "NOT_VERIFIED" });
    throw new AuthError("IDENTITY_NOT_VERIFIED");
  }

  await audit("LOGIN_SUCCESS", { identifier: id.value, userId: user.id });
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

/* ------------------------------ OTP consume ------------------------------- */

async function consumeOtp(kind: Kind, userId: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  const where = {
    userId,
    expiresAt: { gt: new Date() },
    usedAt: null,
  } as const;
  const select = { id: true, tokenHash: true } as const;

  const candidates =
    kind === "emailVerificationToken"
      ? await db.emailVerificationToken.findMany({ where, select })
      : await db.passwordResetToken.findMany({ where, select });

  const match = candidates.find((c) => safeTokenEquals(code, c.tokenHash));
  if (!match) return false;

  const txOps =
    kind === "emailVerificationToken"
      ? [
          db.emailVerificationToken.update({
            where: { id: match.id },
            data: { usedAt: new Date() },
          }),
          db.emailVerificationToken.deleteMany({
            where: { userId, id: { not: match.id }, usedAt: null },
          }),
        ]
      : [
          db.passwordResetToken.update({
            where: { id: match.id },
            data: { usedAt: new Date() },
          }),
          db.passwordResetToken.deleteMany({
            where: { userId, id: { not: match.id }, usedAt: null },
          }),
        ];

  await db.$transaction(txOps);
  return true;
}
