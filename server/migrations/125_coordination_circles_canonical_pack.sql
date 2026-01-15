/*
Migration: 125_coordination_circles_canonical_pack
Purpose: Canonical Coordination Circles (no-refactor-later) + GUC helper + RLS-safe read access
Dependencies:
 - pgcrypto (gen_random_uuid)
 - existing helper functions: current_tenant_id(), current_portal_id(), current_individual_id(), is_service_mode()
 - cc_set_updated_at() trigger function
Notes:
 - Writes are service-mode only for now. Member/admin write policies can be added later without schema refactor.
*/

-- Ensure UUID generator exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------
-- 1) ENUMS (idempotent)
------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE cc_circle_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cc_circle_member_type AS ENUM ('tenant', 'party', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cc_circle_role_level AS ENUM ('owner', 'admin', 'operator', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cc_grant_principal_type AS ENUM ('tenant', 'circle', 'portal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cc_delegation_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

------------------------------------------------------------
-- 2) Helper: current_circle_id() (reads app.circle_id GUC)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_circle_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(current_setting('app.circle_id', true), '')::uuid;
$$;

-- (Optional) grant for tests
GRANT EXECUTE ON FUNCTION current_circle_id() TO cc_app_test;

------------------------------------------------------------
-- 3) TABLES
------------------------------------------------------------

-- 3.1 Circles
CREATE TABLE IF NOT EXISTS cc_coordination_circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  status cc_circle_status NOT NULL DEFAULT 'active',
  hub_tenant_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_coordination_circles_slug
  ON cc_coordination_circles (slug);

CREATE INDEX IF NOT EXISTS idx_cc_coordination_circles_community
  ON cc_coordination_circles (community_id);

CREATE INDEX IF NOT EXISTS idx_cc_coordination_circles_hub_tenant
  ON cc_coordination_circles (hub_tenant_id);

DROP TRIGGER IF EXISTS trg_cc_coordination_circles_updated ON cc_coordination_circles;
CREATE TRIGGER trg_cc_coordination_circles_updated
  BEFORE UPDATE ON cc_coordination_circles
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- 3.2 Circle roles (scopes)
CREATE TABLE IF NOT EXISTS cc_circle_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES cc_coordination_circles(id) ON DELETE CASCADE,
  name text NOT NULL,
  level cc_circle_role_level NOT NULL DEFAULT 'member',
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_circle_roles_circle_name
  ON cc_circle_roles (circle_id, name);

DROP TRIGGER IF EXISTS trg_cc_circle_roles_updated ON cc_circle_roles;
CREATE TRIGGER trg_cc_circle_roles_updated
  BEFORE UPDATE ON cc_circle_roles
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- 3.3 Circle members (tenant/party/individual)
CREATE TABLE IF NOT EXISTS cc_circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES cc_coordination_circles(id) ON DELETE CASCADE,
  member_type cc_circle_member_type NOT NULL,
  tenant_id uuid NULL,
  party_id uuid NULL,
  individual_id uuid NULL,
  role_id uuid NULL REFERENCES cc_circle_roles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cc_circle_members
  DROP CONSTRAINT IF EXISTS cc_circle_members_identity_check;

ALTER TABLE cc_circle_members
  ADD CONSTRAINT cc_circle_members_identity_check
  CHECK (
    (member_type = 'tenant' AND tenant_id IS NOT NULL AND party_id IS NULL AND individual_id IS NULL) OR
    (member_type = 'party' AND party_id IS NOT NULL AND tenant_id IS NULL AND individual_id IS NULL) OR
    (member_type = 'individual' AND individual_id IS NOT NULL AND tenant_id IS NULL AND party_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_cc_circle_members_circle
  ON cc_circle_members (circle_id);

CREATE INDEX IF NOT EXISTS idx_cc_circle_members_individual
  ON cc_circle_members (individual_id) WHERE individual_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_circle_members_party
  ON cc_circle_members (party_id) WHERE party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_circle_members_tenant
  ON cc_circle_members (tenant_id) WHERE tenant_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cc_circle_members_updated ON cc_circle_members;
CREATE TRIGGER trg_cc_circle_members_updated
  BEFORE UPDATE ON cc_circle_members
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- 3.4 Delegations (Sheryl partner case)
CREATE TABLE IF NOT EXISTS cc_circle_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES cc_coordination_circles(id) ON DELETE CASCADE,
  delegated_by_individual_id uuid NOT NULL,
  delegatee_member_type cc_circle_member_type NOT NULL,
  delegatee_tenant_id uuid NULL,
  delegatee_party_id uuid NULL,
  delegatee_individual_id uuid NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  status cc_delegation_status NOT NULL DEFAULT 'active',
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL
);

ALTER TABLE cc_circle_delegations
  DROP CONSTRAINT IF EXISTS cc_circle_delegations_identity_check;

ALTER TABLE cc_circle_delegations
  ADD CONSTRAINT cc_circle_delegations_identity_check
  CHECK (
    (delegatee_member_type = 'tenant' AND delegatee_tenant_id IS NOT NULL AND delegatee_party_id IS NULL AND delegatee_individual_id IS NULL) OR
    (delegatee_member_type = 'party' AND delegatee_party_id IS NOT NULL AND delegatee_tenant_id IS NULL AND delegatee_individual_id IS NULL) OR
    (delegatee_member_type = 'individual' AND delegatee_individual_id IS NOT NULL AND delegatee_tenant_id IS NULL AND delegatee_party_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_cc_circle_delegations_circle
  ON cc_circle_delegations (circle_id);

CREATE INDEX IF NOT EXISTS idx_cc_circle_delegations_delegatee_individual
  ON cc_circle_delegations (delegatee_individual_id) WHERE delegatee_individual_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cc_circle_delegations_updated ON cc_circle_delegations;
CREATE TRIGGER trg_cc_circle_delegations_updated
  BEFORE UPDATE ON cc_circle_delegations
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- 3.5 Federation grants (hub/spoke)
CREATE TABLE IF NOT EXISTS cc_federation_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  provider_tenant_id uuid NOT NULL,
  principal_type cc_grant_principal_type NOT NULL,
  principal_tenant_id uuid NULL,
  principal_circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE CASCADE,
  principal_portal_id uuid NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  share_availability boolean NOT NULL DEFAULT false,
  allow_reservation_requests boolean NOT NULL DEFAULT false,
  requires_provider_confirmation boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cc_federation_grants
  DROP CONSTRAINT IF EXISTS cc_federation_grants_principal_check;

ALTER TABLE cc_federation_grants
  ADD CONSTRAINT cc_federation_grants_principal_check
  CHECK (
    (principal_type = 'tenant' AND principal_tenant_id IS NOT NULL AND principal_circle_id IS NULL AND principal_portal_id IS NULL) OR
    (principal_type = 'circle' AND principal_circle_id IS NOT NULL AND principal_tenant_id IS NULL AND principal_portal_id IS NULL) OR
    (principal_type = 'portal' AND principal_portal_id IS NOT NULL AND principal_tenant_id IS NULL AND principal_circle_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_cc_federation_grants_provider
  ON cc_federation_grants (provider_tenant_id, community_id);

CREATE INDEX IF NOT EXISTS idx_cc_federation_grants_principal_circle
  ON cc_federation_grants (principal_circle_id) WHERE principal_circle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_federation_grants_principal_tenant
  ON cc_federation_grants (principal_tenant_id) WHERE principal_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_federation_grants_principal_portal
  ON cc_federation_grants (principal_portal_id) WHERE principal_portal_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cc_federation_grants_updated ON cc_federation_grants;
CREATE TRIGGER trg_cc_federation_grants_updated
  BEFORE UPDATE ON cc_federation_grants
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

------------------------------------------------------------
-- 4) Activity Ledger columns (circle_id + portal_id)
------------------------------------------------------------
ALTER TABLE cc_activity_ledger
  ADD COLUMN IF NOT EXISTS circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL;

ALTER TABLE cc_activity_ledger
  ADD COLUMN IF NOT EXISTS portal_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_cc_activity_ledger_circle
  ON cc_activity_ledger (circle_id);

CREATE INDEX IF NOT EXISTS idx_cc_activity_ledger_portal
  ON cc_activity_ledger (portal_id);

------------------------------------------------------------
-- 5) RLS POLICIES
-- Strategy:
--  - SELECT allowed for members (individual/tenant) + service mode.
--  - Writes restricted to service mode for now (admin role logic later).
------------------------------------------------------------

-- 5.1 cc_coordination_circles
ALTER TABLE cc_coordination_circles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_coordination_circles_select ON cc_coordination_circles;
CREATE POLICY cc_coordination_circles_select ON cc_coordination_circles
  FOR SELECT
  USING (
    is_service_mode()
    OR id = current_circle_id()
    OR EXISTS (
      SELECT 1
      FROM cc_circle_members m
      WHERE m.circle_id = cc_coordination_circles.id
        AND m.is_active = true
        AND (
          (m.member_type = 'individual' AND m.individual_id = current_individual_id())
          OR (m.member_type = 'tenant' AND m.tenant_id = current_tenant_id())
        )
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS cc_coordination_circles_write ON cc_coordination_circles;
CREATE POLICY cc_coordination_circles_write ON cc_coordination_circles
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

ALTER TABLE cc_coordination_circles FORCE ROW LEVEL SECURITY;

-- 5.2 cc_circle_roles
ALTER TABLE cc_circle_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_circle_roles_select ON cc_circle_roles;
CREATE POLICY cc_circle_roles_select ON cc_circle_roles
  FOR SELECT
  USING (
    is_service_mode()
    OR circle_id = current_circle_id()
    OR EXISTS (
      SELECT 1
      FROM cc_circle_members m
      WHERE m.circle_id = cc_circle_roles.circle_id
        AND m.is_active = true
        AND (
          (m.member_type = 'individual' AND m.individual_id = current_individual_id())
          OR (m.member_type = 'tenant' AND m.tenant_id = current_tenant_id())
        )
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS cc_circle_roles_write ON cc_circle_roles;
CREATE POLICY cc_circle_roles_write ON cc_circle_roles
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

ALTER TABLE cc_circle_roles FORCE ROW LEVEL SECURITY;

-- 5.3 cc_circle_members
ALTER TABLE cc_circle_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_circle_members_select ON cc_circle_members;
CREATE POLICY cc_circle_members_select ON cc_circle_members
  FOR SELECT
  USING (
    is_service_mode()
    OR circle_id = current_circle_id()
    OR (member_type = 'individual' AND individual_id = current_individual_id())
    OR (member_type = 'tenant' AND tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS cc_circle_members_write ON cc_circle_members;
CREATE POLICY cc_circle_members_write ON cc_circle_members
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

ALTER TABLE cc_circle_members FORCE ROW LEVEL SECURITY;

-- 5.4 cc_circle_delegations
ALTER TABLE cc_circle_delegations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_circle_delegations_select ON cc_circle_delegations;
CREATE POLICY cc_circle_delegations_select ON cc_circle_delegations
  FOR SELECT
  USING (
    is_service_mode()
    OR circle_id = current_circle_id()
    OR delegatee_individual_id = current_individual_id()
    OR delegatee_tenant_id = current_tenant_id()
  );

DROP POLICY IF EXISTS cc_circle_delegations_write ON cc_circle_delegations;
CREATE POLICY cc_circle_delegations_write ON cc_circle_delegations
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

ALTER TABLE cc_circle_delegations FORCE ROW LEVEL SECURITY;

-- 5.5 cc_federation_grants
ALTER TABLE cc_federation_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_federation_grants_select ON cc_federation_grants;
CREATE POLICY cc_federation_grants_select ON cc_federation_grants
  FOR SELECT
  USING (
    is_service_mode()
    OR principal_tenant_id = current_tenant_id()
    OR principal_portal_id = current_portal_id()
    OR principal_circle_id = current_circle_id()
  );

DROP POLICY IF EXISTS cc_federation_grants_write ON cc_federation_grants;
CREATE POLICY cc_federation_grants_write ON cc_federation_grants
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

ALTER TABLE cc_federation_grants FORCE ROW LEVEL SECURITY;
