import { describe, expect, it } from "vitest";
import { signStreamToken, verifyStreamToken } from "@/lib/server/video/playback";

/**
 * Unit — signed playback URL token lifecycle (Phase 6 security).
 * Tokens are hotlink protection; the stream route re-runs the full
 * authorization chain regardless. These pin the expiry semantics.
 */

describe("stream token expiry", () => {
  it("accepts a valid, unexpired token", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signStreamToken("video-1", exp);
    expect(verifyStreamToken("video-1", token, String(exp))).toBe(true);
  });

  it("rejects an EXPIRED token — signed URLs are short-lived", () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const token = signStreamToken("video-1", exp);
    expect(verifyStreamToken("video-1", token, String(exp))).toBe(false);
  });

  it("rejects tokens for a different video (IDOR via URL swap)", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signStreamToken("video-A", exp);
    expect(verifyStreamToken("video-B", token, String(exp))).toBe(false);
  });

  it("rejects missing/malformed inputs without throwing", () => {
    expect(verifyStreamToken("v", null, null)).toBe(false);
    expect(verifyStreamToken("v", "tok", "not-a-number")).toBe(false);
    expect(
      verifyStreamToken("v", "tampered", String(Math.floor(Date.now() / 1000) + 60)),
    ).toBe(false);
  });
});
