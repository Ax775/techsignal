import { Hono } from 'hono';
import type { Env } from '../types/env';
import { CheckoutSchema, type IntentSignalRow } from '../types/domain';
import { stripeClient } from '../lib/stripe';

const app = new Hono<{ Bindings: Env }>();

interface SignalJoinRow extends IntentSignalRow {
  domain: string;
  company_name: string | null;
}

// POST /api/checkout — body: { signal_id }
// Creates a Stripe Checkout Session for unlocking a single intent signal and
// returns its hosted-page URL. The signal is only flipped to `unlocked` later,
// by the webhook, after Stripe confirms the payment completed.
app.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'validation_error', issues: parsed.error.flatten() },
      400,
    );
  }

  const signal = await c.env.DB.prepare(
    `SELECT s.*, c.domain AS domain, c.company_name AS company_name
       FROM intent_signals s
       JOIN companies c ON c.id = s.company_id
      WHERE s.id = ?`,
  )
    .bind(parsed.data.signal_id)
    .first<SignalJoinRow>();

  if (!signal) return c.json({ error: 'not_found' }, 404);
  if (signal.status !== 'locked') {
    return c.json({ error: 'already_unlocked' }, 409);
  }

  // Derive the amount from the signal's own price (cents). For the default
  // €49 signal this is exactly 4900.
  const unitAmount = Math.round(signal.price * 100);
  const dashboardUrl = c.env.DASHBOARD_URL.replace(/\/+$/, '');

  let session;
  try {
    const stripe = stripeClient(c.env);
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: unitAmount,
            product_data: {
              name: `Intent Signal Unlock — ${signal.domain}`,
            },
          },
        },
      ],
      success_url: `${dashboardUrl}/unlock/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: dashboardUrl,
      metadata: { signal_id: signal.id },
    });
  } catch (err) {
    console.error('stripe_checkout_create_failed', err);
    return c.json({ error: 'checkout_failed' }, 502);
  }

  if (!session.url) {
    return c.json({ error: 'checkout_failed' }, 502);
  }

  try {
    await c.env.DB.prepare(
      'INSERT INTO system_logs (event, level, payload) VALUES (?, ?, ?)',
    )
      .bind(
        'checkout_session_created',
        'info',
        JSON.stringify({ signal_id: signal.id, session_id: session.id }),
      )
      .run();
  } catch {
    // best-effort logging
  }

  return c.json({ url: session.url });
});

export default app;
