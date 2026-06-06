// Hash + KV state utilities using the Web Crypto API (available in Workers).

const HASH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** SHA-256 of a UTF-8 string, returned as lowercase hex. */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

function hashKey(domain: string): string {
  return `hash:${domain.toLowerCase()}`;
}

/** Read the previously-stored content hash for a domain, or null. */
export async function getStoredHash(
  kv: KVNamespace,
  domain: string,
): Promise<string | null> {
  return kv.get(hashKey(domain));
}

/** Persist a content hash for a domain with a 7-day TTL. */
export async function setStoredHash(
  kv: KVNamespace,
  domain: string,
  hash: string,
): Promise<void> {
  await kv.put(hashKey(domain), hash, { expirationTtl: HASH_TTL_SECONDS });
}

/**
 * Determine whether the supplied content differs from what we last stored.
 * Returns true if changed OR if no prior hash exists.
 *
 * NOTE: this does NOT update the store — the caller is responsible for
 * calling setStoredHash() once a full diff/scan has completed successfully.
 */
export async function hasChanged(
  kv: KVNamespace,
  domain: string,
  currentContent: string,
): Promise<boolean> {
  const current = await sha256(currentContent);
  const stored = await getStoredHash(kv, domain);
  if (stored === null) return true;
  return stored !== current;
}
