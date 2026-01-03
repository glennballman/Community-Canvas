-- ============================================================================
-- MIGRATION 024 — ROW-LEVEL SECURITY POLICIES
-- ============================================================================
-- This migration enables RLS on core tenant-scoped tables and creates
-- policies that enforce tenant isolation based on app.tenant_id session var.
-- 
-- SECURITY MODEL:
-- - Empty/missing session vars = no access (regular user without context)
-- - '__SERVICE__' sentinel value = bypass RLS (service/admin mode)
-- - Valid UUID = scoped access to that tenant/portal/individual
-- ============================================================================

BEGIN;

-- Enable RLS on core tables
ALTER TABLE cc_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  -- Returns NULL only for explicit service mode (__SERVICE__)
  -- Empty string or missing = regular user without tenant = no access
  IF current_setting('app.tenant_id', true) = '__SERVICE__' THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(current_setting('app.tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_portal_id() RETURNS UUID AS $$
BEGIN
  IF current_setting('app.portal_id', true) = '__SERVICE__' THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(current_setting('app.portal_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_individual_id() RETURNS UUID AS $$
BEGIN
  IF current_setting('app.individual_id', true) = '__SERVICE__' THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(current_setting('app.individual_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Service mode check function
CREATE OR REPLACE FUNCTION is_service_mode() RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true) = '__SERVICE__';
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TENANT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON cc_tenants;
CREATE POLICY tenant_isolation ON cc_tenants
  FOR ALL
  USING (id = current_tenant_id() OR is_service_mode());

-- ============================================================================
-- INDIVIDUAL POLICIES  
-- ============================================================================

DROP POLICY IF EXISTS individual_isolation ON cc_individuals;
CREATE POLICY individual_isolation ON cc_individuals
  FOR ALL
  USING (
    id = current_individual_id() 
    OR is_service_mode()
    OR EXISTS (
      SELECT 1 FROM portal_memberships pm
      JOIN portals p ON p.id = pm.portal_id
      WHERE pm.individual_id = cc_individuals.id
        AND p.owning_tenant_id = current_tenant_id()
    )
  );

-- ============================================================================
-- PORTAL POLICIES
-- ============================================================================

DROP POLICY IF EXISTS portal_tenant_isolation ON portals;
CREATE POLICY portal_tenant_isolation ON portals
  FOR ALL
  USING (
    owning_tenant_id = current_tenant_id()
    OR is_service_mode()
    OR id = current_portal_id()
    OR EXISTS (
      SELECT 1 FROM portal_memberships pm
      WHERE pm.portal_id = portals.id
        AND pm.individual_id = current_individual_id()
    )
  );

DROP POLICY IF EXISTS membership_isolation ON portal_memberships;
CREATE POLICY membership_isolation ON portal_memberships
  FOR ALL
  USING (
    individual_id = current_individual_id()
    OR is_service_mode()
    OR EXISTS (
      SELECT 1 FROM portals p
      WHERE p.id = portal_memberships.portal_id
        AND p.owning_tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS domain_portal_isolation ON portal_domains;
CREATE POLICY domain_portal_isolation ON portal_domains
  FOR ALL
  USING (
    is_service_mode()
    OR portal_id = current_portal_id()
    OR EXISTS (
      SELECT 1 FROM portals p
      WHERE p.id = portal_domains.portal_id
        AND p.owning_tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS flags_portal_isolation ON portal_feature_flags;
CREATE POLICY flags_portal_isolation ON portal_feature_flags
  FOR ALL
  USING (
    is_service_mode()
    OR portal_id = current_portal_id()
    OR EXISTS (
      SELECT 1 FROM portals p
      WHERE p.id = portal_feature_flags.portal_id
        AND p.owning_tenant_id = current_tenant_id()
    )
  );

-- ============================================================================
-- OPPORTUNITY & ASSET POLICIES
-- ============================================================================

DROP POLICY IF EXISTS opportunity_isolation ON opportunities;
CREATE POLICY opportunity_isolation ON opportunities
  FOR ALL
  USING (
    visibility_scope = 'public'
    OR owner_tenant_id = current_tenant_id()
    OR portal_id = current_portal_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS asset_isolation ON assets;
CREATE POLICY asset_isolation ON assets
  FOR ALL
  USING (
    visibility_scope = 'public'
    OR tenant_id = current_tenant_id()
    OR portal_id = current_portal_id()
    OR is_service_mode()
  );

-- ============================================================================
-- WORK ORDER & CONTRACT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS work_order_isolation ON work_orders;
CREATE POLICY work_order_isolation ON work_orders
  FOR ALL
  USING (
    is_service_mode()
    OR community_id IN (
      SELECT id FROM sr_communities WHERE tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS contract_isolation ON contracts;
CREATE POLICY contract_isolation ON contracts
  FOR ALL
  USING (
    owner_tenant_id = current_tenant_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS bid_isolation ON bids;
CREATE POLICY bid_isolation ON bids
  FOR ALL
  USING (
    is_service_mode()
    OR party_id IN (SELECT id FROM parties WHERE tenant_id = current_tenant_id())
    OR opportunity_id IN (SELECT id FROM opportunities WHERE owner_tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS party_isolation ON parties;
CREATE POLICY party_isolation ON parties
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- ============================================================================
-- SECURITY MODEL
-- ============================================================================
-- RLS policies are enforced when session vars are set:
-- - app.tenant_id = '' (empty): No tenant access (user without tenant)
-- - app.tenant_id = '__SERVICE__': Bypass RLS (service/admin mode)
-- - app.tenant_id = '<uuid>': Scoped to that tenant
--
-- The application uses withServiceContext() for background jobs and
-- withRequestContext() for user requests to set appropriate session vars.

COMMIT;
