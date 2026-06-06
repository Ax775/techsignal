import { Hono } from 'hono';
import type { Env, ScanQueueMessage } from '../types/env';
import { ScanSchema, type CompanyRow } from '../types/domain';

const app = new Hono<{ Bindings: Env }>();

// POST /api/scan — upsert company by domain, enqueue a scan, return job id.
app.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'validation_error', issues: parsed.error.flatten() },
      400,
    );
  }

  const { domain } = parsed.data;

  // Upsert: insert if missing, otherwise reuse the existing row.
  await c.env.DB.prepare(
    'INSERT INTO companies (domain) VALUES (?) ON CONFLICT(domain) DO NOTHING',
  )
    .bind(domain)
    .run();

  const company = await c.env.DB.prepare(
    'SELECT * FROM companies WHERE domain = ?',
  )
    .bind(domain)
    .first<CompanyRow>();

  if (!company) return c.json({ error: 'Internal server error' }, 500);

  const message: ScanQueueMessage = {
    companyId: company.id,
    domain: company.domain,
    retryCount: 0,
  };
  await c.env.SCAN_QUEUE.send(message);

  await c.env.DB.prepare(
    'UPDATE companies SET scan_status = ? WHERE id = ?',
  )
    .bind('pending', company.id)
    .run();

  return c.json({ job_id: company.id, domain, status: 'pending' }, 202);
});

// GET /api/scan/status/:id — current scan status for a company.
app.get('/status/:id', async (c) => {
  const id = c.req.param('id');
  const company = await c.env.DB.prepare(
    'SELECT id, domain, scan_status, last_scanned_at FROM companies WHERE id = ?',
  )
    .bind(id)
    .first<{
      id: string;
      domain: string;
      scan_status: string;
      last_scanned_at: string | null;
    }>();

  if (!company) return c.json({ error: 'not_found' }, 404);

  return c.json({
    job_id: company.id,
    domain: company.domain,
    status: company.scan_status,
    last_scanned_at: company.last_scanned_at,
  });
});

export default app;
