import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { ChangeType, IntentSignalRow, SignalStatus } from '../types/domain';

const app = new Hono<{ Bindings: Env }>();

interface SignalJoinRow extends IntentSignalRow {
  domain: string;
  company_name: string | null;
}

const LOCKED_PITCH = '[LOCKED — unlock to reveal personalized pitch]';

function clampInt(value: string | undefined, def: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function redactLocked(row: SignalJoinRow): SignalJoinRow {
  if (row.status === 'unlocked') return row;
  return {
    ...row,
    generated_pitch: LOCKED_PITCH,
    description:
      row.description.length > 200
        ? `${row.description.slice(0, 200)}…`
        : row.description,
  };
}

const VALID_TYPES: ChangeType[] = ['churn', 'adoption', 'vulnerability'];
const VALID_STATUS: SignalStatus[] = ['locked', 'unlocked'];

// GET /api/signals — filtered, paginated list (newest first).
app.get('/', async (c) => {
  const page = clampInt(c.req.query('page'), 1, 1, 100_000);
  const limit = clampInt(c.req.query('limit'), 20, 1, 100);
  const offset = (page - 1) * limit;

  const statusFilter = c.req.query('status');
  const typeFilter = c.req.query('change_type');
  const companyId = c.req.query('company_id');

  const conditions: string[] = [];
  const binds: (string | number)[] = [];

  if (statusFilter && (VALID_STATUS as string[]).includes(statusFilter)) {
    conditions.push('s.status = ?');
    binds.push(statusFilter);
  }
  if (typeFilter && (VALID_TYPES as string[]).includes(typeFilter)) {
    conditions.push('s.change_type = ?');
    binds.push(typeFilter);
  }
  if (companyId) {
    conditions.push('s.company_id = ?');
    binds.push(companyId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM intent_signals s ${where}`,
  )
    .bind(...binds)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const res = await c.env.DB.prepare(
    `SELECT s.*, c.domain AS domain, c.company_name AS company_name
       FROM intent_signals s
       JOIN companies c ON c.id = s.company_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<SignalJoinRow>();

  const data = (res.results ?? []).map(redactLocked);

  return c.json({ data, total, page, limit });
});

// GET /api/signals/:id — single signal (pitch redacted if locked).
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT s.*, c.domain AS domain, c.company_name AS company_name
       FROM intent_signals s
       JOIN companies c ON c.id = s.company_id
      WHERE s.id = ?`,
  )
    .bind(id)
    .first<SignalJoinRow>();

  if (!row) return c.json({ error: 'not_found' }, 404);

  return c.json({ data: redactLocked(row) });
});

export default app;
