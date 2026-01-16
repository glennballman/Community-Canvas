-- P2.7 Legal Hold & Retention Policies
-- Migration 133: Legal holds, targets, events, retention policies

-- ============================================================
-- HELPER FUNCTION FOR CIRCLE MEMBERSHIP
-- ============================================================

CREATE OR REPLACE FUNCTION cc_check_circle_membership(
  p_tenant_id uuid,
  p_individual_id uuid,
  p_circle_id uuid
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cc_circle_members
    WHERE tenant_id = p_tenant_id
      AND individual_id = p_individual_id
      AND circle_id = p_circle_id
      AND is_active = true
  );
EXCEPTION WHEN undefined_table THEN
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE legal_hold_type AS ENUM (
    'insurance_claim',
    'dispute_defense',
    'class_action',
    'regulatory',
    'litigation',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE legal_hold_status AS ENUM (
    'active',
    'released'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE hold_target_type AS ENUM (
    'evidence_object',
    'evidence_bundle',
    'claim',
    'claim_dossier',
    'table_scope'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE hold_event_type AS ENUM (
    'created',
    'target_added',
    'target_removed',
    'released',
    'access_blocked',
    'export_blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE retention_policy_scope AS ENUM (
    'evidence',
    'bundles',
    'claims',
    'dossiers',
    'all'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: cc_legal_holds
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  circle_id uuid NULL,
  portal_id uuid NULL,
  hold_type legal_hold_type NOT NULL,
  title text NOT NULL,
  description text NULL,
  hold_status legal_hold_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  released_at timestamptz NULL,
  released_by_individual_id uuid NULL,
  release_reason text NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_tenant_status 
  ON cc_legal_holds(tenant_id, hold_status);
CREATE INDEX IF NOT EXISTS idx_legal_holds_tenant_created 
  ON cc_legal_holds(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_holds_client_request 
  ON cc_legal_holds(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- TABLE: cc_legal_hold_targets
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_legal_hold_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hold_id uuid NOT NULL REFERENCES cc_legal_holds(id) ON DELETE CASCADE,
  target_type hold_target_type NOT NULL,
  target_id uuid NULL,
  table_name text NULL,
  scope_filter jsonb NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by_individual_id uuid NULL,
  notes text NULL,
  
  CONSTRAINT target_id_or_table CHECK (
    (target_type != 'table_scope' AND target_id IS NOT NULL) OR
    (target_type = 'table_scope' AND table_name IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hold_targets_unique 
  ON cc_legal_hold_targets(tenant_id, hold_id, target_type, target_id) 
  WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hold_targets_lookup 
  ON cc_legal_hold_targets(tenant_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_hold_targets_hold 
  ON cc_legal_hold_targets(hold_id);

-- ============================================================
-- TABLE: cc_legal_hold_events (Append-Only)
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_legal_hold_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hold_id uuid NOT NULL REFERENCES cc_legal_holds(id) ON DELETE CASCADE,
  event_type hold_event_type NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_individual_id uuid NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_request_id text NULL
);

CREATE INDEX IF NOT EXISTS idx_hold_events_hold_time 
  ON cc_legal_hold_events(tenant_id, hold_id, event_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hold_events_client_request 
  ON cc_legal_hold_events(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ============================================================
-- TABLE: cc_retention_policies
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  circle_id uuid NULL,
  policy_scope retention_policy_scope NOT NULL,
  retain_days int NULL,
  min_severity text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant 
  ON cc_retention_policies(tenant_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE cc_legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_legal_hold_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_legal_hold_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_retention_policies ENABLE ROW LEVEL SECURITY;

-- cc_legal_holds: tenant access with optional circle check
CREATE POLICY legal_holds_tenant_access ON cc_legal_holds
  FOR ALL
  USING (
    is_service_mode() OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          current_setting('app.tenant_id', true)::uuid,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  )
  WITH CHECK (
    is_service_mode() OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          current_setting('app.tenant_id', true)::uuid,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  );

-- cc_legal_hold_targets: tenant access
CREATE POLICY hold_targets_tenant_access ON cc_legal_hold_targets
  FOR ALL
  USING (
    is_service_mode() OR 
    tenant_id = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- cc_legal_hold_events: tenant access (append-only enforced by trigger)
CREATE POLICY hold_events_tenant_access ON cc_legal_hold_events
  FOR ALL
  USING (
    is_service_mode() OR 
    tenant_id = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- cc_retention_policies: tenant access with optional circle check
CREATE POLICY retention_policies_tenant_access ON cc_retention_policies
  FOR ALL
  USING (
    is_service_mode() OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          current_setting('app.tenant_id', true)::uuid,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  )
  WITH CHECK (
    is_service_mode() OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL 
        OR cc_check_circle_membership(
          current_setting('app.tenant_id', true)::uuid,
          current_setting('app.individual_id', true)::uuid,
          circle_id
        )
      )
    )
  );

-- ============================================================
-- APPEND-ONLY TRIGGER FOR EVENTS
-- ============================================================

CREATE OR REPLACE FUNCTION cc_prevent_hold_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'LEGAL_HOLD_EVENTS_IMMUTABLE: Cannot update legal hold events';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LEGAL_HOLD_EVENTS_IMMUTABLE: Cannot delete legal hold events';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hold_events_append_only ON cc_legal_hold_events;
CREATE TRIGGER trg_hold_events_append_only
  BEFORE UPDATE OR DELETE ON cc_legal_hold_events
  FOR EACH ROW
  EXECUTE FUNCTION cc_prevent_hold_event_mutation();

-- ============================================================
-- LEGAL HOLD ENFORCEMENT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION cc_is_row_on_active_hold(
  p_tenant_id uuid,
  p_target_type text,
  p_target_id uuid
) RETURNS boolean AS $$
DECLARE
  v_has_direct_hold boolean;
  v_has_scope_hold boolean;
BEGIN
  -- Check direct target match
  SELECT EXISTS (
    SELECT 1
    FROM cc_legal_hold_targets t
    JOIN cc_legal_holds h ON h.id = t.hold_id
    WHERE h.tenant_id = p_tenant_id
      AND h.hold_status = 'active'
      AND t.target_type = p_target_type::hold_target_type
      AND t.target_id = p_target_id
  ) INTO v_has_direct_hold;
  
  IF v_has_direct_hold THEN
    RETURN true;
  END IF;
  
  -- Check table_scope holds (limited support for claim-based scoping)
  -- For evidence objects linked to claims via cc_claim_inputs
  IF p_target_type = 'evidence_object' THEN
    SELECT EXISTS (
      SELECT 1
      FROM cc_legal_hold_targets t
      JOIN cc_legal_holds h ON h.id = t.hold_id
      JOIN cc_claim_inputs ci ON ci.evidence_object_id = p_target_id
      WHERE h.tenant_id = p_tenant_id
        AND h.hold_status = 'active'
        AND t.target_type = 'claim'
        AND t.target_id = ci.claim_id
    ) INTO v_has_scope_hold;
    
    IF v_has_scope_hold THEN
      RETURN true;
    END IF;
  END IF;
  
  -- For evidence bundles linked to claims via cc_claim_inputs
  IF p_target_type = 'evidence_bundle' THEN
    SELECT EXISTS (
      SELECT 1
      FROM cc_legal_hold_targets t
      JOIN cc_legal_holds h ON h.id = t.hold_id
      JOIN cc_claim_inputs ci ON ci.bundle_id = p_target_id
      WHERE h.tenant_id = p_tenant_id
        AND h.hold_status = 'active'
        AND t.target_type = 'claim'
        AND t.target_id = ci.claim_id
    ) INTO v_has_scope_hold;
    
    IF v_has_scope_hold THEN
      RETURN true;
    END IF;
  END IF;
  
  -- For dossiers linked to claims
  IF p_target_type = 'claim_dossier' THEN
    SELECT EXISTS (
      SELECT 1
      FROM cc_legal_hold_targets t
      JOIN cc_legal_holds h ON h.id = t.hold_id
      JOIN cc_claim_dossiers d ON d.id = p_target_id
      WHERE h.tenant_id = p_tenant_id
        AND h.hold_status = 'active'
        AND t.target_type = 'claim'
        AND t.target_id = d.claim_id
    ) INTO v_has_scope_hold;
    
    IF v_has_scope_hold THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- ENFORCEMENT TRIGGERS ON PROTECTED TABLES
-- ============================================================

-- Trigger function for evidence objects
CREATE OR REPLACE FUNCTION cc_enforce_hold_on_evidence_objects()
RETURNS TRIGGER AS $$
BEGIN
  IF cc_is_row_on_active_hold(OLD.tenant_id, 'evidence_object', OLD.id) THEN
    RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot modify evidence object % while under legal hold', OLD.id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_evidence_objects ON cc_evidence_objects;
CREATE TRIGGER trg_legal_hold_evidence_objects
  BEFORE UPDATE OR DELETE ON cc_evidence_objects
  FOR EACH ROW
  EXECUTE FUNCTION cc_enforce_hold_on_evidence_objects();

-- Trigger function for evidence bundles
CREATE OR REPLACE FUNCTION cc_enforce_hold_on_evidence_bundles()
RETURNS TRIGGER AS $$
BEGIN
  IF cc_is_row_on_active_hold(OLD.tenant_id, 'evidence_bundle', OLD.id) THEN
    RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot modify evidence bundle % while under legal hold', OLD.id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_evidence_bundles ON cc_evidence_bundles;
CREATE TRIGGER trg_legal_hold_evidence_bundles
  BEFORE UPDATE OR DELETE ON cc_evidence_bundles
  FOR EACH ROW
  EXECUTE FUNCTION cc_enforce_hold_on_evidence_bundles();

-- Trigger function for evidence bundle items
CREATE OR REPLACE FUNCTION cc_enforce_hold_on_bundle_items()
RETURNS TRIGGER AS $$
BEGIN
  IF cc_is_row_on_active_hold(OLD.tenant_id, 'evidence_bundle', OLD.bundle_id) THEN
    RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot modify bundle items for bundle % while under legal hold', OLD.bundle_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_bundle_items ON cc_evidence_bundle_items;
CREATE TRIGGER trg_legal_hold_bundle_items
  BEFORE UPDATE OR DELETE ON cc_evidence_bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION cc_enforce_hold_on_bundle_items();

-- Trigger function for insurance claims
CREATE OR REPLACE FUNCTION cc_enforce_hold_on_claims()
RETURNS TRIGGER AS $$
BEGIN
  IF cc_is_row_on_active_hold(OLD.tenant_id, 'claim', OLD.id) THEN
    -- Allow status changes but block deletion and other mutations
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot delete claim % while under legal hold', OLD.id;
    END IF;
    
    -- Block changes to core fields (allow status updates)
    IF OLD.title != NEW.title 
       OR OLD.claim_type != NEW.claim_type
       OR OLD.loss_occurred_at IS DISTINCT FROM NEW.loss_occurred_at
       OR OLD.summary IS DISTINCT FROM NEW.summary THEN
      RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot modify claim % content while under legal hold', OLD.id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_claims ON cc_insurance_claims;
CREATE TRIGGER trg_legal_hold_claims
  BEFORE UPDATE OR DELETE ON cc_insurance_claims
  FOR EACH ROW
  EXECUTE FUNCTION cc_enforce_hold_on_claims();

-- Trigger function for claim dossiers
CREATE OR REPLACE FUNCTION cc_enforce_hold_on_dossiers()
RETURNS TRIGGER AS $$
BEGIN
  IF cc_is_row_on_active_hold(OLD.tenant_id, 'claim_dossier', OLD.id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot delete dossier % while under legal hold', OLD.id;
    END IF;
    -- Dossiers are already immutable, but enforce hold on any update
    RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot modify dossier % while under legal hold', OLD.id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_dossiers ON cc_claim_dossiers;
CREATE TRIGGER trg_legal_hold_dossiers
  BEFORE UPDATE OR DELETE ON cc_claim_dossiers
  FOR EACH ROW
  EXECUTE FUNCTION cc_enforce_hold_on_dossiers();

-- Trigger function for claim inputs
CREATE OR REPLACE FUNCTION cc_enforce_hold_on_claim_inputs()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the parent claim is on hold
  IF cc_is_row_on_active_hold(OLD.tenant_id, 'claim', OLD.claim_id) THEN
    RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE: Cannot modify claim inputs for claim % while under legal hold', OLD.claim_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_claim_inputs ON cc_claim_inputs;
CREATE TRIGGER trg_legal_hold_claim_inputs
  BEFORE UPDATE OR DELETE ON cc_claim_inputs
  FOR EACH ROW
  EXECUTE FUNCTION cc_enforce_hold_on_claim_inputs();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE cc_legal_holds IS 'Legal hold containers for spoliation prevention';
COMMENT ON TABLE cc_legal_hold_targets IS 'Targets covered by legal holds';
COMMENT ON TABLE cc_legal_hold_events IS 'Append-only audit log for legal hold actions';
COMMENT ON TABLE cc_retention_policies IS 'Retention policy rules for evidence/claims';
COMMENT ON FUNCTION cc_is_row_on_active_hold IS 'Check if a row is under an active legal hold';
