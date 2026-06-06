import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { SystemLogRow } from '../types/domain';

const app = new Hono<{ Bindings: Env }>();

// GET /api/health — liveness + DB connectivity + aggregate counts.
app.get('/', async (c) => {
  let dbOk = false;
  let companies = 0;
  let signals = 0;

  try {
    const cRow = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM companies',
    ).first<{ n: number }>();
    const sRow = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM intent_signals',
    ).first<{ n: number }>();
    companies = cRow?.n ?? 0;
    signals = sRow?.n ?? 0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk,
    companies,
    signals,
    time: new Date().toISOString(),
  });
});

// GET /api/health/logs — recent system logs (newest first).
app.get('/logs', async (c) => {
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(c.req.query('limit') ?? '50', 10) || 50),
  );
  const res = await c.env.DB.prepare(
    'SELECT * FROM system_logs ORDER BY ts DESC LIMIT ?',
  )
    .bind(limit)
    .all<SystemLogRow>();

  return c.json({ data: res.results ?? [] });
});

export default app;
