import { describe, expect, it } from "vitest";
import {
  canTransition,
  effectiveStatus,
  isSubscriptionActive,
  isTerminal,
  type SubscriptionStatus,
} from "@/lib/domain/subscriptions";

/**
 * Unit — Phase 7A subscription state machine.
 * Every allowed transition, every forbidden one, and time-derived expiry.
 */

const ALL: SubscriptionStatus[] = [
  "CREATED",
  "ACTIVE",
  "PAST_DUE",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
];

const ALLOWED: Array<[SubscriptionStatus, SubscriptionStatus]> = [
  ["CREATED", "ACTIVE"],
  ["CREATED", "CANCELLED"],
  ["CREATED", "EXPIRED"],
  ["ACTIVE", "PAST_DUE"],
  ["ACTIVE", "PAUSED"],
  ["ACTIVE", "CANCELLED"],
  ["ACTIVE", "EXPIRED"],
  ["ACTIVE", "REFUNDED"],
  ["PAST_DUE", "ACTIVE"],
  ["PAST_DUE", "PAUSED"],
  ["PAST_DUE", "CANCELLED"],
  ["PAST_DUE", "EXPIRED"],
  ["PAST_DUE", "REFUNDED"],
  ["PAUSED", "ACTIVE"],
  ["PAUSED", "CANCELLED"],
];

describe("subscription state machine — allowed transitions", () => {
  for (const [from, to] of ALLOWED) {
    it(`${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }
});

describe("subscription state machine — forbidden transitions", () => {
  it("terminal states never reopen (incl. REFUNDED without new purchase)", () => {
    for (const terminal of ["CANCELLED", "EXPIRED", "REFUNDED"] as const) {
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it("no self-transitions", () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false);
  });

  it("exhaustive forbidden matrix", () => {
    const allowedSet = new Set(ALLOWED.map(([f, t]) => `${f}->${t}`));
    for (const from of ALL) {
      for (const to of ALL) {
        const key = `${from}->${to}`;
        if (!allowedSet.has(key)) {
          expect(canTransition(from, to)).toBe(false);
        }
      }
    }
  });
});

describe("entitlement evaluation — time-derived expiry + refund revocation", () => {
  const future = new Date(Date.now() + 86400_000);
  const past = new Date(Date.now() - 86400_000);

  it("only ACTIVE within period grants PRO", () => {
    expect(isSubscriptionActive({ status: "ACTIVE", currentPeriodEnd: future })).toBe(
      true,
    );
    // REFUNDED denies even with a live-looking period:
    expect(
      isSubscriptionActive({ status: "REFUNDED" as never, currentPeriodEnd: future }),
    ).toBe(false);
    // Expired-by-time denies even with stored ACTIVE:
    expect(isSubscriptionActive({ status: "ACTIVE", currentPeriodEnd: past })).toBe(
      false,
    );
  });

  it("effectiveStatus derives expiry without cron jobs", () => {
    expect(
      effectiveStatus({ status: "ACTIVE", currentPeriodEnd: past }),
    ).toBe<SubscriptionStatus>("EXPIRED");
    expect(isTerminal("REFUNDED")).toBe(true);
  });
});
