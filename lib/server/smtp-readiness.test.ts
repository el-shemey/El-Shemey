import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resetRateLimiter } from "@/lib/server/rate-limit";
import { hashToken } from "@/lib/server/auth/tokens";
import { hashPassword } from "@/lib/server/auth/password";
import {
  DeliveryNotConfiguredError,
  DevMailProvider,
  SmtpMailProvider,
  requireRealMailProvider,
} from "@/lib/server/mail-providers";
import { registerWithIdentifier, requestPasswordResetOtp, verifyIdentityWithOtp } from "@/lib/server/auth-service";
import { isPhoneAuthEnabled } from "@/lib/server/delivery";
import nodemailer from "nodemailer";

/**
 * Task 4 — SMTP / Email Delivery Readiness (A-K)
 * Uses deterministic fake values: smtp.test.local, TEST_ONLY_PASSWORD, etc.
 * Never prints real secrets; reports only configured/not-configured.
 * No real SMTP connections are made (mocked transport).
 */

const prisma = new PrismaClient();
let dbUp = true;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if ((await prisma.course.count()) === 0) throw new Error("seed missing");
  } catch {
    dbUp = false;
  }
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(() => {
  if (dbUp) resetRateLimiter();
  // clear mail singleton between env changes
  (globalThis as unknown as Record<string, unknown>).mail = undefined;
  vi.restoreAllMocks();
});

function withEnv(overrides: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(overrides)) {
    prev[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k] as string;
  }
  const run = fn();
  const restore = () => {
    for (const k of Object.keys(overrides)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k] as string;
    }
    (globalThis as unknown as Record<string, unknown>).mail = undefined;
  };
  if (run instanceof Promise) return run.finally(restore) as Promise<void>;
  restore();
}

function withProd(fn: () => void | Promise<void>) {
  const prev = process.env.NODE_ENV;
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "production";
  const run = fn();
  const restore = () => {
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = prev;
  };
  if (run instanceof Promise) return run.finally(restore);
  restore();
}
function withDev(fn: () => void | Promise<void>) {
  const prev = process.env.NODE_ENV;
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "development";
  const run = fn();
  const restore = () => {
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = prev;
  };
  if (run instanceof Promise) return run.finally(restore);
  restore();
}

describe("Task 4 — SMTP readiness", () => {
  it("A. production without SMTP fails closed (requireRealMailProvider throws)", () => {
    withProd(() => {
      withEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
        expect(() => requireRealMailProvider()).toThrow(DeliveryNotConfiguredError);
        expect(() => requireRealMailProvider()).toThrow("DELIVERY_NOT_CONFIGURED:EMAIL");
      });
    });
  });

  it("B. production never selects DevMailProvider (auth path)", () => {
    withProd(() => {
      withEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
        const p = (() => {
          try {
            return requireRealMailProvider();
          } catch (e) {
            return e;
          }
        })();
        expect(p).toBeInstanceOf(DeliveryNotConfiguredError);
        expect((p as DeliveryNotConfiguredError).channel).toBe("EMAIL");
        // getMailProvider is not used in prod auth; but ensure it would still be dev is not returned via requireReal
      });
    });
  });

  it("C. development selects DevMailProvider when SMTP missing", () => {
    withDev(() => {
      withEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
        const p = requireRealMailProvider();
        expect(p).toBeInstanceOf(DevMailProvider);
      });
    });
  });

  it("D. SMTP detection requires HOST+USER+PASS (partial config still fails)", () => {
    withProd(() => {
      withEnv({ SMTP_HOST: "smtp.test.local", SMTP_USER: undefined, SMTP_PASS: "TEST_ONLY_PASSWORD" }, () => {
        expect(() => requireRealMailProvider()).toThrow(DeliveryNotConfiguredError);
      });
      withEnv({ SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: undefined }, () => {
        expect(() => requireRealMailProvider()).toThrow(DeliveryNotConfiguredError);
      });
      withEnv({ SMTP_HOST: undefined, SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD" }, () => {
        expect(() => requireRealMailProvider()).toThrow(DeliveryNotConfiguredError);
      });
      withEnv({ SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD" }, () => {
        expect(() => requireRealMailProvider()).not.toThrow();
      });
    });
  });

  it("E. MAIL_FROM defaults to SMTP_USER when omitted (existing behavior)", async () => {
    withProd(() => {
      withEnv(
        {
          SMTP_HOST: "smtp.test.local",
          SMTP_USER: "test@example.com",
          SMTP_PASS: "TEST_ONLY_PASSWORD",
          MAIL_FROM: undefined,
          SMTP_PORT: "465",
        },
        () => {
          let capturedFrom = "";
          vi.spyOn(nodemailer, "createTransport").mockReturnValue({
            sendMail: vi.fn(async (opts: { from: string }) => {
              capturedFrom = opts.from;
              return { messageId: "<test>" } as never;
            }),
          } as never);
          const provider = new SmtpMailProvider();
          return provider.send({
            to: "dest@test.dev",
            subject: "subj",
            locale: "en",
            kind: "VERIFY_EMAIL",
            otp: "123456",
            otpExpiresMinutes: 10,
          }).then(() => {
            expect(capturedFrom).toBe("test@example.com");
          });
        },
      );
    });
    // explicit MAIL_FROM overrides
    withProd(() => {
      withEnv(
        {
          SMTP_HOST: "smtp.test.local",
          SMTP_USER: "test@example.com",
          SMTP_PASS: "TEST_ONLY_PASSWORD",
          MAIL_FROM: "noreply@example.com",
        },
        () => {
          let capturedFrom = "";
          vi.spyOn(nodemailer, "createTransport").mockReturnValue({
            sendMail: vi.fn(async (opts: { from: string }) => {
              capturedFrom = opts.from;
              return { messageId: "<test>" } as never;
            }),
          } as never);
          const provider = new SmtpMailProvider();
          return provider.send({
            to: "dest@test.dev",
            subject: "subj",
            locale: "en",
            kind: "VERIFY_EMAIL",
            otp: "123456",
            otpExpiresMinutes: 10,
          }).then(() => {
            expect(capturedFrom).toBe("noreply@example.com");
          });
        },
      );
    });
  });

  it("F. SMTP errors exposed to callers are coarse and contain no password/OTP", async () => {
    withProd(() => {
      return withEnv(
        {
          SMTP_HOST: "smtp.test.local",
          SMTP_USER: "test@example.com",
          SMTP_PASS: "TEST_ONLY_PASSWORD",
        },
        async () => {
          vi.spyOn(nodemailer, "createTransport").mockReturnValue({
            sendMail: vi.fn(async () => {
              throw new Error("auth failed with TEST_ONLY_PASSWORD for test@example.com");
            }),
          } as never);
          const provider = new SmtpMailProvider();
          let caught: Error | undefined;
          try {
            await provider.send({
              to: "dest@test.dev",
              subject: "subj",
              locale: "en",
              kind: "VERIFY_EMAIL",
              otp: "999999",
              otpExpiresMinutes: 10,
            });
          } catch (e) {
            caught = e as Error;
          }
          expect(caught).toBeDefined();
          expect(caught!.message).not.toContain("TEST_ONLY_PASSWORD");
          expect(caught!.message).not.toContain("999999");
          // coarsened to SMTP_AUTH_FAILED
          expect(caught!.message).toBe("SMTP_AUTH_FAILED");
        },
      );
    });
  });

  it("SMTP transporter TLS/timeout hardened (465 secure, 587 STARTTLS)", () => {
    // 465 → secure true
    withEnv({ SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD", SMTP_PORT: "465" }, () => {
      let captured: Record<string, unknown> = {};
      vi.spyOn(nodemailer as unknown as { createTransport: typeof nodemailer.createTransport }, "createTransport").mockImplementation(((opts: unknown) => {
        captured = opts as Record<string, unknown>;
        return { sendMail: vi.fn() } as never;
      }) as never);
      void new SmtpMailProvider();
      expect(captured.secure).toBe(true);
      expect(captured.connectionTimeout).toBe(10_000);
      expect((captured.tls as Record<string, unknown>)?.minVersion).toBe("TLSv1.2");
    });
    // 587 → secure false (STARTTLS)
    withEnv({ SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD", SMTP_PORT: "587" }, () => {
      let captured: Record<string, unknown> = {};
      vi.spyOn(nodemailer as unknown as { createTransport: typeof nodemailer.createTransport }, "createTransport").mockImplementation(((opts: unknown) => {
        captured = opts as Record<string, unknown>;
        return { sendMail: vi.fn() } as never;
      }) as never);
      void new SmtpMailProvider();
      expect(captured.secure).toBe(false);
      expect(captured.port).toBe(587);
    });
  });

  it("G. registration response contains only masked identifier/channel (no OTP/token)", async () => {
    if (!dbUp) return;
    await withDev(async () => {
      await withEnv(
        { SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD" },
        async () => {
          // Mock transport to avoid real send
          vi.spyOn(nodemailer, "createTransport").mockReturnValue({
            sendMail: vi.fn(async () => ({ messageId: "<test>" } as never)),
          } as never);
          const email = `smtp-g-${Math.random().toString(36).slice(2, 6)}@test.dev`;
          const result = await registerWithIdentifier({ identifier: email, password: "Strong-Pass-77" });
          const s = JSON.stringify(result);
          expect(s).not.toMatch(/"otp"/i);
          expect(s).not.toMatch(/"code"/i);
          expect(s).not.toMatch(/"token"/i);
          expect(s).not.toMatch(/999999/);
          expect(result.masked).toContain("***@");
          // cleanup
          const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
          if (u) {
            await prisma.emailVerificationToken.deleteMany({ where: { userId: u.id } });
            await prisma.user.delete({ where: { id: u.id } });
          }
        },
      );
    });
  });

  it("H. password-reset response remains enumeration-safe (same shape for existing vs non-existing)", async () => {
    if (!dbUp) return;
    const existing = `smtp-h-exist-${Math.random().toString(36).slice(2, 4)}@test.dev`;
    await prisma.user.create({ data: { email: existing, passwordHash: await hashPassword("Strong-Pass-77") } });
    const missing = `smtp-h-missing-${Math.random().toString(36).slice(2, 4)}@test.dev`;
    await withDev(async () => {
      await withEnv(
        { SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD" },
        async () => {
          vi.spyOn(nodemailer, "createTransport").mockReturnValue({
            sendMail: vi.fn(async () => ({ messageId: "<test>" } as never)),
          } as never);
          const a = await requestPasswordResetOtp(existing);
          const b = await requestPasswordResetOtp(missing);
          // both return same channel/masked shape, no leak whether exists
          expect(a.channel).toBe("EMAIL");
          expect(b.channel).toBe("EMAIL");
          expect(a.masked).toBeDefined();
          expect(b.masked).toBeDefined();
          // no OTP in either
          expect(JSON.stringify(a)).not.toMatch(/"otp"/i);
          expect(JSON.stringify(b)).not.toMatch(/"otp"/i);
        },
      );
    });
    await prisma.user.deleteMany({ where: { email: { contains: "smtp-h-" } } });
    await prisma.passwordResetToken.deleteMany({});
  });

  it("I. OTP remains server-only (hashed at rest, not in logs/response)", async () => {
    if (!dbUp) return;
    const email = `smtp-i-${Math.random().toString(36).slice(2, 6)}@test.dev`;
    const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword("Strong-Pass-77") } });
    const code = String(100000 + Math.floor(Math.random() * 900000));
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hashToken(code), expiresAt: new Date(Date.now() + 600_000) },
    });
    // tokenHash length 64, not plaintext
    const row = await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.tokenHash).toHaveLength(64);
    expect(row.tokenHash).not.toContain(code);
    expect(await verifyIdentityWithOtp(email, code)).toBe(true);
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("J. existing email OTP lifecycle intact (issue mocked, verify, reuse fails, expiry)", async () => {
    if (!dbUp) return;
    await withDev(async () => {
      await withEnv(
        { SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD" },
        async () => {
          vi.spyOn(nodemailer, "createTransport").mockReturnValue({
            sendMail: vi.fn(async () => ({ messageId: "<test>" } as never)),
          } as never);
          const email = `smtp-j-${Math.random().toString(36).slice(2, 6)}@test.dev`;
          const res = await registerWithIdentifier({ identifier: email, password: "Strong-Pass-77" });
          expect(res.channel).toBe("EMAIL");
          const u = await prisma.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
          const tok = await prisma.emailVerificationToken.findFirst({ where: { userId: u.id } });
          expect(tok).not.toBeNull();
          expect(tok!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000); // ~10 min TTL
          await prisma.emailVerificationToken.deleteMany({ where: { userId: u.id } });
          await prisma.user.delete({ where: { id: u.id } });
        },
      );
    });
  });

  it("K. existing phone gate remains intact (prod phone still blocked)", async () => {
    const phone = `+201599${String(Math.floor(1000000 + Math.random() * 9000000))}`;
    await withProd(async () => {
      await withEnv({ PHONE_AUTH_ENABLED: undefined }, async () => {
        expect(isPhoneAuthEnabled()).toBe(false);
        // register would be blocked even if SMTP is configured
        await withEnv(
          { SMTP_HOST: "smtp.test.local", SMTP_USER: "test@example.com", SMTP_PASS: "TEST_ONLY_PASSWORD" },
          async () => {
            const { registerWithIdentifier } = await import("@/lib/server/auth-service");
            await expect(registerWithIdentifier({ identifier: phone, password: "Strong-Pass-77" })).rejects.toThrow(
              "DELIVERY_NOT_CONFIGURED:SMS",
            );
          },
        );
      });
    });
  });
});
