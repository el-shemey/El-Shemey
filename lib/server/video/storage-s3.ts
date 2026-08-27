import "server-only";
import { createHash, createHmac } from "node:crypto";
import { Readable } from "node:stream";
import {
  isValidStorageRef,
  type VideoStorageProvider,
} from "@/lib/server/video/storage";

/**
 * S3-COMPATIBLE OBJECT STORAGE DRIVER (Phase 10).
 *
 * Implements VideoStorageProvider over the S3 REST API using dependency-free
 * AWS Signature V4 (works with AWS S3, Cloudflare R2, Backblaze B2, Minio…).
 *
 * SECURITY:
 *  - Credentials come exclusively from server-only env (never NEXT_PUBLIC_*).
 *  - Object keys are the same validated opaque refs as local storage —
 *    user input never touches a key or a URL.
 *  - Objects live in a PRIVATE bucket; student access flows through the
 *    authorized streaming/download routes exactly like local storage.
 *
 * ACTIVATION: VIDEO_STORAGE_DRIVER=s3 + S3_* env vars (see .env.example).
 * Missing config → driver refuses to construct; the app never silently
 * falls back between drivers.
 *
 * LARGE FILES: save() currently buffers the entire body then does a
 * single-part PUT. This is safe only with a conservative size cap
 * (VIDEO_MAX_UPLOAD_MB=250 by default, enforced server-side via
 * streaming byte counter). Buffering 2 GB would OOM Node — the cap
 * prevents that. Multipart/streaming upload is a documented follow-up
 * for large media beyond this cap.
 */

export interface S3Config {
  bucket: string;
  region: string;
  endpoint: string; // e.g. https://s3.eu-central-1.amazonaws.com or R2 endpoint
  accessKeyId: string;
  secretAccessKey: string;
}

export function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    region,
    endpoint: endpoint.replace(/\/+$/, ""),
    accessKeyId,
    secretAccessKey,
  };
}

/* ------------------------------- SigV4 core -------------------------------- */

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}
function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function buildCanonicalRequest(input: {
  method: string;
  pathname: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
}): { canonical: string; signedHeaders: string } {
  const sortedHeaderKeys = Object.keys(input.headers)
    .map((k) => k.toLowerCase())
    .sort();
  const signedHeaders = sortedHeaderKeys.join(";");
  // SigV4: EVERY canonical header line ends with \n (including host).
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${input.headers[k.toLowerCase()]}\n`)
    .join("");
  const sortedQuery = Object.keys(input.query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(input.query[k] ?? "")}`)
    .join("&");
  const canonical =
    `${input.method}\n` +
    `${input.pathname}\n` +
    `${sortedQuery}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    input.payloadHash;
  return { canonical, signedHeaders };
}

export function signRequest(
  config: S3Config,
  method: string,
  key: string,
  body?: Buffer | null,
): { url: string; headers: Record<string, string> } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? "");
  const host = new URL(config.endpoint).host;
  const pathname = `/${config.bucket}/${key}`;

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  const { canonical, signedHeaders } = buildCanonicalRequest({
    method,
    pathname,
    query: {},
    headers,
    payloadHash,
  });

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonical)].join(
    "\n",
  );

  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `${config.endpoint}${pathname}`,
    headers: {
      ...headers,
      Authorization: authHeader,
    },
  };
}

/* --------------------------------- Driver ---------------------------------- */

export class S3VideoStorage implements VideoStorageProvider {
  readonly id = "s3";

  constructor(
    private readonly config: S3Config,
    /** Injectable fetch for deterministic tests. */
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(
    method: string,
    ref: string,
    body?: Buffer | null,
  ): Promise<Response> {
    if (!isValidStorageRef(ref)) throw new Error("INVALID_STORAGE_REF");
    const { url, headers } = signRequest(this.config, method, ref, body);
    return this.fetchImpl(url, {
      method,
      headers,
      ...(body ? { body: new Uint8Array(body) } : {}),
    });
  }

  async save(
    ref: string,
    body: ReadableStream<Uint8Array>,
    maxBytes?: number,
  ): Promise<{ sizeBytes: number }> {
    // Buffered single-part PUT with streaming byte counter.
    // OOM-safe only with the conservative VIDEO_MAX_UPLOAD_MB cap (250 MB default).
    // The route enforces the cap while replaying the magic-byte header chunk;
    // this second counter is defense-in-depth for direct storage calls.
    let written = 0;
    const chunks: Buffer[] = [];
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        written += value.byteLength;
        if (maxBytes !== undefined && written > maxBytes) {
          void reader.cancel();
          throw new Error("PAYLOAD_TOO_LARGE");
        }
        chunks.push(Buffer.from(value));
      }
    }
    const buffer = Buffer.concat(chunks);

    // Single-part PUT. Multipart upload is a documented follow-up for
    // objects beyond ~5 GB — the current upload cap keeps us far below it.
    const res = await this.request("PUT", ref, buffer);
    if (!res.ok) throw new Error(`S3_PUT_FAILED:${res.status}`);
    return { sizeBytes: written };
  }

  async openRange(ref: string, start: number, endInclusive: number) {
    if (start < 0 || endInclusive < start) throw new Error("INVALID_RANGE");
    const length = endInclusive - start + 1;
    // Signed GET with Range header requires the header inside the signature;
    // simplest correct path: fetch the ranged bytes and wrap in a stream.
    const { url, headers } = signRequest(this.config, "GET", ref, null);
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        ...Object.fromEntries(
          Object.entries(headers).filter(
            ([k]) => k.startsWith("x-amz") || k === "Authorization",
          ),
        ),
        host: headers.host,
        Range: `bytes=${start}-${endInclusive}`,
      },
    });
    if (!res.ok && res.status !== 206) throw new Error(`S3_GET_FAILED:${res.status}`);
    return Readable.fromWeb(
      res.body as unknown as import("node:stream/web").ReadableStream,
    );
  }

  async stat(ref: string): Promise<{ sizeBytes: number } | null> {
    // Validation errors propagate (parity with the local driver); network /
    // missing-object failures resolve to null.
    if (!isValidStorageRef(ref)) throw new Error("INVALID_STORAGE_REF");
    try {
      const res = await this.request("HEAD", ref, null);
      if (!res.ok) return null;
      const len = Number(res.headers.get("content-length") ?? "0");
      return Number.isFinite(len) ? { sizeBytes: len } : null;
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_STORAGE_REF")
        throw error;
      return null;
    }
  }

  async delete(ref: string): Promise<void> {
    const res = await this.request("DELETE", ref, null);
    // 204 expected; 404 tolerated (idempotent delete).
    if (!res.ok && res.status !== 404)
      throw new Error(`S3_DELETE_FAILED:${res.status}`);
  }
}

/** Registry helper: constructs the production driver or refuses safely. */
export function createS3VideoStorage(): VideoStorageProvider | null {
  const config = getS3Config();
  return config ? new S3VideoStorage(config) : null;
}
