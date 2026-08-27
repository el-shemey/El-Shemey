/**
 * Payment domain primitives (schema prepared Phase 3, logic activated Phase 5).
 *
 * Provider adapters (Paymob first; InstaPay/Fawry/Vodafone Cash pending
 * verified merchant flows — see docs/PAYMENTS.md) map their native statuses
 * INTO `PaymentStatus`. Domain/entitlement code only ever sees these states,
 * never provider payloads.
 */

export type PaymentMethod = "CARD" | "VODAFONE_CASH" | "FAWRY" | "INSTAPAY";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "REQUIRES_ACTION"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

/** Terminal-positive statuses that may influence entitlements. */
export function isPaymentSuccessful(status: PaymentStatus): boolean {
  return status === "SUCCEEDED";
}

/** Refund-aware status: access should be revoked/downgraded. */
export function isRefundState(status: PaymentStatus): boolean {
  return status === "REFUNDED" || status === "PARTIALLY_REFUNDED";
}

/** States from which a payment can still resolve to SUCCEEDED. */
export function isAwaitingResolution(status: PaymentStatus): boolean {
  return status === "CREATED" || status === "PENDING" || status === "REQUIRES_ACTION";
}
/**
 * Idempotent webhook application (Phase 5).
 *
 * Dedup happens at the persistence layer via PaymentEvent unique
 * (provider, externalEventId). This function validates that a payment may
 * legally move to the webhook's target status; repositories apply it inside
 * a transaction together with the PaymentEvent insert.
 */
export function canApplyPaymentStatus(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  if (current === next) return false; // duplicate — nothing to do
  // Refund states only from SUCCEEDED / PARTIALLY_REFUNDED.
  if (isRefundState(next)) {
    return current === "SUCCEEDED" || current === "PARTIALLY_REFUNDED";
  }
  // Terminal states never reopen.
  const terminal: PaymentStatus[] = ["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED"];
  if (terminal.includes(current)) return false;
  // Non-terminal → any non-terminal or terminal transition is allowed
  // (e.g. PENDING → REQUIRES_ACTION, PENDING → SUCCEEDED).
  return true;
}
