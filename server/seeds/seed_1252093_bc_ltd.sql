-- ============================================================================
-- SEED: 1252093 BC LTD — Multi-Portal Business Tenant
-- ============================================================================
-- This seed creates:
-- 1. The tenant: 1252093 BC LTD (business type)
-- 2. Three portals: Enviropaving BC, Remote Serve, Enviro Bright Lights
-- 3. Fleet assets (vehicles, trailers, equipment)
--
-- NOTE: Users (Ellen White, Pavel) must be created through the application's
-- identity/membership flow, not raw SQL inserts.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create or update tenant
-- ============================================================================

INSERT INTO cc_tenants (id, name, slug, tenant_type, status, created_at)
VALUES (
  'b1252093-0000-4000-8000-000000000001',
  '1252093 BC LTD',
  '1252093-bc-ltd',
  'business',
  'active',
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  tenant_type = EXCLUDED.tenant_type,
  status = EXCLUDED.status;

-- ============================================================================
-- STEP 2: Create portals for the tenant
-- Portal slugs are globally unique
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM cc_tenants WHERE slug = '1252093-bc-ltd';
  
  -- Portal 1: Enviropaving BC (paving/construction services)
  INSERT INTO portals (
    owning_tenant_id, name, slug, portal_type, legal_dba_name, 
    status, primary_audience, tagline
  )
  VALUES (
    v_tenant_id,
    'Enviropaving BC',
    'enviropaving',
    'business_service',
    'Enviropaving BC',
    'active',
    'buyer',
    'Eco-friendly paving solutions for BC communities'
  )
  ON CONFLICT (slug) DO UPDATE SET
    owning_tenant_id = EXCLUDED.owning_tenant_id,
    portal_type = EXCLUDED.portal_type,
    legal_dba_name = EXCLUDED.legal_dba_name,
    name = EXCLUDED.name;

  -- Portal 2: Remote Serve (remote community services)
  INSERT INTO portals (
    owning_tenant_id, name, slug, portal_type, legal_dba_name, 
    status, primary_audience, tagline
  )
  VALUES (
    v_tenant_id,
    'Remote Serve',
    'remote-serve',
    'business_service',
    'Remote Serve',
    'active',
    'buyer',
    'Reliable services for remote BC communities'
  )
  ON CONFLICT (slug) DO UPDATE SET
    owning_tenant_id = EXCLUDED.owning_tenant_id,
    portal_type = EXCLUDED.portal_type,
    legal_dba_name = EXCLUDED.legal_dba_name,
    name = EXCLUDED.name;

  -- Portal 3: Enviro Bright Lights (lighting/electrical services)
  INSERT INTO portals (
    owning_tenant_id, name, slug, portal_type, legal_dba_name, 
    status, primary_audience, tagline
  )
  VALUES (
    v_tenant_id,
    'Enviro Bright Lights',
    'enviro-bright',
    'business_service',
    'Enviro Bright Lights',
    'active',
    'buyer',
    'Sustainable lighting solutions'
  )
  ON CONFLICT (slug) DO UPDATE SET
    owning_tenant_id = EXCLUDED.owning_tenant_id,
    portal_type = EXCLUDED.portal_type,
    legal_dba_name = EXCLUDED.legal_dba_name,
    name = EXCLUDED.name;
    
END $$;

-- ============================================================================
-- STEP 3: Create fleet assets (tenant-level, NOT portal-level)
-- Assets are shared across all portals within the tenant
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM cc_tenants WHERE slug = '1252093-bc-ltd';
  
  -- VEHICLES (source_table = 'seed_data', source_id = unique identifier)
  INSERT INTO unified_assets (owner_tenant_id, name, asset_type, description, status, source_table, source_id, created_at)
  VALUES
    (v_tenant_id, '2015 Ford F350 Silver', 'vehicle', 'Gas, longbox, roof rack, 4WD, seats 6, bumper hitch', 'active', 'seed_data', '1252093-v-f350-silver', NOW()),
    (v_tenant_id, '2015 Ford F350 Grey', 'vehicle', 'Gas, longbox, 4WD, seats 6, bumper hitch', 'active', 'seed_data', '1252093-v-f350-grey', NOW()),
    (v_tenant_id, '2012 Ford F350 White', 'vehicle', 'Diesel, shortbox, 5th wheel + bumper hitch, 4WD, seats 6', 'active', 'seed_data', '1252093-v-f350-white', NOW()),
    (v_tenant_id, '2006 Isuzu 3500 Cube Van', 'vehicle', 'Diesel, hydraulic lift 2000 lbs, Crown mortar mixer, 6000 lbs cargo', 'active', 'seed_data', '1252093-v-isuzu-cube', NOW())
  ON CONFLICT DO NOTHING;

  -- EQUIPMENT
  INSERT INTO unified_assets (owner_tenant_id, name, asset_type, description, status, source_table, source_id, created_at)
  VALUES
    (v_tenant_id, 'Green Forklift', 'equipment', 'Propane, outdoor rated', 'active', 'seed_data', '1252093-e-forklift', NOW()),
    (v_tenant_id, 'Pallet Jack', 'equipment', 'Manual pallet jack', 'active', 'seed_data', '1252093-e-pallet-jack', NOW())
  ON CONFLICT DO NOTHING;

  -- TRAILERS
  INSERT INTO unified_assets (owner_tenant_id, name, asset_type, description, status, source_table, source_id, created_at)
  VALUES
    (v_tenant_id, '24ft Royal Cargo Cube Trailer', 'trailer', '24 foot enclosed cargo trailer', 'active', 'seed_data', '1252093-t-royal-24ft', NOW()),
    (v_tenant_id, '18ft Cargo Trailer', 'trailer', '18 foot cargo trailer', 'active', 'seed_data', '1252093-t-cargo-18ft', NOW()),
    (v_tenant_id, '22ft Flatbed Tandem Trailer', 'trailer', '22 foot flatbed, tandem axle, 10000 lbs capacity', 'active', 'seed_data', '1252093-t-flatbed-22ft', NOW())
  ON CONFLICT DO NOTHING;
    
END $$;

-- ============================================================================
-- STEP 4: Verification queries (output for confirmation)
-- ============================================================================

-- Show created tenant
SELECT id, name, slug, tenant_type, status 
FROM cc_tenants WHERE slug = '1252093-bc-ltd';

-- Show created portals
SELECT p.id, p.name, p.slug, p.portal_type, p.legal_dba_name, p.status
FROM portals p
JOIN cc_tenants t ON p.owning_tenant_id = t.id
WHERE t.slug = '1252093-bc-ltd';

-- Show created assets
SELECT ua.id, ua.name, ua.asset_type, ua.status
FROM unified_assets ua
JOIN cc_tenants t ON ua.owner_tenant_id = t.id
WHERE t.slug = '1252093-bc-ltd'
ORDER BY ua.asset_type, ua.name;

COMMIT;

-- ============================================================================
-- POST-SEED: User Setup Instructions
-- ============================================================================
-- Users should be created through the application's identity flow:
--
-- 1. Ellen White (Admin):
--    - Role: admin on tenant 1252093 BC LTD
--    - default_portal_id: remote-serve portal
--    - Use application signup/invite flow
--
-- 2. Pavel (Crew/Member):
--    - Role: crew/member on tenant 1252093 BC LTD
--    - No default portal needed (ops role)
--    - Use application signup/invite flow
-- ============================================================================
