-- ============================================================================
-- MIGRATION 027 ROLLBACK
-- Catalog Claim + Capability Extraction + Asset Binding
-- ============================================================================

BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_claim_auto_apply ON catalog_claims;
DROP TRIGGER IF EXISTS trg_claim_status_transition ON catalog_claims;
DROP TRIGGER IF EXISTS trg_catalog_claims_updated_at ON catalog_claims;

-- Drop functions
DROP FUNCTION IF EXISTS fn_claim_auto_apply_on_approved();
DROP FUNCTION IF EXISTS fn_apply_catalog_claim(UUID);
DROP FUNCTION IF EXISTS fn_extract_capabilities_for_asset(UUID, claim_target_type, UUID, UUID);
DROP FUNCTION IF EXISTS fn_enforce_claim_status_transition();

-- Drop tables (cascade will remove policies, indexes, FKs)
DROP TABLE IF EXISTS catalog_claim_events CASCADE;
DROP TABLE IF EXISTS catalog_claim_evidence CASCADE;
DROP TABLE IF EXISTS catalog_claims CASCADE;
DROP TABLE IF EXISTS catalog_capability_templates CASCADE;

-- Drop ENUMs (only the ones created by this migration)
DROP TYPE IF EXISTS claim_event_type;
DROP TYPE IF EXISTS claim_decision;
DROP TYPE IF EXISTS claim_evidence_type;
DROP TYPE IF EXISTS catalog_claim_status;
DROP TYPE IF EXISTS claimant_type;
DROP TYPE IF EXISTS claim_target_type;

COMMIT;

-- ============================================================================
-- END ROLLBACK 027
-- ============================================================================
