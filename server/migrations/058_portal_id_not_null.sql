-- ============================================================================
-- MIGRATION 058 — ENFORCE NOT NULL ON portal_id COLUMNS
-- ============================================================================
-- Completes the staged migration pattern from 057:
-- crm_contacts, projects, work_requests MUST have portal_id
-- unified_bookings remains nullable (internal holds may not have portal)
-- ============================================================================

BEGIN;

-- Verify no NULL values exist before adding constraint
-- (Migration will fail if any NULLs exist)

-- crm_contacts: Add NOT NULL constraint
ALTER TABLE crm_contacts ALTER COLUMN portal_id SET NOT NULL;

-- projects: Add NOT NULL constraint
ALTER TABLE projects ALTER COLUMN portal_id SET NOT NULL;

-- work_requests: Add NOT NULL constraint
ALTER TABLE work_requests ALTER COLUMN portal_id SET NOT NULL;

COMMIT;
