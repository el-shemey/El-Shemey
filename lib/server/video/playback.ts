import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server/db";
import { getEntitlementProvider } from "@/lib/server/entitlement-provider";

/**
 * Authoritative video authorization + playback-source generation.
 * SELF-HOSTED storage — no third-party video provider.
 *
 * A video is NEVER accessible merely because its URL is known:
 *   authenticate (verified userId) → resolve lesson → resolve course →
 *   publish-state checks → entitlement check → short-lived signed
 *   playback source. The stream route re-runs the full chain on every
 *   request (signed URLs are convenience/hotlink protection, NOT the
 *   authorization mechanism).
 *
 * This is the ONE access decision for video. Pages, players and APIs all
 * go through here — rules are never duplicated.
 */

/** Default signed-URL lifetime: 10 minutes; hard cap 1 hour. */
const DEFAULT_TTL_SECONDS = 600;
const MAX_TTL_SECONDS = 3600;

function signingKey(): string {
  // Dedicated key when provided; otherwise derived from the Phase 4 auth
  // secret (always configured). Never exposed to the client bundle.
  return process.env.VIDEO_STREAM_SIGNING_KEY ?? process.env.AUTH_SECRET ?? "";
}

export function signStreamToken(videoId: string, expiresEpochSeconds: number): string {
  return createHmac("sha256", signingKey())
    .update(`${videoId}.${expiresEpochSeconds}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function verifyStreamToken(
  videoId: string,
  token: string | null,
  expires: string | null,
): boolean {
  if (!token || !expires) return false;
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = signStreamToken(videoId, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildStreamUrl(videoId: string): {
  url: string;
  expiresAt: Date;
} {
  const ttl = Math.min(DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS);
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const token = signStreamToken(videoId, expires);
  return {
    url: `/api/videos/${videoId}/stream?token=${token}&expires=${expires}`,
    expiresAt: new Date(expires * 1000),
  };
}

export type PlaybackAuthorization =
  | {
      allowed: true;
      /** Short-lived authorized stream URL (self-hosted route). */
      playbackUrl: string;
      expiresAt: Date;
      note: "SIGNED_URL";
    }
  | {
      allowed: false;
      reason: "LESSON_NOT_FOUND" | "ACCESS_DENIED" | "NO_VIDEO" | "VIDEO_NOT_READY";
    };

/**
 * The single video access decision. `userId` must come from the verified
 * session — there is no anonymous path into this function by design.
 */
export async function authorizePlayback(
  userId: string,
  lessonSlug: string,
): Promise<PlaybackAuthorization> {
  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug },
    include: {
      videos: { where: { archivedAt: null } },
      module: {
        select: {
          publishState: true,
          course: { select: { publishState: true } },
        },
      },
    },
  });
  if (
    !lesson ||
    lesson.publishState !== "PUBLISHED" ||
    lesson.module.publishState !== "PUBLISHED" ||
    lesson.module.course.publishState !== "PUBLISHED"
  ) {
    return { allowed: false, reason: "LESSON_NOT_FOUND" };
  }

  // Single authoritative entitlement decision — FREE passes, PRO requires it.
  const hasPro = await getEntitlementProvider().hasProAccess(userId);
  if (lesson.accessLevel === "PRO" && !hasPro) {
    return { allowed: false, reason: "ACCESS_DENIED" };
  }

  const video = lesson.videos.find((v) => v.status === "READY");
  if (!video) {
    return {
      allowed: false,
      reason: lesson.videos.length > 0 ? "VIDEO_NOT_READY" : "NO_VIDEO",
    };
  }

  const source = buildStreamUrl(video.id);
  return {
    allowed: true,
    playbackUrl: source.url,
    expiresAt: source.expiresAt,
    note: "SIGNED_URL",
  };
}
