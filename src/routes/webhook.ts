import { Hono } from 'hono';
import { Resend } from 'resend';
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

  // Idempotency: Stripe may deliver the same event multiple times. Use KV as a
  // dedup store keyed on the event id so a retry never re-sends the payment
  // email or re-runs the unlock side effects.
  const eventKey = `stripe_event:${event.id}`;
  const seen = await c.env.HASH_STORE.get(eventKey);
  if (seen) return c.json({ received: true }); // already processed

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

      // Send email notification (fire-and-forget, never blocks the webhook).
      try {
        const signal = await c.env.DB.prepare(
          'SELECT * FROM intent_signals WHERE id = ?',
        )
          .bind(signalId)
          .first<{ company_id?: string; price?: number }>();
        const price = signal?.price ?? 49;
        const resend = new Resend(c.env.RESEND_API_KEY);
        await resend.emails.send({
          from: c.env.RESEND_FROM,
          to: c.env.NOTIFY_EMAIL,
          subject: `💰 Signal unlocked — €${price.toFixed(2)} received`,
          html: `
            <p><strong>New payment received on TechSignal</strong></p>
            <p>Signal ID: ${signalId}<br>
            Company: ${signal?.company_id ?? 'unknown'}<br>
            Amount: €${price.toFixed(2)}<br>
            Time: ${new Date().toISOString()}</p>
            <p><a href="${c.env.DASHBOARD_URL}">View dashboard →</a></p>
          `,
        });
      } catch {
        // non-fatal: notification failure must never fail the webhook
      }
    } else {
      console.error('stripe_webhook_missing_signal_id', { id: session.id });
    }
  }

  // Mark this event processed (7-day TTL) so duplicate deliveries are ignored.
  await c.env.HASH_STORE.put(eventKey, '1', { expirationTtl: 7 * 24 * 60 * 60 });

  // Acknowledge all events (handled or not) so Stripe stops retrying.
  return c.json({ received: true });
});

export default app;
