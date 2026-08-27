import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/server/db";

/**
 * Server-side session/authorization helpers (Phase 4).
 *
 * Layered authorization model:
 *  - middleware.ts: coarse gate (session cookie/token presence) for /learn.
 *  - requireUser(): fresh DB check incl. sessionVersion → revocation works.
 *  - requireRole(): role boundary (ADMIN) — deny by default.
 *
 * The client is never trusted: roles and identity are read from the
 * database via the verified session, never from request payloads.
 */

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
}

/**
 * Fresh, cached-per-request user resolution.
 * Returns null when unauthenticated OR when the session was revoked
 * (sessionVersion mismatch after password change/reset).
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid || typeof uid !== "string") return null;

  const user = await db.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      role: true,
      sessionVersion: true,
    },
  });
  if (!user) return null;

  // Revocation check: token version must match the live value.
  const tokenVersion = (session.user as { sv?: number } | undefined)?.sv;
  if (typeof tokenVersion === "number" && tokenVersion !== user.sessionVersion) {
    return null; // revoked — treat as signed out
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
  };
});

/** Deny-by-default role gate for admin/server-action surfaces. */
export async function requireRole(
  ...roles: Array<"USER" | "ADMIN">
): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
