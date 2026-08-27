import { appendFileSync, mkdirSync } from "node:fs";

/**
 * Delivery channel abstraction (Phase 4-OTP).
 *
 * EMAIL → MailProvider (lib/server/mail-providers.ts): SMTP (Gmail-ready
 *         with an App Password) when SMTP_* env is present, otherwise the
 *         dev outbox file.
 * SMS   → SmsProvider interface. NO real SMS provider is implemented yet —
 *         production requires a verified aggregator (e.g. Twilio or an
 *         Egypt-capable provider) with credentials in env. The development
 *         adapter writes `.dev-sms/outbox.jsonl` and is ALWAYS clearly
 *         reported as DEVELOPMENT DELIVERY MODE — never as a real send.
 */

export type OtpChannel = "EMAIL" | "SMS";

export interface OtpDelivery {
  to: string;
  code: string;
  purpose: "VERIFY_IDENTITY" | "RESET_PASSWORD";
  expiresMinutes: number;
  locale: "en" | "ar";
}

export interface SmsProvider {
  readonly id: string;
  /** True only when REAL delivery credentials are configured. */
  readonly realDelivery: boolean;
  sendSms(toE164: string, message: string): Promise<void>;
}

class DevSmsProvider implements SmsProvider {
  readonly id = "dev-sms-outbox";
  readonly realDelivery = false;

  async sendSms(toE164: string, message: string): Promise<void> {
    const dir = ".dev-sms";
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(
        `${dir}/outbox.jsonl`,
        JSON.stringify({ to: toE164, message, at: new Date().toISOString() }) + "\n",
        "utf8",
      );
    } catch {
      // Local capture failure must not break auth flows.
    }
  }
}

const globalForSms = globalThis as unknown as { sms: SmsProvider | undefined };

/** Swap point for a production aggregator implementation later. */
export function getSmsProvider(): SmsProvider {
  return (globalForSms.sms ??= new DevSmsProvider());
}

/**
 * Whether REAL (non-dev) OTP delivery is available on a channel.
 * The UI uses this to decide whether it may show a dev-mode code banner.
 */
export function hasRealDelivery(channel: OtpChannel): boolean {
  if (channel === "SMS") return getSmsProvider().realDelivery;
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

export function buildOtpMessage(
  purpose: OtpDelivery["purpose"],
  code: string,
  expiresMinutes: number,
  locale: "en" | "ar",
): string {
  const ar = locale === "ar";
  const purposeText =
    purpose === "RESET_PASSWORD"
      ? ar
        ? "إعادة تعيين كلمة المرور"
        : "password reset"
      : ar
        ? "تأكيد الحساب"
        : "account verification";
  return ar
    ? `رمز التحقق لإل-شمي (${purposeText}): ${code}. ينتهي بعد ${expiresMinutes} دقائق.`
    : `EL-SHEMEY ${purposeText} code: ${code}. Expires in ${expiresMinutes} minutes.`;
}
export class SmsDeliveryNotConfiguredError extends Error {
  constructor() {
    super("DELIVERY_NOT_CONFIGURED:SMS");
  }
}

/**
 * Phone-auth feature gate (Phase 11 Task 2).
 *
 * No real production SmsProvider exists yet. Development may use the
 * DevSmsProvider outbox (`.dev-sms/outbox.jsonl`) so the full OTP loop
 * remains exercisable locally. Production fails closed: phone flows throw
 * `SmsDeliveryNotConfiguredError` without touching the DB or leaking
 * whether the number exists.
 *
 * Explicit flag overrides the default:
 *  PHONE_AUTH_ENABLED=1 → force allow (future real provider)
 *  PHONE_AUTH_ENABLED=0 → force deny
 * Default: allow in non-production, deny in production.
 */
export function isPhoneAuthEnabled(): boolean {
  const flag = process.env.PHONE_AUTH_ENABLED;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/** Auth-path getter: refuses silent dev fallback in production. */
export function requireRealSmsProvider(): SmsProvider {
  if (isPhoneAuthEnabled()) {
    // Development: DevSmsProvider (realDelivery=false) is intentional.
    // Production with PHONE_AUTH_ENABLED=1 would require a real provider;
    // until one exists, this still returns the dev adapter only when explicitly enabled.
    return getSmsProvider();
  }
  throw new SmsDeliveryNotConfiguredError();
}
