import { db } from "@/lib/server/db";

/**
 * Admin authorization primitive (Phase 5).
 * Deny-by-default: only ADMIN role passes. Used by every admin page and
 * server action — never by client code.
 */
import { assertAdminRole as assertRolePure } from "@/lib/domain/admin";

export function assertAdminRole(role: "USER" | "ADMIN" | undefined | null): void {
  assertRolePure(role);
  if (role !== "ADMIN") throw new Error("FORBIDDEN");
}

/** Append-only audit write. Never throws into the caller's flow. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata
          ? (JSON.parse(JSON.stringify(metadata)) as object)
          : undefined,
      },
    });
  } catch {
    // Operational logging covers audit-write failures; never block the
    // business mutation on audit infrastructure.
  }
}
