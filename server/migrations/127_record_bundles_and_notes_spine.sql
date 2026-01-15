-- ============================================================
-- MIGRATION 127: DEFENSIVE RECORD BUNDLES + CONTEMPORANEOUS NOTES
-- Phase A2.X - Legal spine for evidence preservation and CYA notes
-- ============================================================
-- Purpose: Immutable, owner-controlled evidence packages for legal/insurance defense
-- This is PRIVATE, OWNER-CONTROLLED, OPT-IN RECORD PRESERVATION.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) ENUMS (IDEMPOTENT)
-- ============================================================

-- 1.1 Record Bundle Type
DO $$ BEGIN
  CREATE TYPE cc_record_bundle_type_enum AS ENUM (
    'incident_defence',
    'emergency_response',
    'employment_action',
    'chargeback_dispute',
    'contract_dispute',
    'general_legal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 Record Bundle Status
DO $$ BEGIN
  CREATE TYPE cc_record_bundle_status_enum AS ENUM (
    'draft',
    'sealed',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.3 Record Bundle Artifact Type
DO $$ BEGIN
  CREATE TYPE cc_record_bundle_artifact_type_enum AS ENUM (
    'json',
    'pdf',
    'html',
    'media',
    'log_export',
    'snapshot'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.4 Record Bundle Visibility
DO $$ BEGIN
  CREATE TYPE cc_record_bundle_visibility_enum AS ENUM (
    'owner_only',
    'legal_team',
    'explicit_delegates'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.5 Note Scope
DO $$ BEGIN
  CREATE TYPE cc_note_scope_enum AS ENUM (
    'incident',
    'bundle',
    'worker',
    'facility',
    'asset',
    'contract',
    'work_order',
    'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.6 Note Visibility
DO $$ BEGIN
  CREATE TYPE cc_note_visibility_enum AS ENUM (
    'internal',
    'owner_only',
    'legal_only'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) TABLE: cc_record_bundles
-- Purpose: Immutable, owner-controlled evidence container
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_record_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id uuid NULL REFERENCES cc_communities(id) ON DELETE SET NULL,
  portal_id uuid NULL REFERENCES cc_portals(id) ON DELETE SET NULL,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  
  -- Scope pointers (exactly one required, enforced by CHECK)
  incident_id uuid NULL REFERENCES cc_incidents(id) ON DELETE SET NULL,
  worker_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  contract_id uuid NULL,
  work_order_id uuid NULL,
  chargeback_case_id uuid NULL,
  
  -- Bundle metadata
  bundle_type cc_record_bundle_type_enum NOT NULL,
  title text NOT NULL,
  description text NULL,
  status cc_record_bundle_status_enum NOT NULL DEFAULT 'draft',
  visibility cc_record_bundle_visibility_enum NOT NULL DEFAULT 'owner_only',
  
  -- Chain-of-custody
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id),
  created_by_circle_id uuid NULL REFERENCES cc_coordination_circles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  sealed_at timestamptz NULL,
  revoked_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Integrity
  bundle_hash text NULL,
  bundle_hash_alg text NOT NULL DEFAULT 'sha256',
  compiled_version text NULL,
  compiler_identity text NULL
);

-- Check constraints
ALTER TABLE cc_record_bundles DROP CONSTRAINT IF EXISTS bundle_exactly_one_scope;
ALTER TABLE cc_record_bundles ADD CONSTRAINT bundle_exactly_one_scope CHECK (
  (
    (CASE WHEN incident_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN worker_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN contract_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN work_order_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN chargeback_case_id IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);

ALTER TABLE cc_record_bundles DROP CONSTRAINT IF EXISTS bundle_sealed_has_timestamp;
ALTER TABLE cc_record_bundles ADD CONSTRAINT bundle_sealed_has_timestamp CHECK (
  status != 'sealed' OR sealed_at IS NOT NULL
);

ALTER TABLE cc_record_bundles DROP CONSTRAINT IF EXISTS bundle_revoked_has_timestamp;
ALTER TABLE cc_record_bundles ADD CONSTRAINT bundle_revoked_has_timestamp CHECK (
  status != 'revoked' OR revoked_at IS NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_record_bundles_tenant_created 
  ON cc_record_bundles(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_record_bundles_incident 
  ON cc_record_bundles(incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_record_bundles_worker 
  ON cc_record_bundles(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_record_bundles_status_sealed 
  ON cc_record_bundles(status, sealed_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS cc_record_bundles_updated_at ON cc_record_bundles;
CREATE TRIGGER cc_record_bundles_updated_at
  BEFORE UPDATE ON cc_record_bundles
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- Enable RLS
ALTER TABLE cc_record_bundles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3) TABLE: cc_record_bundle_artifacts
-- Purpose: Immutable pointers to compiled evidence artifacts in R2
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_record_bundle_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES cc_record_bundles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  artifact_type cc_record_bundle_artifact_type_enum NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'r2',
  storage_bucket text NULL,
  storage_key text NOT NULL,
  byte_size bigint NULL,
  hash text NOT NULL,
  hash_alg text NOT NULL DEFAULT 'sha256',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint
ALTER TABLE cc_record_bundle_artifacts DROP CONSTRAINT IF EXISTS artifacts_unique_storage_key;
ALTER TABLE cc_record_bundle_artifacts ADD CONSTRAINT artifacts_unique_storage_key 
  UNIQUE(bundle_id, artifact_type, storage_key);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_record_bundle_artifacts_bundle 
  ON cc_record_bundle_artifacts(bundle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cc_record_bundle_artifacts_tenant 
  ON cc_record_bundle_artifacts(tenant_id, created_at);

-- Enable RLS with FORCE
ALTER TABLE cc_record_bundle_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_record_bundle_artifacts FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 4) TABLE: cc_record_bundle_acl
-- Purpose: Explicit private access delegation (legal counsel, CFO, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_record_bundle_acl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES cc_record_bundles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  grantee_individual_id uuid NULL REFERENCES cc_individuals(id),
  grantee_circle_id uuid NULL REFERENCES cc_coordination_circles(id),
  granted_by_individual_id uuid NULL REFERENCES cc_individuals(id),
  scope text[] NOT NULL DEFAULT ARRAY['read'],
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Check constraint: exactly one grantee
ALTER TABLE cc_record_bundle_acl DROP CONSTRAINT IF EXISTS acl_exactly_one_grantee;
ALTER TABLE cc_record_bundle_acl ADD CONSTRAINT acl_exactly_one_grantee CHECK (
  (grantee_individual_id IS NOT NULL AND grantee_circle_id IS NULL) OR
  (grantee_individual_id IS NULL AND grantee_circle_id IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_record_bundle_acl_bundle 
  ON cc_record_bundle_acl(bundle_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cc_record_bundle_acl_individual 
  ON cc_record_bundle_acl(grantee_individual_id, is_active) WHERE grantee_individual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_record_bundle_acl_circle 
  ON cc_record_bundle_acl(grantee_circle_id, is_active) WHERE grantee_circle_id IS NOT NULL;

-- Enable RLS with FORCE
ALTER TABLE cc_record_bundle_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_record_bundle_acl FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 5) TABLE: cc_contemporaneous_notes
-- Purpose: Timestamped, scoped, append-only field notes for CYA
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_contemporaneous_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id uuid NULL REFERENCES cc_communities(id),
  portal_id uuid NULL REFERENCES cc_portals(id),
  circle_id uuid NULL REFERENCES cc_coordination_circles(id),
  
  -- Scope
  scope cc_note_scope_enum NOT NULL,
  incident_id uuid NULL REFERENCES cc_incidents(id),
  bundle_id uuid NULL REFERENCES cc_record_bundles(id),
  worker_id uuid NULL REFERENCES cc_individuals(id),
  facility_id uuid NULL REFERENCES cc_facilities(id),
  asset_id uuid NULL,
  contract_id uuid NULL,
  work_order_id uuid NULL,
  
  -- Content
  title text NULL,
  note_text text NOT NULL,
  visibility cc_note_visibility_enum NOT NULL DEFAULT 'internal',
  
  -- Temporal truth (critical for legal defense)
  occurred_at timestamptz NOT NULL DEFAULT now(),  -- when the action/decision occurred
  created_at timestamptz NOT NULL DEFAULT now(),   -- when note was written
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id),
  created_by_party_id uuid NULL REFERENCES cc_parties(id),
  
  -- Locking (notes become immutable when bundle is sealed)
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz NULL
);

-- Check constraints for scope validation
ALTER TABLE cc_contemporaneous_notes DROP CONSTRAINT IF EXISTS note_scope_incident;
ALTER TABLE cc_contemporaneous_notes ADD CONSTRAINT note_scope_incident CHECK (
  scope != 'incident' OR incident_id IS NOT NULL
);

ALTER TABLE cc_contemporaneous_notes DROP CONSTRAINT IF EXISTS note_scope_bundle;
ALTER TABLE cc_contemporaneous_notes ADD CONSTRAINT note_scope_bundle CHECK (
  scope != 'bundle' OR bundle_id IS NOT NULL
);

ALTER TABLE cc_contemporaneous_notes DROP CONSTRAINT IF EXISTS note_scope_worker;
ALTER TABLE cc_contemporaneous_notes ADD CONSTRAINT note_scope_worker CHECK (
  scope != 'worker' OR worker_id IS NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_contemporaneous_notes_tenant 
  ON cc_contemporaneous_notes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_contemporaneous_notes_incident 
  ON cc_contemporaneous_notes(incident_id, occurred_at DESC) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_contemporaneous_notes_bundle 
  ON cc_contemporaneous_notes(bundle_id, occurred_at DESC) WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_contemporaneous_notes_worker 
  ON cc_contemporaneous_notes(worker_id, occurred_at DESC) WHERE worker_id IS NOT NULL;

-- Trigger for updated_at (if we add it later)
-- Notes are append-only so no updated_at needed

-- Enable RLS
ALTER TABLE cc_contemporaneous_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6) TABLE: cc_contemporaneous_note_media
-- Purpose: Attach photos/videos/receipts to notes
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_contemporaneous_note_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES cc_contemporaneous_notes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'r2',
  storage_key text NOT NULL,
  byte_size bigint NULL,
  hash text NOT NULL,
  hash_alg text NOT NULL DEFAULT 'sha256',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_contemporaneous_note_media_note 
  ON cc_contemporaneous_note_media(note_id);
CREATE INDEX IF NOT EXISTS idx_cc_contemporaneous_note_media_tenant 
  ON cc_contemporaneous_note_media(tenant_id, created_at);

-- Enable RLS with FORCE
ALTER TABLE cc_contemporaneous_note_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_contemporaneous_note_media FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 7) RLS POLICIES
-- ============================================================

-- 7.1 Helper function: check if user is tenant owner/admin
CREATE OR REPLACE FUNCTION is_tenant_admin() RETURNS boolean AS $$
DECLARE
  v_tenant_id uuid;
  v_individual_id uuid;
  v_is_admin boolean;
BEGIN
  v_tenant_id := current_tenant_id();
  v_individual_id := current_individual_id();
  
  IF v_tenant_id IS NULL OR v_individual_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM cc_individual_memberships im
    WHERE im.tenant_id = v_tenant_id
      AND im.individual_id = v_individual_id
      AND im.is_active = true
      AND im.role IN ('owner', 'admin')
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7.2 cc_record_bundles policies

DROP POLICY IF EXISTS cc_record_bundles_service ON cc_record_bundles;
CREATE POLICY cc_record_bundles_service ON cc_record_bundles
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_record_bundles_owner_admin_select ON cc_record_bundles;
CREATE POLICY cc_record_bundles_owner_admin_select ON cc_record_bundles
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

DROP POLICY IF EXISTS cc_record_bundles_delegate_select ON cc_record_bundles;
CREATE POLICY cc_record_bundles_delegate_select ON cc_record_bundles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cc_record_bundle_acl acl
      WHERE acl.bundle_id = cc_record_bundles.id
        AND acl.is_active = true
        AND (acl.expires_at IS NULL OR acl.expires_at > now())
        AND (
          acl.grantee_individual_id = current_individual_id()
          OR acl.grantee_circle_id = current_circle_id()
        )
    )
  );

DROP POLICY IF EXISTS cc_record_bundles_owner_admin_insert ON cc_record_bundles;
CREATE POLICY cc_record_bundles_owner_admin_insert ON cc_record_bundles
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

DROP POLICY IF EXISTS cc_record_bundles_owner_admin_update ON cc_record_bundles;
CREATE POLICY cc_record_bundles_owner_admin_update ON cc_record_bundles
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

-- DELETE only by service mode (data preservation)
DROP POLICY IF EXISTS cc_record_bundles_service_delete ON cc_record_bundles;
CREATE POLICY cc_record_bundles_service_delete ON cc_record_bundles
  FOR DELETE USING (is_service_mode());

-- 7.3 cc_record_bundle_artifacts policies

DROP POLICY IF EXISTS cc_record_bundle_artifacts_service ON cc_record_bundle_artifacts;
CREATE POLICY cc_record_bundle_artifacts_service ON cc_record_bundle_artifacts
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_record_bundle_artifacts_owner_admin ON cc_record_bundle_artifacts;
CREATE POLICY cc_record_bundle_artifacts_owner_admin ON cc_record_bundle_artifacts
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

DROP POLICY IF EXISTS cc_record_bundle_artifacts_delegate ON cc_record_bundle_artifacts;
CREATE POLICY cc_record_bundle_artifacts_delegate ON cc_record_bundle_artifacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cc_record_bundle_acl acl
      WHERE acl.bundle_id = cc_record_bundle_artifacts.bundle_id
        AND acl.is_active = true
        AND (acl.expires_at IS NULL OR acl.expires_at > now())
        AND (
          acl.grantee_individual_id = current_individual_id()
          OR acl.grantee_circle_id = current_circle_id()
        )
    )
  );

-- 7.4 cc_record_bundle_acl policies

DROP POLICY IF EXISTS cc_record_bundle_acl_service ON cc_record_bundle_acl;
CREATE POLICY cc_record_bundle_acl_service ON cc_record_bundle_acl
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_record_bundle_acl_owner_admin ON cc_record_bundle_acl;
CREATE POLICY cc_record_bundle_acl_owner_admin ON cc_record_bundle_acl
  FOR ALL USING (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

-- 7.5 cc_contemporaneous_notes policies

DROP POLICY IF EXISTS cc_contemporaneous_notes_service ON cc_contemporaneous_notes;
CREATE POLICY cc_contemporaneous_notes_service ON cc_contemporaneous_notes
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_contemporaneous_notes_tenant_insert ON cc_contemporaneous_notes;
CREATE POLICY cc_contemporaneous_notes_tenant_insert ON cc_contemporaneous_notes
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() 
    AND current_individual_id() IS NOT NULL
  );

DROP POLICY IF EXISTS cc_contemporaneous_notes_owner_admin_select ON cc_contemporaneous_notes;
CREATE POLICY cc_contemporaneous_notes_owner_admin_select ON cc_contemporaneous_notes
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

DROP POLICY IF EXISTS cc_contemporaneous_notes_author_select ON cc_contemporaneous_notes;
CREATE POLICY cc_contemporaneous_notes_author_select ON cc_contemporaneous_notes
  FOR SELECT USING (
    tenant_id = current_tenant_id() 
    AND created_by_individual_id = current_individual_id()
  );

DROP POLICY IF EXISTS cc_contemporaneous_notes_bundle_delegate_select ON cc_contemporaneous_notes;
CREATE POLICY cc_contemporaneous_notes_bundle_delegate_select ON cc_contemporaneous_notes
  FOR SELECT USING (
    bundle_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM cc_record_bundle_acl acl
      WHERE acl.bundle_id = cc_contemporaneous_notes.bundle_id
        AND acl.is_active = true
        AND (acl.expires_at IS NULL OR acl.expires_at > now())
        AND (
          acl.grantee_individual_id = current_individual_id()
          OR acl.grantee_circle_id = current_circle_id()
        )
    )
  );

DROP POLICY IF EXISTS cc_contemporaneous_notes_update ON cc_contemporaneous_notes;
CREATE POLICY cc_contemporaneous_notes_update ON cc_contemporaneous_notes
  FOR UPDATE USING (
    is_locked = false
    AND tenant_id = current_tenant_id()
    AND (is_tenant_admin() OR created_by_individual_id = current_individual_id())
  );

-- 7.6 cc_contemporaneous_note_media policies

DROP POLICY IF EXISTS cc_contemporaneous_note_media_service ON cc_contemporaneous_note_media;
CREATE POLICY cc_contemporaneous_note_media_service ON cc_contemporaneous_note_media
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_contemporaneous_note_media_owner_admin ON cc_contemporaneous_note_media;
CREATE POLICY cc_contemporaneous_note_media_owner_admin ON cc_contemporaneous_note_media
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND is_tenant_admin()
  );

DROP POLICY IF EXISTS cc_contemporaneous_note_media_via_note ON cc_contemporaneous_note_media;
CREATE POLICY cc_contemporaneous_note_media_via_note ON cc_contemporaneous_note_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cc_contemporaneous_notes n
      WHERE n.id = cc_contemporaneous_note_media.note_id
    )
  );

-- ============================================================
-- 8) GRANT PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_record_bundles TO PUBLIC;
GRANT SELECT, INSERT ON cc_record_bundle_artifacts TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_record_bundle_acl TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON cc_contemporaneous_notes TO PUBLIC;
GRANT SELECT, INSERT ON cc_contemporaneous_note_media TO PUBLIC;

COMMIT;
