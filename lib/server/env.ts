import "server-only";

/**
 * Production environment validation (Phase 11 Task 3 — C3).
 *
 * - No secrets are ever logged, returned, or placed in JWT/session.
 * - Validation reports only VARIABLE NAMES + coarse reasons.
 * - Development may use localhost/dev outbox/local-fs; production fails closed.
 * - Called at server startup in production via instrumentation.ts.
 */

export type EnvError = { variable: string; reason: string };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// AUTH_SECRET must be strong: >=32 chars, not empty/placeholder
export function validateAuthSecret(): EnvError[] {
  if (!isProduction()) return [];
  const v = process.env.AUTH_SECRET;
  if (!v || v.trim().length === 0) return [{ variable: "AUTH_SECRET", reason: "required in production" }];
  if (v.trim().length < 32) return [{ variable: "AUTH_SECRET", reason: "must be >=32 characters (generate with: openssl rand -base64 48)" }];
  if (/^(changeme|placeholder|test|example|your-domain)/i.test(v.trim())) {
    return [{ variable: "AUTH_SECRET", reason: "placeholder value not allowed" }];
  }
  return [];
}

export function validateDatabase(): EnvError[] {
  if (!isProduction()) return [];
  const errors: EnvError[] = [];
  const db = process.env.DATABASE_URL;
  const direct = process.env.DIRECT_URL;
  if (!db || db.trim().length === 0) errors.push({ variable: "DATABASE_URL", reason: "required in production (pooled, pgbouncer=true)" });
  else if (!db.startsWith("postgresql://") && !db.startsWith("postgres://")) {
    errors.push({ variable: "DATABASE_URL", reason: "must be postgresql:// connection string" });
  }
  if (!direct || direct.trim().length === 0) errors.push({ variable: "DIRECT_URL", reason: "required in production (direct, for migrations)" });
  else if (!direct.startsWith("postgresql://") && !direct.startsWith("postgres://")) {
    errors.push({ variable: "DIRECT_URL", reason: "must be postgresql:// connection string" });
  }
  return errors;
}

export function validateAppUrl(): EnvError[] {
  if (!isProduction()) return [];
  const v = process.env.NEXT_PUBLIC_APP_URL;
  if (!v || v.trim().length === 0) return [{ variable: "NEXT_PUBLIC_APP_URL", reason: "required in production (https://YOUR-DOMAIN)" }];
  const t = v.trim();
  // Reject placeholders
  if (/YOUR-DOMAIN/i.test(t)) return [{ variable: "NEXT_PUBLIC_APP_URL", reason: "placeholder YOUR-DOMAIN not allowed" }];
  if (t.includes("localhost") || t.includes("127.0.0.1")) {
    return [{ variable: "NEXT_PUBLIC_APP_URL", reason: "localhost not allowed in production" }];
  }
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    return [{ variable: "NEXT_PUBLIC_APP_URL", reason: "must be a valid URL" }];
  }
  if (url.protocol !== "https:") return [{ variable: "NEXT_PUBLIC_APP_URL", reason: "must be https:// in production" }];
  return [];
}

// SMTP: production requires HOST/USER/PASS (MAIL_FROM defaults to SMTP_USER per existing behavior)
export function validateSmtp(): EnvError[] {
  if (!isProduction()) return [];
  const errors: EnvError[] = [];
  if (!process.env.SMTP_HOST) errors.push({ variable: "SMTP_HOST", reason: "required in production for OTP delivery" });
  if (!process.env.SMTP_USER) errors.push({ variable: "SMTP_USER", reason: "required in production for OTP delivery" });
  if (!process.env.SMTP_PASS) errors.push({ variable: "SMTP_PASS", reason: "required in production for OTP delivery" });
  return errors;
}

// S3: only when VIDEO_STORAGE_DRIVER=s3
export function validateS3(): EnvError[] {
  const driver = process.env.VIDEO_STORAGE_DRIVER ?? "local-fs";
  if (driver !== "s3") return [];
  // In production, s3 driver requires all S3 vars; in dev, also fail-loud but allow local-fs default
  const required = ["S3_BUCKET", "S3_REGION", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
  const errors: EnvError[] = [];
  for (const k of required) {
    if (!process.env[k] || String(process.env[k]).trim().length === 0) {
      errors.push({ variable: k, reason: "required when VIDEO_STORAGE_DRIVER=s3" });
    }
  }
  if (isProduction() && driver === "s3") {
    // no silent fallback to local-fs already enforced in storage.ts
  }
  return errors;
}

// PAYMOB validation
const VALID_PAYMOB_MODES = new Set(["sandbox", "production"]);

export function validatePaymob(): EnvError[] {
  const errors: EnvError[] = [];
  const mode = process.env.PAYMOB_MODE;
  // Mode must be explicit if any Paymob var is set or in production when paymob is expected
  if (mode !== undefined && mode !== "" && !VALID_PAYMOB_MODES.has(mode)) {
    errors.push({ variable: "PAYMOB_MODE", reason: "must be sandbox or production" });
  }
  // If any Paymob credential is set, all required must be set
  const anyPaymobSet = Boolean(
    process.env.PAYMOB_API_KEY ||
      process.env.PAYMOB_INTEGRATION_ID ||
      process.env.PAYMOB_HMAC_SECRET ||
      process.env.PAYMOB_IFRAME_ID,
  );
  if (anyPaymobSet || isProduction()) {
    // In production, if app expects payments, these should be validated at point-of-use;
    // we report missing only when any is partially configured to avoid noisy prod without payments yet.
    // But per C3 spec: production must not allow fakepay — already enforced via isFakePayEnabled.
    // So only validate completeness when any is set.
    if (anyPaymobSet) {
      if (!process.env.PAYMOB_API_KEY) errors.push({ variable: "PAYMOB_API_KEY", reason: "required when Paymob is configured" });
      if (!process.env.PAYMOB_INTEGRATION_ID) errors.push({ variable: "PAYMOB_INTEGRATION_ID", reason: "required when Paymob is configured" });
      else if (!/^\d+$/.test(String(process.env.PAYMOB_INTEGRATION_ID).trim())) {
        errors.push({ variable: "PAYMOB_INTEGRATION_ID", reason: "must be numeric" });
      }
      if (!process.env.PAYMOB_HMAC_SECRET) errors.push({ variable: "PAYMOB_HMAC_SECRET", reason: "required when Paymob is configured" });
      if (!process.env.PAYMOB_IFRAME_ID) errors.push({ variable: "PAYMOB_IFRAME_ID", reason: "required when Paymob is configured" });
      if (!mode) errors.push({ variable: "PAYMOB_MODE", reason: "required when Paymob is configured (sandbox|production)" });
    }
  }
  return errors;
}

export function validatePhoneGate(): EnvError[] {
  // PHONE_AUTH_ENABLED=1 in production without real SMS provider is a misconfiguration
  if (isProduction() && process.env.PHONE_AUTH_ENABLED === "1") {
    // Until real SMS provider exists, this flag must not be enabled in prod
    // We return a warning-level error; caller decides to throw or warn
    return [{ variable: "PHONE_AUTH_ENABLED", reason: "must be 0 or unset in production until real SMS provider is provisioned" }];
  }
  return [];
}

export function validateFakepay(): EnvError[] {
  if (isProduction() && (process.env.FAKEPAY_ENABLED === "1" || process.env.PAYMENT_DEV_PROVIDER === "fakepay")) {
    return [{ variable: "FAKEPAY_ENABLED/PAYMENT_DEV_PROVIDER", reason: "fakepay must never be enabled in production" }];
  }
  return [];
}

export function getProductionEnvErrors(): EnvError[] {
  return [
    ...validateAuthSecret(),
    ...validateDatabase(),
    ...validateAppUrl(),
    ...validateSmtp(),
    ...validateS3(),
    ...validatePaymob(),
    ...validatePhoneGate(),
    ...validateFakepay(),
  ];
}

/**
 * Throws at server startup in production if critical config is missing.
 * Error message contains only variable names + coarse reasons — never secret values.
 */
export function assertProductionEnv(): void {
  if (!isProduction()) return;
  const errors = getProductionEnvErrors();
  // Filter to truly blocking errors: auth + database + app url are always blocking;
  // S3 only blocking when driver=s3; SMTP only blocking as warning for now (let requireRealMailProvider fail at OTP time)
  // For strictness, we block on AUTH_SECRET, DATABASE_URL/DIRECT_URL, NEXT_PUBLIC_APP_URL, S3 (when s3), PAYMOB (when partially set), FAK EPAY
  const blocking = errors.filter((e) => {
    // Treat PHONE_AUTH_ENABLED warning as blocking too (fail-closed)
    return true;
  });
  // Separate non-blocking SMTP/optional Upstash is not in error list anyway
  // But to avoid noisy prod without email yet, we allow SMTP to be reported but not throw during build?
  // For C3, we require SMTP to be validated where it matters — at OTP time, not at startup.
  // So filter out SMTP from startup assertion to avoid breaking prod without email provisioned yet.
  const startupBlocking = blocking.filter((e) => !["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].includes(e.variable));
  if (startupBlocking.length > 0) {
    const msg = `Production env misconfigured: ${startupBlocking.map((e) => `${e.variable}(${e.reason})`).join(", ")}`;
    throw new Error(msg);
  }
}

export function formatEnvErrors(errors: EnvError[]): string {
  return errors.map((e) => `${e.variable}: ${e.reason}`).join("; ");
}
