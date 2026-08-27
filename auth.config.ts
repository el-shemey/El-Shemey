import type { NextAuthConfig } from "next-auth";

/**
 * EDGE-SAFE auth configuration.
 *
 * Contains NO Node-only imports (no Prisma, no argon2, no nodemailer).
 * The credentials `authorize()` callback — which needs those — is attached
 * in auth.ts (Node runtime). Middleware uses this config purely for JWT
 * session verification.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/en/login" },
  providers: [], // Credentials provider added in auth.ts (Node-only)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
        const sv = (user as { sessionVersion?: number }).sessionVersion;
        if (typeof sv === "number") token.sv = sv;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
        const sv = (token as { sv?: number }).sv;
        if (typeof sv === "number") {
          (session.user as { sv?: number }).sv = sv;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
