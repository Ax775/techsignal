import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tech taxonomy
// ---------------------------------------------------------------------------

export type TechCategory =
  | 'ecommerce'
  | 'martech'
  | 'infrastructure'
  | 'analytics'
  | 'cms';

export interface TechStack {
  ecommerce: string[];
  martech: string[];
  infrastructure: string[];
  analytics: string[];
  cms: string[];
}

export function emptyTechStack(): TechStack {
  return {
    ecommerce: [],
    martech: [],
    infrastructure: [],
    analytics: [],
    cms: [],
  };
}

export const TECH_CATEGORIES: TechCategory[] = [
  'ecommerce',
  'martech',
  'infrastructure',
  'analytics',
  'cms',
];

// ---------------------------------------------------------------------------
// Database row shapes (as stored / returned by D1)
// ---------------------------------------------------------------------------

export type ScanStatus = 'pending' | 'scanning' | 'done' | 'error';

/** Raw row as returned by D1 (JSON columns are still strings). */
export interface CompanyRow {
  id: string;
  domain: string;
  company_name: string | null;
  current_tech_stack: string; // JSON-encoded TechStack
  last_scanned_at: string | null;
  scan_status: ScanStatus;
  created_at: string;
}

/** Hydrated company (JSON columns parsed). */
export interface Company {
  id: string;
  domain: string;
  company_name: string | null;
  current_tech_stack: TechStack;
  last_scanned_at: string | null;
  scan_status: ScanStatus;
  created_at: string;
}

export interface TechSnapshotRow {
  id: string;
  company_id: string;
  tech_signature: string; // JSON-encoded string[]
  html_hash: string;
  http_headers: string; // JSON-encoded Record<string,string>
  detected_at: string;
}

export interface TechSnapshot {
  id: string;
  company_id: string;
  tech_signature: string[];
  html_hash: string;
  http_headers: Record<string, string>;
  detected_at: string;
}

export type ChangeType = 'churn' | 'adoption' | 'vulnerability';
export type SignalStatus = 'locked' | 'unlocked';

export interface IntentSignalRow {
  id: string;
  company_id: string;
  change_type: ChangeType;
  tech_involved: string;
  description: string;
  generated_pitch: string | null;
  status: SignalStatus;
  price: number;
  created_at: string;
}

/** Intent signal joined with parent company domain for convenience. */
export interface IntentSignal extends IntentSignalRow {
  domain?: string;
  company_name?: string | null;
}

export interface SystemLogRow {
  id: string;
  event: string;
  level: 'info' | 'warn' | 'error' | 'success';
  payload: string | null;
  ts: string;
}

// ---------------------------------------------------------------------------
// Crawler / parser results
// ---------------------------------------------------------------------------

export interface ScanResult {
  domain: string;
  stack: TechStack;
  signature: string[];
  htmlHash: string;
  headers: Record<string, string>;
  ok: boolean;
  status: number;
}

// ---------------------------------------------------------------------------
// Differ output
// ---------------------------------------------------------------------------

export interface ChangeEvent {
  type: ChangeType;
  tech: string;
  category?: TechCategory;
  from?: TechStack;
  to?: TechStack;
  description?: string;
}

// ---------------------------------------------------------------------------
// Hydration helpers
// ---------------------------------------------------------------------------

export function hydrateCompany(row: CompanyRow): Company {
  return {
    ...row,
    current_tech_stack: safeParseTechStack(row.current_tech_stack),
  };
}

export function hydrateSnapshot(row: TechSnapshotRow): TechSnapshot {
  return {
    ...row,
    tech_signature: safeParseStringArray(row.tech_signature),
    http_headers: safeParseStringRecord(row.http_headers),
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function safeParseTechStack(raw: string): TechStack {
  const base = emptyTechStack();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof parsed !== 'object' || parsed === null) return base;
  const obj = parsed as Record<string, unknown>;
  for (const cat of TECH_CATEGORIES) {
    const val = obj[cat];
    if (isStringArray(val)) base[cat] = val;
  }
  return base;
}

export function safeParseStringArray(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return isStringArray(parsed) ? parsed : [];
}

export function safeParseStringRecord(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zod schemas for request validation
// ---------------------------------------------------------------------------

const domainRegex =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Normalize raw user input to a bare host:
 *  - strip protocol (http://, https://)
 *  - lowercase
 *  - drop a leading `www.`
 *  - strip any path / query / fragment (and the trailing slash with it)
 *  - strip an explicit port
 */
function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/[/?#].*$/, '');
  d = d.replace(/:\d+$/, '');
  d = d.replace(/\.$/, ''); // drop a trailing root-zone dot
  return d;
}

/**
 * Reject hosts that must never be scanned: loopback/internal names, IP
 * literals, and non-public TLDs. The {@link domainRegex} already rejects bare
 * hostnames (no dot) and IPv4 literals (numeric TLD), but these are blocked
 * explicitly so the intent is unmistakable and `.local` / IPv6 are covered.
 */
function isDisallowedHost(d: string): boolean {
  if (d === 'localhost' || d.endsWith('.localhost')) return true;
  if (d.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return true; // IPv4 literal
  if (d.includes(':')) return true; // IPv6 literal or leftover port
  return false;
}

/** Shared, hardened domain field: normalized then FQDN-validated. */
const domainField = z
  .string()
  .min(3)
  .max(253)
  .transform(normalizeDomain)
  .refine((d) => domainRegex.test(d) && !isDisallowedHost(d), {
    message: 'Invalid or disallowed domain',
  });

export const AddCompanySchema = z.object({
  domain: domainField,
  company_name: z.string().trim().min(1).max(200).optional(),
});
export type AddCompanyInput = z.infer<typeof AddCompanySchema>;

export const ScanSchema = z.object({
  domain: domainField,
});
export type ScanInput = z.infer<typeof ScanSchema>;

export const UnlockSchema = z.object({
  payment_ref: z.string().trim().min(1, 'payment_ref is required').max(200),
});
export type UnlockInput = z.infer<typeof UnlockSchema>;

export const CheckoutSchema = z.object({
  signal_id: z.string().trim().min(1, 'signal_id is required').max(100),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export { normalizeDomain };
