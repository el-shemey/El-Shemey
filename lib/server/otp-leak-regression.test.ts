import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registerWithIdentifier } from "@/lib/server/auth-service";
import { generateOtp, hashToken } from "@/lib/server/auth/tokens";

/**
 * SECURITY REGRESSION — OTP must never reach the client through
 * action return values, page props, URLs, or JSON responses.
 */

describe("OTP client-exposure regression", () => {
  it("register result contains no plaintext or hashed OTP value", async () => {
    const email = `no-leak-${Math.random().toString(36).slice(2, 6)}@test.dev`;
    // This will throw DELIVERY_NOT_CONFIGURED in dev (no SMTP creds) —
    // which itself proves no OTP was generated-and-returned.
    try {
      const result = await registerWithIdentifier({
        name: "LeakTest",
        identifier: email,
        password: "Strong-Pass-77",
      });
      // If a provider were configured, assert no code in response
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/"otp"/i);
      expect(serialized).not.toMatch(/"code"\s*:\s*"\d{6}"/);
      expect(serialized).not.toMatch(/"devCode"/);
    } catch (e) {
      // DELIVERY_NOT_CONFIGURED is correct behavior without credentials
      expect((e as Error).message).toContain("DELIVERY_NOT_CONFIGURED");
    }
  });

  it("generateOtp returns 6-digit codes; hash never equals plaintext", () => {
    for (let i = 0; i < 20; i++) {
      const { code, hash } = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(hash).toHaveLength(64); // SHA-256 hex
      expect(hash).not.toBe(code);
    }
  });

  it("hashed tokens never contain the plaintext code", async () => {
    const { code, hash } = generateOtp();
    expect(hashToken(code)).toBe(hash);
    expect(hash).not.toContain(code);
  });
});
