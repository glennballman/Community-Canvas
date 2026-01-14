-- ============================================================================
-- MIGRATION 114B: External Sync Records (Connector Sync State)
-- Purpose:
--   Dedicated sync-state table for external systems (RTR, Service Canada, CivOS, etc.)
--   Separate from cc_external_records (External Data Lake v2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_external_sync_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  -- Which connector/system
  connector_id UUID REFERENCES cc_gov_connectors(id) ON DELETE SET NULL,
  external_system TEXT NOT NULL,            -- e.g. 'rtr', 'service_canada', 'civos', 'custom'
  external_account_id TEXT,                 -- optional: remote account/tenant id

  -- Remote object identity
  external_object_type TEXT NOT NULL,       -- e.g. 'payment', 'identity', 'permit', 'case'
  external_object_id TEXT NOT NULL,         -- remote primary key
  external_object_version TEXT,             -- remote version/etag/rev if provided

  -- Local linkage (optional)
  local_table TEXT,                         -- e.g. 'cc_wallet_ledger_entries'
  local_id UUID,                            -- local record id

  -- Sync state
  sync_status TEXT NOT NULL DEFAULT 'active',   -- 'active','deleted','blocked','error'
  last_synced_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  sync_cursor TEXT,                          -- for incremental sync
  content_hash TEXT,                         -- sha256/etag snapshot of last payload

  -- Error handling
  last_error_code TEXT,
  last_error_message TEXT,
  last_error_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,

  -- Provenance
  source_url TEXT,
  source_ref TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_external_sync_remote UNIQUE (tenant_id, external_system, external_object_type, external_object_id),
  CONSTRAINT ck_external_sync_status CHECK (sync_status IN ('active','deleted','blocked','error'))
);

CREATE INDEX IF NOT EXISTS idx_external_sync_tenant_system
  ON cc_external_sync_records(tenant_id, external_system, external_object_type);

CREATE INDEX IF NOT EXISTS idx_external_sync_connector
  ON cc_external_sync_records(connector_id);

CREATE INDEX IF NOT EXISTS idx_external_sync_local_link
  ON cc_external_sync_records(local_table, local_id);

-- updated_at trigger helper (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE p.proname='cc_set_updated_at' AND n.nspname='public'
  ) THEN
    DROP TRIGGER IF EXISTS trg_external_sync_updated ON cc_external_sync_records;
    CREATE TRIGGER trg_external_sync_updated
      BEFORE UPDATE ON cc_external_sync_records
      FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE cc_external_sync_records ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant/service
DROP POLICY IF EXISTS external_sync_select ON cc_external_sync_records;
CREATE POLICY external_sync_select ON cc_external_sync_records
  FOR SELECT
  USING (tenant_id = current_tenant_id() OR is_service_mode());

-- INSERT: tenant/service
DROP POLICY IF EXISTS external_sync_insert ON cc_external_sync_records;
CREATE POLICY external_sync_insert ON cc_external_sync_records
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- UPDATE: tenant/service
DROP POLICY IF EXISTS external_sync_update ON cc_external_sync_records;
CREATE POLICY external_sync_update ON cc_external_sync_records
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- DELETE: service-only (prefer tombstones via sync_status)
DROP POLICY IF EXISTS external_sync_delete_service ON cc_external_sync_records;
CREATE POLICY external_sync_delete_service ON cc_external_sync_records
  FOR DELETE
  USING (is_service_mode());

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Q1: Verify table exists
SELECT 'cc_external_sync_records' as table_name, COUNT(*) as column_count
FROM information_schema.columns WHERE table_name = 'cc_external_sync_records';

-- Q2: Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'cc_external_sync_records';

-- Q3: Verify FK to cc_gov_connectors
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'cc_external_sync_records';
