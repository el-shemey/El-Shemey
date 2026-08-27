import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { isValidStorageRef, getVideoStorage } from "@/lib/server/video/storage";
import { probeMp4File, sniffVideoMimeType } from "@/lib/server/video/probe";
import { audit } from "@/lib/server/admin-guard";
import { rm } from "node:fs/promises";
import path from "node:path";

/**
 * Admin video upload (self-hosted storage).
 *
 * SECURITY:
 *  - ADMIN-only, re-verified from the session on every request.
 *  - File type decided by MAGIC BYTES, never the client MIME type.
 *  - Size capped server-side while streaming (no full buffering).
 *  - Storage refs are server-generated; client filenames are discarded.
 *  - Partial/failed uploads leave no playable file and no DB row.
 */

const DEFAULT_MAX_MB = 250;

/** Local-driver seam for metadata probing (server-only, never exposed). */
async function localProbePath(ref: string): Promise<string | null> {
  if (!isValidStorageRef(ref)) return null;
  const root = process.env.VIDEO_STORAGE_ROOT
    ? path.resolve(process.env.VIDEO_STORAGE_ROOT)
    : path.resolve(process.cwd(), "storage", "videos");
  return path.resolve(root, ref);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }

  const maxBytes =
    Number(process.env.VIDEO_MAX_UPLOAD_MB ?? DEFAULT_MAX_MB) * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE", maxBytes }, { status: 413 });
  }

  // Magic-byte sniffing from the first chunk — MIME headers are untrusted.
  const webStream = file.stream();
  const reader = webStream.getReader();
  let headerChunk: Uint8Array;
  try {
    const first = await reader.read();
    if (first.done || !first.value || first.value.byteLength < 12) {
      return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
    }
    headerChunk = first.value;
  } catch {
    return NextResponse.json({ error: "UPLOAD_ABORTED" }, { status: 400 });
  }
  const mimeType = sniffVideoMimeType(headerChunk);
  if (!mimeType) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }
  const ext = mimeType === "video/mp4" ? "mp4" : "webm";

  const title =
    String(form.get("title") ?? "")
      .trim()
      .slice(0, 200) || `Upload ${new Date().toISOString().slice(0, 16)}`;
  const lessonId = String(form.get("lessonId") ?? "") || null;

  // Server-generated opaque ref. Client input never touches the path.
  const placeholderId = crypto.randomUUID();
  const ref = `${placeholderId}/original.${ext}`;

  const asset = await db.videoAsset.create({
    data: {
      storageRef: ref,
      title,
      mimeType,
      status: "UPLOADING",
      lessonId,
      createdById: user.id,
    },
  });

  const storage = getVideoStorage();

  // Re-attach the consumed header chunk ahead of the remaining stream.
  function replayHeader(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(headerChunk);
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        void reader.cancel();
      },
    });
  }

  try {
    const stored = await storage.save(ref, replayHeader(), maxBytes);
    await db.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: "PROCESSING",
        fileSizeBytes: BigInt(stored.sizeBytes),
        mimeType,
      },
    });

    // Metadata probing (MP4 container parsed server-side; no FFmpeg needed).
    if (mimeType === "video/mp4") {
      const fsPath = await localProbePath(ref);
      const probe = fsPath ? await probeMp4File(fsPath) : null;
      await db.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: "READY",
          durationSeconds: probe?.durationSeconds ?? null,
          width: probe?.width ?? null,
          height: probe?.height ?? null,
        },
      });
    } else {
      await db.videoAsset.update({
        where: { id: asset.id },
        data: { status: "READY" },
      });
    }

    await audit(user.id, "video.uploaded", "VideoAsset", asset.id, {
      sizeBytes: stored.sizeBytes,
      mimeType,
    });
    return NextResponse.json({ ok: true, id: asset.id });
  } catch (error) {
    // Never leave partial uploads behind: remove bytes + row.
    await storage.delete(ref).catch(() => {});
    await rm(path.dirname((await localProbePath(ref)) ?? ""), {
      force: true,
      recursive: true,
    }).catch(() => {});
    await db.videoAsset.delete({ where: { id: asset.id } }).catch(() => {});
    const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
    return NextResponse.json(
      { error: tooLarge ? "PAYLOAD_TOO_LARGE" : "UPLOAD_FAILED" },
      { status: tooLarge ? 413 : 500 },
    );
  }
}
