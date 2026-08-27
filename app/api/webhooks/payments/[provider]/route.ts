import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "@/lib/server/payments/provider";
import { applyVerifiedPaymentEvent } from "@/lib/server/payments/webhook-service";

/**
 * Provider webhook receiver (Phase 5).
 *
 * SECURITY:
 *  - Raw body is read verbatim and passed to the adapter for signature
 *    verification. Invalid signature → 401, no state change, no detail leak.
 *  - The verified server-side event is the ONLY authority. Client-side
 *    success redirects, query parameters and browser state are never trusted.
 *  - Idempotency: duplicate/replayed events are deduplicated by
 *    (provider, externalEventId) and acknowledged with 200 — safe to retry.
 *  - Unknown providers → 404; unconfigured providers → 503; unknown payment
 *    references are recorded + audited but never applied.
 *  - No secrets, signatures or raw payloads are logged here.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  const raw = await request.text();

  let adapter;
  try {
    adapter = getPaymentAdapter(provider);
  } catch {
    return NextResponse.json({ error: "UNKNOWN_PROVIDER" }, { status: 404 });
  }

  let verified;
  try {
    verified = await adapter.verifyAndParseWebhook(raw, request.headers, request.url);
  } catch {
    return NextResponse.json({ error: "PROVIDER_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!verified) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const result = await applyVerifiedPaymentEvent(provider, verified);

  switch (result) {
    case "deduplicated":
      return NextResponse.json({ received: true, deduplicated: true });
    case "unknown_payment":
      return NextResponse.json({ received: true, matched: false });
    case "illegal_transition":
      return NextResponse.json(
        { received: true, applied: false, reason: "ILLEGAL_TRANSITION" },
        { status: 409 },
      );
    default:
      return NextResponse.json({ received: true, applied: true });
  }
}
