import { NextResponse } from "next/server";

/**
 * Liveness probe (Phase 9).
 * Confirms the process is alive. Deliberately does NOT touch the database —
 * an overloaded DB must not make the orchestrator kill the app.
 * Response contains no configuration, secrets or paths.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { status: "live", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
