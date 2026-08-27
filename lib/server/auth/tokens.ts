import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * One-time token generation for email verification / password reset.
 *
 * Raw tokens are returned ONCE to the caller (to embed in an email link)
 * and are never persisted or logged. Only the SHA-256 hash is stored,
 * making database leakage insufficient to impersonate a user.
 */

const TOKEN_BYTES = 32;

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Timing-safe comparison of a presented raw token against a stored hash. */
export function safeTokenEquals(presentedRaw: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(presentedRaw), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}
/**
 * 6-digit OTP generation (Phase 4.6 UX switch).
 * Cryptographically secure, zero-padded, unique-per-call.
 */
export function generateOtp(): { code: string; hash: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { code, hash: hashToken(code) };
}
