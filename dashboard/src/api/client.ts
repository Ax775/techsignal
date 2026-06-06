import type {
  CompaniesResponse,
  Company,
  CompanyParams,
  IntentSignal,
  SignalFilters,
  SignalsResponse,
  SystemLog,
} from '../types';

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export function getSignals(filters: SignalFilters = {}): Promise<SignalsResponse> {
  return request<SignalsResponse>(
    `/api/signals${qs({
      change_type: filters.change_type,
      status: filters.status,
      company_id: filters.company_id,
      page: filters.page,
      limit: filters.limit,
    })}`,
  );
}

export function getSignal(id: string): Promise<{ data: IntentSignal }> {
  return request<{ data: IntentSignal }>(`/api/signals/${encodeURIComponent(id)}`);
}

export function unlockSignal(
  id: string,
  paymentRef: string,
): Promise<{ data: IntentSignal; unlocked: boolean }> {
  return request(`/api/unlock/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ payment_ref: paymentRef }),
  });
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export function getCompanies(
  params: CompanyParams = {},
): Promise<CompaniesResponse> {
  return request<CompaniesResponse>(
    `/api/companies${qs({
      page: params.page,
      limit: params.limit,
      search: params.search,
    })}`,
  );
}

export function addCompany(
  domain: string,
  name?: string,
): Promise<{ data: Company; created: boolean }> {
  return request(`/api/companies`, {
    method: 'POST',
    body: JSON.stringify({ domain, company_name: name || undefined }),
  });
}

export function scanCompany(
  id: string,
): Promise<{ queued: boolean; company_id: string; domain: string }> {
  return request(`/api/companies/${encodeURIComponent(id)}/scan`, {
    method: 'POST',
  });
}

export function deleteCompany(id: string): Promise<{ deleted: boolean }> {
  return request(`/api/companies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Scan (by domain)
// ---------------------------------------------------------------------------

export function triggerScan(
  domain: string,
): Promise<{ job_id: string; domain: string; status: string }> {
  return request(`/api/scan`, {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
}

export function getScanStatus(
  id: string,
): Promise<{ job_id: string; domain: string; status: string }> {
  return request(`/api/scan/status/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export function getLogs(limit = 50): Promise<{ data: SystemLog[] }> {
  return request<{ data: SystemLog[] }>(`/api/health/logs${qs({ limit })}`);
}

export { ApiError };
