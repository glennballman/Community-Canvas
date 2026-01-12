-- Migration: 073_cart_foundation.sql
-- 30-PROMPT PACK - PROMPT 01: Foundation Tables (Cart + Items + Adjustments + Partner Requests + Weather)
-- Creates cart-first reservation system integrating with V3.3.1 infrastructure

-- PHASE 1: Create cc_reservation_carts
BEGIN;

CREATE TABLE IF NOT EXISTS cc_reservation_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Schema.org alignment
  schema_type varchar DEFAULT 'Order',
  
  -- Context (all optional - cart can exist standalone)
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  trip_id uuid,
  
  -- Access
  access_token varchar NOT NULL UNIQUE,
  
  -- Lifecycle: draft → quote → checking_out → submitted → completed | expired | cancelled
  status varchar NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'quote', 'checking_out', 'submitted', 'completed', 'expired', 'cancelled'
  )),
  currency varchar NOT NULL DEFAULT 'CAD',
  
  -- Expiry
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 minutes'),
  submitted_at timestamptz,
  completed_at timestamptz,
  
  -- Guest info
  primary_guest_name varchar,
  primary_guest_email varchar,
  primary_guest_phone varchar,
  guest_language varchar DEFAULT 'en',
  
  -- Party composition
  party_adults integer DEFAULT 1,
  party_children integer DEFAULT 0,
  party_infants integer DEFAULT 0,
  
  -- INTENT (what kind of trip/booking)
  intent_json jsonb DEFAULT '{}'::jsonb,
  
  -- SAFETY ENVELOPE (dietary, accessibility, medical, pets)
  needs_json jsonb DEFAULT '{}'::jsonb,
  
  -- PAYMENT (flexibility for cash, invoice, bond)
  payment_json jsonb DEFAULT '{}'::jsonb,
  
  -- TRAVEL (airline integration)
  travel_json jsonb DEFAULT '{}'::jsonb,
  
  -- VIRAL (growth tracking)
  viral_json jsonb DEFAULT '{}'::jsonb,
  
  -- QUOTE (for groups/RFP)
  quote_json jsonb DEFAULT '{}'::jsonb,
  
  -- Source tracking
  source varchar DEFAULT 'public',
  source_ref varchar,
  entry_point varchar,
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_carts_token ON cc_reservation_carts(access_token);
CREATE INDEX IF NOT EXISTS idx_cc_carts_status ON cc_reservation_carts(status, expires_at) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_cc_carts_trip ON cc_reservation_carts(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_carts_portal ON cc_reservation_carts(portal_id) WHERE portal_id IS NOT NULL;

ALTER TABLE cc_reservation_carts ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PHASE 2: Create cc_reservation_cart_items
BEGIN;

CREATE TABLE IF NOT EXISTS cc_reservation_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES cc_reservation_carts(id) ON DELETE CASCADE,
  
  schema_type varchar DEFAULT 'Offer',
  
  -- What
  item_type varchar NOT NULL CHECK (item_type IN (
    'parking', 'accommodation', 'charter', 'activity', 'meal', 
    'rental', 'equipment', 'service', 'transport', 'venue', 'other'
  )),
  title varchar NOT NULL,
  description text,
  
  -- Fulfillment mode (THE key abstraction)
  reservation_mode varchar NOT NULL DEFAULT 'internal' CHECK (reservation_mode IN (
    'internal',
    'external',
    'public'
  )),
  
  -- Internal fields (links to V3.3.1 infrastructure)
  facility_id uuid REFERENCES cc_facilities(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES cc_offers(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES cc_inventory_units(id) ON DELETE SET NULL,
  asset_id uuid,
  moment_id uuid,
  provider_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- External/partner fields
  external_url text,
  external_reservation_ref varchar,
  provider_name varchar,
  provider_email varchar,
  provider_phone varchar,
  
  -- Scheduling
  start_at timestamptz,
  end_at timestamptz,
  preferred_time time,
  flexible_window_minutes integer,
  
  -- Quantity
  quantity integer DEFAULT 1,
  party_size integer,
  
  -- Approval
  requires_approval boolean NOT NULL DEFAULT false,
  approval_status varchar NOT NULL DEFAULT 'not_required' CHECK (approval_status IN (
    'not_required', 'pending', 'approved', 'rejected'
  )),
  
  -- Pricing (uses V3.3.1 pricingService for calculation)
  rate_type varchar,
  rate_amount numeric,
  subtotal_cents integer,
  taxes_cents integer DEFAULT 0,
  total_cents integer,
  deposit_required_cents integer DEFAULT 0,
  
  -- Pricing snapshot from V3.3.1 calculateQuote()
  pricing_snapshot jsonb DEFAULT '{}'::jsonb,
  
  -- HOLD (soft holds - integrates with V3.3.1 allocation)
  hold_json jsonb DEFAULT '{}'::jsonb,
  
  -- INTENT at item level
  intent_json jsonb DEFAULT '{}'::jsonb,
  
  -- NEEDS at item level
  needs_json jsonb DEFAULT '{}'::jsonb,
  dietary_requirements text[],
  special_requests text,
  
  -- WEATHER
  weather_json jsonb DEFAULT '{}'::jsonb,
  
  -- Links (populated at checkout - connects to V3.3.1)
  reservation_id uuid REFERENCES cc_reservations(id) ON DELETE SET NULL,
  reservation_item_id uuid REFERENCES cc_reservation_items(id) ON DELETE SET NULL,
  partner_request_id uuid,
  itinerary_item_id uuid,
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending', 'reserved', 'pending_confirmation', 'confirmed', 'cancelled'
  )),
  
  -- Metadata
  requirements_snapshot jsonb DEFAULT '{}'::jsonb,
  details_json jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_cart_items_cart ON cc_reservation_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cc_cart_items_facility ON cc_reservation_cart_items(facility_id) WHERE facility_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_cart_items_offer ON cc_reservation_cart_items(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_cart_items_mode ON cc_reservation_cart_items(cart_id, reservation_mode);

ALTER TABLE cc_reservation_cart_items ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PHASE 3: Create cc_reservation_cart_adjustments
BEGIN;

CREATE TABLE IF NOT EXISTS cc_reservation_cart_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES cc_reservation_carts(id) ON DELETE CASCADE,
  
  label varchar NOT NULL,
  adjustment_type varchar NOT NULL DEFAULT 'discount' CHECK (adjustment_type IN (
    'discount', 'fee', 'credit', 'tax', 'pet_fee', 'cleaning_fee', 
    'deposit', 'group_discount', 'promo_code', 'loyalty'
  )),
  
  amount_cents integer NOT NULL,
  scope varchar NOT NULL DEFAULT 'cart' CHECK (scope IN ('cart', 'item')),
  item_id uuid REFERENCES cc_reservation_cart_items(id) ON DELETE CASCADE,
  
  rule_code varchar,
  rules_snapshot jsonb DEFAULT '{}'::jsonb,
  is_taxable boolean DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_cart_adj_cart ON cc_reservation_cart_adjustments(cart_id);

ALTER TABLE cc_reservation_cart_adjustments ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PHASE 4: Create cc_partner_reservation_requests
BEGIN;

CREATE TABLE IF NOT EXISTS cc_partner_reservation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  cart_id uuid REFERENCES cc_reservation_carts(id) ON DELETE SET NULL,
  cart_item_id uuid REFERENCES cc_reservation_cart_items(id) ON DELETE SET NULL,
  trip_id uuid,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Partner
  provider_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  provider_name varchar,
  provider_email varchar,
  provider_phone varchar,
  
  -- Request
  request_type varchar NOT NULL DEFAULT 'reservation' CHECK (request_type IN (
    'reservation', 'quote', 'availability', 'inquiry'
  )),
  status varchar NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'sent', 'viewed', 'accepted', 'declined', 
    'needs_info', 'cancelled', 'expired'
  )),
  
  -- The ask
  item_type varchar,
  title varchar,
  requested_start timestamptz,
  requested_end timestamptz,
  preferred_time time,
  party_size integer,
  
  -- Guest
  contact_name varchar,
  contact_email varchar,
  contact_phone varchar,
  
  -- Needs
  needs_json jsonb DEFAULT '{}'::jsonb,
  dietary_requirements text[],
  special_accommodations text,
  notes text,
  
  -- Response
  provider_confirmation_ref varchar,
  provider_notes text,
  responded_at timestamptz,
  confirmed_start timestamptz,
  confirmed_end timestamptz,
  
  -- VIRAL: Partner invitation (network growth)
  partner_invitation_sent boolean DEFAULT false,
  partner_invitation_sent_at timestamptz,
  partner_onboarded boolean DEFAULT false,
  
  -- Details
  details_json jsonb DEFAULT '{}'::jsonb,
  
  -- Communication
  request_sent_at timestamptz,
  expires_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_partner_req_cart ON cc_partner_reservation_requests(cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_partner_req_status ON cc_partner_reservation_requests(status) WHERE status IN ('requested', 'sent');

ALTER TABLE cc_partner_reservation_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PHASE 5: Create cc_weather_trends
BEGIN;

CREATE TABLE IF NOT EXISTS cc_weather_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  location_code varchar NOT NULL,
  location_name varchar NOT NULL,
  region varchar,
  
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  
  avg_high_c numeric,
  avg_low_c numeric,
  precip_days integer,
  rain_prob_percent integer,
  fog_prob_percent integer,
  wind_avg_kph numeric,
  daylight_hours numeric,
  
  planning_notes text,
  best_for text[],
  avoid_for text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE (location_code, month)
);

-- Seed Bamfield weather data
INSERT INTO cc_weather_trends (location_code, location_name, region, month, avg_high_c, avg_low_c, rain_prob_percent, fog_prob_percent, daylight_hours, planning_notes, best_for, avoid_for)
VALUES
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 1, 8, 3, 70, 15, 8.5, 'Peak storm season. Indoor activities.', ARRAY['storm watching'], ARRAY['kayaking']),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 2, 9, 3, 65, 15, 10, 'Still wet. Good for planning.', ARRAY['early hiking'], ARRAY['water sports']),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 3, 10, 4, 55, 20, 12, 'Transition. Fog common.', ARRAY['whale watching'], ARRAY['outdoor events']),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 4, 12, 5, 45, 25, 14, 'Spring arriving. Wildflowers.', ARRAY['hiking', 'photography'], ARRAY['peak events']),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 5, 14, 7, 35, 30, 16, 'Excellent shoulder season.', ARRAY['kayaking', 'hiking', 'whale watching'], ARRAY[]::text[]),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 6, 16, 9, 25, 35, 17, 'Summer beginning. Morning fog.', ARRAY['kayaking', 'fishing'], ARRAY[]::text[]),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 7, 18, 11, 20, 40, 17, 'Best weather. Book early.', ARRAY['all activities'], ARRAY[]::text[]),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 8, 18, 11, 20, 35, 15.5, 'Peak season. Warmest water.', ARRAY['swimming', 'kayaking'], ARRAY[]::text[]),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 9, 16, 9, 30, 25, 13, 'Excellent shoulder. Fall colors.', ARRAY['hiking', 'mushroom foraging'], ARRAY[]::text[]),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 10, 13, 7, 50, 20, 11, 'Mushroom season! Rain returning.', ARRAY['foraging', 'storm watching'], ARRAY['water sports']),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 11, 10, 4, 65, 15, 9, 'Storm season begins.', ARRAY['storm watching'], ARRAY['kayaking']),
  ('BAMFIELD', 'Bamfield', 'Vancouver Island', 12, 8, 3, 70, 15, 8, 'Peak winter. Cozy indoor.', ARRAY['holiday retreats'], ARRAY['outdoor activities'])
ON CONFLICT (location_code, month) DO UPDATE SET
  rain_prob_percent = EXCLUDED.rain_prob_percent,
  planning_notes = EXCLUDED.planning_notes,
  best_for = EXCLUDED.best_for,
  avoid_for = EXCLUDED.avoid_for;

COMMIT;

-- PHASE 6: Extend cc_reservations for Cart Integration
BEGIN;

ALTER TABLE cc_reservations
  ADD COLUMN IF NOT EXISTS schema_type varchar DEFAULT 'Reservation',
  ADD COLUMN IF NOT EXISTS cart_id uuid,
  ADD COLUMN IF NOT EXISTS cart_item_id uuid,
  ADD COLUMN IF NOT EXISTS intent_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_json jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cc_reservations_cart ON cc_reservations(cart_id) WHERE cart_id IS NOT NULL;

COMMIT;
