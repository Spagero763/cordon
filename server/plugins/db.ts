import { runMigrations } from "@agent-native/core/db";

const SHARES = (table: string) => `CREATE TABLE IF NOT EXISTS ${table} (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE INDEX IF NOT EXISTS ${table}_resource_idx ON ${table} (resource_id, principal_type, principal_id);`;

export default runMigrations(
  [
    {
      version: 1,
      name: "cordon-core",
      sql: `CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  repo TEXT,
  check_interval_minutes INTEGER NOT NULL DEFAULT 5,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  webhook_token TEXT NOT NULL,
  oncall_email TEXT,
  last_check_at TEXT,
  last_check_ok BOOLEAN,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE UNIQUE INDEX IF NOT EXISTS services_webhook_token_idx ON services (webhook_token);
CREATE INDEX IF NOT EXISTS services_org_name_idx ON services (org_id, name);
${SHARES("service_shares")}
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  checked_at TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  error TEXT,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS checks_service_time_idx ON checks (service_id, checked_at DESC);
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'sev3' CHECK (severity IN ('sev1','sev2','sev3','sev4')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  service_id TEXT REFERENCES services(id),
  commander_email TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','monitor','alert')),
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  summary TEXT,
  impact TEXT,
  root_cause TEXT,
  lessons TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE INDEX IF NOT EXISTS incidents_org_status_started_idx ON incidents (org_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS incidents_service_status_idx ON incidents (service_id, status);
${SHARES("incident_shares")}
CREATE TABLE IF NOT EXISTS timeline_entries (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  actor_email TEXT,
  actor_kind TEXT NOT NULL DEFAULT 'person' CHECK (actor_kind IN ('person','agent','monitor','webhook')),
  meta TEXT,
  created_at TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS timeline_incident_time_idx ON timeline_entries (incident_id, created_at);
CREATE TABLE IF NOT EXISTS status_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  body TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('investigating','identified','monitoring','resolved')),
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TEXT,
  author_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS status_updates_incident_idx ON status_updates (incident_id, created_at);
CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  title TEXT NOT NULL,
  assignee_email TEXT,
  due_at TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS action_items_incident_idx ON action_items (incident_id, created_at);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  service_id TEXT REFERENCES services(id),
  incident_id TEXT REFERENCES incidents(id),
  source TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  received_at TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS alerts_fingerprint_idx ON alerts (fingerprint, received_at DESC);
CREATE TABLE IF NOT EXISTS status_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE UNIQUE INDEX IF NOT EXISTS status_pages_slug_idx ON status_pages (slug);
${SHARES("status_page_shares")}`,
    },
  ],
  { table: "cordon_migrations" },
);
