import type { Env, ScanQueueMessage } from '../types/env';

interface DueCompany {
  id: string;
  domain: string;
}

/**
 * Cron entrypoint (runs every 6 hours per wrangler.toml).
 * Dispatches up to 50 of the least-recently-scanned companies onto the scan
 * queue. Companies currently mid-scan are skipped to avoid duplicate work.
 */
export async function handleCron(env: Env): Promise<{ dispatched: number }> {
  const { results } = await env.DB.prepare(
    `SELECT id, domain
       FROM companies
      WHERE scan_status != 'scanning'
      ORDER BY (last_scanned_at IS NULL) DESC, last_scanned_at ASC
      LIMIT 50`,
  ).all<DueCompany>();

  const companies = results ?? [];
  let dispatched = 0;

  for (const company of companies) {
    const message: ScanQueueMessage = {
      companyId: company.id,
      domain: company.domain,
      retryCount: 0,
    };
    try {
      await env.SCAN_QUEUE.send(message);
      dispatched += 1;
    } catch {
      // If a single enqueue fails, keep dispatching the rest.
    }
  }

  try {
    await env.DB.prepare(
      'INSERT INTO system_logs (event, level, payload) VALUES (?, ?, ?)',
    )
      .bind(
        'cron_dispatch',
        'info',
        JSON.stringify({ dispatched, candidates: companies.length }),
      )
      .run();
  } catch {
    // Logging is best-effort.
  }

  return { dispatched };
}
