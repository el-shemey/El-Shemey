import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/session";
import { saveLessonPosition } from "@/lib/server/learning-repo";

/**
 * Playback position persistence (resume support).
 * userId always derives from the verified session; payloads carry slugs and
 * an integer second offset only. Failures are silent by design.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { courseSlug, lessonSlug, positionSeconds } = body as Record<string, unknown>;
  if (
    typeof courseSlug !== "string" ||
    typeof lessonSlug !== "string" ||
    typeof positionSeconds !== "number" ||
    !Number.isFinite(positionSeconds)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await saveLessonPosition(user.id, courseSlug, lessonSlug, positionSeconds);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
