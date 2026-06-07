import { Hono } from 'hono';
import type Stripe from 'stripe';
import type { Env } from '../types/env';
import { constructWebhookEvent } from '../lib/stripe';

const app = new Hono<{ Bindings: Env }>();

// POST /api/webhook — Stripe webhook receiver.
// Authentication is the Stripe signature, not the admin key, so this route is
// on the public-prefix allow-list. The raw request body is required for
// signature verification, so we read it as text before any JSON parsing.
app.post('/', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'missing_signature' }, 400);
  }

  const payload = await c.req.text();

  let event: Stripe.Event;
  try {
    event = await constructWebhookEvent(c.env, payload, signature);
  } catch (err) {
    console.error('stripe_webhook_signature_invalid', err);
    return c.json({ error: 'invalid_signature' }, 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const signalId = session.metadata?.signal_id;

    if (signalId) {
      await c.env.DB.prepare(
        "UPDATE intent_signals SET status = 'unlocked' WHERE id = ?",
      )
        .bind(signalId)
        .run();

      try {
        await c.env.DB.prepare(
          'INSERT INTO system_logs (event, level, payload) VALUES (?, ?, ?)',
        )
          .bind(
            'signal_unlocked',
            'success',
            JSON.stringify({
              signal_id: signalId,
              session_id: session.id,
              amount_total: session.amount_total,
            }),
          )
          .run();
      } catch {
        // best-effort logging
      }
    } else {
      console.error('stripe_webhook_missing_signal_id', { id: session.id });
    }
  }

  // Acknowledge all events (handled or not) so Stripe stops retrying.
  return c.json({ received: true });
});

export default app;
