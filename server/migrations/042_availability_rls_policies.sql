-- ============================================================
-- Migration 042 - RLS Policies for Availability & Sharing Model
-- Adds tenant isolation to all tables from migration 041
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE tenant_sharing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE hold_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_import_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: tenant_sharing_settings
-- ============================================================

DROP POLICY IF EXISTS tenant_sharing_settings_select ON tenant_sharing_settings;
CREATE POLICY tenant_sharing_settings_select ON tenant_sharing_settings
  FOR SELECT USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS tenant_sharing_settings_insert ON tenant_sharing_settings;
CREATE POLICY tenant_sharing_settings_insert ON tenant_sharing_settings
  FOR INSERT WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS tenant_sharing_settings_update ON tenant_sharing_settings;
CREATE POLICY tenant_sharing_settings_update ON tenant_sharing_settings
  FOR UPDATE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS tenant_sharing_settings_delete ON tenant_sharing_settings;
CREATE POLICY tenant_sharing_settings_delete ON tenant_sharing_settings
  FOR DELETE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

-- ============================================================
-- RLS POLICIES: catalog_items
-- ============================================================

DROP POLICY IF EXISTS catalog_items_select ON catalog_items;
CREATE POLICY catalog_items_select ON catalog_items
  FOR SELECT USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_items_insert ON catalog_items;
CREATE POLICY catalog_items_insert ON catalog_items
  FOR INSERT WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_items_update ON catalog_items;
CREATE POLICY catalog_items_update ON catalog_items
  FOR UPDATE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_items_delete ON catalog_items;
CREATE POLICY catalog_items_delete ON catalog_items
  FOR DELETE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

-- ============================================================
-- RLS POLICIES: catalog_availability (through catalog_items)
-- ============================================================

DROP POLICY IF EXISTS catalog_availability_select ON catalog_availability;
CREATE POLICY catalog_availability_select ON catalog_availability
  FOR SELECT USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN catalog_item_id IN (
          SELECT id FROM catalog_items WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_availability_insert ON catalog_availability;
CREATE POLICY catalog_availability_insert ON catalog_availability
  FOR INSERT WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN catalog_item_id IN (
          SELECT id FROM catalog_items WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_availability_update ON catalog_availability;
CREATE POLICY catalog_availability_update ON catalog_availability
  FOR UPDATE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN catalog_item_id IN (
          SELECT id FROM catalog_items WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_availability_delete ON catalog_availability;
CREATE POLICY catalog_availability_delete ON catalog_availability
  FOR DELETE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN catalog_item_id IN (
          SELECT id FROM catalog_items WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      ELSE false
    END
  );

-- ============================================================
-- RLS POLICIES: hold_requests (visible to both business and requesting tenant)
-- ============================================================

DROP POLICY IF EXISTS hold_requests_select ON hold_requests;
CREATE POLICY hold_requests_select ON hold_requests
  FOR SELECT USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN business_tenant_id = current_setting('app.tenant_id', true)::uuid
          OR requesting_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS hold_requests_insert ON hold_requests;
CREATE POLICY hold_requests_insert ON hold_requests
  FOR INSERT WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN requesting_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS hold_requests_update ON hold_requests;
CREATE POLICY hold_requests_update ON hold_requests
  FOR UPDATE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN business_tenant_id = current_setting('app.tenant_id', true)::uuid
          OR requesting_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS hold_requests_delete ON hold_requests;
CREATE POLICY hold_requests_delete ON hold_requests
  FOR DELETE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN requesting_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

-- ============================================================
-- RLS POLICIES: operator_call_logs
-- ============================================================

DROP POLICY IF EXISTS operator_call_logs_select ON operator_call_logs;
CREATE POLICY operator_call_logs_select ON operator_call_logs
  FOR SELECT USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN operator_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS operator_call_logs_insert ON operator_call_logs;
CREATE POLICY operator_call_logs_insert ON operator_call_logs
  FOR INSERT WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN operator_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS operator_call_logs_update ON operator_call_logs;
CREATE POLICY operator_call_logs_update ON operator_call_logs
  FOR UPDATE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN operator_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS operator_call_logs_delete ON operator_call_logs;
CREATE POLICY operator_call_logs_delete ON operator_call_logs
  FOR DELETE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN operator_tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

-- ============================================================
-- RLS POLICIES: catalog_import_jobs
-- ============================================================

DROP POLICY IF EXISTS catalog_import_jobs_select ON catalog_import_jobs;
CREATE POLICY catalog_import_jobs_select ON catalog_import_jobs
  FOR SELECT USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_import_jobs_insert ON catalog_import_jobs;
CREATE POLICY catalog_import_jobs_insert ON catalog_import_jobs
  FOR INSERT WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_import_jobs_update ON catalog_import_jobs;
CREATE POLICY catalog_import_jobs_update ON catalog_import_jobs
  FOR UPDATE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

DROP POLICY IF EXISTS catalog_import_jobs_delete ON catalog_import_jobs;
CREATE POLICY catalog_import_jobs_delete ON catalog_import_jobs
  FOR DELETE USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NOT NULL 
        THEN tenant_id = current_setting('app.tenant_id', true)::uuid
      ELSE false
    END
  );

-- ============================================================
-- GRANT PERMISSIONS to cc_app role
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_sharing_settings TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_items TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_availability TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON hold_requests TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON operator_call_logs TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_import_jobs TO cc_app;

-- ============================================================
-- ADD CONSTRAINT: hold_requests date range validation
-- ============================================================

ALTER TABLE hold_requests 
  ADD CONSTRAINT hold_requests_valid_date_range 
  CHECK (date_end >= date_start);
