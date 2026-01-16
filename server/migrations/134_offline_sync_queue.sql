-- P2.8 Offline / Low-Signal Evidence Queue + Reconciliation
-- Migration 134: Sync sessions, ingest queue, and reconciliation log

-- 1) cc_sync_sessions - Tracks client device sync sessions
CREATE TABLE IF NOT EXISTS cc_sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  circle_id UUID NULL,
  portal_id UUID NULL,
  individual_id UUID NULL,
  device_id TEXT NOT NULL,
  app_version TEXT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_sessions_tenant_device 
  ON cc_sync_sessions(tenant_id, device_id);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_tenant_last_seen 
  ON cc_sync_sessions(tenant_id, last_seen_at DESC);

-- 2) cc_offline_ingest_queue - Server-side landing zone for offline batches
CREATE TYPE cc_ingest_status AS ENUM ('received', 'processed', 'rejected');

CREATE TABLE IF NOT EXISTS cc_offline_ingest_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  circle_id UUID NULL,
  portal_id UUID NULL,
  individual_id UUID NULL,
  device_id TEXT NOT NULL,
  batch_client_request_id TEXT NOT NULL,
  batch_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  batch_json JSONB NOT NULL,
  status cc_ingest_status NOT NULL DEFAULT 'received',
  error JSONB NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingest_queue_idempotency 
  ON cc_offline_ingest_queue(tenant_id, device_id, batch_client_request_id);
CREATE INDEX IF NOT EXISTS idx_ingest_queue_tenant_received 
  ON cc_offline_ingest_queue(tenant_id, received_at DESC);

-- 3) cc_offline_reconcile_log - Append-only reconciliation log
CREATE TYPE cc_reconcile_result AS ENUM ('applied', 'partially_applied', 'rejected');

CREATE TABLE IF NOT EXISTS cc_offline_reconcile_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  batch_client_request_id TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result cc_reconcile_result NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reconcile_log_tenant_device_event 
  ON cc_offline_reconcile_log(tenant_id, device_id, event_at DESC);

-- 4) Append-only trigger for reconcile log
CREATE OR REPLACE FUNCTION cc_reconcile_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'RECONCILE_LOG_IMMUTABLE: Reconciliation log entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reconcile_log_append_only
  BEFORE UPDATE OR DELETE ON cc_offline_reconcile_log
  FOR EACH ROW
  EXECUTE FUNCTION cc_reconcile_log_immutable();

-- 5) RLS Policies

-- Enable RLS on all tables
ALTER TABLE cc_sync_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_offline_ingest_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_offline_reconcile_log ENABLE ROW LEVEL SECURITY;

-- Force RLS for reconcile log (append-only audit table)
ALTER TABLE cc_offline_reconcile_log FORCE ROW LEVEL SECURITY;

-- Sync Sessions RLS
CREATE POLICY sync_sessions_tenant_isolation ON cc_sync_sessions
  FOR ALL
  USING (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          tenant_id,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  )
  WITH CHECK (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          tenant_id,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  );

-- Ingest Queue RLS
CREATE POLICY ingest_queue_tenant_isolation ON cc_offline_ingest_queue
  FOR ALL
  USING (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          tenant_id,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  )
  WITH CHECK (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          tenant_id,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  );

-- Reconcile Log RLS (read-only for non-service mode)
CREATE POLICY reconcile_log_tenant_read ON cc_offline_reconcile_log
  FOR SELECT
  USING (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY reconcile_log_service_insert ON cc_offline_reconcile_log
  FOR INSERT
  WITH CHECK (is_service_mode());

-- 6) Add client_request_id to evidence objects for idempotency if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cc_evidence_objects' AND column_name = 'client_request_id'
  ) THEN
    ALTER TABLE cc_evidence_objects ADD COLUMN client_request_id TEXT NULL;
    CREATE UNIQUE INDEX idx_evidence_objects_client_request_id 
      ON cc_evidence_objects(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;
  END IF;
END $$;

-- 7) Add pending_bytes flag to evidence objects if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cc_evidence_objects' AND column_name = 'pending_bytes'
  ) THEN
    ALTER TABLE cc_evidence_objects ADD COLUMN pending_bytes BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
