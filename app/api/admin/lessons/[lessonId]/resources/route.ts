import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { createResourceFile } from "@/lib/server/admin-content";
import { getVideoStorage, isValidStorageRef } from "@/lib/server/video/storage";

/**
 * Admin resource upload (Phase 8 Content Factory).
 * Documents/archives attached to a lesson. ADMIN-only, extension
 * whitelist, streaming size cap, server-generated storage keys.
 */

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "txt",
  "csv",
  "md",
  "docx",
  "xlsx",
  "pptx",
]);
const DEFAULT_MAX_MB = 50;

const RESOURCE_MIME: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<NextResponse> {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { lessonId } = await params;

  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

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
    Number(process.env.RESOURCE_MAX_UPLOAD_MB ?? DEFAULT_MAX_MB) * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  // Extension allowlist (server-side; client hints are never trusted).
  const rawName = file.name.toLowerCase();
  const ext = rawName.includes(".") ? rawName.split(".").pop()! : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }

  // No executable uploads, ever.
  if (["exe", "bat", "sh", "js", "php"].includes(ext)) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }

  // Magic-byte validation for binary types the route claims to accept.
  // Prevents trivial extension spoofing; plain text types are allowed as-is.
  const webStreamForMagic = file.stream();
  const readerForMagic = webStreamForMagic.getReader();
  let headerForMagic: Uint8Array | null = null;
  try {
    const first = await readerForMagic.read();
    if (first.value) headerForMagic = first.value;
    else headerForMagic = new Uint8Array(0);
  } catch {
    return NextResponse.json({ error: "UPLOAD_ABORTED" }, { status: 400 });
  }
  function magicValid(h: Uint8Array | null, e: string): boolean {
    if (!h || h.length < 4) return e === "txt" || e === "csv" || e === "md";
    // PDF: %PDF
    if (e === "pdf") return h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (e === "png")
      return (
        h.length >= 8 &&
        h[0] === 0x89 &&
        h[1] === 0x50 &&
        h[2] === 0x4e &&
        h[3] === 0x47 &&
        h[4] === 0x0d &&
        h[5] === 0x0a &&
        h[6] === 0x1a &&
        h[7] === 0x0a
      );
    // ZIP-based: PK (zip, docx, xlsx, pptx)
    if (["zip", "docx", "xlsx", "pptx"].includes(e)) return h[0] === 0x50 && h[1] === 0x4b;
    // JPG: FF D8 FF
    if (e === "jpg" || e === "jpeg")
      return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
    // WEBP: RIFF....WEBP
    if (e === "webp")
      return (
        h.length >= 12 &&
        h[0] === 0x52 &&
        h[1] === 0x49 &&
        h[2] === 0x46 &&
        h[3] === 0x46 &&
        String.fromCharCode(...h.slice(8, 12)) === "WEBP"
      );
    // GIF: GIF87a / GIF89a
    if (e === "gif")
      return (
        h.length >= 6 &&
        String.fromCharCode(...h.slice(0, 3)) === "GIF" &&
        h[3] === 0x38 &&
        (h[4] === 0x37 || h[4] === 0x39) &&
        h[5] === 0x61
      );
    return true; // txt/csv/md passthrough
  }
  if (!magicValid(headerForMagic, ext)) {
    void readerForMagic.cancel().catch(() => {});
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }
  // Reconstruct a stream that replays the consumed header chunk
  const originalStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (headerForMagic && headerForMagic.length) controller.enqueue(headerForMagic);
      try {
        for (;;) {
          const { done, value } = await readerForMagic.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      void readerForMagic.cancel();
    },
  });

  const label =
    String(form.get("label") ?? "")
      .trim()
      .slice(0, 200) || file.name.slice(0, 200);
  const placeholderId = crypto.randomUUID();
  const storageRef = `resources/${lessonId}/${placeholderId}.${ext}`;
  if (!isValidStorageRef(storageRef)) {
    return NextResponse.json({ error: "INVALID_REF" }, { status: 500 });
  }

  const storage = getVideoStorage();
  try {
    const stored = await storage.save(storageRef, originalStream, maxBytes);
    const result = await createResourceFile({
      actorId: user.id,
      lessonId,
      label,
      storageRef,
      mimeType: RESOURCE_MIME[ext] ?? "application/octet-stream",
      sizeBytes: stored.sizeBytes,
    });
    if (!result.ok) {
      await storage.delete(storageRef).catch(() => {});
      return NextResponse.json({ error: result.reason ?? "FAILED" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: result.resourceId });
  } catch (error) {
    await storage.delete(storageRef).catch(() => {});
    const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
    return NextResponse.json(
      { error: tooLarge ? "PAYLOAD_TOO_LARGE" : "UPLOAD_FAILED" },
      { status: tooLarge ? 413 : 500 },
    );
  }
}
