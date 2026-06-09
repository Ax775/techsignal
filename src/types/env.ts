export interface Env {
  DB: D1Database;
  HASH_STORE: KVNamespace;
  SCAN_QUEUE: Queue<ScanQueueMessage>;
  AI_API_KEY: string;
  /** Admin API key for mutating routes (wrangler secret). */
  ADMIN_KEY: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  UNLOCK_PRICE_EUR: string;
  /** Stripe API secret key (wrangler secret). */
  STRIPE_SECRET_KEY: string;
  /** Stripe publishable key (wrangler secret). */
  STRIPE_PUBLISHABLE_KEY: string;
  /** Stripe webhook signing secret (wrangler secret). */
  STRIPE_WEBHOOK_SECRET: string;
  /** Public dashboard origin, used to build Checkout success/cancel URLs. */
  DASHBOARD_URL: string;
  /** Resend API key for payment-notification emails (wrangler secret). */
  RESEND_API_KEY: string;
}

export interface ScanQueueMessage {
  companyId: string;
  domain: string;
  retryCount: number;
}
