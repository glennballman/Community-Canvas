-- ============================================================================
-- MIGRATION 050 — Rename "catalog" to "inventory" everywhere
-- Community Canvas
--
-- Goal
--   Eliminate the word "catalog" from the database entirely, replacing with
--   "inventory" for user-facing terminology consistency.
--
-- NOTE: Since there is no production data, this is a clean rename.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Rename tables
-- ---------------------------------------------------------------------------

-- Rename main tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_catalog') THEN
    ALTER TABLE vehicle_catalog RENAME TO vehicle_inventory;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_catalog') THEN
    ALTER TABLE trailer_catalog RENAME TO trailer_inventory;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_listings') THEN
    ALTER TABLE catalog_listings RENAME TO inventory_listings;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_media') THEN
    ALTER TABLE catalog_media RENAME TO inventory_media;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_claims') THEN
    ALTER TABLE catalog_claims RENAME TO inventory_claims;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_claim_evidence') THEN
    ALTER TABLE catalog_claim_evidence RENAME TO inventory_claim_evidence;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_claim_events') THEN
    ALTER TABLE catalog_claim_events RENAME TO inventory_claim_events;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_capability_templates') THEN
    ALTER TABLE catalog_capability_templates RENAME TO inventory_capability_templates;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_items') THEN
    ALTER TABLE catalog_items RENAME TO inventory_items;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Rename columns that reference catalog -> inventory
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- inventory_media columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_media' AND column_name = 'vehicle_catalog_id') THEN
    ALTER TABLE inventory_media RENAME COLUMN vehicle_catalog_id TO vehicle_inventory_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_media' AND column_name = 'trailer_catalog_id') THEN
    ALTER TABLE inventory_media RENAME COLUMN trailer_catalog_id TO trailer_inventory_id;
  END IF;

  -- inventory_listings columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_listings' AND column_name = 'vehicle_catalog_id') THEN
    ALTER TABLE inventory_listings RENAME COLUMN vehicle_catalog_id TO vehicle_inventory_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_listings' AND column_name = 'trailer_catalog_id') THEN
    ALTER TABLE inventory_listings RENAME COLUMN trailer_catalog_id TO trailer_inventory_id;
  END IF;

  -- inventory_claims columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_claims' AND column_name = 'vehicle_catalog_id') THEN
    ALTER TABLE inventory_claims RENAME COLUMN vehicle_catalog_id TO vehicle_inventory_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_claims' AND column_name = 'trailer_catalog_id') THEN
    ALTER TABLE inventory_claims RENAME COLUMN trailer_catalog_id TO trailer_inventory_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_claims' AND column_name = 'catalog_listing_id') THEN
    ALTER TABLE inventory_claims RENAME COLUMN catalog_listing_id TO inventory_listing_id;
  END IF;

  -- inventory_claim_evidence columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_claim_evidence' AND column_name = 'catalog_media_id') THEN
    ALTER TABLE inventory_claim_evidence RENAME COLUMN catalog_media_id TO inventory_media_id;
  END IF;

  -- tenant_vehicles columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_vehicles' AND column_name = 'catalog_vehicle_id') THEN
    ALTER TABLE tenant_vehicles RENAME COLUMN catalog_vehicle_id TO vehicle_inventory_id;
  END IF;

  -- tenant_trailers columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_trailers' AND column_name = 'catalog_trailer_id') THEN
    ALTER TABLE tenant_trailers RENAME COLUMN catalog_trailer_id TO trailer_inventory_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Rename enum type
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_claim_status') THEN
    ALTER TYPE catalog_claim_status RENAME TO inventory_claim_status;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Recreate functions with new names
-- ---------------------------------------------------------------------------

-- Drop old function if exists
DROP FUNCTION IF EXISTS fn_apply_catalog_claim(UUID);

-- Create renamed function
CREATE OR REPLACE FUNCTION fn_apply_inventory_claim(p_claim_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_vehicle_inventory_id UUID;
  v_trailer_inventory_id UUID;
  v_created_id UUID;
BEGIN
  SELECT * INTO c
  FROM inventory_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_claim not found: %', p_claim_id;
  END IF;

  IF c.status = 'applied' THEN
    RAISE EXCEPTION 'inventory_claim already applied. claim_id=%, status=%', p_claim_id, c.status;
  END IF;

  IF c.applied_at IS NOT NULL THEN
    RAISE EXCEPTION 'inventory_claim already has applied_at set. claim_id=%, applied_at=%', p_claim_id, c.applied_at;
  END IF;

  IF c.status <> 'approved' THEN
    RAISE EXCEPTION 'inventory_claim must be approved before apply. current status=%', c.status;
  END IF;

  IF c.tenant_id IS NULL THEN
    RAISE EXCEPTION 'inventory_claim must have tenant_id to apply (v1). claim_id=%', p_claim_id;
  END IF;

  -- Resolve inventory ids from listing if needed
  v_vehicle_inventory_id := c.vehicle_inventory_id;
  v_trailer_inventory_id := c.trailer_inventory_id;

  IF c.inventory_listing_id IS NOT NULL THEN
    IF c.target_type = 'vehicle' THEN
      SELECT vehicle_inventory_id INTO v_vehicle_inventory_id
      FROM inventory_listings
      WHERE id = c.inventory_listing_id;
    ELSE
      SELECT trailer_inventory_id INTO v_trailer_inventory_id
      FROM inventory_listings
      WHERE id = c.inventory_listing_id;
    END IF;
  END IF;

  -- Create the tenant asset
  IF c.target_type = 'vehicle' THEN
    IF v_vehicle_inventory_id IS NULL THEN
      RAISE EXCEPTION 'No vehicle_inventory_id resolved for vehicle claim %', p_claim_id;
    END IF;
    
    INSERT INTO tenant_vehicles (id, tenant_id, vehicle_inventory_id, nickname, is_active, status)
    VALUES (gen_random_uuid(), c.tenant_id, v_vehicle_inventory_id, c.nickname, true, 'active')
    RETURNING id INTO v_created_id;
  ELSE
    IF v_trailer_inventory_id IS NULL THEN
      RAISE EXCEPTION 'No trailer_inventory_id resolved for trailer claim %', p_claim_id;
    END IF;
    
    INSERT INTO tenant_trailers (id, tenant_id, trailer_inventory_id, nickname, is_active, status)
    VALUES (gen_random_uuid(), c.tenant_id, v_trailer_inventory_id, c.nickname, true, 'active')
    RETURNING id INTO v_created_id;
  END IF;

  -- Update claim with binding info
  UPDATE inventory_claims
  SET
    status = 'applied',
    applied_at = now(),
    created_tenant_vehicle_id = CASE WHEN c.target_type = 'vehicle' THEN v_created_id ELSE NULL END,
    created_tenant_trailer_id = CASE WHEN c.target_type = 'trailer' THEN v_created_id ELSE NULL END
  WHERE id = p_claim_id;

  -- Log the apply event
  INSERT INTO inventory_claim_events (id, claim_id, event_type, actor_individual_id, payload, created_at)
  VALUES (
    gen_random_uuid(),
    p_claim_id,
    'applied',
    NULL,
    jsonb_build_object(
      'vehicle_inventory_id', v_vehicle_inventory_id,
      'trailer_inventory_id', v_trailer_inventory_id
    ),
    now()
  );

  RETURN v_created_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Recreate triggers with new names
-- ---------------------------------------------------------------------------

-- Drop old triggers
DROP TRIGGER IF EXISTS trg_claim_auto_apply ON inventory_claims;
DROP TRIGGER IF EXISTS trg_claim_status_transition ON inventory_claims;
DROP TRIGGER IF EXISTS trg_catalog_claims_updated_at ON inventory_claims;

-- Create renamed triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_claims_updated_at'
  ) THEN
    CREATE TRIGGER trg_inventory_claims_updated_at
      BEFORE UPDATE ON inventory_claims
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Update RLS policies
-- ---------------------------------------------------------------------------

-- Drop old policies if they exist and recreate with new names
DO $$
BEGIN
  -- Drop old policies on renamed tables
  DROP POLICY IF EXISTS catalog_claims_tenant_isolation ON inventory_claims;
  DROP POLICY IF EXISTS claim_evidence_isolation ON inventory_claim_evidence;
  DROP POLICY IF EXISTS claim_events_isolation ON inventory_claim_events;
  DROP POLICY IF EXISTS claim_events_insert ON inventory_claim_events;
END $$;

-- Recreate policies with inventory naming
CREATE POLICY inventory_claims_tenant_isolation ON inventory_claims
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id = current_tenant_id()
    OR individual_id = current_individual_id()
  );

CREATE POLICY inventory_claim_evidence_isolation ON inventory_claim_evidence
  FOR ALL
  USING (
    is_service_mode()
    OR claim_id IN (
      SELECT id FROM inventory_claims
      WHERE tenant_id = current_tenant_id()
        OR individual_id = current_individual_id()
    )
  );

CREATE POLICY inventory_claim_events_isolation ON inventory_claim_events
  FOR ALL
  USING (
    is_service_mode()
    OR claim_id IN (
      SELECT id FROM inventory_claims
      WHERE tenant_id = current_tenant_id()
        OR individual_id = current_individual_id()
    )
  );

CREATE POLICY inventory_claim_events_insert ON inventory_claim_events
  FOR INSERT
  WITH CHECK (
    is_service_mode()
    OR claim_id IN (
      SELECT id FROM inventory_claims
      WHERE tenant_id = current_tenant_id()
        OR individual_id = current_individual_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Update status transition trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_inventory_claim_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate status transitions
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid inventory_claims status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'under_review', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid inventory_claims status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'under_review' AND NEW.status NOT IN ('under_review', 'approved', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid inventory_claims status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'applied', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid inventory_claims status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status IN ('rejected', 'cancelled', 'applied') AND OLD.status <> NEW.status THEN
    RAISE EXCEPTION 'Invalid inventory_claims status transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for status transitions
DROP TRIGGER IF EXISTS trg_inventory_claim_status_transition ON inventory_claims;
CREATE TRIGGER trg_inventory_claim_status_transition
  BEFORE UPDATE ON inventory_claims
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_inventory_claim_status_transition();

COMMIT;
