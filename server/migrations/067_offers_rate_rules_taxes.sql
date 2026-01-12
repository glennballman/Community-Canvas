-- V3.3.1 Block 04: Offers + Rate Rules + Tax Integration
-- Unified pricing stack: offers → rate_rules → tax_rules

-- ============================================================================
-- cc_offers - Pricing products for facilities
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES cc_facilities(id) ON DELETE CASCADE,
  
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  offer_type VARCHAR(32) NOT NULL,
  participation_mode cc_participation_mode NOT NULL DEFAULT 'requests_only',
  
  price_cents INTEGER NOT NULL,
  currency CHAR(3) DEFAULT 'CAD',
  
  duration_type VARCHAR(16),
  duration_value INTEGER DEFAULT 1,
  
  tax_category_code VARCHAR(64) NOT NULL,
  
  applies_to_unit_types VARCHAR(32)[],
  constraints JSONB DEFAULT '{}'::jsonb,
  
  is_addon BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, facility_id, code)
);

-- ============================================================================
-- cc_rate_rules - Dynamic pricing adjustments
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_rate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES cc_offers(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(32) NOT NULL CHECK (rule_type IN ('seasonal', 'length_tier', 'weekday', 'early_bird', 'last_minute', 'duration_discount')),
  
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  adjustment_type VARCHAR(16) NOT NULL CHECK (adjustment_type IN ('multiply', 'add_cents', 'replace_cents')),
  adjustment_value NUMERIC(10, 4) NOT NULL,
  
  priority INTEGER NOT NULL DEFAULT 100,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- cc_tax_rules - Tax configuration by category
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  tax_category_code VARCHAR(64) NOT NULL,
  tax_name VARCHAR(32) NOT NULL,
  
  rate_percent NUMERIC(6, 4) NOT NULL,
  
  applies_after TIMESTAMPTZ,
  min_nights INTEGER,
  
  is_compound BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS cc_offers_tenant_idx ON cc_offers(tenant_id);
CREATE INDEX IF NOT EXISTS cc_offers_facility_idx ON cc_offers(facility_id);
CREATE INDEX IF NOT EXISTS cc_offers_code_idx ON cc_offers(tenant_id, facility_id, code);
CREATE INDEX IF NOT EXISTS cc_offers_type_idx ON cc_offers(offer_type);

CREATE INDEX IF NOT EXISTS cc_rate_rules_tenant_idx ON cc_rate_rules(tenant_id);
CREATE INDEX IF NOT EXISTS cc_rate_rules_offer_idx ON cc_rate_rules(offer_id);
CREATE INDEX IF NOT EXISTS cc_rate_rules_type_idx ON cc_rate_rules(rule_type);

CREATE INDEX IF NOT EXISTS cc_tax_rules_tenant_idx ON cc_tax_rules(tenant_id);
CREATE INDEX IF NOT EXISTS cc_tax_rules_category_idx ON cc_tax_rules(tax_category_code);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_tax_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_offers_tenant_isolation ON cc_offers;
CREATE POLICY cc_offers_tenant_isolation ON cc_offers
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

DROP POLICY IF EXISTS cc_rate_rules_tenant_isolation ON cc_rate_rules;
CREATE POLICY cc_rate_rules_tenant_isolation ON cc_rate_rules
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

DROP POLICY IF EXISTS cc_tax_rules_tenant_isolation ON cc_tax_rules;
CREATE POLICY cc_tax_rules_tenant_isolation ON cc_tax_rules
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_offers TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_rate_rules TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_tax_rules TO PUBLIC;

-- ============================================================================
-- SEED DATA - Bamfield Offers
-- ============================================================================

-- Save Paradise Parking Offers
INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types)
SELECT 
  '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
  f.id,
  'DAY_PASS',
  'Day Pass',
  'Single day parking pass',
  'day_pass',
  'instant_confirm',
  1500,
  'PARKING_FEE',
  'day',
  1,
  ARRAY['stall']
FROM cc_facilities f WHERE f.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8' AND f.slug = 'main-lot'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types)
SELECT 
  '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
  f.id,
  'OVERNIGHT',
  'Overnight',
  'Overnight parking pass',
  'overnight',
  'instant_confirm',
  2500,
  'PARKING_FEE',
  'night',
  1,
  ARRAY['stall']
FROM cc_facilities f WHERE f.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8' AND f.slug = 'main-lot'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types, constraints)
SELECT 
  '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
  f.id,
  'OVERSIZE_DAY',
  'Oversize Day',
  'Day pass for oversize vehicles',
  'day_pass',
  'instant_confirm',
  2500,
  'PARKING_FEE',
  'day',
  1,
  ARRAY['stall'],
  '{"oversize": true}'::jsonb
FROM cc_facilities f WHERE f.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8' AND f.slug = 'main-lot'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Woods End Marina Offers
INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types)
SELECT 
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  f.id,
  'SLIP_NIGHT',
  'Transient Moorage',
  'Nightly moorage per foot',
  'slip_overnight',
  'instant_confirm',
  250,
  'MOORAGE_FEE',
  'night',
  1,
  ARRAY['slip', 'segment']
FROM cc_facilities f WHERE f.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337' AND f.slug = 'main-dock'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, is_addon)
SELECT 
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  f.id,
  'POWER_30A',
  '30A Shore Power',
  'Shore power addon per night',
  'power_addon',
  'instant_confirm',
  1500,
  'MOORAGE_FEE',
  'night',
  1,
  true
FROM cc_facilities f WHERE f.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337' AND f.slug = 'main-dock'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types)
SELECT 
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  f.id,
  'MONTHLY',
  'Monthly Moorage',
  'Monthly moorage per foot',
  'moorage_monthly',
  'manual_confirm',
  1200,
  'MOORAGE_FEE',
  'month',
  1,
  ARRAY['slip', 'segment']
FROM cc_facilities f WHERE f.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337' AND f.slug = 'main-dock'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- HFN Marina Offer
INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types)
SELECT 
  '00000000-0000-0000-0001-000000000001',
  f.id,
  'SLIP_NIGHT',
  'Transient Moorage',
  'Nightly moorage per foot',
  'slip_overnight',
  'manual_confirm',
  200,
  'MOORAGE_FEE',
  'night',
  1,
  ARRAY['slip']
FROM cc_facilities f WHERE f.tenant_id = '00000000-0000-0000-0001-000000000001' AND f.slug = 'hfn-dock'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Woods End Landing Offer
INSERT INTO cc_offers (tenant_id, facility_id, code, name, description, offer_type, participation_mode, price_cents, tax_category_code, duration_type, duration_value, applies_to_unit_types)
SELECT 
  'd0000000-0000-0000-0000-000000000001',
  f.id,
  'CABIN_NIGHT',
  'Cabin Nightly',
  'Nightly cabin rental',
  'overnight',
  'instant_confirm',
  25000,
  'LODGING_SHORT_TERM',
  'night',
  1,
  ARRAY['room']
FROM cc_facilities f WHERE f.tenant_id = 'd0000000-0000-0000-0000-000000000001' AND f.slug = 'main-lodge'
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- ============================================================================
-- SEED DATA - Rate Rules
-- ============================================================================

-- Save Paradise DAY_PASS Peak Season
INSERT INTO cc_rate_rules (tenant_id, offer_id, rule_name, rule_type, conditions, adjustment_type, adjustment_value, priority)
SELECT 
  o.tenant_id,
  o.id,
  'Peak Season',
  'seasonal',
  '{"start_date": "2026-06-01", "end_date": "2026-09-15"}'::jsonb,
  'multiply',
  1.5,
  100
FROM cc_offers o
WHERE o.code = 'DAY_PASS' AND o.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8'
ON CONFLICT DO NOTHING;

-- Woods End Marina SLIP_NIGHT Large Vessel
INSERT INTO cc_rate_rules (tenant_id, offer_id, rule_name, rule_type, conditions, adjustment_type, adjustment_value, priority)
SELECT 
  o.tenant_id,
  o.id,
  'Large Vessel',
  'length_tier',
  '{"min_length_ft": 40}'::jsonb,
  'multiply',
  1.25,
  90
FROM cc_offers o
WHERE o.code = 'SLIP_NIGHT' AND o.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337'
ON CONFLICT DO NOTHING;

-- Woods End Marina SLIP_NIGHT Peak Season
INSERT INTO cc_rate_rules (tenant_id, offer_id, rule_name, rule_type, conditions, adjustment_type, adjustment_value, priority)
SELECT 
  o.tenant_id,
  o.id,
  'Peak Season',
  'seasonal',
  '{"start_date": "2026-06-01", "end_date": "2026-09-15"}'::jsonb,
  'multiply',
  1.5,
  100
FROM cc_offers o
WHERE o.code = 'SLIP_NIGHT' AND o.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337'
ON CONFLICT DO NOTHING;

-- Woods End Landing CABIN_NIGHT Weekend
INSERT INTO cc_rate_rules (tenant_id, offer_id, rule_name, rule_type, conditions, adjustment_type, adjustment_value, priority)
SELECT 
  o.tenant_id,
  o.id,
  'Weekend',
  'weekday',
  '{"days": ["friday", "saturday"]}'::jsonb,
  'multiply',
  1.2,
  90
FROM cc_offers o
WHERE o.code = 'CABIN_NIGHT' AND o.tenant_id = 'd0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Woods End Landing CABIN_NIGHT Peak Season
INSERT INTO cc_rate_rules (tenant_id, offer_id, rule_name, rule_type, conditions, adjustment_type, adjustment_value, priority)
SELECT 
  o.tenant_id,
  o.id,
  'Peak Season',
  'seasonal',
  '{"start_date": "2026-06-01", "end_date": "2026-09-15"}'::jsonb,
  'multiply',
  1.75,
  100
FROM cc_offers o
WHERE o.code = 'CABIN_NIGHT' AND o.tenant_id = 'd0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED DATA - BC Tax Rules (tenant-agnostic, use community tenant)
-- ============================================================================

-- PARKING_FEE taxes
INSERT INTO cc_tax_rules (tenant_id, tax_category_code, tax_name, rate_percent)
VALUES ('c0000000-0000-0000-0000-000000000001', 'PARKING_FEE', 'GST', 5.0)
ON CONFLICT DO NOTHING;

-- MOORAGE_FEE taxes
INSERT INTO cc_tax_rules (tenant_id, tax_category_code, tax_name, rate_percent)
VALUES ('c0000000-0000-0000-0000-000000000001', 'MOORAGE_FEE', 'GST', 5.0)
ON CONFLICT DO NOTHING;

-- LODGING_SHORT_TERM taxes
INSERT INTO cc_tax_rules (tenant_id, tax_category_code, tax_name, rate_percent)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'LODGING_SHORT_TERM', 'GST', 5.0),
  ('c0000000-0000-0000-0000-000000000001', 'LODGING_SHORT_TERM', 'PST', 8.0),
  ('c0000000-0000-0000-0000-000000000001', 'LODGING_SHORT_TERM', 'MRDT', 3.0)
ON CONFLICT DO NOTHING;

-- Set MRDT min_nights constraint
UPDATE cc_tax_rules 
SET min_nights = 27 
WHERE tax_name = 'MRDT' AND tenant_id = 'c0000000-0000-0000-0000-000000000001';
