-- Migration 136: Dispute / Extortion Defense Pack
-- P2.10: Backend system for one-click, defensible defense packs
-- Supports: chargebacks, review extortion, BBB complaints, contractor/vendor disputes

-- ============================================================
-- Table: cc_disputes
-- Represents a dispute case file
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  circle_id uuid NULL,
  portal_id uuid NULL,
  
  -- Dispute classification
  dispute_type text NOT NULL CHECK (dispute_type IN (
    'chargeback', 'review_extortion', 'bbb', 'contract', 'platform_dispute', 'other'
  )),
  counterparty_type text NOT NULL CHECK (counterparty_type IN (
    'guest_customer', 'platform', 'bank', 'vendor', 'contractor', 'regulator', 'other'
  )),
  counterparty_name text NULL,
  counterparty_reference text NULL,  -- chargeback case #, review URL, BBB case #
  
  -- Status workflow
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'assembled', 'sent', 'resolved', 'lost', 'won', 'closed'
  )),
  
  -- Case details
  title text NOT NULL,
  summary text NULL,
  incident_occurred_at timestamptz NULL,
  reported_at timestamptz NULL,
  amount_cents int NULL,
  currency text NULL,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for cc_disputes
CREATE INDEX IF NOT EXISTS idx_disputes_tenant_created 
  ON cc_disputes (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_tenant_status 
  ON cc_disputes (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_tenant_client_request 
  ON cc_disputes (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- Table: cc_dispute_inputs
-- Attach sealed bundles / evidence / claim dossiers to disputes
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_dispute_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  dispute_id uuid NOT NULL REFERENCES cc_disputes(id) ON DELETE CASCADE,
  
  -- Input reference
  input_type text NOT NULL CHECK (input_type IN (
    'evidence_bundle', 'evidence_object', 'claim_dossier', 'insurance_claim'
  )),
  input_id uuid NOT NULL,
  copied_sha256 text NOT NULL,  -- manifest_sha, content_sha, dossier_sha, etc.
  
  -- Labeling
  label text NULL,
  notes text NULL,
  
  -- Audit
  attached_at timestamptz NOT NULL DEFAULT now(),
  attached_by_individual_id uuid NULL
);

-- Indexes for cc_dispute_inputs
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_inputs_unique 
  ON cc_dispute_inputs (tenant_id, dispute_id, input_type, input_id);
CREATE INDEX IF NOT EXISTS idx_dispute_inputs_type_id 
  ON cc_dispute_inputs (tenant_id, input_type, input_id);

-- ============================================================
-- Table: cc_defense_packs
-- Immutable assembled defense pack outputs (versioned)
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_defense_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  dispute_id uuid NOT NULL REFERENCES cc_disputes(id) ON DELETE CASCADE,
  
  -- Versioning
  pack_version int NOT NULL DEFAULT 1,
  pack_status text NOT NULL DEFAULT 'assembled' CHECK (pack_status IN (
    'assembled', 'exported', 'superseded'
  )),
  
  -- Pack type
  pack_type text NOT NULL CHECK (pack_type IN (
    'chargeback_v1', 'review_extortion_v1', 'bbb_v1', 'contract_v1', 'generic_v1'
  )),
  
  -- Assembly
  assembled_at timestamptz NOT NULL DEFAULT now(),
  assembled_by_individual_id uuid NULL,
  
  -- Immutable content
  pack_json jsonb NOT NULL,
  pack_sha256 text NOT NULL,
  
  -- Export tracking
  export_artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Audit
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for cc_defense_packs
CREATE INDEX IF NOT EXISTS idx_defense_packs_dispute_version 
  ON cc_defense_packs (tenant_id, dispute_id, pack_version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_defense_packs_client_request 
  ON cc_defense_packs (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE cc_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_dispute_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_defense_packs ENABLE ROW LEVEL SECURITY;

-- Disputes: tenant scope + circle membership when circle_id is set
DROP POLICY IF EXISTS disputes_tenant_access ON cc_disputes;
CREATE POLICY disputes_tenant_access ON cc_disputes
  FOR ALL
  USING (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
      AND (
        circle_id IS NULL 
        OR circle_id::text = current_setting('app.circle_id', true)
        OR EXISTS (
          SELECT 1 FROM cc_circle_memberships cm
          WHERE cm.circle_id = cc_disputes.circle_id
            AND cm.individual_id::text = current_setting('app.individual_id', true)
            AND cm.status = 'active'
        )
      )
    )
  )
  WITH CHECK (
    is_service_mode() OR (
      tenant_id::text = current_setting('app.tenant_id', true)
      AND (
        circle_id IS NULL 
        OR circle_id::text = current_setting('app.circle_id', true)
        OR EXISTS (
          SELECT 1 FROM cc_circle_memberships cm
          WHERE cm.circle_id = cc_disputes.circle_id
            AND cm.individual_id::text = current_setting('app.individual_id', true)
            AND cm.status = 'active'
        )
      )
    )
  );

-- Dispute inputs: tenant scope
DROP POLICY IF EXISTS dispute_inputs_tenant_access ON cc_dispute_inputs;
CREATE POLICY dispute_inputs_tenant_access ON cc_dispute_inputs
  FOR ALL
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Defense packs: tenant scope, no UPDATE to pack_json (immutable)
DROP POLICY IF EXISTS defense_packs_select ON cc_defense_packs;
CREATE POLICY defense_packs_select ON cc_defense_packs
  FOR SELECT
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

DROP POLICY IF EXISTS defense_packs_insert ON cc_defense_packs;
CREATE POLICY defense_packs_insert ON cc_defense_packs
  FOR INSERT
  WITH CHECK (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Allow UPDATE only to pack_status, export_artifacts, metadata (not pack_json or pack_sha256)
DROP POLICY IF EXISTS defense_packs_update ON cc_defense_packs;
CREATE POLICY defense_packs_update ON cc_defense_packs
  FOR UPDATE
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Trigger to prevent modification of immutable pack fields
CREATE OR REPLACE FUNCTION cc_defense_packs_immutable_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD.pack_json IS DISTINCT FROM NEW.pack_json THEN
    RAISE EXCEPTION 'pack_json is immutable after creation';
  END IF;
  IF OLD.pack_sha256 IS DISTINCT FROM NEW.pack_sha256 THEN
    RAISE EXCEPTION 'pack_sha256 is immutable after creation';
  END IF;
  IF OLD.pack_version IS DISTINCT FROM NEW.pack_version THEN
    RAISE EXCEPTION 'pack_version is immutable after creation';
  END IF;
  IF OLD.assembled_at IS DISTINCT FROM NEW.assembled_at THEN
    RAISE EXCEPTION 'assembled_at is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS defense_packs_immutable_guard ON cc_defense_packs;
CREATE TRIGGER defense_packs_immutable_guard
  BEFORE UPDATE ON cc_defense_packs
  FOR EACH ROW
  EXECUTE FUNCTION cc_defense_packs_immutable_guard();

-- ============================================================
-- Record migration
-- ============================================================

INSERT INTO drizzle_migrations (hash, created_at)
SELECT '136_dispute_defense_packs', now()
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle_migrations WHERE hash = '136_dispute_defense_packs'
);
