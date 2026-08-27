import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";

/**
 * Regression tests for C1 — JWT sessionVersion persistence.
 *
 * Coverage:
 *  A. authenticated session contains sessionVersion
 *  B. old JWT/session becomes invalid after password reset (mismatch detection)
 *  C. new login after password reset succeeds (fresh sv)
 *  D. admin revokeUserSessions invalidates an existing session (same mismatch path)
 *  E. no sensitive data is added to JWT/session
 */

function callJwt(user: Record<string, unknown>) {
  const cb = authConfig.callbacks.jwt as unknown as (args: {
    token: Record<string, unknown>;
    user: Record<string, unknown>;
  }) => Record<string, unknown>;
  return cb({ token: {}, user });
}

function callSession(token: Record<string, unknown>) {
  const cb = authConfig.callbacks.session as unknown as (args: {
    session: { user: Record<string, unknown> };
    token: Record<string, unknown>;
  }) => { user: Record<string, unknown> };
  const session: { user: Record<string, unknown> } = { user: {} };
  return cb({ session, token });
}

// Mirrors lib/server/auth/session.ts revocation check
function isSessionValid(
  sessionUser: Record<string, unknown>,
  dbSessionVersion: number,
): boolean {
  const tokenVersion = (sessionUser as { sv?: unknown }).sv;
  if (typeof tokenVersion === "number" && tokenVersion !== dbSessionVersion) return false;
  return true;
}

describe("C1 JWT sessionVersion — regression", () => {
  it("A. jwt callback persists sessionVersion -> token.sv and session callback copies to session.user.sv", () => {
    const token = callJwt({ id: "u1", role: "USER", sessionVersion: 3 });
    expect(token.uid).toBe("u1");
    expect(token.role).toBe("USER");
    expect(token.sv).toBe(3);

    const session = callSession(token);
    expect(session.user.id).toBe("u1");
    expect(session.user.role).toBe("USER");
    expect(session.user.sv).toBe(3);
  });

  it("A. jwt preserves sv as number only; undefined when user has no sessionVersion", () => {
    const token = callJwt({ id: "u2", role: "ADMIN" });
    expect(token.sv).toBeUndefined();
    const session = callSession(token);
    expect(session.user.sv).toBeUndefined();
  });

  it("B. old session becomes invalid after password reset (DB version bumped)", () => {
    // Login at version 5
    const tokenAtLogin = callJwt({ id: "u1", role: "USER", sessionVersion: 5 });
    const sessionAtLogin = callSession(tokenAtLogin);
    expect(isSessionValid(sessionAtLogin.user, 5)).toBe(true);

    // Password reset increments DB version to 6; old JWT still carries 5
    expect(isSessionValid(sessionAtLogin.user, 6)).toBe(false);
  });

  it("C. new login after password reset succeeds with fresh sv", () => {
    // After reset DB is at 6; fresh authenticateUser returns 6
    const freshToken = callJwt({ id: "u1", role: "USER", sessionVersion: 6 });
    const freshSession = callSession(freshToken);
    expect(freshSession.user.sv).toBe(6);
    expect(isSessionValid(freshSession.user, 6)).toBe(true);
  });

  it("D. admin revokeUserSessions (sessionVersion bump) invalidates existing session", () => {
    const tokenBefore = callJwt({ id: "u9", role: "USER", sessionVersion: 0 });
    const sessionBefore = callSession(tokenBefore);
    expect(isSessionValid(sessionBefore.user, 0)).toBe(true);
    // Admin revokes -> DB becomes 1, old token still 0
    expect(isSessionValid(sessionBefore.user, 1)).toBe(false);
    // Re-login gets 1 and passes
    const tokenAfter = callJwt({ id: "u9", role: "USER", sessionVersion: 1 });
    const sessionAfter = callSession(tokenAfter);
    expect(isSessionValid(sessionAfter.user, 1)).toBe(true);
  });

  it("E. JWT/session contain only sv (+ uid/role/id) — no sensitive fields", () => {
    const sensitiveUser = {
      id: "u1",
      role: "USER" as const,
      sessionVersion: 7,
      passwordHash: "argon2$hash$secret",
      password: "plaintext",
      tokenHash: "abc",
      emailVerificationToken: "secret",
      otp: "123456",
      DATABASE_URL: "postgres://secret",
      AUTH_SECRET: "shhh",
      SMTP_PASS: "smtp-secret",
    };
    const token = callJwt(sensitiveUser);
    const sensitiveKeys = [
      "passwordHash",
      "password",
      "tokenHash",
      "emailVerificationToken",
      "otp",
      "DATABASE_URL",
      "AUTH_SECRET",
      "SMTP_PASS",
    ];
    for (const k of sensitiveKeys) {
      expect(token).not.toHaveProperty(k);
    }
    // Only allowed keys
    expect(Object.keys(token).sort()).toEqual(["role", "sv", "uid"].sort());

    const session = callSession(token);
    for (const k of sensitiveKeys) {
      expect(session.user).not.toHaveProperty(k);
    }
    expect(Object.keys(session.user).sort()).toEqual(["id", "role", "sv"].sort());
    expect(typeof (session.user as { sv: unknown }).sv).toBe("number");
  });

  it("E. sv is numeric; non-numeric sessionVersion is ignored", () => {
    const token = callJwt({ id: "u1", role: "USER", sessionVersion: "7" as unknown as number });
    expect(token.sv).toBeUndefined();
  });
});
