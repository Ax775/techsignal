import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithStealth, USER_AGENTS } from '../services/crawler';

// ---------------------------------------------------------------------------
// All tests mock globalThis.fetch so no real network traffic occurs.
// ---------------------------------------------------------------------------

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function uaOf(call: unknown[]): string {
  const init = call[1] as RequestInit;
  const headers = init.headers as Record<string, string>;
  return headers['User-Agent'];
}

describe('fetchWithStealth', () => {
  it('rotates User-Agent headers (not always the same)', async () => {
    const fetchMock = vi.fn(async () => new Response('<html>ok</html>', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // pickUserAgent() derives its index from Date.now()/1000 % USER_AGENTS.length.
    // Advance the mocked clock by one second per call so the index moves.
    const nowSpy = vi.spyOn(Date, 'now');
    const seen = new Set<string>();
    for (let i = 0; i < USER_AGENTS.length; i++) {
      nowSpy.mockReturnValue(i * 1000);
      await fetchWithStealth('https://example.com');
    }

    const uas = fetchMock.mock.calls.map(uaOf);
    uas.forEach((ua) => seen.add(ua));
    expect(seen.size).toBeGreaterThan(1);
    // Every UA used must be a known, realistic browser string.
    uas.forEach((ua) => expect(USER_AGENTS).toContain(ua));
  });

  it('returns error result on 403 without throwing', async () => {
    globalThis.fetch = vi.fn(async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch;
    const res = await fetchWithStealth('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.error).toBe('http_403');
    expect(res.html).toBeNull();
  });

  it('returns error result on 404 without throwing', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    const res = await fetchWithStealth('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.error).toBe('http_404');
  });

  it('returns error result on 500 without throwing', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
    const res = await fetchWithStealth('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(res.error).toBe('http_500');
  });

  it('follows redirects up to max 3', async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call += 1;
      if (call <= 3) {
        return new Response(null, {
          status: 302,
          headers: { location: `https://example.com/step${call}` },
        });
      }
      return new Response('<html>final</html>', { status: 200 });
    }) as unknown as typeof fetch;

    const res = await fetchWithStealth('https://example.com');
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.redirectCount).toBe(3);
    expect(res.html).toContain('final');
  });

  it('stops following redirects after 3 levels', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/loop' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await fetchWithStealth('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('too_many_redirects');
    expect(res.redirectCount).toBe(3);
    // 4th fetch is what trips the limit; never a 5th.
    expect(fetchMock.mock.calls.length).toBe(4);
  });

  it('respects timeout (AbortController)', async () => {
    // fetch that never resolves until its abort signal fires.
    globalThis.fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;

    const res = await fetchWithStealth('https://slow.example.com', 50);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toBe('timeout');
  });

  it('blocks private IP addresses (SSRF protection)', async () => {
    const fetchMock = vi.fn(async () => new Response('should not happen', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    for (const target of [
      'http://192.168.1.1',
      'http://10.0.0.5',
      'http://169.254.169.254/latest/meta-data/', // cloud metadata endpoint
      'http://172.16.0.1',
    ]) {
      const res = await fetchWithStealth(target);
      expect(res.ok).toBe(false);
      expect(res.error).toBe('blocked_private_address');
    }
    // The guard runs BEFORE any network call.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks localhost', async () => {
    const fetchMock = vi.fn(async () => new Response('should not happen', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    for (const target of ['http://localhost', 'http://localhost:8080', 'http://127.0.0.1']) {
      const res = await fetchWithStealth(target);
      expect(res.ok).toBe(false);
      expect(res.error).toBe('blocked_private_address');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a public host that redirects to an internal address', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await fetchWithStealth('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('blocked_private_address');
    // One fetch to the public host; the internal redirect target is never fetched.
    expect(fetchMock.mock.calls.length).toBe(1);
  });
});
