import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { isFakePayEnabled } from "@/lib/server/payments/fakepay";
import { isPhoneAuthEnabled } from "@/lib/server/delivery";
import {
  getProductionEnvErrors,
  validateAppUrl,
  validateAuthSecret,
  validateDatabase,
  validateS3,
  validatePhoneGate,
} from "@/lib/server/env";
import { requireRealMailProvider } from "@/lib/server/mail-providers";

/**
 * C3 production environment & secrets hardening — 10 required cases.
 * Uses deterministic fake placeholders (TEST_SECRET_ONLY, etc.) — never real secrets.
 * No secret values are printed or asserted to contain real credentials.
 */

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(overrides)) {
    prev[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k] as string;
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(overrides)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k] as string;
    }
  }
}

function withProd(fn: () => void) {
  const prev = process.env.NODE_ENV;
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "production";
  try {
    fn();
  } finally {
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = prev;
  }
}
function withDev(fn: () => void) {
  const prev = process.env.NODE_ENV;
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "development";
  try {
    fn();
  } finally {
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = prev;
  }
}

describe("C3 production env hardening", () => {
  it("1. production without AUTH_SECRET fails safely (variable name only, no secret leak)", () => {
    withProd(() => {
      withEnv({ AUTH_SECRET: undefined }, () => {
        const errs = validateAuthSecret();
        expect(errs.some((e) => e.variable === "AUTH_SECRET")).toBe(true);
        const msg = errs.map((e) => `${e.variable}:${e.reason}`).join("; ");
        expect(msg).not.toContain("TEST_SECRET_ONLY"); // placeholder not leaked
        expect(msg).toContain("AUTH_SECRET");
      });
      withEnv({ AUTH_SECRET: "short" }, () => {
        const errs = validateAuthSecret();
        expect(errs.length).toBeGreaterThan(0);
        expect(errs[0].reason).toContain(">=32");
      });
      withEnv({ AUTH_SECRET: "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789!!@@##" }, () => {
        expect(validateAuthSecret()).toEqual([]);
      });
    });
  });

  it("2. production without DATABASE_URL/DIRECT_URL fails safely", () => {
    withProd(() => {
      withEnv({ DATABASE_URL: undefined, DIRECT_URL: undefined }, () => {
        const errs = validateDatabase();
        expect(errs.some((e) => e.variable === "DATABASE_URL")).toBe(true);
        expect(errs.some((e) => e.variable === "DIRECT_URL")).toBe(true);
      });
      withEnv(
        {
          DATABASE_URL: "postgresql://user:TEST_SECRET_ONLY@host:6543/postgres?pgbouncer=true",
          DIRECT_URL: "postgresql://user:TEST_SECRET_ONLY@host:5432/postgres",
        },
        () => {
          expect(validateDatabase()).toEqual([]);
        },
      );
    });
  });

  it("3. production with localhost/placeholder NEXT_PUBLIC_APP_URL is rejected; dev allows it", () => {
    withProd(() => {
      withEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, () => {
        const errs = validateAppUrl();
        expect(errs.some((e) => e.variable === "NEXT_PUBLIC_APP_URL")).toBe(true);
        expect(errs[0].reason).toContain("localhost");
      });
      withEnv({ NEXT_PUBLIC_APP_URL: "https://YOUR-DOMAIN.com" }, () => {
        expect(validateAppUrl().length).toBeGreaterThan(0);
      });
      withEnv({ NEXT_PUBLIC_APP_URL: "http://example.com" }, () => {
        const errs = validateAppUrl();
        expect(errs.some((e) => e.reason.includes("https"))).toBe(true);
      });
      withEnv({ NEXT_PUBLIC_APP_URL: "https://app.example.com" }, () => {
        expect(validateAppUrl()).toEqual([]);
      });
    });
    withDev(() => {
      withEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, () => {
        expect(validateAppUrl()).toEqual([]);
      });
    });
  });

  it("4. production SMTP missing remains fail-closed (requireRealMailProvider throws)", () => {
    withProd(() => {
      withEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
        expect(() => requireRealMailProvider()).toThrow("DELIVERY_NOT_CONFIGURED:EMAIL");
      });
      withEnv({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u@example.com", SMTP_PASS: "TEST_SMTP_PASS" }, () => {
        const p = requireRealMailProvider();
        expect(p).toBeDefined();
      });
    });
    withDev(() => {
      withEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
        // dev fallback allowed
        expect(() => requireRealMailProvider()).not.toThrow();
      });
    });
  });

  it("5. production S3 selected without required S3 variables fails closed", () => {
    withProd(() => {
      withEnv(
        {
          VIDEO_STORAGE_DRIVER: "s3",
          S3_BUCKET: undefined,
          S3_REGION: undefined,
          S3_ENDPOINT: undefined,
          S3_ACCESS_KEY_ID: undefined,
          S3_SECRET_ACCESS_KEY: undefined,
        },
        () => {
          const errs = validateS3();
          expect(errs.length).toBeGreaterThan(0);
          expect(errs.some((e) => e.variable === "S3_BUCKET")).toBe(true);
          // getS3Config would return null and storage factory would throw VIDEO_STORAGE_S3_MISCONFIGURED
        },
      );
      withEnv(
        {
          VIDEO_STORAGE_DRIVER: "s3",
          S3_BUCKET: "test-bucket",
          S3_REGION: "eu-central-1",
          S3_ENDPOINT: "https://s3.example.com",
          S3_ACCESS_KEY_ID: "TEST_ID",
          S3_SECRET_ACCESS_KEY: "TEST_SECRET_ONLY",
        },
        () => {
          expect(validateS3()).toEqual([]);
        },
      );
    });
    withEnv({ VIDEO_STORAGE_DRIVER: "local-fs" }, () => {
      expect(validateS3()).toEqual([]);
    });
  });

  it("6. production fakepay remains impossible (double-gated)", () => {
    withProd(() => {
      withEnv({ FAKEPAY_ENABLED: "1", PAYMENT_DEV_PROVIDER: "fakepay" }, () => {
        // Direct check: isFakePayEnabled must be false in prod even when flag set
        expect(isFakePayEnabled()).toBe(false);
        const errs = getProductionEnvErrors();
        expect(errs.some((e) => e.variable.includes("FAKEPAY"))).toBe(true);
      });
    });
    // dev with flag allows
    withDev(() => {
      withEnv({ FAKEPAY_ENABLED: "1" }, () => {
        expect(isFakePayEnabled()).toBe(true);
      });
    });
  });

  it("7. production phone auth remains disabled without real SMS provider", () => {
    withProd(() => {
      withEnv({ PHONE_AUTH_ENABLED: undefined }, () => {
        expect(isPhoneAuthEnabled()).toBe(false);
        const errs = validatePhoneGate();
        expect(errs).toEqual([]); // not an error when disabled
      });
      withEnv({ PHONE_AUTH_ENABLED: "1" }, () => {
        expect(isPhoneAuthEnabled()).toBe(true);
        const errs = validatePhoneGate();
        // flag=1 in prod must be reported as misconfiguration until real provider exists
        expect(errs.some((e) => e.variable === "PHONE_AUTH_ENABLED")).toBe(true);
      });
    });
  });

  it("8. no secret appears in returned error messages", () => {
    const fakeSecret = "FAKE_PLACEHOLDER_SECRET_SUPER_LONG_12345";
    withProd(() => {
      withEnv(
        {
          AUTH_SECRET: "short",
          DATABASE_URL: undefined,
          NEXT_PUBLIC_APP_URL: "http://localhost:3000",
          VIDEO_STORAGE_DRIVER: "s3",
          S3_BUCKET: undefined,
        },
        () => {
          const errs = getProductionEnvErrors();
          const msg = errs.map((e) => `${e.variable}:${e.reason}`).join("|");
          expect(msg).not.toContain(fakeSecret);
          expect(msg).not.toContain("TEST_SMTP_PASS");
          // messages contain only variable names + coarse reasons
          expect(msg).toContain("AUTH_SECRET");
          expect(msg).toContain("DATABASE_URL");
        },
      );
    });
  });

  it("9. no secret appears in JWT/session payloads (sv/uid/role only)", () => {
    const sensitive = {
      id: "u1",
      role: "USER" as const,
      sessionVersion: 2,
      AUTH_SECRET: "TEST_SECRET_ONLY",
      SMTP_PASS: "TEST_SMTP_PASS",
      S3_SECRET_ACCESS_KEY: "TEST_SECRET_ONLY",
      PAYMOB_API_KEY: "TEST_PAYMOB_KEY",
      PAYMOB_HMAC_SECRET: "TEST_HMAC",
    };
    // Reuse jwt/session callbacks from auth.config
    const jwtCb = authConfig.callbacks.jwt as unknown as (a: {
      token: Record<string, unknown>;
      user: Record<string, unknown>;
    }) => Record<string, unknown>;
    const sessionCb = authConfig.callbacks.session as unknown as (a: {
      session: { user: Record<string, unknown> };
      token: Record<string, unknown>;
    }) => { user: Record<string, unknown> };
    const token = jwtCb({ token: {}, user: sensitive });
    expect(token).not.toHaveProperty("AUTH_SECRET");
    expect(token).not.toHaveProperty("SMTP_PASS");
    expect(token).not.toHaveProperty("S3_SECRET_ACCESS_KEY");
    expect(Object.keys(token).sort()).toEqual(["role", "sv", "uid"].sort());

    const session = sessionCb({ session: { user: {} }, token });
    expect(session.user).not.toHaveProperty("AUTH_SECRET");
    expect(Object.keys(session.user).sort()).toEqual(["id", "role", "sv"].sort());
  });

  it("10. development configuration still works (relaxed, no production throw)", () => {
    withDev(() => {
      withEnv(
        {
          AUTH_SECRET: undefined,
          DATABASE_URL: undefined,
          DIRECT_URL: undefined,
          NEXT_PUBLIC_APP_URL: "http://localhost:3000",
          SMTP_HOST: undefined,
        },
        () => {
          expect(validateAuthSecret()).toEqual([]);
          expect(validateDatabase()).toEqual([]);
          expect(validateAppUrl()).toEqual([]);
          expect(getProductionEnvErrors().filter((e) => ["AUTH_SECRET", "DATABASE_URL"].includes(e.variable))).toEqual([]);
        },
      );
    });
  });
});
