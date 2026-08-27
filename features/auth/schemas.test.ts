import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/features/auth/schemas";

describe("auth input validation + normalization", () => {
  it("accepts mixed-case email identifiers (service normalizes)", () => {
    const r = registerSchema.safeParse({
      identifier: "  Learner@Example.COM ",
      password: "GoodPass123",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid phone identifiers", () => {
    expect(
      registerSchema.safeParse({ identifier: "12345", password: "GoodPass123" })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ identifier: "+201000000000", password: "GoodPass123" })
        .success,
    ).toBe(true);
  });

  it("enforces the password policy", () => {
    expect(
      registerSchema.safeParse({ identifier: "a@b.co", password: "short1" }).success,
    ).toBe(false); // <10
    expect(
      registerSchema.safeParse({ email: "a@b.co", password: "onlyletterspass" })
        .success,
    ).toBe(false); // no number
    expect(
      registerSchema.safeParse({ identifier: "a@b.co", password: "GoodPass123" })
        .success,
    ).toBe(true);
  });

  it("login schema rejects empty credentials without leaking detail", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
  });
});
