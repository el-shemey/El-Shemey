import "server-only";
import { open } from "node:fs/promises";
import { spawn } from "node:child_process";

/**
 * Video metadata probing — MP4-first, zero dependencies.
 *
 * Phase scope (deliberately NOT over-engineered):
 *  - Reliable MP4 playback is the deliverable.
 *  - Duration/resolution are extracted server-side from the container boxes
 *    so the admin UI shows honest metadata without trusting client input.
 *  - HLS transcoding via FFmpeg is an OPTIONAL future seam (see
 *    detectFfmpeg). Nothing depends on FFmpeg being installed.
 */

export interface VideoProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

/** Magic-byte content sniffing — client MIME types are never trusted. */
export function sniffVideoMimeType(
  header: Uint8Array,
): "video/mp4" | "video/webm" | null {
  if (header.length < 12) return null;
  const ascii = String.fromCharCode(...header.slice(4, 8));
  if (ascii === "ftyp") return "video/mp4";
  // EBML header: 0x1A 0x45 0xDF 0xA3
  if (
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  ) {
    return "video/webm";
  }
  return null;
}

function readU32(b: DataView, off: number): number {
  return b.getUint32(off, false);
}
function readU64(b: DataView, off: number): number {
  const hi = b.getUint32(off, false);
  const lo = b.getUint32(off + 4, false);
  return hi * 0x100000000 + lo;
}

/**
 * Walks the top-level MP4 boxes of a file, parses `moov` in memory
 * (typically < a few MB even for large videos) and extracts duration
 * (mvhd) plus display dimensions (tkhd).
 */
export async function probeMp4File(filePath: string): Promise<VideoProbeResult> {
  const handle = await open(filePath, "r");
  try {
    const size = (await handle.stat()).size;
    let offset = 0;
    let result: VideoProbeResult = {
      durationSeconds: null,
      width: null,
      height: null,
    };

    while (offset + 8 <= size) {
      const header = Buffer.alloc(8);
      await handle.read(header, 0, 8, offset);
      const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
      let boxSize = readU32(view, 0);
      const type = header.toString("latin1", 4, 8);
      let headerLen = 8;
      if (boxSize === 1) {
        const large = Buffer.alloc(8);
        await handle.read(large, 0, 8, offset + 8);
        boxSize = Number(
          new DataView(large.buffer, large.byteOffset, large.byteLength).getBigUint64(
            0,
            false,
          ),
        );
        headerLen = 16;
      }
      if (boxSize < headerLen || offset + boxSize > size) break;

      if (type === "moov") {
        const moov = Buffer.alloc(boxSize - headerLen);
        await handle.read(moov, 0, moov.length, offset + headerLen);
        result = parseMoov(moov);
      }
      offset += boxSize;
    }
    return result;
  } finally {
    await handle.close();
  }
}

function parseMoov(moov: Buffer): VideoProbeResult {
  const out: VideoProbeResult = {
    durationSeconds: null,
    width: null,
    height: null,
  };
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  let off = 0;

  while (off + 8 <= moov.length) {
    let boxSize = readU32(view, off);
    const type = moov.toString("latin1", off + 4, off + 8);
    let headerLen = 8;
    if (boxSize === 1) {
      boxSize = readU64(view, off + 8);
      headerLen = 16;
    }
    if (boxSize < headerLen || off + boxSize > moov.length) break;
    const bodyStart = off + headerLen;

    if (type === "mvhd" && out.durationSeconds === null) {
      const version = moov[bodyStart];
      if (version === 1 && bodyStart + 28 <= moov.length) {
        const timescale = readU32(view, bodyStart + 20);
        const duration = readU64(view, bodyStart + 24);
        if (timescale > 0) out.durationSeconds = Math.round(duration / timescale);
      } else if (bodyStart + 20 <= moov.length) {
        const timescale = readU32(view, bodyStart + 12);
        const duration = readU32(view, bodyStart + 16);
        if (timescale > 0) out.durationSeconds = Math.round(duration / timescale);
      }
    }

    if (type === "trak") {
      const dims = parseTrkhd(moov.subarray(bodyStart, off + boxSize));
      if (dims) {
        out.width = dims.width;
        out.height = dims.height;
      }
    }

    off += boxSize;
  }
  return out;
}

/** tkhd width/height are the final 8 bytes (two 16.16 fixed-point values). */
function parseTrkhd(trak: Buffer): { width: number; height: number } | null {
  const view = new DataView(trak.buffer, trak.byteOffset, trak.byteLength);
  let off = 0;
  while (off + 8 <= trak.length) {
    let boxSize = readU32(view, off);
    const type = trak.toString("latin1", off + 4, off + 8);
    let headerLen = 8;
    if (boxSize === 1) {
      boxSize = readU64(view, off + 8);
      headerLen = 16;
    }
    if (boxSize < headerLen || off + boxSize > trak.length) break;
    if (type === "tkhd") {
      const end = off + boxSize;
      if (end - 8 >= off + headerLen) {
        const widthFixed = readU32(view, end - 8);
        const heightFixed = readU32(view, end - 4);
        return {
          width: Math.round(widthFixed / 65536),
          height: Math.round(heightFixed / 65536),
        };
      }
    }
    off += boxSize;
  }
  return null;
}

/* --------------------------- FFmpeg optional seam -------------------------- */

let ffmpegAvailable: boolean | null = null;

/**
 * Optional processing seam. When a safe system FFmpeg exists AND a future
 * phase enables it, this returns true and HLS transcoding can be layered on
 * WITHOUT changing storage or playback contracts. The application never
 * requires it — absence is a supported, honest state.
 */
export function detectFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return Promise.resolve(ffmpegAvailable);
  return new Promise((resolve) => {
    try {
      const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
      const timer = setTimeout(() => {
        child.kill();
        ffmpegAvailable = false;
        resolve(false);
      }, 3000);
      child.on("error", () => {
        clearTimeout(timer);
        ffmpegAvailable = false;
        resolve(false);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        ffmpegAvailable = code === 0;
        resolve(ffmpegAvailable);
      });
    } catch {
      ffmpegAvailable = false;
      resolve(false);
    }
  });
}
