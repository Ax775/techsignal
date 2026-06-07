import Stripe from 'stripe';
import type { Env } from '../types/env';

/**
 * Build a Stripe client wired for the Cloudflare Workers runtime.
 *
 * The default Stripe SDK assumes Node's `http`/`crypto`; on Workers we must
 * swap in the fetch-based HTTP client. Webhook signature verification
 * additionally needs the SubtleCrypto provider — see {@link constructWebhookEvent}.
 */
export function stripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    // Pin to the version the installed SDK is built against, so behaviour stays
    // stable and the typings line up.
    apiVersion: '2023-10-16',
  });
}

/**
 * Verify a Stripe webhook payload and return the parsed event.
 *
 * Uses the async, SubtleCrypto-backed verifier because Workers has no
 * synchronous `crypto` HMAC. Throws if the signature does not match — callers
 * should translate that into a 400.
 */
export function constructWebhookEvent(
  env: Env,
  payload: string,
  signature: string,
): Promise<Stripe.Event> {
  const stripe = stripeClient(env);
  return stripe.webhooks.constructEventAsync(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
