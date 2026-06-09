import { Hono } from 'hono';
import type { Env, ScanQueueMessage } from '../types/env';
import {
  AddCompanySchema,
  hydrateCompany,
  hydrateSnapshot,
  type CompanyRow,
  type TechSnapshotRow,
} from '../types/domain';
import { clampInt } from '../lib/http';

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies — paginated list with optional search.
app.get('/', async (c) => {
  const page = clampInt(c.req.query('page'), 1, 1, 100_000);
  const limit = clampInt(c.req.query('limit'), 20, 1, 100);
  const search = (c.req.query('search') ?? '').trim();
  const offset = (page - 1) * limit;

  let rows: CompanyRow[];
  let total: number;

  if (search) {
    const like = `%${search}%`;
    const countRow = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM companies WHERE domain LIKE ? OR company_name LIKE ?',
    )
      .bind(like, like)
      .first<{ n: number }>();
    total = countRow?.n ?? 0;

    const res = await c.env.DB.prepare(
      `SELECT * FROM companies
        WHERE domain LIKE ? OR company_name LIKE ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
    )
      .bind(like, like, limit, offset)
      .all<CompanyRow>();
    rows = res.results ?? [];
  } else {
    const countRow = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM companies',
    ).first<{ n: number }>();
    total = countRow?.n ?? 0;

    const res = await c.env.DB.prepare(
      'SELECT * FROM companies ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
      .bind(limit, offset)
      .all<CompanyRow>();
    rows = res.results ?? [];
  }

  return c.json({
    data: rows.map(hydrateCompany),
    total,
    page,
    limit,
  });
});

// POST /api/companies — add a new company.
app.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = AddCompanySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'validation_error', issues: parsed.error.flatten() },
      400,
    );
  }

  const { domain, company_name } = parsed.data;

  const existing = await c.env.DB.prepare(
    'SELECT * FROM companies WHERE domain = ?',
  )
    .bind(domain)
    .first<CompanyRow>();

  if (existing) {
    return c.json({ data: hydrateCompany(existing), created: false }, 200);
  }

  await c.env.DB.prepare(
    'INSERT INTO companies (domain, company_name) VALUES (?, ?)',
  )
    .bind(domain, company_name ?? null)
    .run();

  const created = await c.env.DB.prepare(
    'SELECT * FROM companies WHERE domain = ?',
  )
    .bind(domain)
    .first<CompanyRow>();

  if (!created) {
    return c.json({ error: 'Internal server error' }, 500);
  }

  return c.json({ data: hydrateCompany(created), created: true }, 201);
});

// GET /api/companies/:id — single company + latest snapshot.
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const company = await c.env.DB.prepare(
    'SELECT * FROM companies WHERE id = ?',
  )
    .bind(id)
    .first<CompanyRow>();

  if (!company) return c.json({ error: 'not_found' }, 404);

  const snapshot = await c.env.DB.prepare(
    'SELECT * FROM tech_snapshots WHERE company_id = ? ORDER BY detected_at DESC LIMIT 1',
  )
    .bind(id)
    .first<TechSnapshotRow>();

  return c.json({
    data: hydrateCompany(company),
    latest_snapshot: snapshot ? hydrateSnapshot(snapshot) : null,
  });
});

// DELETE /api/companies/:id — remove company (cascade handled by FK).
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT id FROM companies WHERE id = ?',
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();
  return c.json({ deleted: true, id });
});

// POST /api/companies/:id/scan — manually queue a scan.
app.post('/:id/scan', async (c) => {
  const id = c.req.param('id');
  const company = await c.env.DB.prepare(
    'SELECT id, domain FROM companies WHERE id = ?',
  )
    .bind(id)
    .first<{ id: string; domain: string }>();

  if (!company) return c.json({ error: 'not_found' }, 404);

  const message: ScanQueueMessage = {
    companyId: company.id,
    domain: company.domain,
    retryCount: 0,
  };
  await c.env.SCAN_QUEUE.send(message);

  await c.env.DB.prepare(
    'UPDATE companies SET scan_status = ? WHERE id = ?',
  )
    .bind('pending', id)
    .run();

  return c.json({ queued: true, company_id: id, domain: company.domain });
});

export default app;
