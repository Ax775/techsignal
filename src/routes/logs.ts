import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { SystemLogRow } from '../types/domain';
import { clampInt } from '../lib/http';
import { timingSafeEqual } from '../middleware/auth';

const app = new Hono<{ Bindings: Env }>();

const VALID_LEVELS: SystemLogRow['level'][] = ['info', 'warn', 'error', 'success'];

// GET /api/logs — filtered, paginated system logs (newest first).
//
// Logs carry Stripe session IDs and payment amounts, so this read route is
// gated behind the admin key (the global auth middleware lets GETs through).
// Compared in constant time, consistent with the admin-auth middleware.
app.get('/', async (c) => {
  const adminKey = c.env.ADMIN_KEY;
  const provided = (c.req.header('Authorization') ?? '')
    .match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!adminKey || !provided || !(await timingSafeEqual(provided, adminKey))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const page = clampInt(c.req.query('page'), 1, 1, 100_000);
  const limit = clampInt(c.req.query('limit'), 50, 1, 200);
  const offset = (page - 1) * limit;

  const levelFilter = c.req.query('level');

  const conditions: string[] = [];
  const binds: (string | number)[] = [];

  if (levelFilter && (VALID_LEVELS as string[]).includes(levelFilter)) {
    conditions.push('level = ?');
    binds.push(levelFilter);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM system_logs ${where}`,
  )
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const res = await c.env.DB.prepare(
    `SELECT * FROM system_logs ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<SystemLogRow>();

  return c.json({ data: res.results ?? [], total, page, limit });
});

export default app;
