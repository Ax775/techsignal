import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

/**
 * CORS middleware that honours the ALLOWED_ORIGINS var (comma-separated).
 * Echoes the request origin back only when it is on the allow-list, and
 * short-circuits pre-flight OPTIONS requests.
 */
export function cors(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const allowed = (c.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const origin = c.req.header('Origin') ?? '';
    const isAllowed = allowed.includes(origin);

    const setHeaders = () => {
      if (isAllowed) {
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Vary', 'Origin');
        c.header('Access-Control-Allow-Credentials', 'true');
      }
      c.header(
        'Access-Control-Allow-Methods',
        'GET,POST,DELETE,OPTIONS,PUT,PATCH',
      );
      c.header(
        'Access-Control-Allow-Headers',
        'Content-Type,Authorization,X-Requested-With',
      );
      c.header('Access-Control-Max-Age', '86400');
    };

    if (c.req.method === 'OPTIONS') {
      setHeaders();
      return c.body(null, 204);
    }

    setHeaders();
    await next();
  };
}
