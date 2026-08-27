import { describe, expect, it } from "vitest";
import {
  isAwaitingResolution,
  isPaymentSuccessful,
  isRefundState,
} from "@/lib/domain/payments";

describe("payment status gates (Phase 5 will consume these)", () => {
  it("only SUCCEEDED may influence entitlements", () => {
    expect(isPaymentSuccessful("SUCCEEDED")).toBe(true);
    expect(isPaymentSuccessful("PENDING")).toBe(false);
    expect(isPaymentSuccessful("REQUIRES_ACTION")).toBe(false);
    expect(isPaymentSuccessful("CREATED")).toBe(false);
    expect(isPaymentSuccessful("FAILED")).toBe(false);
  });

  it("creating a payment request never grants access", () => {
    // Fawry-style flow: reference created → still pending
    expect(isPaymentSuccessful("PENDING")).toBe(false);
    expect(isAwaitingResolution("PENDING")).toBe(true);
  });

  it("refunds are recognized for entitlement revocation", () => {
    expect(isRefundState("REFUNDED")).toBe(true);
    expect(isRefundState("PARTIALLY_REFUNDED")).toBe(true);
    expect(isRefundState("FAILED")).toBe(false);
  });

  it("expired/cancelled payments are terminal and non-successful", () => {
    expect(isPaymentSuccessful("EXPIRED")).toBe(false);
    expect(isPaymentSuccessful("CANCELLED")).toBe(false);
    expect(isAwaitingResolution("EXPIRED")).toBe(false);
  });
});
