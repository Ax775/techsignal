// Stealth HTTP fetcher for technographic crawling.
//
// Goals:
//  - Rotate realistic browser User-Agent strings.
//  - Manual redirect following (max 3) so we can record the redirect chain.
//  - Hard timeout via AbortController.
//  - Never throw on HTTP errors / network failures — always resolve to a
//    structured CrawlResponse so the queue consumer can degrade gracefully.

export interface CrawlResponse {
  ok: boolean;
  status: number;
  html: string | null;
  headers: Record<string, string>;
  finalUrl: string;
  redirectCount: number;
  error?: string;
}

export const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2_000_000; // 2 MB cap to bound memory

function pickUserAgent(): string {
  // Index derived from current time; randomness source is not required for
  // correctness, only for spreading load across UA strings.
  const idx = Math.floor((Date.now() / 1000) % USER_AGENTS.length);
  return USER_AGENTS[idx] ?? USER_AGENTS[0]!;
}

function buildHeaders(): HeadersInit {
  // No Cookie header is ever sent (and Workers fetch never attaches cookies
  // automatically), so crawls carry no session/identity state.
  return {
    'User-Agent': pickUserAgent(),
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * SSRF guard. Blocks loopback, private/RFC1918, link-local and CGNAT IPv4
 * ranges, IPv6 loopback/ULA/link-local, plus `localhost` and `.local` names.
 * Applied to the initial target AND to every redirect hop, so a public host
 * cannot redirect us at an internal address.
 */
export function isBlockedHost(hostname: string): boolean {
  let h = hostname.toLowerCase().replace(/\.$/, '');
  // Strip IPv6 brackets if present.
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);

  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local')) return true;

  // IPv4 literal.
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map((n) => Number.parseInt(n, 10));
    if (octets.some((n) => n > 255)) return true; // malformed → block
    const [a, b] = octets as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true; // this-host, RFC1918, loopback
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 literal (loopback, unique-local fc00::/7, link-local fe80::/10).
  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true;
    if (/^f[cd][0-9a-f]*:/.test(h)) return true;
    if (/^fe[89ab][0-9a-f]*:/.test(h)) return true;
    return false;
  }

  return false;
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function resolveLocation(location: string, base: string): string | null {
  try {
    return new URL(location, base).toString();
  } catch {
    return null;
  }
}

function normalizeUrl(domainOrUrl: string): string {
  if (/^https?:\/\//i.test(domainOrUrl)) return domainOrUrl;
  return `https://${domainOrUrl}`;
}

function blockedResponse(
  url: string,
  redirectCount: number,
  lastHeaders: Record<string, string>,
  error: string,
): CrawlResponse {
  return {
    ok: false,
    status: 0,
    html: null,
    headers: lastHeaders,
    finalUrl: url,
    redirectCount,
    error,
  };
}

/**
 * Read a response body but stop once MAX_BODY_BYTES have been consumed —
 * actually halting the download rather than buffering everything and slicing
 * afterwards, so an oversized/hostile response cannot exhaust memory.
 */
async function readBodyCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  // Concatenate up to the cap.
  const out = new Uint8Array(Math.min(total, MAX_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = out.length - offset;
    if (remaining <= 0) break;
    const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    out.set(slice, offset);
    offset += slice.length;
  }
  return new TextDecoder().decode(out);
}

/**
 * Fetch a URL with stealth headers, manual redirect handling and a timeout.
 * Always resolves; never rejects.
 */
export async function fetchWithStealth(
  url: string,
  timeout = 5000,
): Promise<CrawlResponse> {
  let currentUrl = normalizeUrl(url);
  let redirectCount = 0;
  let lastHeaders: Record<string, string> = {};

  while (redirectCount <= MAX_REDIRECTS) {
    // SSRF guard — validate the URL (and every redirect target) before fetching.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      return blockedResponse(currentUrl, redirectCount, lastHeaders, 'invalid_url');
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return blockedResponse(
        currentUrl,
        redirectCount,
        lastHeaders,
        'blocked_scheme',
      );
    }
    if (isBlockedHost(parsedUrl.hostname)) {
      return blockedResponse(
        currentUrl,
        redirectCount,
        lastHeaders,
        'blocked_private_address',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        headers: buildHeaders(),
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timer);

      lastHeaders = headersToObject(res.headers);

      // Manual redirect handling.
      const isRedirect =
        res.status >= 300 &&
        res.status < 400 &&
        res.headers.has('location');

      if (isRedirect) {
        const loc = res.headers.get('location') ?? '';
        const next = resolveLocation(loc, currentUrl);
        if (!next) {
          return {
            ok: false,
            status: res.status,
            html: null,
            headers: lastHeaders,
            finalUrl: currentUrl,
            redirectCount,
            error: 'invalid_redirect_location',
          };
        }
        redirectCount += 1;
        if (redirectCount > MAX_REDIRECTS) {
          return {
            ok: false,
            status: res.status,
            html: null,
            headers: lastHeaders,
            finalUrl: currentUrl,
            redirectCount: redirectCount - 1,
            error: 'too_many_redirects',
          };
        }
        currentUrl = next;
        continue;
      }

      // Graceful handling of client/server errors — no throw.
      if (
        res.status === 403 ||
        res.status === 404 ||
        res.status === 410 ||
        res.status === 429 ||
        res.status >= 500
      ) {
        // Drain body to release the connection but don't keep it.
        await res.body?.cancel().catch(() => undefined);
        return {
          ok: false,
          status: res.status,
          html: null,
          headers: lastHeaders,
          finalUrl: currentUrl,
          redirectCount,
          error: `http_${res.status}`,
        };
      }

      const html = await readBodyCapped(res);
      return {
        ok: res.ok,
        status: res.status,
        html,
        headers: lastHeaders,
        finalUrl: currentUrl,
        redirectCount,
      };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        html: null,
        headers: lastHeaders,
        finalUrl: currentUrl,
        redirectCount,
        error: isAbort ? 'timeout' : 'network_error',
      };
    }
  }

  // Should be unreachable, but keeps the type-checker satisfied.
  return {
    ok: false,
    status: 0,
    html: null,
    headers: lastHeaders,
    finalUrl: currentUrl,
    redirectCount,
    error: 'too_many_redirects',
  };
}
