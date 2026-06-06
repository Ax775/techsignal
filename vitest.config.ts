import { defineConfig } from 'vitest/config';

// NOTE: The units under test (parser, differ, kv-hash, ai-pitch, crawler) rely
// only on standard Web Platform APIs (crypto.subtle, fetch, AbortController,
// URL) that are available natively in the Node runtime. We therefore run them
// under plain Vitest (node environment) rather than the Cloudflare Workers pool.
//
// The Workers pool (@cloudflare/vitest-pool-workers) is installed and ready, but
// wrangler.toml currently ships placeholder D1/KV ids plus a queue consumer,
// which makes the miniflare-backed pool brittle to boot for pure-logic units.
// See the project README/test report for the rationale and how to switch back.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    globals: false,
  },
});
