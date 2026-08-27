import { describe, expect, it } from "vitest";
import { getRateLimiter } from "@/lib/server/rate-limit";

describe("rate limiter boundary (dev in-memory implementation)", () => {
  it("allows under the limit and blocks at the limit", async () => {
    const limiter = getRateLimiter();
    const key = `test-login:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const r = await limiter.consume(key, 5, 60);
      expect(r.allowed).toBe(true);
    }
    const blocked = await limiter.consume(key, 5, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are isolated — a different key is unaffected", async () => {
    const limiter = getRateLimiter();
    const used = `test-iso:${Math.random()}`;
    await limiter.consume(used, 1, 60);
    expect((await limiter.consume(used, 1, 60)).allowed).toBe(false);

    const fresh = `test-iso:${Math.random()}`;
    expect((await limiter.consume(fresh, 1, 60)).allowed).toBe(true);
  });
});
