/**
 * Identity normalization (Phase 4-OTP).
 *
 * EMAIL: existing invariant — trim + lowercase.
 * PHONE: canonical E.164 (+[1-15 digits]). Accepted inputs:
 *   +<digits>            → kept
 *   00<digits>           → 00 replaced with +
 *   <digits>             → rejected unless it already looks fully qualified;
 *                          we do NOT guess a country code (no invented rules).
 */

export type IdentifierChannel = "EMAIL" | "SMS";

export interface NormalizedIdentifier {
  channel: IdentifierChannel;
  /** Canonical stored form (lowercase email / E.164 phone). */
  value: string;
}

export class InvalidIdentifierError extends Error {
  constructor(public reason: "EMPTY" | "BAD_EMAIL" | "BAD_PHONE") {
    super("INVALID_IDENTIFIER");
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(emailRaw: string): string {
  return emailRaw.trim().toLowerCase();
}

export function normalizePhone(phoneRaw: string): string {
  const trimmed = phoneRaw.replace(/[\s()\-.]/g, "");
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1);
    if (!/^[1-9]\d{6,14}$/.test(digits)) {
      throw new InvalidIdentifierError("BAD_PHONE");
    }
    return `+${digits}`;
  }
  if (trimmed.startsWith("00")) {
    const digits = trimmed.slice(2);
    if (!/^[1-9]\d{6,14}$/.test(digits)) {
      throw new InvalidIdentifierError("BAD_PHONE");
    }
    return `+${digits}`;
  }
  throw new InvalidIdentifierError("BAD_PHONE");
}

/**
 * Normalize an arbitrary user-supplied identifier and detect its channel.
 */
export function normalizeIdentifier(raw: string): NormalizedIdentifier {
  const value = raw.trim();
  if (!value) throw new InvalidIdentifierError("EMPTY");
  if (value.includes("@")) {
    const email = normalizeEmail(value);
    if (!EMAIL_RE.test(email)) throw new InvalidIdentifierError("BAD_EMAIL");
    return { channel: "EMAIL", value: email };
  }
  return { channel: "SMS", value: normalizePhone(value) };
}
/** Safe display form for the verification page (never reveals the full address). */
export function maskIdentifier(channel: IdentifierChannel, value: string): string {
  if (channel === "EMAIL") {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  const digits = value.replace("+", "");
  const cc = digits.slice(0, 2);
  const last4 = digits.slice(-4);
  return `+${cc} ${"*".repeat(Math.max(6, digits.length - 6))}${last4}`;
}
