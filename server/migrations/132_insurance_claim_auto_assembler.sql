-- Migration 132: P2.6 Insurance Claim Auto-Assembler
-- 
-- Creates insurance claim subsystem that treats sealed evidence bundles (P2.5)
-- as canonical input and produces carrier-agnostic, defensible claim dossiers.
--
-- Tables:
-- 1. cc_insurance_policies - Policy records (not claims)
-- 2. cc_insurance_claims - Claim case files
-- 3. cc_claim_inputs - Links claims to sealed evidence bundles/objects
-- 4. cc_claim_dossiers - Assembled dossiers (immutable once finalized)

-- ============================================================
-- 1) ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE cc_policy_type_enum AS ENUM (
    'property', 'liability', 'business_interruption', 'travel', 'auto', 'marine', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cc_claim_type_enum AS ENUM (
    'evacuation', 'wildfire', 'flood', 'tsunami', 'power_outage', 'storm', 'theft', 'liability', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cc_claim_status_enum AS ENUM (
    'draft', 'assembled', 'submitted', 'under_review', 'approved', 'denied', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cc_dossier_status_enum AS ENUM (
    'assembled', 'exported', 'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) TABLE: cc_insurance_policies
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  portal_id uuid NULL REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Policy details
  policy_type cc_policy_type_enum NOT NULL,
  carrier_name text NULL,
  broker_name text NULL,
  policy_number text NULL,
  named_insured text NULL,
  effective_date date NULL,
  expiry_date date NULL,
  coverage_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_tenant_created 
  ON cc_insurance_policies(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_policies_client_request 
  ON cc_insurance_policies(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 3) TABLE: cc_insurance_claims
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  portal_id uuid NULL REFERENCES cc_portals(id) ON DELETE SET NULL,
  policy_id uuid NULL REFERENCES cc_insurance_policies(id) ON DELETE SET NULL,
  
  -- Claim details
  claim_type cc_claim_type_enum NOT NULL,
  claim_status cc_claim_status_enum NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  
  -- Timeline
  loss_occurred_at timestamptz NULL,
  loss_discovered_at timestamptz NULL,
  reported_at timestamptz NULL,
  
  -- Carrier info
  claim_number text NULL,
  
  -- Location
  loss_location jsonb NULL,
  
  -- Claimants
  claimants jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Description
  summary text NULL,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_tenant_created 
  ON cc_insurance_claims(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_tenant_status 
  ON cc_insurance_claims(tenant_id, claim_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_claims_client_request 
  ON cc_insurance_claims(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 4) TABLE: cc_claim_inputs
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_claim_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES cc_insurance_claims(id) ON DELETE CASCADE,
  
  -- Either bundle OR evidence object (one must be present)
  bundle_id uuid NULL REFERENCES cc_evidence_bundles(id) ON DELETE RESTRICT,
  bundle_manifest_sha256 text NULL,
  evidence_object_id uuid NULL REFERENCES cc_evidence_objects(id) ON DELETE RESTRICT,
  evidence_content_sha256 text NULL,
  
  -- Metadata
  attached_at timestamptz NOT NULL DEFAULT now(),
  attached_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  label text NULL,
  notes text NULL,
  
  -- Constraint: exactly one of bundle_id or evidence_object_id must be set
  CONSTRAINT claim_input_one_source CHECK (
    (bundle_id IS NOT NULL AND evidence_object_id IS NULL) OR
    (bundle_id IS NULL AND evidence_object_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_inputs_bundle 
  ON cc_claim_inputs(tenant_id, claim_id, bundle_id) WHERE bundle_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_inputs_evidence 
  ON cc_claim_inputs(tenant_id, claim_id, evidence_object_id) WHERE evidence_object_id IS NOT NULL;

-- ============================================================
-- 5) TABLE: cc_claim_dossiers
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_claim_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES cc_insurance_claims(id) ON DELETE CASCADE,
  
  -- Version tracking
  dossier_version int NOT NULL DEFAULT 1,
  dossier_status cc_dossier_status_enum NOT NULL DEFAULT 'assembled',
  
  -- Assembly info
  assembled_at timestamptz NOT NULL DEFAULT now(),
  assembled_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  -- Dossier content (immutable after insert)
  dossier_json jsonb NOT NULL,
  dossier_sha256 text NOT NULL,
  
  -- Export tracking
  export_artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Idempotency
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_claim_dossiers_claim_version 
  ON cc_claim_dossiers(tenant_id, claim_id, dossier_version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_dossiers_client_request 
  ON cc_claim_dossiers(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 6) RLS POLICIES
-- ============================================================

ALTER TABLE cc_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_claim_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_claim_dossiers ENABLE ROW LEVEL SECURITY;

-- 6.1 Insurance Policies RLS
DROP POLICY IF EXISTS insurance_policies_tenant_access ON cc_insurance_policies;
CREATE POLICY insurance_policies_tenant_access ON cc_insurance_policies
  FOR ALL
  USING (
    is_service_mode()
    OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL
        OR EXISTS (
          SELECT 1 FROM cc_circle_members cm
          WHERE cm.circle_id = cc_insurance_policies.circle_id
          AND cm.individual_id = current_setting('app.individual_id', true)::uuid
          AND cm.is_active = true
        )
      )
    )
  );

-- 6.2 Insurance Claims RLS
DROP POLICY IF EXISTS insurance_claims_tenant_access ON cc_insurance_claims;
CREATE POLICY insurance_claims_tenant_access ON cc_insurance_claims
  FOR ALL
  USING (
    is_service_mode()
    OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL
        OR EXISTS (
          SELECT 1 FROM cc_circle_members cm
          WHERE cm.circle_id = cc_insurance_claims.circle_id
          AND cm.individual_id = current_setting('app.individual_id', true)::uuid
          AND cm.is_active = true
        )
      )
    )
  );

-- 6.3 Claim Inputs RLS
DROP POLICY IF EXISTS claim_inputs_tenant_access ON cc_claim_inputs;
CREATE POLICY claim_inputs_tenant_access ON cc_claim_inputs
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- 6.4 Claim Dossiers RLS
DROP POLICY IF EXISTS claim_dossiers_tenant_access ON cc_claim_dossiers;
CREATE POLICY claim_dossiers_tenant_access ON cc_claim_dossiers
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- ============================================================
-- 7) IMMUTABILITY TRIGGER FOR DOSSIERS
-- ============================================================

CREATE OR REPLACE FUNCTION cc_prevent_dossier_content_update()
RETURNS trigger AS $$
BEGIN
  -- Prevent modification of dossier_json and dossier_sha256 after insert
  IF OLD.dossier_json IS DISTINCT FROM NEW.dossier_json THEN
    RAISE EXCEPTION 'Cannot modify dossier_json after creation';
  END IF;
  IF OLD.dossier_sha256 IS DISTINCT FROM NEW.dossier_sha256 THEN
    RAISE EXCEPTION 'Cannot modify dossier_sha256 after creation';
  END IF;
  -- Allow updates to status and export_artifacts only
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_dossier_content_update ON cc_claim_dossiers;
CREATE TRIGGER trg_prevent_dossier_content_update
  BEFORE UPDATE ON cc_claim_dossiers
  FOR EACH ROW
  EXECUTE FUNCTION cc_prevent_dossier_content_update();

-- ============================================================
-- 8) COMMENTS
-- ============================================================

COMMENT ON TABLE cc_insurance_policies IS 'P2.6: Insurance policy records for claim management';
COMMENT ON TABLE cc_insurance_claims IS 'P2.6: Insurance claim case files linking to evidence bundles';
COMMENT ON TABLE cc_claim_inputs IS 'P2.6: Links claims to sealed evidence bundles/objects';
COMMENT ON TABLE cc_claim_dossiers IS 'P2.6: Assembled claim dossiers (immutable once created)';
