import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";

describe("argon2id password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("Correct-Horse-9");
    expect(hash).not.toContain("Correct-Horse-9");
    expect(await verifyPassword(hash, "Correct-Horse-9")).toBe(true);
  });

  it("rejects wrong passwords", async () => {
    const hash = await hashPassword("Correct-Horse-9");
    expect(await verifyPassword(hash, "wrong-password-1")).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPassword("Same-Password-1");
    const b = await hashPassword("Same-Password-1");
    expect(a).not.toBe(b);
  });

  it("never returns the plaintext", async () => {
    const hash = await hashPassword("Another-Pass-22");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });
});
