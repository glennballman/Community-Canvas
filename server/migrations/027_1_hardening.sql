-- ============================================================================
-- MIGRATION 027.1 — Catalog Claim Hardening
-- 1) Tighten RLS on catalog_claim_events: INSERT must be is_service_mode() only
-- 2) Prevent fn_apply_catalog_claim() from running twice
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Tighten RLS on catalog_claim_events INSERT
--    Replace the permissive policy with service-mode-only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS claim_events_insert ON catalog_claim_events;

CREATE POLICY claim_events_insert ON catalog_claim_events
  FOR INSERT
  WITH CHECK (is_service_mode());

-- ---------------------------------------------------------------------------
-- 2) Harden fn_apply_catalog_claim() to prevent double-apply
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

  -- HARDENING: Prevent double-apply
  IF c.status = 'applied' THEN
    RAISE EXCEPTION 'catalog_claim already applied. claim_id=%, status=%', p_claim_id, c.status;
  END IF;

  IF c.applied_at IS NOT NULL THEN
    RAISE EXCEPTION 'catalog_claim already has applied_at set. claim_id=%, applied_at=%', p_claim_id, c.applied_at;
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

COMMIT;

-- ============================================================================
-- END MIGRATION 027.1
-- ============================================================================
