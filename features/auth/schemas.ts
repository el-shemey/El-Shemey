import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "@/lib/server/auth/policy";

/**
 * Auth input validation — identifier-based (email OR E.164 phone).
 * Every auth mutation validates through these schemas server-side.
 */

/** Canonical form is decided by normalizeIdentifier at the service layer;
 *  here we only enforce basic shape so obviously-bad input fails fast. */
export const identifierSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .refine(
    (v) => v.includes("@") || /^\+?\d[\d\s\-().]{6,20}$/.test(v),
    "identifier must be an email or phone number",
  );

const passwordSchema = z
  .string()
  .min(10)
  .max(PASSWORD_MAX_LENGTH)
  .regex(/[A-Za-z]/, "password needs a letter")
  .regex(/[0-9]/, "password needs a number");

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  identifier: identifierSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const resetRequestSchema = z.object({ identifier: identifierSchema });

export const otpCodeSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(6));

export const verifyIdentitySchema = z.object({
  identifier: identifierSchema,
  code: otpCodeSchema,
});

export const resetConfirmSchema = z.object({
  identifier: identifierSchema,
  code: otpCodeSchema,
  password: passwordSchema,
});

/** Normalize helper shared by all callers (emails lowercase / phones E.164). */
export function normalizeIdentifierInput(identifier: string): string {
  return identifier.trim();
}
