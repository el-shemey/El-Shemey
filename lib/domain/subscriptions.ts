/**
 * Subscription lifecycle domain (Phase 5).
 * Transitions are validated here; the repository refuses illegal moves.
 */

export type SubscriptionStatus =
  "CREATED" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  CREATED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  ACTIVE: ["PAST_DUE", "PAUSED", "CANCELLED", "EXPIRED", "REFUNDED"],
  PAST_DUE: ["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", "REFUNDED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  CANCELLED: [], // terminal for the period; re-subscribe = new CREATED row state via plan change
  EXPIRED: [],
  // Refund is a terminal revocation — it can never return to ACTIVE without
  // a NEW valid purchase (which starts a fresh subscription lifecycle).
  REFUNDED: [],
};

const TERMINAL: ReadonlySet<SubscriptionStatus> = new Set([
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
]);

export function isTerminal(status: SubscriptionStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  return from !== to && TRANSITIONS[from].includes(to);
}

/** A subscription grants PRO only while ACTIVE and inside its period. */
export function isSubscriptionActive(
  sub: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (sub.status !== "ACTIVE") return false;
  if (!sub.currentPeriodEnd) return false;
  // Expired-by-time is derived, never trusted from a stored status alone.
  return sub.currentPeriodEnd > now;
}

/** Status that time implies (e.g. ACTIVE past period end → EXPIRED). */
export function effectiveStatus(
  sub: { status: SubscriptionStatus; currentPeriodEnd: Date | null },
  now: Date = new Date(),
): SubscriptionStatus {
  if (sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
    return "EXPIRED";
  }
  return sub.status;
}
