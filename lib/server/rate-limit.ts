/**
 * Rate limiting boundary (Phase 4).
 *
 * PRODUCTION NOTE: the in-memory implementation below is single-instance
 * and resets on deploy. It is correct for local development and for the
 * current single-server deployment. For horizontally scaled/serverless
 * production, implement this interface against a shared store (e.g.
 * Upstash Redis sliding window) — the call sites will not change.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    if (bucket.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    bucket.count += 1;
    // Opportunistic cleanup to keep memory bounded.
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) {
        if (b.resetAt <= now) this.buckets.delete(k);
      }
    }
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
}

const globalForLimiter = globalThis as unknown as {
  rateLimiter: RateLimiter | undefined;
};

/** Swap point for a distributed implementation (Upstash/Redis) later. */
export function getRateLimiter(): RateLimiter {
  return (globalForLimiter.rateLimiter ??= new MemoryRateLimiter());
}
/** Test hook: clears all buckets (dev/test only). */
export function resetRateLimiter(): void {
  getRateLimiter();
  globalThisRateLimiterReset();
}
function globalThisRateLimiterReset() {
  const g = globalThis as unknown as { rateLimiter?: RateLimiter };
  g.rateLimiter = new MemoryRateLimiter();
}
