import type { Env, ScanQueueMessage } from '../types/env';
import {
  safeParseTechStack,
  type ChangeEvent,
  type TechSnapshotRow,
  type CompanyRow,
  type TechStack,
} from '../types/domain';
import { fetchWithStealth } from '../services/crawler';
import { parseTechStack, techStackToSignature } from '../services/parser';
import { sha256, hasChanged, setStoredHash } from '../services/kv-hash';
import {
  diffTechStacks,
  detectVulnerabilitySignals,
} from '../services/differ';
import { generatePitch } from '../services/ai-pitch';

async function logEvent(
  env: Env,
  event: string,
  level: 'info' | 'warn' | 'error' | 'success',
  payload: unknown,
): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO system_logs (event, level, payload) VALUES (?, ?, ?)',
    )
      .bind(event, level, payload === undefined ? null : JSON.stringify(payload))
      .run();
  } catch {
    // Logging must never break the pipeline.
  }
}

async function setStatus(
  env: Env,
  companyId: string,
  status: 'pending' | 'scanning' | 'done' | 'error',
): Promise<void> {
  await env.DB.prepare(
    'UPDATE companies SET scan_status = ? WHERE id = ?',
  )
    .bind(status, companyId)
    .run();
}

async function processMessage(
  env: Env,
  msg: ScanQueueMessage,
): Promise<void> {
  const { companyId, domain } = msg;

  await setStatus(env, companyId, 'scanning');

  const crawl = await fetchWithStealth(domain);

  if (!crawl.ok || crawl.html === null) {
    await setStatus(env, companyId, 'error');
    await env.DB.prepare(
      'UPDATE companies SET last_scanned_at = datetime(\'now\') WHERE id = ?',
    )
      .bind(companyId)
      .run();
    await logEvent(env, 'scan_failed', 'warn', {
      domain,
      status: crawl.status,
      error: crawl.error,
    });
    return;
  }

  const stack = parseTechStack(crawl.html, crawl.headers);
  const signature = techStackToSignature(stack);
  const htmlHash = await sha256(crawl.html);

  const changed = await hasChanged(env.HASH_STORE, domain, crawl.html);

  if (!changed) {
    await env.DB.prepare(
      'UPDATE companies SET last_scanned_at = datetime(\'now\'), scan_status = ? WHERE id = ?',
    )
      .bind('done', companyId)
      .run();
    await logEvent(env, 'scan_unchanged', 'info', { domain });
    return;
  }

  // Content changed — persist new hash and run a deep diff.
  await setStoredHash(env.HASH_STORE, domain, crawl.html);

  // Fetch most recent prior snapshot (if any) for diffing.
  const prevRow = await env.DB.prepare(
    'SELECT * FROM tech_snapshots WHERE company_id = ? ORDER BY detected_at DESC LIMIT 1',
  )
    .bind(companyId)
    .first<TechSnapshotRow>();

  const events: ChangeEvent[] = [];
  let prevStack: TechStack | null = null;

  if (prevRow) {
    // Reconstruct the previous stack from the company row's stored stack,
    // which represents the last fully-scanned state.
    const companyRow = await env.DB.prepare(
      'SELECT current_tech_stack FROM companies WHERE id = ?',
    )
      .bind(companyId)
      .first<Pick<CompanyRow, 'current_tech_stack'>>();
    prevStack = safeParseTechStack(companyRow?.current_tech_stack ?? '{}');
    events.push(...diffTechStacks(prevStack, stack));
  }

  // Vulnerability signals reflect an ongoing risk state, not a point-in-time
  // event. Emit only those that are NEWLY applicable since the previous scan —
  // otherwise a persistent risk (e.g. Magento without a WAF) would mint a fresh
  // paid signal on every scan where unrelated page content changed, growing
  // intent_signals without bound. On the first scan (no prior stack) every
  // current risk is emitted once.
  const currVulns = detectVulnerabilitySignals(stack);
  if (prevStack) {
    const prevVulnTechs = new Set(
      detectVulnerabilitySignals(prevStack).map((v) => v.tech),
    );
    events.push(...currVulns.filter((v) => !prevVulnTechs.has(v.tech)));
  } else {
    events.push(...currVulns);
  }

  // Insert the new snapshot.
  await env.DB.prepare(
    'INSERT INTO tech_snapshots (company_id, tech_signature, html_hash, http_headers) VALUES (?, ?, ?, ?)',
  )
    .bind(
      companyId,
      JSON.stringify(signature),
      htmlHash,
      JSON.stringify(filterHeaders(crawl.headers)),
    )
    .run();

  // Update the company's current stack + scan metadata.
  await env.DB.prepare(
    'UPDATE companies SET current_tech_stack = ?, last_scanned_at = datetime(\'now\'), scan_status = ? WHERE id = ?',
  )
    .bind(JSON.stringify(stack), 'done', companyId)
    .run();

  // Resolve the company name once for pitch personalization.
  const company = await env.DB.prepare(
    'SELECT company_name FROM companies WHERE id = ?',
  )
    .bind(companyId)
    .first<{ company_name: string | null }>();

  const price = Number.parseFloat(env.UNLOCK_PRICE_EUR ?? '49') || 49;

  for (const ev of events) {
    const techInvolved = ev.tech;
    const description =
      ev.description ?? `${ev.tech} change detected (${ev.type}).`;
    const pitch = await generatePitch(
      {
        domain,
        companyName: company?.company_name ?? null,
        changeType: ev.type,
        techInvolved,
        description,
      },
      env.AI_API_KEY,
    );

    await env.DB.prepare(
      'INSERT INTO intent_signals (company_id, change_type, tech_involved, description, generated_pitch, status, price) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        companyId,
        ev.type,
        techInvolved,
        description,
        pitch,
        'locked',
        price,
      )
      .run();
  }

  await logEvent(env, 'scan_complete', 'success', {
    domain,
    signals: events.length,
    signature,
  });
}

/**
 * Keep only non-PII, infrastructure-relevant response headers. Strips
 * cookies and anything that could carry personal data.
 */
function filterHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const allow = new Set([
    'server',
    'cf-ray',
    'x-powered-by',
    'via',
    'x-amz-cf-id',
    'x-amz-request-id',
    'content-type',
    'x-served-by',
    'x-cache',
    'x-shopify-stage',
    'x-drupal-cache',
  ]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (allow.has(k.toLowerCase())) out[k.toLowerCase()] = v;
  }
  return out;
}

/**
 * Queue consumer entrypoint. Each message is isolated in its own try/catch so
 * a single failure neither aborts the batch nor blocks unrelated companies.
 */
export async function handleScanQueue(
  batch: MessageBatch<ScanQueueMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processMessage(env, message.body);
      message.ack();
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      await logEvent(env, 'scan_exception', 'error', {
        domain: message.body?.domain,
        reason,
      });
      try {
        if (message.body?.companyId) {
          await setStatus(env, message.body.companyId, 'error');
        }
      } catch {
        // ignore secondary failure
      }
      // Retry up to the queue's max_retries; after that it lands in the DLQ.
      message.retry();
    }
  }
}
