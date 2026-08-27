"use server";

import { CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { getUser } from "@/lib/server/auth/session";
import {
  authenticateUser,
  confirmPasswordResetWithOtp,
  registerWithIdentifier,
  requestLoginVerification,
  requestPasswordResetOtp,
  resendVerificationOtp,
  verifyIdentityWithOtp,
} from "@/lib/server/auth-service";
import { DeliveryNotConfiguredError } from "@/lib/server/mail-providers";
import { SmsDeliveryNotConfiguredError } from "@/lib/server/delivery";
import { getRateLimiter } from "@/lib/server/rate-limit";
import {
  loginSchema,
  normalizeIdentifierInput,
  registerSchema,
  resetConfirmSchema,
} from "@/features/auth/schemas";

/**
 * Auth server actions — identifier-based OTP edition.
 *
 * Every action: validated → rate-limited → service call.
 * Responses are enumeration-safe. OTP values NEVER appear in any return
 * value, URL, or payload — only a masked identifier for display.
 */

export type ActionState = {
  ok?: boolean;
  identifier?: string;
  /** Safe display form, e.g. m***@gmail.com / +20 ******1234 */
  masked?: string;
  channel?: "EMAIL" | "SMS";
  code?:
    | "INVALID_INPUT"
    | "INVALID_CREDENTIALS"
    | "INVALID_CODE"
    | "IDENTITY_NOT_VERIFIED"
    | "DELIVERY_NOT_CONFIGURED"
    | "RATE_LIMITED"
    | "WEAK_OR_INVALID"
    | "UNKNOWN";
};

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? "local").trim();
}

async function limiterConsume(key: string, limit: number, windowSeconds: number) {
  const ip = await clientIp();
  return getRateLimiter().consume(`${key}:${ip}`, limit, windowSeconds);
}

/** Maps provider-configuration failures into a safe UI state. */
function deliveryError(channel: "EMAIL" | "SMS"): ActionState {
  return { code: "DELIVERY_NOT_CONFIGURED", channel };
}

/* ------------------------------- register -------------------------------- */

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name") || undefined,
    identifier: String(formData.get("identifier") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { code: "WEAK_OR_INVALID" };

  try {
    const result = await registerWithIdentifier(parsed.data);
    revalidatePath(`/${localeHint()}/verify`);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof DeliveryNotConfiguredError) {
      return deliveryError(error.channel);
    }
    if (error instanceof SmsDeliveryNotConfiguredError) {
      return deliveryError("SMS");
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { code: "RATE_LIMITED" };
    }
    return { code: "UNKNOWN" };
  }
}

function localeHint(): string {
  return "en";
}

/* --------------------------- OTP verify / resend -------------------------- */

export async function verifyIdentityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identifier = normalizeIdentifierInput(String(formData.get("identifier") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");

  try {
    const ok = await verifyIdentityWithOtp(identifier, code);
    if (!ok) return { code: "INVALID_CODE", identifier };
    return { ok: true, identifier };
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { code: "RATE_LIMITED", identifier };
    }
    return { code: "UNKNOWN" };
  }
}

export async function resendOtpAction(identifierRaw: string): Promise<ActionState> {
  const identifier = normalizeIdentifierInput(identifierRaw);
  try {
    const result = await resendVerificationOtp(identifier);
    return { ok: true, identifier: result.identifier, channel: result.channel };
  } catch (error) {
    if (error instanceof DeliveryNotConfiguredError) {
      return { code: "DELIVERY_NOT_CONFIGURED", channel: "EMAIL" };
    }
    if (error instanceof SmsDeliveryNotConfiguredError) {
      return { code: "DELIVERY_NOT_CONFIGURED", channel: "SMS" };
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { code: "RATE_LIMITED" };
    }
    return { code: "UNKNOWN" };
  }
}

/* ------------------------------ login/logout ----------------------------- */

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: normalizeIdentifierInput(String(formData.get("identifier") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { code: "INVALID_CREDENTIALS" };

  const rl = await limiterConsume("login-page", 10, 15 * 60);
  if (!rl.allowed) return { code: "RATE_LIMITED" };

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true, identifier: parsed.data.identifier };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const code = (error as { code?: string }).code;
      if (code === "IDENTITY_NOT_VERIFIED") {
        // Auto-issue the OTP; delivery misconfiguration surfaces safely.
        let masked: string | undefined;
        let channel: "EMAIL" | "SMS" = "EMAIL";
        try {
          const issued = await requestLoginVerification(parsed.data.identifier);
          masked = issued.masked;
          channel = issued.channel;
        } catch (deliveryError) {
          if (deliveryError instanceof DeliveryNotConfiguredError) {
            channel = "EMAIL";
          } else if (deliveryError instanceof SmsDeliveryNotConfiguredError) {
            channel = "SMS";
          }
          return { code: "DELIVERY_NOT_CONFIGURED", channel };
        }
        return {
          code: "IDENTITY_NOT_VERIFIED",
          identifier: parsed.data.identifier,
          masked,
          channel,
        };
      }
      return { code: "INVALID_CREDENTIALS" };
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { code: "RATE_LIMITED" };
    }
    return { code: "INVALID_CREDENTIALS" };
  }
}

export async function logoutAction(locale: string): Promise<void> {
  await signOut({ redirect: false });
  redirect(`/${locale}/login`);
}

/* ---------------------------- password reset ----------------------------- */

export async function requestResetCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identifier = normalizeIdentifierInput(String(formData.get("identifier") ?? ""));

  try {
    const result = await requestPasswordResetOtp(identifier);
    return {
      ok: true,
      identifier: result.identifier || identifier,
      channel: result.channel,
    };
  } catch (error) {
    if (error instanceof DeliveryNotConfiguredError) {
      return { code: "DELIVERY_NOT_CONFIGURED", channel: "EMAIL" };
    }
    if (error instanceof SmsDeliveryNotConfiguredError) {
      return { code: "DELIVERY_NOT_CONFIGURED", channel: "SMS" };
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { code: "RATE_LIMITED" };
    }
    // Enumeration-safe constant response even on unexpected errors.
    return { ok: true, identifier };
  }
}

export async function confirmPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetConfirmSchema.safeParse({
    identifier: normalizeIdentifierInput(String(formData.get("identifier") ?? "")),
    code: String(formData.get("code") ?? "").replace(/\D/g, ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { code: "WEAK_OR_INVALID" };

  const rl = await limiterConsume("reset-confirm", 10, 60 * 60);
  if (!rl.allowed) return { code: "RATE_LIMITED" };

  try {
    const done = await confirmPasswordResetWithOtp(
      parsed.data.identifier,
      parsed.data.code,
      parsed.data.password,
    );
    if (!done) return { code: "INVALID_CODE", identifier: parsed.data.identifier };
    revalidatePath("/", "layout");
    return { ok: true, identifier: parsed.data.identifier };
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { code: "RATE_LIMITED" };
    }
    return { code: "UNKNOWN" };
  }
}

/* --------------------------- Enrollment (P5) ----------------------------- */

import { startEnrollment } from "@/lib/server/learning-repo";

export async function startLearningAction(
  locale: string,
  courseSlug: string,
): Promise<void> {
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  await startEnrollment({ userId: user.id, courseSlug });
  redirect(`/${locale}/courses/${courseSlug}`);
}
