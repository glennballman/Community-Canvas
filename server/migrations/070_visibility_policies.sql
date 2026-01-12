-- V3.3.1 Block 08: Visibility Policies
-- Truth vs Disclosure layer for public-facing availability signals

CREATE TABLE IF NOT EXISTS cc_asset_visibility_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES cc_assets(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES cc_facilities(id) ON DELETE CASCADE,
  
  policy_mode varchar(20) NOT NULL DEFAULT 'truthful' 
    CHECK (policy_mode IN ('scarcity_bookable', 'truthful', 'hidden', 'request_only')),
  
  public_signal_available varchar(20) DEFAULT 'limited'
    CHECK (public_signal_available IN ('available', 'limited', 'call_to_confirm')),
  
  public_signal_full varchar(20) DEFAULT 'waitlist'
    CHECK (public_signal_full IN ('waitlist', 'call_to_confirm', 'unavailable')),
  
  operator_can_view_truth boolean DEFAULT true,
  public_can_show boolean DEFAULT true,
  allow_requests_when_full boolean DEFAULT true,
  
  seasonal_rules jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT cc_asset_visibility_policies_target_check 
    CHECK ((asset_id IS NOT NULL) != (facility_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS cc_asset_visibility_policies_tenant_idx 
  ON cc_asset_visibility_policies(tenant_id);
CREATE INDEX IF NOT EXISTS cc_asset_visibility_policies_asset_idx 
  ON cc_asset_visibility_policies(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cc_asset_visibility_policies_facility_idx 
  ON cc_asset_visibility_policies(facility_id) WHERE facility_id IS NOT NULL;

ALTER TABLE cc_asset_visibility_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_asset_visibility_policies_tenant_isolation ON cc_asset_visibility_policies;
CREATE POLICY cc_asset_visibility_policies_tenant_isolation ON cc_asset_visibility_policies
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Seed visibility policies for Bamfield facilities
-- Using subqueries to get facility IDs

INSERT INTO cc_asset_visibility_policies (tenant_id, facility_id, policy_mode, public_signal_available, public_signal_full)
SELECT 
  f.tenant_id,
  f.id,
  CASE 
    WHEN f.name ILIKE '%marina%' OR f.name ILIKE '%dock%' THEN 'scarcity_bookable'
    WHEN f.name ILIKE '%parking%' THEN 'truthful'
    ELSE 'truthful'
  END,
  CASE 
    WHEN f.name ILIKE '%marina%' OR f.name ILIKE '%dock%' THEN 'limited'
    WHEN f.name ILIKE '%parking%' THEN 'available'
    ELSE 'available'
  END,
  CASE 
    WHEN f.name ILIKE '%marina%' OR f.name ILIKE '%dock%' THEN 'waitlist'
    WHEN f.name ILIKE '%parking%' THEN 'unavailable'
    ELSE 'unavailable'
  END
FROM cc_facilities f
WHERE f.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM cc_asset_visibility_policies p 
    WHERE p.facility_id = f.id
  );

-- Special policy for HFN Marina - request_only
UPDATE cc_asset_visibility_policies
SET policy_mode = 'request_only',
    public_signal_available = 'call_to_confirm',
    public_signal_full = 'call_to_confirm'
WHERE facility_id IN (
  SELECT id FROM cc_facilities 
  WHERE name ILIKE '%HFN%' OR name ILIKE '%Huu-ay-aht%'
);
