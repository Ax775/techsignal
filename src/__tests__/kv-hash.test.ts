import { describe, expect, it } from 'vitest';
import { hasChanged, sha256 } from '../services/kv-hash';

/**
 * Minimal in-memory stand-in for a Cloudflare KVNamespace. Only the methods the
 * code under test calls (get/put) are implemented; the rest throw so an
 * accidental dependency surfaces loudly.
 */
function makeKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, string>(Object.entries(initial));
  const kv = {
    async get(key: string): Promise<string | null> {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
  };
  return kv as unknown as KVNamespace;
}

describe('sha256', () => {
  it('returns hex string', async () => {
    const hash = await sha256('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same input = same hash', async () => {
    const a = await sha256('TechSignal');
    const b = await sha256('TechSignal');
    expect(a).toBe(b);
  });

  it('different input = different hash', async () => {
    const a = await sha256('TechSignal');
    const b = await sha256('TechSignai');
    expect(a).not.toBe(b);
  });

  it('handles empty string', async () => {
    const hash = await sha256('');
    // Well-known SHA-256 of the empty string.
    expect(hash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('handles unicode characters', async () => {
    const hash = await sha256('héllo 世界 🚀 café');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic across runs.
    expect(hash).toBe(await sha256('héllo 世界 🚀 café'));
  });
});

describe('hasChanged', () => {
  it('returns true when no previous hash stored', async () => {
    const kv = makeKV();
    expect(await hasChanged(kv, 'example.com', 'some content')).toBe(true);
  });

  it('returns false when content unchanged', async () => {
    const content = '<html>stable</html>';
    const stored = await sha256(content);
    const kv = makeKV({ 'hash:example.com': stored });
    expect(await hasChanged(kv, 'example.com', content)).toBe(false);
  });

  it('returns true when content changed', async () => {
    const stored = await sha256('<html>old</html>');
    const kv = makeKV({ 'hash:example.com': stored });
    expect(await hasChanged(kv, 'example.com', '<html>new</html>')).toBe(true);
  });

  it('is case-insensitive on the domain key', async () => {
    const content = 'abc';
    const kv = makeKV({ 'hash:example.com': await sha256(content) });
    // Stored under lowercase; querying with uppercase must still match.
    expect(await hasChanged(kv, 'EXAMPLE.com', content)).toBe(false);
  });
});
