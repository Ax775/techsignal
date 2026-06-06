import type { Context, MiddlewareHandler, Next } from 'hono';
import type { Env } from '../types/env';

/**
 * Admin API-key authentication.
 *
 * Mutating routes (POST/PUT/PATCH/DELETE) require an
 * `Authorization: Bearer <ADMIN_KEY>` header whose value matches the
 * `ADMIN_KEY` secret (set via `wrangler secret put ADMIN_KEY`). Read-only
 * traffic (GET/HEAD) and the public health check are never gated.
 *
 * The provided token is compared against the configured key in constant time
 * (see {@link timingSafeEqual}) so the endpoint does not leak the key length or
 * a per-character match position through response timing.
 *
 * Fails CLOSED: if `ADMIN_KEY` is not configured, every mutation is rejected
 * rather than silently left open.
 */

/** Path prefixes that bypass admin auth even for mutating methods. */
const PUBLIC_PREFIXES = ['/api/health'];

/** Methods that never mutate state and therefore stay public. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Constant-time string comparison built on the Web Crypto API (Workers has no
 * `crypto.timingSafeEqual`). Uses the "double HMAC" pattern: both inputs are
 * HMAC'd under a fresh random key, so the comparison runs over fixed-length
 * digests and neither the length nor the contents of the secret influence the
 * branch timing.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const keyData = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const macA = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(a)));
  const macB = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(b)));

  let diff = 0;
  for (let i = 0; i < macA.length; i++) diff |= macA[i]! ^ macB[i]!;
  return diff === 0;
}

/** True when the request should bypass auth (safe method or public prefix). */
function shouldSkipAuth(c: Context<{ Bindings: Env }>): boolean {
  if (SAFE_METHODS.has(c.req.method)) return true;
  const path = new URL(c.req.url).pathname;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Extract the bearer token from the Authorization header, or null. */
function extractBearer(c: Context<{ Bindings: Env }>): string | null {
  const header = c.req.header('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

/**
 * Hono middleware enforcing the admin key on mutating routes. Mount it on the
 * API surface (`app.use('/api/*', adminAuth())`) — it self-skips GET/HEAD and
 * the public prefixes.
 */
export function adminAuth(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    if (shouldSkipAuth(c)) {
      await next();
      return;
    }

    const expected = c.env.ADMIN_KEY;
    if (!expected) {
      // Fail closed: a missing secret means mutations are disabled, not open.
      console.error('admin_auth_misconfigured: ADMIN_KEY is not set');
      return c.json({ error: 'unauthorized' }, 401);
    }

    const provided = extractBearer(c);
    if (!provided || !(await timingSafeEqual(provided, expected))) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    await next();
  };
}
