import { describe, expect, it } from "vitest";
import {
  canTransition,
  effectiveStatus,
  isSubscriptionActive,
} from "@/lib/domain/subscriptions";
import { canApplyPaymentStatus, isPaymentSuccessful } from "@/lib/domain/payments";
import { assertAdminRole } from "@/lib/server/admin-guard";

describe("subscription lifecycle transitions", () => {
  it("allows the documented happy path", () => {
    expect(canTransition("CREATED", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "PAST_DUE")).toBe(true);
    expect(canTransition("PAST_DUE", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "CANCELLED")).toBe(true);
  });

  it("blocks illegal transitions and terminal states", () => {
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransition("EXPIRED", "ACTIVE")).toBe(false);
    expect(canTransition("CREATED", "PAUSED")).toBe(false);
    expect(canTransition("ACTIVE", "CREATED")).toBe(false);
  });
});

describe("entitlement evaluation — time-derived expiry", () => {
  const future = new Date(Date.now() + 86400_000);
  const past = new Date(Date.now() - 86400_000);

  it("ACTIVE inside period grants PRO", () => {
    expect(isSubscriptionActive({ status: "ACTIVE", currentPeriodEnd: future })).toBe(
      true,
    );
  });

  it("expired period revokes access even when stored status is ACTIVE", () => {
    const sub = { status: "ACTIVE" as const, currentPeriodEnd: past };
    expect(isSubscriptionActive(sub)).toBe(false);
    expect(effectiveStatus(sub)).toBe("EXPIRED");
  });

  it("non-ACTIVE statuses never grant PRO regardless of dates", () => {
    expect(isSubscriptionActive({ status: "PAST_DUE", currentPeriodEnd: future })).toBe(
      false,
    );
    expect(
      isSubscriptionActive({ status: "CANCELLED", currentPeriodEnd: future }),
    ).toBe(false);
  });
});

describe("payment → subscription linkage gates", () => {
  it("only SUCCEEDED payments may drive subscription activation", () => {
    expect(canApplyPaymentStatus("PENDING", "SUCCEEDED")).toBe(true);
    expect(canApplyPaymentStatus("CREATED", "SUCCEEDED")).toBe(true);
  });

  it("terminal payments cannot re-apply (webhook replay safety)", () => {
    expect(canApplyPaymentStatus("SUCCEEDED", "SUCCEEDED")).toBe(false);
    expect(canApplyPaymentStatus("FAILED", "SUCCEEDED")).toBe(false);
    expect(canApplyPaymentStatus("EXPIRED", "SUCCEEDED")).toBe(false);
  });

  it("refunds only from SUCCEEDED / PARTIALLY_REFUNDED", () => {
    expect(canApplyPaymentStatus("SUCCEEDED", "REFUNDED")).toBe(true);
    expect(canApplyPaymentStatus("PARTIALLY_REFUNDED", "REFUNDED")).toBe(true);
    expect(canApplyPaymentStatus("PENDING", "REFUNDED")).toBe(false);
    expect(isPaymentSuccessful("REFUNDED")).toBe(false);
  });
});

describe("admin authorization primitive — deny by default", () => {
  it("ADMIN passes; USER/undefined/none are rejected", () => {
    expect(() => assertAdminRole("ADMIN")).not.toThrow();
    expect(() => assertAdminRole("USER")).toThrow("FORBIDDEN");
    expect(() => assertAdminRole(undefined)).toThrow("FORBIDDEN");
    // Role can never arrive from a client payload — only from the verified session.
  });
});
