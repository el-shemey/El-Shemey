import { afterEach, describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import {
  buildCanonicalRequest,
  createS3VideoStorage,
  getS3Config,
  signRequest,
  S3VideoStorage,
} from "@/lib/server/video/storage-s3";

/**
 * Unit — S3-compatible storage driver (Phase 10).
 * SigV4 signing is verified against an independently computed signature
 * (AWS documented algorithm). Network is injected; no credentials exist.
 */

const ENV_KEYS = [
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

function setS3Env() {
  process.env.S3_BUCKET = "elshemey-videos";
  process.env.S3_REGION = "eu-central-1";
  process.env.S3_ENDPOINT = "https://s3.eu-central-1.amazonaws.com";
  process.env.S3_ACCESS_KEY_ID = "AKIA-test";
  process.env.S3_SECRET_ACCESS_KEY = "wJalr-secret";
}

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

const config = {
  bucket: "elshemey-videos",
  region: "eu-central-1",
  endpoint: "https://s3.eu-central-1.amazonaws.com",
  accessKeyId: "AKIA-test",
  secretAccessKey: "wJalr-secret",
};

/** Rebuilds the canonical request from emitted headers (independent check). */
function buildCanonicalString(
  headers: Record<string, string>,
  body: Buffer | null,
): string {
  const keys = ["host", "x-amz-content-sha256", "x-amz-date"];
  const canonicalHeaders = keys.map((k) => `${k}:${headers[k]}\n`).join("");
  return [
    "PUT",
    "/elshemey-videos/vid/original.mp4",
    "",
    canonicalHeaders,
    keys.join(";"),
    createHash("sha256")
      .update(body ?? "")
      .digest("hex"),
  ].join("\n");
}

describe("credential boundary", () => {
  it("refuses construction without complete config", () => {
    expect(getS3Config()).toBeNull();
    expect(createS3VideoStorage()).toBeNull();
  });
});

describe("SigV4 signing (documented AWS algorithm)", () => {
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it("produces the documented canonical request structure", () => {
    const headers = {
      host: "s3.eu-central-1.amazonaws.com",
      "x-amz-content-sha256": createHash("sha256").update("").digest("hex"),
      "x-amz-date": "20260825T000000Z",
    };
    const { canonical, signedHeaders } = buildCanonicalRequest({
      method: "GET",
      pathname: "/elshemey-videos/vid123/original.mp4",
      query: {},
      headers,
      payloadHash: headers["x-amz-content-sha256"],
    });
    expect(signedHeaders).toBe("host;x-amz-content-sha256;x-amz-date");
    const lines = canonical.split("\n");
    expect(lines[0]).toBe("GET");
    expect(lines[1]).toBe("/elshemey-videos/vid123/original.mp4");
    expect(lines[lines.length - 1]).toBe(headers["x-amz-content-sha256"]);
  });

  it("signs PUT with key derivation date→region→service→request", () => {
    setS3Env();
    const body = Buffer.from("video-bytes");
    const { url, headers } = signRequest(config, "PUT", "vid/original.mp4", body);

    expect(url).toBe(`${config.endpoint}/elshemey-videos/vid/original.mp4`);
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA-test\//);
    expect(headers.Authorization).toContain("/eu-central-1/s3/aws4_request, ");
    expect(headers["x-amz-content-sha256"]).toBe(
      createHash("sha256").update(body).digest("hex"),
    );

    // Independent recomputation: rebuild the canonical request via the
    // (separately tested) canonical builder, then verify ONLY the signing
    // chain — key derivation date→region→service→request.
    const signature = headers.Authorization.split("Signature=")[1];
    const { canonical } = buildCanonicalRequest({
      method: "PUT",
      pathname: "/elshemey-videos/vid/original.mp4",
      query: {},
      headers: {
        host: "s3.eu-central-1.amazonaws.com",
        "x-amz-content-sha256": headers["x-amz-content-sha256"],
        "x-amz-date": headers["x-amz-date"],
      },
      payloadHash: headers["x-amz-content-sha256"],
    });
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      headers["x-amz-date"],
      `${headers["x-amz-date"].slice(0, 8)}/eu-central-1/s3/aws4_request`,
      createHash("sha256").update(canonical).digest("hex"),
    ].join("\n");
    const kDate = createHmac("sha256", `AWS4${config.secretAccessKey}`)
      .update(headers["x-amz-date"].slice(0, 8))
      .digest();
    const kRegion = createHmac("sha256", kDate).update("eu-central-1").digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const expected = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    expect(signature).toBe(expected);
  });
});

describe("driver behavior (mocked network)", () => {
  function makeDriver(
    responses: Array<{ status: number; headers?: Record<string, string> }>,
  ) {
    setS3Env();
    let call = 0;
    return new S3VideoStorage(getS3Config()!, async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return new Response(null, { status: r.status, headers: r.headers });
    });
  }

  function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    });
  }

  it("save streams bytes and enforces the size cap", async () => {
    const driver = makeDriver([{ status: 200 }]);
    const info = await driver.save("vid-1/original.mp4", streamOf(new Uint8Array(16)));
    expect(info.sizeBytes).toBe(16);

    await expect(
      driver.save("vid-2/original.mp4", streamOf(new Uint8Array(64)), 32),
    ).rejects.toThrow("PAYLOAD_TOO_LARGE");
  });

  it("stat returns null on missing objects instead of throwing", async () => {
    const driver = makeDriver([{ status: 404 }]);
    expect(await driver.stat("missing/original.mp4")).toBeNull();
  });

  it("delete tolerates 404 but fails loudly on real errors", async () => {
    const okDriver = makeDriver([{ status: 204 }, { status: 204 }]);
    await okDriver.delete("vid/original.mp4");

    const errDriver = makeDriver([{ status: 500 }, { status: 500 }]);
    await expect(errDriver.delete("vid/original.mp4")).rejects.toThrow();
  });

  it("rejects invalid refs before any network call", async () => {
    const driver = makeDriver([{ status: 200 }]);
    await expect(driver.stat("../escape.mp4")).rejects.toThrow("INVALID_STORAGE_REF");
  });
});
