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

export type ScanStatus = 'pending' | 'scanning' | 'done' | 'error';

export interface Company {
  id: string;
  domain: string;
  company_name: string | null;
  current_tech_stack: TechStack;
  last_scanned_at: string | null;
  scan_status: ScanStatus;
  created_at: string;
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

export interface IntentSignal {
  id: string;
  company_id: string;
  change_type: ChangeType;
  tech_involved: string;
  description: string;
  generated_pitch: string | null;
  status: SignalStatus;
  price: number;
  created_at: string;
  domain?: string;
  company_name?: string | null;
}

export interface SystemLog {
  id: string;
  event: string;
  level: 'info' | 'warn' | 'error' | 'success';
  payload: string | null;
  ts: string;
}

export interface SignalsResponse {
  data: IntentSignal[];
  total: number;
  page: number;
  limit: number;
}

export interface CompaniesResponse {
  data: Company[];
  total: number;
  page: number;
  limit: number;
}

export interface SignalFilters {
  change_type?: ChangeType;
  status?: SignalStatus;
  company_id?: string;
  page?: number;
  limit?: number;
}

export interface CompanyParams {
  page?: number;
  limit?: number;
  search?: string;
}
