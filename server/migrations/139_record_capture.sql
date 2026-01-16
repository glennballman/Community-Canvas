-- P2.13 Preserve Record → Generate Pack
-- Migration: 139_record_capture.sql

-- 1) cc_record_sources - Configurable sources to capture from
CREATE TABLE IF NOT EXISTS cc_record_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid NULL,
  circle_id uuid NULL,
  source_type text NOT NULL CHECK (source_type IN ('url', 'rss', 'json_feed', 'webhook', 'manual_url_list')),
  title text NOT NULL,
  description text NULL,
  base_url text NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cc_record_sources_tenant_enabled 
  ON cc_record_sources(tenant_id, enabled);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_record_sources_client_request 
  ON cc_record_sources(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 2) cc_record_captures - A capture attempt (append-only, operational log)
CREATE TABLE IF NOT EXISTS cc_record_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NULL REFERENCES cc_emergency_runs(id) ON DELETE SET NULL,
  source_id uuid NULL REFERENCES cc_record_sources(id) ON DELETE SET NULL,
  capture_type text NOT NULL CHECK (capture_type IN ('evac_order', 'utility_outage', 'media_article', 'advisory', 'alert', 'generic')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by_individual_id uuid NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fetched', 'stored', 'sealed', 'failed', 'deferred')),
  target_url text NULL,
  http_status int NULL,
  response_headers jsonb NULL,
  content_mime text NULL,
  content_bytes bigint NULL,
  content_sha256 text NULL,
  r2_key text NULL,
  evidence_object_id uuid NULL,
  error jsonb NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cc_record_captures_tenant_run_requested 
  ON cc_record_captures(tenant_id, run_id, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_record_captures_client_request 
  ON cc_record_captures(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 3) cc_record_capture_queue - For deferred/async fetching
CREATE TABLE IF NOT EXISTS cc_record_capture_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NULL,
  capture_id uuid NOT NULL REFERENCES cc_record_captures(id) ON DELETE CASCADE,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempt_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'deadletter')),
  last_error jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_record_capture_queue_tenant_next 
  ON cc_record_capture_queue(tenant_id, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_cc_record_capture_queue_tenant_status 
  ON cc_record_capture_queue(tenant_id, status);

-- RLS Policies
ALTER TABLE cc_record_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_record_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_record_capture_queue ENABLE ROW LEVEL SECURITY;

-- cc_record_sources policies
DROP POLICY IF EXISTS cc_record_sources_tenant_isolation ON cc_record_sources;
CREATE POLICY cc_record_sources_tenant_isolation ON cc_record_sources
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- cc_record_captures policies
DROP POLICY IF EXISTS cc_record_captures_tenant_isolation ON cc_record_captures;
CREATE POLICY cc_record_captures_tenant_isolation ON cc_record_captures
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- cc_record_capture_queue policies
DROP POLICY IF EXISTS cc_record_capture_queue_tenant_isolation ON cc_record_capture_queue;
CREATE POLICY cc_record_capture_queue_tenant_isolation ON cc_record_capture_queue
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- Add emergency_pack to bundle type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'emergency_pack' AND enumtypid = 'cc_evidence_bundle_type_enum'::regtype) THEN
    ALTER TYPE cc_evidence_bundle_type_enum ADD VALUE 'emergency_pack';
  END IF;
END $$;
