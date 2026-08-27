import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { resolveLessonAccess } from "@/lib/server/entitlements";
import { getVideoStorage, isValidStorageRef } from "@/lib/server/video/storage";

/**
 * Authorized resource download (Phase 8).
 *
 * Authorization mirrors video playback exactly: the OWNING LESSON's chain
 * (publish states + FREE/PRO entitlement) is re-evaluated on EVERY request.
 * Admin preview is allowed. Anonymous/unauthorized requests get a bare 404 —
 * resource enumeration is impossible, and no storage paths ever appear.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> },
): Promise<NextResponse> {
  const { resourceId } = await params;

  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const resource = await db.resourceFile.findUnique({
    where: { id: resourceId },
    select: {
      storageRef: true,
      mimeType: true,
      label: true,
      lesson: {
        select: {
          slug: true,
          accessLevel: true,
          publishState: true,
          module: {
            select: {
              publishState: true,
              course: { select: { publishState: true, slug: true } },
            },
          },
        },
      },
    },
  });
  if (!resource) return new NextResponse(null, { status: 404 });

  // Admin preview OR full student chain via the ONE resolver.
  const isAdmin = user.role === "ADMIN";
  const decision = await resolveLessonAccess(
    user.id,
    resource.lesson.module.course.slug,
    resource.lesson.slug,
    { adminPreview: isAdmin },
  );
  if (!decision.allowed) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isValidStorageRef(resource.storageRef)) {
    return new NextResponse(null, { status: 404 });
  }

  const storage = getVideoStorage();
  const info = await storage.stat(resource.storageRef);
  if (!info || info.sizeBytes === 0) {
    return new NextResponse(null, { status: 404 });
  }

  const stream = await storage.openRange(resource.storageRef, 0, info.sizeBytes - 1);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": resource.mimeType ?? "application/octet-stream",
      "Content-Length": String(info.sizeBytes),
      "Content-Disposition": `attachment; filename="resource-${resourceId}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
