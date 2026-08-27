import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { getEntitlementProvider } from "@/lib/server/entitlement-provider";
import { verifyStreamToken } from "@/lib/server/video/playback";
import { getVideoStorage, isValidStorageRef } from "@/lib/server/video/storage";

/**
 * Protected video streaming route (self-hosted storage).
 *
 * AUTHORIZATION (re-run on EVERY request — signed URLs are hotlink
 * protection only, never the access mechanism):
 *   verified session → video → lesson → module → course → publish states →
 *   entitlement (PRO) or ADMIN preview.
 *
 * SECURITY:
 *  - Storage refs and filesystem paths NEVER appear in responses.
 *  - Range requests supported for seeking; bytes streamed, not buffered.
 *  - Responses are private + no-store: no shared-cache leakage.
 *  - Unknown/forbidden videos return 404 — identical shape, nothing leaks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
): Promise<NextResponse> {
  const { videoId } = await params;

  // Signed-URL gate (defense in depth; full chain runs below regardless).
  if (
    !verifyStreamToken(
      videoId,
      request.nextUrl.searchParams.get("token"),
      request.nextUrl.searchParams.get("expires"),
    )
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const video = await db.videoAsset.findUnique({
    where: { id: videoId },
    include: {
      lesson: {
        include: {
          module: {
            select: {
              publishState: true,
              course: { select: { publishState: true, accessLevel: true } },
            },
          },
        },
      },
    },
  });

  const authorized =
    user.role === "ADMIN" || // owner preview of unpublished/protected media
    (video &&
      video.status === "READY" &&
      video.archivedAt === null &&
      video.lesson !== null &&
      video.lesson.publishState === "PUBLISHED" &&
      video.lesson.module.publishState === "PUBLISHED" &&
      video.lesson.module.course.publishState === "PUBLISHED" &&
      (video.lesson.accessLevel === "FREE"
        ? true
        : await getEntitlementProvider().hasProAccess(user.id)));

  if (!video || !authorized || !isValidStorageRef(video.storageRef)) {
    return new NextResponse(null, { status: 404 });
  }

  const storage = getVideoStorage();
  const info = await storage.stat(video.storageRef);
  if (!info || info.sizeBytes === 0) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = video.mimeType ?? "application/octet-stream";
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    let start: number;
    let end: number;
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.sizeBytes}` },
      });
    }
    if (match[1] === "") {
      // suffix range: last N bytes
      const suffix = Math.min(Number(match[2]), info.sizeBytes);
      start = info.sizeBytes - suffix;
      end = info.sizeBytes - 1;
    } else {
      start = Number(match[1]);
      end =
        match[2] === ""
          ? info.sizeBytes - 1
          : Math.min(Number(match[2]), info.sizeBytes - 1);
    }
    if (start > end || start >= info.sizeBytes) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.sizeBytes}` },
      });
    }
    const stream = await storage.openRange(video.storageRef, start, end);
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${info.sizeBytes}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = await storage.openRange(video.storageRef, 0, info.sizeBytes - 1);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(info.sizeBytes) },
  });
}

/** Video.js may probe with HEAD — same authorization, headers only. */
export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> },
): Promise<NextResponse> {
  const response = await GET(request, ctx);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
