-- ============================================================================
-- MIGRATION 027.2 — Force RLS on Owner
-- Ensures RLS applies even to table owners
-- ============================================================================

BEGIN;

ALTER TABLE catalog_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE catalog_claim_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE catalog_claim_events FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_trailers FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_vehicle_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_trailer_photos FORCE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- END MIGRATION 027.2
-- ============================================================================
