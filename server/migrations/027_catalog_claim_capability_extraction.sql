-- ============================================================================
-- MIGRATION 027 — Catalog Claim + Capability Extraction + Asset Binding
-- Community Canvas
--
-- Goal
--   Turn public marketplace "world objects" (catalog + listings) into
--   tenant-owned operational fleet assets (tenant_vehicles / tenant_trailers),
--   and automatically generate asset_capabilities from catalog fields.
--
-- Core flow
--   1) A tenant/individual creates a catalog_claim against:
--        - a catalog_listings row, OR
--        - a vehicle_catalog row, OR
--        - a trailer_catalog row
--   2) Claim is submitted → reviewed → approved
--   3) On approval, the system "applies" the claim:
--        - creates tenant_vehicles or tenant_trailers
--        - triggers from Migration 026 auto-create an assets row and set asset_id
--        - capabilities are extracted into asset_capabilities for that asset
--
-- Assumptions
--   - current_tenant_id() and is_service_mode() functions already exist
--   - tenant_vehicles / tenant_trailers already exist and have:
--       id, tenant_id, catalog_vehicle_id (vehicles), catalog_trailer_id (trailers),
--       nickname, is_active, status, asset_id
--   - assets table exists and asset_capabilities table exists
--   - vehicle_catalog / trailer_catalog / catalog_listings / catalog_media exist
--
-- NOTE
--   This migration is "v1 extraction": it generates a useful baseline set of
--   capabilities directly from catalog columns. You can evolve rules later.
--
-- MODIFIED: Uses catalog_claim_status instead of claim_status to avoid conflict
--           with existing entity_claims enum.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 0) Types (ENUMs)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_target_type') THEN
    CREATE TYPE claim_target_type AS ENUM ('vehicle', 'trailer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claimant_type') THEN
    CREATE TYPE claimant_type AS ENUM ('tenant', 'individual');
  END IF;

  -- Use catalog_claim_status to avoid conflict with existing claim_status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_claim_status') THEN
    CREATE TYPE catalog_claim_status AS ENUM (
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'cancelled',
      'applied'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_evidence_type') THEN
    CREATE TYPE claim_evidence_type AS ENUM (
      'photo',
      'document',
      'listing_screenshot',
      'vin_photo',
      'serial_photo',
      'bill_of_sale',
      'insurance',
      'registration',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_decision') THEN
    CREATE TYPE claim_decision AS ENUM ('approve', 'reject', 'request_changes');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_event_type') THEN
    CREATE TYPE claim_event_type AS ENUM (
      'created',
      'updated',
      'submitted',
      'review_started',
      'reviewed',
      'approved',
      'rejected',
      'cancelled',
      'applied',
      'capabilities_extracted'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Utility: updated_at trigger function (idempotent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Claim tables
-- ---------------------------------------------------------------------------

-- Main claim record (ties to listing OR catalog item)
CREATE TABLE IF NOT EXISTS catalog_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  target_type claim_target_type NOT NULL,

  -- Who is claiming
  claimant claimant_type NOT NULL,
  tenant_id UUID REFERENCES cc_tenants(id) ON DELETE CASCADE,
  individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,

  -- What they are claiming (exactly one path)
  catalog_listing_id UUID REFERENCES catalog_listings(id) ON DELETE SET NULL,
  vehicle_catalog_id UUID REFERENCES vehicle_catalog(id) ON DELETE SET NULL,
  trailer_catalog_id UUID REFERENCES trailer_catalog(id) ON DELETE SET NULL,

  -- Intended outcome
  desired_action TEXT NOT NULL DEFAULT 'create_tenant_asset',
  -- 'create_tenant_asset' (default), 'link_existing' (future)

  -- Optional: if linking to existing tenant object
  target_tenant_vehicle_id UUID REFERENCES tenant_vehicles(id) ON DELETE SET NULL,
  target_tenant_trailer_id UUID REFERENCES tenant_trailers(id) ON DELETE SET NULL,

  -- Display / notes
  nickname TEXT,
  notes TEXT,

  -- Status lifecycle (uses catalog_claim_status)
  status catalog_claim_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,

  -- Review metadata (v1)
  reviewed_by_individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
  decision claim_decision,
  decision_reason TEXT,

  -- Binding outputs (set when applied)
  created_tenant_vehicle_id UUID REFERENCES tenant_vehicles(id) ON DELETE SET NULL,
  created_tenant_trailer_id UUID REFERENCES tenant_trailers(id) ON DELETE SET NULL,
  created_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,

  -- Provenance / raw
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Invariants
  CHECK (
    -- claimant=tenant requires tenant_id
    (claimant <> 'tenant' OR tenant_id IS NOT NULL)
  ),
  CHECK (
    -- target_type must match catalog pointers
    (target_type = 'vehicle' AND trailer_catalog_id IS NULL AND (catalog_listing_id IS NOT NULL OR vehicle_catalog_id IS NOT NULL))
 OR (target_type = 'trailer' AND vehicle_catalog_id IS NULL AND (catalog_listing_id IS NOT NULL OR trailer_catalog_id IS NOT NULL))
  ),
  CHECK (
    -- if linking existing, target object must be present and tenant_id must be present
    (desired_action <> 'link_existing')
    OR (tenant_id IS NOT NULL AND (
          (target_type = 'vehicle' AND target_tenant_vehicle_id IS NOT NULL)
       OR (target_type = 'trailer' AND target_tenant_trailer_id IS NOT NULL)
    ))
  ),
  CHECK (
    -- Only one of vehicle_catalog_id / trailer_catalog_id can be set
    (vehicle_catalog_id IS NULL OR trailer_catalog_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_claims_tenant_status
  ON catalog_claims(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_catalog_claims_individual_status
  ON catalog_claims(individual_id, status);

CREATE INDEX IF NOT EXISTS idx_catalog_claims_listing
  ON catalog_claims(catalog_listing_id);

CREATE INDEX IF NOT EXISTS idx_catalog_claims_vehicle_catalog
  ON catalog_claims(vehicle_catalog_id);

CREATE INDEX IF NOT EXISTS idx_catalog_claims_trailer_catalog
  ON catalog_claims(trailer_catalog_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catalog_claims_updated_at') THEN
    CREATE TRIGGER trg_catalog_claims_updated_at
      BEFORE UPDATE ON catalog_claims
      FOR EACH ROW
      EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

-- Claim evidence (photos/docs). Can optionally reference catalog_media rows.
CREATE TABLE IF NOT EXISTS catalog_claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES catalog_claims(id) ON DELETE CASCADE,

  evidence_type claim_evidence_type NOT NULL,
  url TEXT,                                -- direct upload, signed URL, etc.
  catalog_media_id UUID REFERENCES catalog_media(id) ON DELETE SET NULL,
  identity_document_id UUID REFERENCES cc_identity_documents(id) ON DELETE SET NULL,

  notes TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by_individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim
  ON catalog_claim_evidence(claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_type
  ON catalog_claim_evidence(evidence_type);

-- Claim events (audit trail)
CREATE TABLE IF NOT EXISTS catalog_claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES catalog_claims(id) ON DELETE CASCADE,

  event_type claim_event_type NOT NULL,
  actor_individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_events_claim_time
  ON catalog_claim_events(claim_id, created_at);

-- ---------------------------------------------------------------------------
-- 3) Status transition enforcement (ruthless, fail-closed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_enforce_claim_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  old_status catalog_claim_status;
  new_status catalog_claim_status;
BEGIN
  old_status := OLD.status;
  new_status := NEW.status;

  IF old_status = new_status THEN
    RETURN NEW;
  END IF;

  -- Allowed transitions:
  -- draft -> submitted | cancelled
  -- submitted -> under_review | cancelled
  -- under_review -> approved | rejected | cancelled
  -- approved -> applied
  -- rejected -> (terminal)
  -- cancelled -> (terminal)
  -- applied -> (terminal)
  IF old_status = 'draft' AND new_status IN ('submitted','cancelled') THEN
    RETURN NEW;
  ELSIF old_status = 'submitted' AND new_status IN ('under_review','cancelled') THEN
    RETURN NEW;
  ELSIF old_status = 'under_review' AND new_status IN ('approved','rejected','cancelled') THEN
    RETURN NEW;
  ELSIF old_status = 'approved' AND new_status IN ('applied') THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Invalid catalog_claims status transition: % -> %', old_status, new_status;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_claim_status_transition') THEN
    CREATE TRIGGER trg_claim_status_transition
      BEFORE UPDATE OF status ON catalog_claims
      FOR EACH ROW
      EXECUTE FUNCTION fn_enforce_claim_status_transition();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Capability extraction rules (optional table for future evolution)
--    v1 extraction below is hard-coded in fn_extract_capabilities_for_asset().
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog_capability_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type claim_target_type NOT NULL,
  capability_type TEXT NOT NULL,
  -- attributes_template is a JSON object with optional placeholder keys
  -- (v1: informational; v2 can implement templating)
  attributes_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_cap_templates_target
  ON catalog_capability_templates(target_type, capability_type);

-- ---------------------------------------------------------------------------
-- 5) Capability extraction function (v1 pragmatic baseline)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_extract_capabilities_for_asset(
  p_asset_id UUID,
  p_target_type claim_target_type,
  p_vehicle_catalog_id UUID,
  p_trailer_catalog_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sleeps INTEGER;
  v_power_amps INTEGER;
  v_has_kitchen BOOLEAN;
  v_has_bathroom BOOLEAN;
  v_has_shower BOOLEAN;

  v_make TEXT;
  v_model TEXT;
  v_year INTEGER;
  v_tow_capacity_kg NUMERIC;
  v_payload_kg NUMERIC;
  v_vehicle_class TEXT;

BEGIN
  -- Trailer baseline capabilities
  IF p_target_type = 'trailer' AND p_trailer_catalog_id IS NOT NULL THEN
    SELECT
      sleeps,
      power_amps,
      has_kitchen,
      has_bathroom,
      has_shower
    INTO
      v_sleeps,
      v_power_amps,
      v_has_kitchen,
      v_has_bathroom,
      v_has_shower
    FROM trailer_catalog
    WHERE id = p_trailer_catalog_id;

    -- sleeping
    IF v_sleeps IS NOT NULL AND v_sleeps > 0 THEN
      INSERT INTO asset_capabilities (id, asset_id, capability_type, attributes, constraints, is_active, created_at)
      VALUES (
        gen_random_uuid(),
        p_asset_id,
        'sleeping',
        jsonb_build_object('people', v_sleeps),
        '{}'::jsonb,
        true,
        now()
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- power_supply
    IF v_power_amps IS NOT NULL AND v_power_amps > 0 THEN
      INSERT INTO asset_capabilities (id, asset_id, capability_type, attributes, constraints, is_active, created_at)
      VALUES (
        gen_random_uuid(),
        p_asset_id,
        'power_supply',
        jsonb_build_object('amps', v_power_amps),
        '{}'::jsonb,
        true,
        now()
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- cooking
    IF v_has_kitchen IS TRUE THEN
      INSERT INTO asset_capabilities (id, asset_id, capability_type, attributes, constraints, is_active, created_at)
      VALUES (
        gen_random_uuid(),
        p_asset_id,
        'cooking',
        jsonb_build_object('kitchen', true),
        '{}'::jsonb,
        true,
        now()
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- waste_handling (simple proxy)
    IF v_has_bathroom IS TRUE OR v_has_shower IS TRUE THEN
      INSERT INTO asset_capabilities (id, asset_id, capability_type, attributes, constraints, is_active, created_at)
      VALUES (
        gen_random_uuid(),
        p_asset_id,
        'waste_handling',
        jsonb_build_object('has_bathroom', COALESCE(v_has_bathroom,false), 'has_shower', COALESCE(v_has_shower,false)),
        '{}'::jsonb,
        true,
        now()
      )
      ON CONFLICT DO NOTHING;
    END IF;

    RETURN;
  END IF;

  -- Vehicle baseline capabilities
  IF p_target_type = 'vehicle' AND p_vehicle_catalog_id IS NOT NULL THEN
    SELECT
      make,
      model,
      year,
      tow_capacity_kg,
      payload_kg,
      vehicle_type
    INTO
      v_make,
      v_model,
      v_year,
      v_tow_capacity_kg,
      v_payload_kg,
      v_vehicle_class
    FROM vehicle_catalog
    WHERE id = p_vehicle_catalog_id;

    INSERT INTO asset_capabilities (id, asset_id, capability_type, attributes, constraints, is_active, created_at)
    VALUES (
      gen_random_uuid(),
      p_asset_id,
      'transportable',
      jsonb_strip_nulls(
        jsonb_build_object(
          'vehicle_class', v_vehicle_class,
          'tow_capacity_kg', v_tow_capacity_kg,
          'payload_kg', v_payload_kg,
          'make', v_make,
          'model', v_model,
          'year', v_year
        )
      ),
      '{}'::jsonb,
      true,
      now()
    )
    ON CONFLICT DO NOTHING;

    RETURN;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Apply claim: create tenant object + bind asset + extract capabilities
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_apply_catalog_claim(p_claim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c RECORD;

  v_created_tenant_vehicle_id UUID;
  v_created_tenant_trailer_id UUID;
  v_asset_id UUID;
  v_vehicle_catalog_id UUID;
  v_trailer_catalog_id UUID;
BEGIN
  SELECT *
  INTO c
  FROM catalog_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_claim not found: %', p_claim_id;
  END IF;

  IF c.status <> 'approved' THEN
    RAISE EXCEPTION 'catalog_claim must be approved before apply. current status=%', c.status;
  END IF;

  IF c.tenant_id IS NULL THEN
    RAISE EXCEPTION 'catalog_claim must have tenant_id to apply (v1). claim_id=%', p_claim_id;
  END IF;

  -- Resolve catalog ids from listing if needed
  v_vehicle_catalog_id := c.vehicle_catalog_id;
  v_trailer_catalog_id := c.trailer_catalog_id;

  IF c.catalog_listing_id IS NOT NULL THEN
    IF c.target_type = 'vehicle' THEN
      SELECT vehicle_catalog_id INTO v_vehicle_catalog_id
      FROM catalog_listings
      WHERE id = c.catalog_listing_id;
    ELSE
      SELECT trailer_catalog_id INTO v_trailer_catalog_id
      FROM catalog_listings
      WHERE id = c.catalog_listing_id;
    END IF;
  END IF;

  -- Create tenant-owned object (or link existing)
  IF c.desired_action = 'link_existing' THEN
    IF c.target_type = 'vehicle' THEN
      v_created_tenant_vehicle_id := c.target_tenant_vehicle_id;
      SELECT asset_id INTO v_asset_id FROM tenant_vehicles WHERE id = v_created_tenant_vehicle_id;
    ELSE
      v_created_tenant_trailer_id := c.target_tenant_trailer_id;
      SELECT asset_id INTO v_asset_id FROM tenant_trailers WHERE id = v_created_tenant_trailer_id;
    END IF;

  ELSE
    -- create_tenant_asset
    IF c.target_type = 'vehicle' THEN
      INSERT INTO tenant_vehicles (id, tenant_id, catalog_vehicle_id, nickname, is_active, status)
      VALUES (gen_random_uuid(), c.tenant_id, v_vehicle_catalog_id, c.nickname, true, 'active')
      RETURNING id, asset_id INTO v_created_tenant_vehicle_id, v_asset_id;

    ELSE
      INSERT INTO tenant_trailers (id, tenant_id, catalog_trailer_id, nickname, is_active, status)
      VALUES (gen_random_uuid(), c.tenant_id, v_trailer_catalog_id, c.nickname, true, 'active')
      RETURNING id, asset_id INTO v_created_tenant_trailer_id, v_asset_id;
    END IF;
  END IF;

  IF v_asset_id IS NULL THEN
    RAISE EXCEPTION 'Expected asset_id to be set by trigger on tenant object insert. claim_id=%', p_claim_id;
  END IF;

  -- Extract baseline capabilities
  PERFORM fn_extract_capabilities_for_asset(
    v_asset_id,
    c.target_type,
    v_vehicle_catalog_id,
    v_trailer_catalog_id
  );

  -- Update claim outputs and status
  UPDATE catalog_claims
  SET
    created_tenant_vehicle_id = COALESCE(created_tenant_vehicle_id, v_created_tenant_vehicle_id),
    created_tenant_trailer_id = COALESCE(created_tenant_trailer_id, v_created_tenant_trailer_id),
    created_asset_id = COALESCE(created_asset_id, v_asset_id),
    applied_at = now(),
    status = 'applied'
  WHERE id = p_claim_id;

  INSERT INTO catalog_claim_events (id, claim_id, event_type, actor_individual_id, payload, created_at)
  VALUES (
    gen_random_uuid(),
    p_claim_id,
    'applied',
    c.reviewed_by_individual_id,
    jsonb_strip_nulls(jsonb_build_object(
      'created_tenant_vehicle_id', v_created_tenant_vehicle_id,
      'created_tenant_trailer_id', v_created_tenant_trailer_id,
      'created_asset_id', v_asset_id
    )),
    now()
  );

  INSERT INTO catalog_claim_events (id, claim_id, event_type, actor_individual_id, payload, created_at)
  VALUES (
    gen_random_uuid(),
    p_claim_id,
    'capabilities_extracted',
    c.reviewed_by_individual_id,
    jsonb_strip_nulls(jsonb_build_object(
      'asset_id', v_asset_id,
      'target_type', c.target_type,
      'vehicle_catalog_id', v_vehicle_catalog_id,
      'trailer_catalog_id', v_trailer_catalog_id
    )),
    now()
  );

END $$;

-- Trigger: when claim status transitions to 'approved', auto-apply (v1)
CREATE OR REPLACE FUNCTION fn_claim_auto_apply_on_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'under_review' THEN
    -- stamp decision times if not set
    IF NEW.decided_at IS NULL THEN
      NEW.decided_at := now();
    END IF;

    -- Apply immediately (synchronous v1)
    PERFORM fn_apply_catalog_claim(NEW.id);

    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_claim_auto_apply') THEN
    CREATE TRIGGER trg_claim_auto_apply
      AFTER UPDATE OF status ON catalog_claims
      FOR EACH ROW
      WHEN (NEW.status = 'approved')
      EXECUTE FUNCTION fn_claim_auto_apply_on_approved();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) RLS: tenant-scoped access on claim tables
--    Rule: tenant sees its own claims. service mode bypass allowed.
-- ---------------------------------------------------------------------------

ALTER TABLE catalog_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_claim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_capability_templates ENABLE ROW LEVEL SECURITY;

-- catalog_claims
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catalog_claims_select') THEN
    CREATE POLICY catalog_claims_select ON catalog_claims
    FOR SELECT
    USING (is_service_mode() OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catalog_claims_insert') THEN
    CREATE POLICY catalog_claims_insert ON catalog_claims
    FOR INSERT
    WITH CHECK (is_service_mode() OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catalog_claims_update') THEN
    CREATE POLICY catalog_claims_update ON catalog_claims
    FOR UPDATE
    USING (is_service_mode() OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id()))
    WITH CHECK (is_service_mode() OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catalog_claims_delete') THEN
    CREATE POLICY catalog_claims_delete ON catalog_claims
    FOR DELETE
    USING (is_service_mode() OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id()));
  END IF;
END $$;

-- evidence: derived access via claim's tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_evidence_select') THEN
    CREATE POLICY claim_evidence_select ON catalog_claim_evidence
    FOR SELECT
    USING (
      is_service_mode()
      OR EXISTS (
        SELECT 1 FROM catalog_claims c
        WHERE c.id = catalog_claim_evidence.claim_id
          AND c.tenant_id = current_tenant_id()
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_evidence_insert') THEN
    CREATE POLICY claim_evidence_insert ON catalog_claim_evidence
    FOR INSERT
    WITH CHECK (
      is_service_mode()
      OR EXISTS (
        SELECT 1 FROM catalog_claims c
        WHERE c.id = catalog_claim_evidence.claim_id
          AND c.tenant_id = current_tenant_id()
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_evidence_update') THEN
    CREATE POLICY claim_evidence_update ON catalog_claim_evidence
    FOR UPDATE
    USING (
      is_service_mode()
      OR EXISTS (
        SELECT 1 FROM catalog_claims c
        WHERE c.id = catalog_claim_evidence.claim_id
          AND c.tenant_id = current_tenant_id()
      )
    )
    WITH CHECK (
      is_service_mode()
      OR EXISTS (
        SELECT 1 FROM catalog_claims c
        WHERE c.id = catalog_claim_evidence.claim_id
          AND c.tenant_id = current_tenant_id()
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_evidence_delete') THEN
    CREATE POLICY claim_evidence_delete ON catalog_claim_evidence
    FOR DELETE
    USING (
      is_service_mode()
      OR EXISTS (
        SELECT 1 FROM catalog_claims c
        WHERE c.id = catalog_claim_evidence.claim_id
          AND c.tenant_id = current_tenant_id()
      )
    );
  END IF;
END $$;

-- events: derived access via claim's tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_events_select') THEN
    CREATE POLICY claim_events_select ON catalog_claim_events
    FOR SELECT
    USING (
      is_service_mode()
      OR EXISTS (
        SELECT 1 FROM catalog_claims c
        WHERE c.id = catalog_claim_events.claim_id
          AND c.tenant_id = current_tenant_id()
      )
    );
  END IF;

  -- typically only service/review workflow inserts events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_events_insert') THEN
    CREATE POLICY claim_events_insert ON catalog_claim_events
    FOR INSERT
    WITH CHECK (is_service_mode() OR TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_events_update') THEN
    CREATE POLICY claim_events_update ON catalog_claim_events
    FOR UPDATE
    USING (is_service_mode())
    WITH CHECK (is_service_mode());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'claim_events_delete') THEN
    CREATE POLICY claim_events_delete ON catalog_claim_events
    FOR DELETE
    USING (is_service_mode());
  END IF;
END $$;

-- capability templates: tenant-scoped future use (v1 keep service-only writes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cap_templates_select') THEN
    CREATE POLICY cap_templates_select ON catalog_capability_templates
    FOR SELECT
    USING (is_service_mode() OR current_tenant_id() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cap_templates_mutate') THEN
    CREATE POLICY cap_templates_mutate ON catalog_capability_templates
    FOR ALL
    USING (is_service_mode())
    WITH CHECK (is_service_mode());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8) Seed minimal templates (optional, informational)
-- ---------------------------------------------------------------------------

INSERT INTO catalog_capability_templates (id, target_type, capability_type, attributes_template, is_active, created_at)
VALUES
  (gen_random_uuid(), 'trailer', 'sleeping', jsonb_build_object('people', '${sleeps}'), true, now()),
  (gen_random_uuid(), 'trailer', 'power_supply', jsonb_build_object('amps', '${power_amps}'), true, now()),
  (gen_random_uuid(), 'trailer', 'cooking', jsonb_build_object('kitchen', true), true, now()),
  (gen_random_uuid(), 'vehicle', 'transportable', jsonb_build_object('tow_capacity_kg', '${tow_capacity_kg}', 'payload_kg', '${payload_kg}'), true, now())
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- END MIGRATION 027
-- ============================================================================
