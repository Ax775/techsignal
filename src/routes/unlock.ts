import { Hono } from 'hono';
import type { Env } from '../types/env';
import { UnlockSchema, type IntentSignalRow } from '../types/domain';

const app = new Hono<{ Bindings: Env }>();

interface SignalJoinRow extends IntentSignalRow {
  domain: string;
  company_name: string | null;
}

// POST /api/unlock/:id — body: { payment_ref }
// Mock payment: any non-empty payment_ref unlocks. In production this would
// verify a Stripe webhook signature or a server-side payment token before
// flipping status.
app.post('/:id', async (c) => {
  const id = c.req.param('id');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = UnlockSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'validation_error', issues: parsed.error.flatten() },
      400,
    );
  }

  const signal = await c.env.DB.prepare(
    'SELECT * FROM intent_signals WHERE id = ?',
  )
    .bind(id)
    .first<IntentSignalRow>();

  if (!signal) return c.json({ error: 'not_found' }, 404);

  if (signal.status !== 'unlocked') {
    await c.env.DB.prepare(
      'UPDATE intent_signals SET status = ? WHERE id = ?',
    )
      .bind('unlocked', id)
      .run();
  }

  const full = await c.env.DB.prepare(
    `SELECT s.*, c.domain AS domain, c.company_name AS company_name
       FROM intent_signals s
       JOIN companies c ON c.id = s.company_id
      WHERE s.id = ?`,
  )
    .bind(id)
    .first<SignalJoinRow>();

  try {
    await c.env.DB.prepare(
      'INSERT INTO system_logs (event, level, payload) VALUES (?, ?, ?)',
    )
      .bind(
        'signal_unlocked',
        'success',
        JSON.stringify({
          signal_id: id,
          payment_ref: parsed.data.payment_ref,
          price: signal.price,
        }),
      )
      .run();
  } catch {
    // best-effort logging
  }

  return c.json({ data: full, unlocked: true });
});

export default app;
