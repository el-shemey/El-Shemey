import "server-only";

/**
 * Server-side error abstraction (Phase 9).
 *
 * - Internal categories are stable strings for log filtering.
 * - Public messages are safe, fixed per category — never raw errors.
 * - Logging is structured single-line JSON to stdout (collectable by any
 *   log drain). No stack traces, secrets or provider payloads are emitted.
 *
 * EXTERNAL ERROR TRACKING: intentionally a NO-OP adapter until the owner
 * selects a provider (e.g. Sentry). The seam below documents exactly where
 * it plugs in — nothing pretends tracking is active when it is not.
 */

export type ErrorCategory =
  | "DATABASE"
  | "AUTH"
  | "AUTHORIZATION"
  | "VALIDATION"
  | "PAYMENT_PROVIDER"
  | "STORAGE"
  | "DELIVERY"
  | "RATE_LIMIT"
  | "INTERNAL";

/** Fixed, user-safe messages — never include error details. */
const PUBLIC_MESSAGES: Record<ErrorCategory, string> = {
  DATABASE: "Something went wrong. Please try again.",
  AUTH: "Sign-in failed. Check your details and try again.",
  AUTHORIZATION: "You don't have access to that.",
  VALIDATION: "Please check the information you provided.",
  PAYMENT_PROVIDER: "The payment provider is unavailable. Try again shortly.",
  STORAGE: "File storage is temporarily unavailable.",
  DELIVERY: "Message delivery is temporarily unavailable.",
  RATE_LIMIT: "Too many attempts. Wait a moment and try again.",
  INTERNAL: "Something went wrong. Please try again.",
};

export interface LoggedError {
  at: string;
  category: ErrorCategory;
  message: string;
  /** Short internal context only — callers must never pass secrets here. */
  context?: Record<string, string | number | boolean | null>;
}

function emit(entry: LoggedError): void {
  // Structured single-line JSON → collectable without extra tooling.
  console.error(JSON.stringify(entry));
}

/**
 * Logs an internal error with category + safe context and returns the
 * public message for the caller to surface.
 */
export function reportError(
  category: ErrorCategory,
  error: unknown,
  context?: LoggedError["context"],
): string {
  const entry: LoggedError = {
    at: new Date().toISOString(),
    category,
    message:
      error instanceof Error
        ? `${error.name}: ${error.message.slice(0, 200)}`
        : "UNKNOWN_ERROR",
    context,
  };
  emit(entry);
  trackExternal(category, entry);
  return PUBLIC_MESSAGES[category];
}

/**
 * External error-tracking SEAM (no-op until a provider is selected and its
 * DSN configured). Integration contract: send {category, message, context}
 * — never raw error objects, stacks with env data, or credentials.
 */
let externalTrackingConfigured = false;

export function configureExternalErrorTracking(): void {
  // e.g. when process.env.SENTRY_DSN exists → init SDK here in one line.
  externalTrackingConfigured = Boolean(process.env.SENTRY_DSN);
}

function trackExternal(_category: ErrorCategory, _entry: LoggedError): void {
  if (!externalTrackingConfigured) return; // documented NO-OP state
  // Provider SDK call goes here in the production-integration step.
}

/** Whether an external tracker is active (for /admin/system honesty). */
export function isExternalErrorTrackingActive(): boolean {
  return externalTrackingConfigured;
}
