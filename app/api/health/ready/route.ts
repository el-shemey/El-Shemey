import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

/**
 * Readiness probe (Phase 9).
 *
 * Verifies required dependencies with a hard timeout and reports ONLY
 * status enums — never connection strings, credentials or paths.
 * A failed dependency returns 503 so orchestrators can route away.
 */

// Separate short-lived client: the readiness check must not be affected by
// (or affect) the request-scoped singleton's pool state.
const probe = new PrismaClient({ log: [] });

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), ms),
      ),
    ]);
    void result;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 40) : "UNKNOWN",
    };
  }
}

let lastProbe = { at: 0, ok: false };
const PROBE_TTL_MS = 15_000;

export async function GET(): Promise<NextResponse> {
  // Cheap TTL cache so orchestrator polling stays inexpensive.
  if (Date.now() - lastProbe.at < PROBE_TTL_MS) {
    return NextResponse.json(
      {
        status: lastProbe.ok ? "ready" : "degraded",
        checks: { database: lastProbe.ok ? "ready" : "unavailable" },
      },
      { status: lastProbe.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dbCheck = await withTimeout(probe.$queryRaw`SELECT 1`, 3000);
  lastProbe = { at: Date.now(), ok: dbCheck.ok };

  const ready = dbCheck.ok;
  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      checks: {
        database: dbCheck.ok
          ? "ready"
          : `unavailable${dbCheck.error ? ` (${dbCheck.error})` : ""}`,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
