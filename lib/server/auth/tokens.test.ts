import { describe, expect, it } from "vitest";
import { generateToken, hashToken, safeTokenEquals } from "@/lib/server/auth/tokens";

describe("one-time tokens (hashed at rest)", () => {
  it("generates unique cryptographically random tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
    expect(a.raw.length).toBeGreaterThanOrEqual(40);
  });

  it("verifies the raw token against its stored hash only", () => {
    const { raw, hash } = generateToken();
    expect(safeTokenEquals(raw, hash)).toBe(true);
    expect(safeTokenEquals(raw + "x", hash)).toBe(false);
    expect(safeTokenEquals("forged-token", hash)).toBe(false);
  });

  it("hashes are deterministic for the same raw value (lookup key)", () => {
    expect(hashToken("same-input")).toBe(hashToken("same-input"));
  });
});
