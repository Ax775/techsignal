import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

/**
 * In-memory fixed-window rate limiter keyed by client IP.
 *
 * Note: Workers isolates are ephemeral and per-colo, so this is a best-effort
 * limiter suitable for abuse smoothing. For strict global limits a Durable
 * Object or KV-backed counter would be substituted — the interface stays the
 * same.
 */
const buckets = new Map<string, Bucket>();

function clientKey(headers: Headers): string {
  return (
    headers.get('CF-Connecting-IP') ||
    headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    headers.get('X-Real-IP') ||
    'anonymous'
  );
}

export interface RateLimitOptions {
  /** Requests allowed per window. Falls back to env.RATE_LIMIT_MAX. */
  max?: number;
  /** Window length in seconds. Falls back to env.RATE_LIMIT_WINDOW_SECONDS. */
  windowSec?: number;
  /**
   * Bucket namespace. Limiters with different names keep independent counters
   * for the same IP, so a strict per-endpoint limit (e.g. unlock) does not
   * share a budget with the global API limit.
   */
  name?: string;
}

export function rateLimit(
  options: RateLimitOptions = {},
): MiddlewareHandler<{ Bindings: Env }> {
  const namespace = options.name ?? 'global';
  return async (c, next) => {
    const max =
      options.max ??
      (Number.parseInt(c.env.RATE_LIMIT_MAX ?? '60', 10) || 60);
    const windowSec =
      options.windowSec ??
      (Number.parseInt(c.env.RATE_LIMIT_WINDOW_SECONDS ?? '60', 10) || 60);
    // The bucket lifetime (resetAt) equals the window exactly, so the
    // "TTL == window" invariant holds for this in-memory limiter.
    const windowMs = windowSec * 1000;
    const now = Date.now();

    const key = `${namespace}:${clientKey(c.req.raw.headers)}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const resetSec = Math.ceil((bucket.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSec));

    // Opportunistic cleanup to keep the map bounded.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }

    if (bucket.count > max) {
      c.header('Retry-After', String(resetSec));
      return c.json(
        { error: 'rate_limited', message: 'Too many requests' },
        429,
      );
    }

    await next();
  };
}
