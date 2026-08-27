import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authenticateUser } from "@/lib/server/auth-service";

/**
 * Node-runtime auth instance (handlers + server `auth()` helper).
 * The edge middleware uses only the edge-safe config from auth.config.ts.
 */

/** Typed sign-in failure so the UI can offer verification resend safely.
 *  Only surfaces for a CORRECT password (implies account ownership). */
class EmailNotVerifiedError extends CredentialsSignin {
  code = "EMAIL_NOT_VERIFIED";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        const identifier =
          typeof credentials?.identifier === "string" ? credentials.identifier : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!identifier || !password) return null;
        // Per-IP brute-force bucket: first hop from the trusted proxy chain.
        const fwd = request?.headers?.get("x-forwarded-for") ?? "";
        const ip = fwd.split(",")[0]?.trim() || undefined;
        try {
          const user = await authenticateUser(identifier, password, ip);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            sessionVersion: user.sessionVersion,
          };
        } catch (error) {
          if (error instanceof Error && error.message === "IDENTITY_NOT_VERIFIED") {
            throw new EmailNotVerifiedError();
          }
          // Generic invalid credentials — never reveals account existence.
          return null;
        }
      },
    }),
  ],
});
