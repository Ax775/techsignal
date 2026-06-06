import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

/**
 * Global security-headers middleware. Applied to every response (including
 * errors and pre-flight) so the API never serves content without a baseline
 * hardening posture.
 *
 * The API only ever returns JSON, so a maximally strict CSP (`default-src
 * 'none'`) is safe and blocks the response from sourcing or framing anything.
 */
export function securityHeaders(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    c.header(
      'Permissions-Policy',
      'geolocation=(), camera=(), microphone=()',
    );
  };
}
