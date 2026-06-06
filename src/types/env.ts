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
}

export interface ScanQueueMessage {
  companyId: string;
  domain: string;
  retryCount: number;
}
