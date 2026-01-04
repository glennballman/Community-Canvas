-- ============================================================================
-- MIGRATION 026.1 — Assets trigger hardening
-- 1) Enforce idempotent asset creation by unique (source_table, source_id)
-- 2) Harden SECURITY DEFINER functions with a pinned search_path
-- ============================================================================

BEGIN;

-- 1) Exactly-once semantics for assets created by triggers
CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_source_table_source_id
ON assets(source_table, source_id);

-- 2) SECURITY DEFINER hardening
-- Pin search_path to avoid malicious shadowing of objects
ALTER FUNCTION fn_tenant_vehicle_create_asset() SET search_path = public;
ALTER FUNCTION fn_tenant_trailer_create_asset() SET search_path = public;

COMMIT;
