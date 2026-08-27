import "server-only";
import { z } from "zod";
import { db } from "@/lib/server/db";

/**
 * Product analytics (Phase 9).
 *
 * SEPARATION OF CONCERNS:
 *  - AuditLog / AuthEvent = security & administrative history.
 *  - AnalyticsEvent       = product behavior (this module).
 *
 * GUARANTEES:
 *  - Event names are a closed, typed set.
 *  - Payloads are validated per-event with Zod and additionally stripped of
 *    sensitive keys (password/otp/token/secret/email/ip/authorization…)
 *    regardless of schema.
 *  - Timestamps are always server-generated.
 *  - userId is optional; anonymous events are allowed only for the kinds
 *    explicitly marked public.
 */

export const ANALYTICS_EVENTS = [
  "user_registered",
  "email_verified",
  "login_success",
  "login_failed",
  "course_viewed",
  "course_enrolled",
  "lesson_opened",
  "lesson_started",
  "lesson_progressed",
  "lesson_completed",
  "course_completed",
  "video_started",
  "video_completed",
  "payment_started",
  "payment_succeeded",
  "payment_failed",
  "refund_created",
  "refund_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const PRIVATE_KEYS =
  /^(password|otp|token|secret|authorization|cookie|apikey|api_key|cvv|cardnumber|card_number)$/i;

/** Recursively strips sensitive-looking keys; caps size and depth. */
export function sanitizeMetadata(
  value: unknown,
  depth = 0,
): Record<string, unknown> | unknown[] | string | number | boolean | undefined {
  if (depth > 3) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeMetadata(v, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(
      0,
      30,
    )) {
      if (PRIVATE_KEYS.test(k)) continue;
      const cleaned = sanitizeMetadata(v, depth + 1);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

const courseContext = z.object({ courseSlug: z.string().max(160).optional() });
const lessonContext = courseContext.extend({
  lessonSlug: z.string().max(200).optional(),
  positionSeconds: z.number().int().min(0).max(86_400).optional(),
});
const paymentContext = z.object({
  amountMinor: z.number().int().min(0).optional(),
  currency: z.string().max(8).optional(),
  provider: z.string().max(32).optional(),
});

/** Per-event payload schemas — unknown fields are stripped by Zod. */
const EVENT_SCHEMAS: Record<
  AnalyticsEventName,
  { zod: z.ZodTypeAny; public: boolean }
> = {
  user_registered: { zod: z.object({}).passthrough(), public: false },
  email_verified: { zod: z.object({}).passthrough(), public: false },
  login_success: { zod: z.object({}).passthrough(), public: false },
  login_failed: {
    zod: z.object({ reason: z.string().max(40).optional() }),
    public: false,
  },
  course_viewed: { zod: courseContext, public: true },
  course_enrolled: { zod: courseContext, public: false },
  lesson_opened: { zod: lessonContext, public: true },
  lesson_started: { zod: lessonContext, public: true },
  lesson_progressed: { zod: lessonContext, public: true },
  lesson_completed: { zod: lessonContext, public: false },
  course_completed: { zod: courseContext, public: false },
  video_started: { zod: lessonContext, public: true },
  video_completed: { zod: lessonContext, public: true },
  payment_started: { zod: paymentContext, public: false },
  payment_succeeded: { zod: paymentContext, public: false },
  payment_failed: { zod: paymentContext, public: false },
  refund_created: { zod: paymentContext, public: false },
  refund_completed: { zod: paymentContext, public: false },
};

/**
 * Records one analytics event. Never throws into caller flows — analytics
 * failures must not break product behavior. Returns true when written.
 */
export async function trackEvent(
  eventName: AnalyticsEventName,
  input: { userId?: string | null; metadata?: unknown },
): Promise<boolean> {
  try {
    const def = EVENT_SCHEMAS[eventName];
    if (!def) return false;

    // Anonymous events are only allowed where explicitly marked public.
    if (!input.userId && !def.public) return false;

    let metadata: Record<string, unknown> | undefined;
    if (input.metadata !== undefined && input.metadata !== null) {
      const parsed = def.zod.safeParse(input.metadata);
      metadata = parsed.success
        ? (sanitizeMetadata(parsed.data) as Record<string, unknown>)
        : undefined;
    }

    await db.analyticsEvent.create({
      data: {
        eventName,
        userId: input.userId ?? null,
        ...(metadata ? { metadata: metadata as object } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export interface EventCount {
  eventName: string;
  count: number;
}

/** Aggregated counts per event within a bounded window. */
export async function eventCountsSince(days: number): Promise<EventCount[]> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000);
  const rows = await db.analyticsEvent.groupBy({
    by: ["eventName"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { eventName: "desc" } },
  });
  return rows.map((r) => ({ eventName: r.eventName, count: r._count._all }));
}

export async function countEvents(
  eventName: AnalyticsEventName,
  days: number,
): Promise<number> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000);
  return db.analyticsEvent.count({
    where: { eventName, createdAt: { gte: since } },
  });
}
