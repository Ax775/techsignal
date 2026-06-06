-- TechSignal Platform: initial schema

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  domain TEXT NOT NULL UNIQUE,
  company_name TEXT,
  current_tech_stack TEXT NOT NULL DEFAULT '{}',
  last_scanned_at TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','scanning','done','error')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_scan_status ON companies(scan_status);
CREATE INDEX IF NOT EXISTS idx_companies_last_scanned ON companies(last_scanned_at DESC);

CREATE TABLE IF NOT EXISTS tech_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tech_signature TEXT NOT NULL,  -- JSON array of detected tech keys
  html_hash TEXT NOT NULL,       -- SHA-256 of page content
  http_headers TEXT NOT NULL DEFAULT '{}',  -- JSON of relevant headers
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_company ON tech_snapshots(company_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS intent_signals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('churn','adoption','vulnerability')),
  tech_involved TEXT NOT NULL,   -- e.g. 'HubSpot' or 'WooCommerce→Shopify'
  description TEXT NOT NULL,
  generated_pitch TEXT,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','unlocked')),
  price REAL NOT NULL DEFAULT 49.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_signals_company ON intent_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON intent_signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_type ON intent_signals(change_type);
CREATE INDEX IF NOT EXISTS idx_signals_created ON intent_signals(created_at DESC);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error','success')),
  payload TEXT,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON system_logs(ts DESC);
