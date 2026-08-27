import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalVideoStorage, isValidStorageRef } from "@/lib/server/video/storage";

/**
 * Unit — storage abstraction security.
 * Path traversal, ref validation, size caps, partial-upload cleanup.
 */

let dir: string;
let storage: LocalVideoStorage;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "elshemey-storage-"));
  storage = new LocalVideoStorage(dir);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

describe("storage ref validation", () => {
  it("accepts well-formed refs", () => {
    expect(isValidStorageRef("abc123/original.mp4")).toBe(true);
    expect(isValidStorageRef("vid-1_x/master.m3u8")).toBe(true);
  });

  it("rejects traversal, empty, and malformed refs", () => {
    expect(isValidStorageRef("../secret.txt")).toBe(false);
    expect(isValidStorageRef("a/../../etc/passwd")).toBe(false);
    expect(isValidStorageRef("a//b.mp4")).toBe(false);
    expect(isValidStorageRef(".mp4")).toBe(false);
    expect(isValidStorageRef("a\\b.mp4")).toBe(false);
    expect(isValidStorageRef("a/b.exe")).toBe(false);
    expect(isValidStorageRef("a/b.php")).toBe(false);
    expect(isValidStorageRef("")).toBe(false);
    // Absolute paths / null bytes
    expect(isValidStorageRef("/etc/passwd")).toBe(false);
    expect(isValidStorageRef("a/b\u0000.mp4")).toBe(false);
  });
});

describe("local driver roundtrip & containment", () => {
  const REF = "video-1/original.mp4";

  it("saves and stats bytes inside the root only", async () => {
    const bytes = new TextEncoder().encode("hello-video-bytes");
    const info = await storage.save(REF, streamOf([bytes]));
    expect(info.sizeBytes).toBe(bytes.byteLength);
    const stat = await storage.stat(REF);
    expect(stat?.sizeBytes).toBe(bytes.byteLength);
    // Written under root
    const raw = await readFile(path.join(dir, "video-1", "original.mp4"));
    expect(raw.byteLength).toBe(bytes.byteLength);
  });

  it("opens requested byte ranges for seeking", async () => {
    const chunks: Buffer[] = [];
    const rs = await storage.openRange(REF, 2, 5);
    await new Promise<void>((resolve) => {
      rs.on("data", (c: string | Buffer) => {
        if (typeof c !== "string") chunks.push(c);
      });
      rs.on("end", resolve);
    });
    expect(Buffer.concat(chunks).toString()).toBe("llo-v".slice(0, 4));
  });

  it("refuses invalid refs even at API level", async () => {
    // stat treats invalid refs as "not found" (no existence oracle);
    // mutating ops reject hard.
    expect(await storage.stat("../../escape.mp4")).toBeNull();
    await expect(storage.delete("a/../../../x.mp4")).rejects.toThrow();
    await expect(
      storage.save("../escape.mp4", streamOf([new Uint8Array([1])])),
    ).rejects.toThrow();
  });

  it("removes partial uploads on failure — never playable", async () => {
    const failing = streamOf([new Uint8Array([1, 2])]).pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(_chunk, controller) {
          controller.error(new Error("NETWORK_DROP"));
        },
      }),
    );
    await expect(storage.save("video-2/original.mp4", failing)).rejects.toThrow(
      "NETWORK_DROP",
    );
    expect(await storage.stat("video-2/original.mp4")).toBeNull();
  });

  it("enforces server-side size caps during streaming", async () => {
    const big = new Uint8Array(1024);
    await expect(
      storage.save("video-3/original.mp4", streamOf([big]), 512),
    ).rejects.toThrow("PAYLOAD_TOO_LARGE");
    expect(await storage.stat("video-3/original.mp4")).toBeNull();
  });

  it("delete removes stored bytes", async () => {
    await storage.save("video-4/original.mp4", streamOf([new Uint8Array([9])]));
    expect(await storage.stat("video-4/original.mp4")).not.toBeNull();
    await storage.delete("video-4/original.mp4");
    expect(await storage.stat("video-4/original.mp4")).toBeNull();
  });
});
