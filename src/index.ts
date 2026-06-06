import { Hono } from 'hono';
import type { Env, ScanQueueMessage } from './types/env';
import { cors } from './middleware/cors';
import { rateLimit } from './middleware/rate-limit';
import { adminAuth } from './middleware/auth';
import { securityHeaders } from './middleware/security-headers';
import companies from './routes/companies';
import signals from './routes/signals';
import unlock from './routes/unlock';
import scan from './routes/scan';
import health from './routes/health';
import { handleScanQueue } from './queue/consumer';
import { handleCron } from './cron/scheduler';

const app = new Hono<{ Bindings: Env }>();

// Security headers wrap every response (registered first so it also decorates
// CORS pre-flight and error responses).
app.use('*', securityHeaders());

// Global CORS for every route.
app.use('*', cors());

// Rate limiting on the API surface — global budget plus stricter per-endpoint
// limits for abuse-prone routes.
app.use('/api/*', rateLimit());
app.use('/api/scan', rateLimit({ name: 'scan', max: 10, windowSec: 60 }));
app.use('/api/scan/*', rateLimit({ name: 'scan', max: 10, windowSec: 60 }));
app.use('/api/unlock/*', rateLimit({ name: 'unlock', max: 3, windowSec: 60 }));

// Admin API-key auth on the API surface. Self-skips GET/HEAD and /api/health,
// so only mutating routes (POST/DELETE companies, POST scan, POST unlock) are
// gated.
app.use('/api/*', adminAuth());

// Mount feature routers.
app.route('/api/companies', companies);
app.route('/api/signals', signals);
app.route('/api/unlock', unlock);
app.route('/api/scan', scan);
app.route('/api/health', health);

app.get('/', (c) =>
  c.json({
    name: 'techsignal-worker',
    version: '1.0.0',
    docs: '/api/health',
  }),
);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  // Never leak internals (stack traces, messages) to clients; log
  // server-side and return a fixed, safe shape.
  console.error('unhandled_error', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<ScanQueueMessage>, env: Env): Promise<void> =>
    handleScanQueue(batch, env),
  scheduled: (
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): void => {
    ctx.waitUntil(handleCron(env));
  },
};
