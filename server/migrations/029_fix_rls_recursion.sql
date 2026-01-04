-- Migration 029: Fix RLS infinite recursion between portals and portal_memberships
-- The issue: portals policy checks portal_memberships, which checks portals back

-- Create a SECURITY DEFINER function to check portal ownership without triggering RLS
CREATE OR REPLACE FUNCTION portal_owned_by_tenant(p_portal_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM portals 
    WHERE id = p_portal_id AND owning_tenant_id = p_tenant_id
  );
$$;

-- Create a SECURITY DEFINER function to check portal membership without triggering RLS
CREATE OR REPLACE FUNCTION user_is_portal_member(p_portal_id UUID, p_individual_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM portal_memberships
    WHERE portal_id = p_portal_id AND individual_id = p_individual_id
  );
$$;

-- Drop existing policies
DROP POLICY IF EXISTS portal_tenant_isolation ON portals;
DROP POLICY IF EXISTS membership_isolation ON portal_memberships;

-- Recreate portals policy using the SECURITY DEFINER function (no subquery to portal_memberships)
CREATE POLICY portal_tenant_isolation ON portals
  FOR ALL
  USING (
    owning_tenant_id = current_tenant_id()
    OR is_service_mode()
    OR id = current_portal_id()
    OR user_is_portal_member(id, current_individual_id())
  );

-- Recreate portal_memberships policy using the SECURITY DEFINER function (no subquery to portals)
CREATE POLICY membership_isolation ON portal_memberships
  FOR ALL
  USING (
    individual_id = current_individual_id()
    OR is_service_mode()
    OR portal_owned_by_tenant(portal_id, current_tenant_id())
  );

-- Grant execute on these functions to cc_app
GRANT EXECUTE ON FUNCTION portal_owned_by_tenant(UUID, UUID) TO cc_app;
GRANT EXECUTE ON FUNCTION user_is_portal_member(UUID, UUID) TO cc_app;
