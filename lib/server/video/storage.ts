import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline, Readable, Transform } from "node:stream";
// Circular-by-design but safe: storage-s3 uses these bindings only inside
// methods (never during module evaluation).
import { createS3VideoStorage } from "@/lib/server/video/storage-s3";

/**
 * VideoStorageProvider — pluggable video binary storage (self-hosted phase).
 *
 * CONTRACT:
 *  - Storage refs are OPAQUE server-generated keys ("{id}/original.mp4").
 *    Client input NEVER becomes part of a ref (path-traversal safe by
 *    construction: refs are validated against a strict charset and resolved
 *    inside the provider root with a containment check).
 *  - No private filesystem paths ever cross the API boundary.
 *  - The local-FS driver below is the DEVELOPMENT implementation. Production
 *    storage (S3-compatible object storage) replaces this driver without any
 *    changes to the lesson system, admin flows or playback routes.
 */

export interface StoredObjectInfo {
  sizeBytes: number;
}

export interface VideoStorageProvider {
  readonly id: string;
  /** Streams bytes to storage; returns the canonical ref + byte count. */
  save(
    ref: string,
    body: ReadableStream<Uint8Array>,
    maxBytes?: number,
  ): Promise<StoredObjectInfo>;
  /** Opens a byte range for streaming responses. */
  openRange(
    ref: string,
    start: number,
    endInclusive: number,
  ): Promise<NodeJS.ReadableStream>;
  stat(ref: string): Promise<StoredObjectInfo | null>;
  delete(ref: string): Promise<void>;
}

/** Strict ref validation: segments of [A-Za-z0-9_-], no "..", known extension.
 *  Covers video renditions AND lesson resources (documents/archives/images). */
const ALLOWED_REF_EXTENSIONS =
  /\.(mp4|webm|m3u8|ts|jpg|jpeg|png|webp|gif|pdf|zip|txt|csv|md|docx|xlsx|pptx)$/;

export function isValidStorageRef(ref: string): boolean {
  if (ref.length === 0 || ref.length > 256) return false;
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*$/.test(ref)) return false;
  if (!ALLOWED_REF_EXTENSIONS.test(ref)) return false;
  const segments = ref.split("/");
  if (segments.some((s) => s === "." || s === ".." || s.length === 0)) {
    return false;
  }
  return true;
}

/* ------------------------- Local filesystem driver ------------------------ */

export class LocalVideoStorage implements VideoStorageProvider {
  readonly id = "local-fs";
  constructor(private readonly root: string) {}

  /** Resolves a validated ref inside the root with containment check. */
  private resolve(ref: string): string {
    if (!isValidStorageRef(ref)) throw new Error("INVALID_STORAGE_REF");
    const full = path.resolve(this.root, ref);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error("PATH_TRAVERSAL_REJECTED");
    }
    return full;
  }

  async save(
    ref: string,
    body: ReadableStream<Uint8Array>,
    maxBytes?: number,
  ): Promise<StoredObjectInfo> {
    const target = this.resolve(ref);
    await mkdir(path.dirname(target), { recursive: true });

    let written = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        written += chunk.length;
        if (maxBytes !== undefined && written > maxBytes) {
          cb(new Error("PAYLOAD_TOO_LARGE"));
          return;
        }
        cb(null, chunk);
      },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        pipeline(
          Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream),
          counter,
          createWriteStream(target),
          (error?: Error | null) => (error ? reject(error) : resolve()),
        );
      });
    } catch (error) {
      // Never leave partial uploads on disk — they must never be playable.
      await rm(target, { force: true }).catch(() => {});
      throw error;
    }
    return { sizeBytes: written };
  }

  async openRange(ref: string, start: number, endInclusive: number) {
    const target = this.resolve(ref);
    if (start < 0 || endInclusive < start) throw new Error("INVALID_RANGE");
    return createReadStream(target, { start, end: endInclusive });
  }

  async stat(ref: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await stat(this.resolve(ref));
      return info.isFile() ? { sizeBytes: info.size } : null;
    } catch {
      return null;
    }
  }

  async delete(ref: string): Promise<void> {
    await rm(this.resolve(ref), { force: true, recursive: true });
  }
}

/* ------------------------------- Factory ---------------------------------- */

let instance: VideoStorageProvider | null = null;

/**
 * Storage selection (Phase 10):
 *   LOCAL (default)  → local-fs driver under VIDEO_STORAGE_ROOT
 *   PRODUCTION       → VIDEO_STORAGE_DRIVER=s3 (+ S3_* server-only env)
 *
 * There is no silent fallback: an s3 request without complete config throws
 * — misconfiguration must be loud, never silently swapped for local disk.
 */
export function getVideoStorage(): VideoStorageProvider {
  if (!instance) {
    const driver = process.env.VIDEO_STORAGE_DRIVER ?? "local-fs";
    if (driver === "s3") {
      const s3 = createS3VideoStorage();
      if (!s3) {
        throw new Error(
          "VIDEO_STORAGE_S3_MISCONFIGURED:set S3_BUCKET/S3_REGION/S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY",
        );
      }
      instance = s3;
      return instance;
    }
    if (driver !== "local-fs") {
      // Honest failure: unknown drivers are added in their own verified change.
      throw new Error(`VIDEO_STORAGE_DRIVER_UNSUPPORTED:${driver}`);
    }
    const root = process.env.VIDEO_STORAGE_ROOT
      ? path.resolve(process.env.VIDEO_STORAGE_ROOT)
      : path.resolve(process.cwd(), "storage", "videos");
    instance = new LocalVideoStorage(root);
  }
  return instance;
}

/** Test/driver seam. */
export function _setVideoStorageForTests(provider: VideoStorageProvider | null) {
  instance = provider;
}
