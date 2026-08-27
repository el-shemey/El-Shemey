import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { probeMp4File, sniffVideoMimeType } from "@/lib/server/video/probe";

/**
 * Unit — MP4 container probing and magic-byte sniffing.
 * A minimal but structurally valid MP4 is synthesized byte-by-byte:
 * ftyp + moov{ mvhd(v0), trak{ tkhd(v0) } }.
 */

function box(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length + 8, 0);
  head.write(type, 4, 8, "latin1");
  return Buffer.concat([head, payload]);
}

function mvhdV0(timescale: number, duration: number): Buffer {
  const b = Buffer.alloc(96 + 4); // version/flags + v0 body
  b.writeUInt32BE(0, 0); // version 0, flags 0
  b.writeUInt32BE(0, 4); // creation
  b.writeUInt32BE(0, 8); // modification
  b.writeUInt32BE(timescale, 12);
  b.writeUInt32BE(duration, 16);
  // rate(4) volume(2) reserved(10) matrix(36) pre_defined(24) next_track(4)
  b.writeUInt32BE(0x00010000, 20); // rate 1.0
  b.writeUInt16BE(0x0100, 24); // volume
  return b;
}

function tkhdV0(width: number, height: number): Buffer {
  const b = Buffer.alloc(80 + 4); // version/flags + v0 body
  b.writeUInt32BE(0, 0);
  b.writeUInt32BE(0, 4); // creation
  b.writeUInt32BE(0, 8); // modification
  b.writeUInt32BE(1, 12); // track id
  b.writeUInt32BE(0, 16); // reserved
  b.writeUInt32BE(0, 20); // duration
  b.writeUInt32BE(0, 24); // reserved
  b.writeUInt32BE(0, 28); // reserved
  b.writeUInt16BE(0, 32); // layer
  b.writeUInt16BE(0, 34); // alternate group
  b.writeUInt16BE(0, 36); // volume
  b.writeUInt16BE(0, 38); // reserved
  // matrix (36 bytes) identity
  const matrix = Buffer.alloc(36);
  matrix.writeUInt32BE(0x00010000, 0);
  matrix.writeUInt32BE(0x00010000, 20);
  matrix.writeUInt32BE(0x40000000, 28);
  matrix.copy(b, 40);
  b.writeUInt32BE(width * 65536, 76);
  b.writeUInt32BE(height * 65536, 80);
  return b;
}

describe("magic-byte sniffing", () => {
  it("recognizes MP4 via ftyp", () => {
    const header = new Uint8Array(12);
    header.set([0, 0, 0, 24], 0);
    "ftyp".split("").forEach((c, i) => (header[4 + i] = c.charCodeAt(0)));
    expect(sniffVideoMimeType(header)).toBe("video/mp4");
  });

  it("recognizes WebM via EBML", () => {
    expect(
      sniffVideoMimeType(
        new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8]),
      ),
    ).toBe("video/webm");
  });

  it("rejects everything else (client MIME never trusted)", () => {
    expect(sniffVideoMimeType(new TextEncoder().encode("%PDF-1.7 junk!"))).toBeNull();
    expect(sniffVideoMimeType(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(
      sniffVideoMimeType(new TextEncoder().encode("<script>x</script>")),
    ).toBeNull();
  });
});

describe("MP4 probing", () => {
  it("extracts duration and dimensions from a synthesized file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "elshemey-probe-"));
    try {
      const moov = box(
        "moov",
        Buffer.concat([
          box("mvhd", mvhdV0(1000, 95_500)), // 95.5 s
          box("trak", box("tkhd", tkhdV0(1920, 1080))),
        ]),
      );
      const mp4 = Buffer.concat([
        box("ftyp", Buffer.alloc(8)),
        moov,
        box("mdat", Buffer.alloc(64)),
      ]);
      const file = path.join(dir, "sample.mp4");
      await writeFile(file, mp4);

      const result = await probeMp4File(file);
      expect(result.durationSeconds).toBe(96); // rounded
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns nulls for non-MP4 garbage instead of throwing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "elshemey-probe-"));
    try {
      const file = path.join(dir, "garbage.mp4");
      await writeFile(file, Buffer.from("definitely not an mp4"));
      const result = await probeMp4File(file);
      expect(result).toEqual({
        durationSeconds: null,
        width: null,
        height: null,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
