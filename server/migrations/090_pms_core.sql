BEGIN;

-- ============ PROPERTIES ============
-- Physical properties (lodges, B&Bs, cabin clusters, marinas)

CREATE TABLE IF NOT EXISTS cc_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  owner_id uuid,
  location_id uuid REFERENCES cc_locations(id) ON DELETE SET NULL,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  slug varchar(50),
  
  property_type varchar NOT NULL CHECK (property_type IN (
    'lodge',          -- Full-service lodge
    'hotel',          -- Hotel/motel
    'bnb',            -- Bed & breakfast
    'cabin_cluster',  -- Multiple cabins
    'vacation_rental', -- Single vacation rental
    'campground',     -- Campground/RV park
    'marina',         -- Marina with slip rentals
    'hostel',         -- Hostel/dorm style
    'resort',         -- Full resort
    'other'
  )),
  
  -- Description
  description text,
  tagline varchar(200),
  
  -- Address
  address_line1 text,
  address_line2 text,
  city varchar(100),
  province varchar(50) DEFAULT 'BC',
  postal_code varchar(20),
  country varchar(50) DEFAULT 'Canada',
  
  -- Geolocation
  lat numeric(9,6),
  lon numeric(9,6),
  
  -- Contact
  contact_phone text,
  contact_email text,
  website_url text,
  
  -- Capacity
  total_units integer DEFAULT 0,
  total_beds integer DEFAULT 0,
  max_occupancy integer DEFAULT 0,
  
  -- Amenities
  amenities_json jsonb DEFAULT '[]'::jsonb,
  
  -- Policies
  policies_json jsonb DEFAULT '{}'::jsonb,
  
  -- Pricing defaults
  base_rate_cad numeric(10,2),
  cleaning_fee_cad numeric(10,2) DEFAULT 0,
  tax_rate_percent numeric(5,2) DEFAULT 13.0,
  
  -- Integration
  external_pms varchar,
  external_pms_id text,
  ical_import_url text,
  ical_export_url text,
  
  -- Media
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'inactive', 'seasonal', 'closed'
  )),
  
  -- Operational
  accepts_instant_book boolean DEFAULT false,
  requires_approval boolean DEFAULT true,
  lead_time_hours integer DEFAULT 24,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, code),
  UNIQUE(portal_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_properties_portal ON cc_properties(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON cc_properties(property_type, status);
CREATE INDEX IF NOT EXISTS idx_properties_location ON cc_properties(location_id) WHERE location_id IS NOT NULL;

ALTER TABLE cc_properties ENABLE ROW LEVEL SECURITY;

-- ============ UNITS ============
-- Individual rentable units within a property

CREATE TABLE IF NOT EXISTS cc_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  property_id uuid NOT NULL REFERENCES cc_properties(id) ON DELETE CASCADE,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  unit_number varchar(20),
  
  unit_type varchar NOT NULL CHECK (unit_type IN (
    'room',           -- Hotel room
    'suite',          -- Suite
    'cabin',          -- Standalone cabin
    'cottage',        -- Cottage
    'tent_site',      -- Tent camping site
    'rv_site',        -- RV/camper site
    'slip',           -- Marina slip
    'mooring',        -- Mooring buoy
    'dorm_bed',       -- Single dorm bed
    'apartment',      -- Full apartment
    'house',          -- Entire house
    'other'
  )),
  
  -- Description
  description text,
  
  -- Capacity
  max_occupancy integer DEFAULT 2,
  bedrooms integer DEFAULT 1,
  beds_json jsonb DEFAULT '[]'::jsonb,
  bathrooms numeric(3,1) DEFAULT 1,
  
  -- Size
  size_sqft integer,
  floor_level integer,
  
  -- For marina slips
  slip_length_ft numeric(6,2),
  slip_width_ft numeric(6,2),
  power_amps integer,
  water_available boolean DEFAULT true,
  
  -- Amenities (unit-specific, adds to property amenities)
  amenities_json jsonb DEFAULT '[]'::jsonb,
  
  -- Pricing
  base_rate_cad numeric(10,2),
  weekend_rate_cad numeric(10,2),
  weekly_rate_cad numeric(10,2),
  monthly_rate_cad numeric(10,2),
  extra_person_fee_cad numeric(10,2) DEFAULT 0,
  
  -- Seasonal pricing
  seasonal_rates_json jsonb DEFAULT '[]'::jsonb,
  
  -- Availability
  status varchar DEFAULT 'available' CHECK (status IN (
    'available',      -- Ready to book
    'occupied',       -- Currently occupied
    'blocked',        -- Blocked (owner use, maintenance)
    'maintenance',    -- Under maintenance
    'inactive',       -- Not in service
    'seasonal'        -- Seasonally closed
  )),
  
  -- Calendar sync
  ical_url text,
  last_ical_sync timestamptz,
  
  -- Media
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Housekeeping
  clean_status varchar DEFAULT 'clean' CHECK (clean_status IN (
    'clean', 'dirty', 'in_progress', 'inspected', 'blocked'
  )),
  last_cleaned_at timestamptz,
  next_inspection_at timestamptz,
  
  -- Display
  sort_order integer DEFAULT 0,
  featured boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(property_id, code)
);

CREATE INDEX IF NOT EXISTS idx_units_property ON cc_units(property_id, status);
CREATE INDEX IF NOT EXISTS idx_units_type ON cc_units(unit_type, status);
CREATE INDEX IF NOT EXISTS idx_units_clean ON cc_units(clean_status) WHERE status = 'available';

ALTER TABLE cc_units ENABLE ROW LEVEL SECURITY;

-- ============ PMS RESERVATIONS ============
-- Direct reservations managed in Community Canvas PMS

CREATE TABLE IF NOT EXISTS cc_pms_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES cc_properties(id),
  unit_id uuid NOT NULL REFERENCES cc_units(id),
  
  -- Cart/trip integration
  cart_id uuid REFERENCES cc_reservation_carts(id) ON DELETE SET NULL,
  cart_item_id uuid REFERENCES cc_reservation_cart_items(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES cc_trips(id) ON DELETE SET NULL,
  
  -- Identity
  confirmation_number varchar(20) NOT NULL UNIQUE,
  
  -- Guest
  guest_name text NOT NULL,
  guest_email text,
  guest_phone text,
  guest_count integer DEFAULT 1,
  guest_notes text,
  
  -- Dates
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  nights integer GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  
  -- Times
  expected_arrival_time time,
  actual_arrival_time time,
  expected_departure_time time,
  actual_departure_time time,
  
  -- Pricing
  base_rate_cad numeric(10,2) DEFAULT 0,
  cleaning_fee_cad numeric(10,2) DEFAULT 0,
  extra_fees_cad numeric(10,2) DEFAULT 0,
  tax_cad numeric(10,2) DEFAULT 0,
  total_cad numeric(10,2) DEFAULT 0,
  
  deposit_cad numeric(10,2) DEFAULT 0,
  deposit_paid boolean DEFAULT false,
  balance_cad numeric(10,2) DEFAULT 0,
  
  -- Payment
  payment_status varchar DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'deposit_paid', 'paid', 'partial', 'refunded', 'failed'
  )),
  payment_method varchar,
  payment_reference text,
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'inquiry',        -- Initial inquiry
    'pending',        -- Awaiting confirmation
    'confirmed',      -- Confirmed
    'checked_in',     -- Guest arrived
    'checked_out',    -- Guest departed
    'completed',      -- Finalized
    'cancelled',      -- Cancelled
    'no_show'         -- Guest didn't arrive
  )),
  
  -- Timestamps
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  
  cancellation_reason text,
  
  -- Source
  source varchar DEFAULT 'direct' CHECK (source IN (
    'direct',         -- Direct booking
    'cart',           -- Via CC cart
    'ical',           -- iCal import
    'airbnb',         -- Airbnb
    'vrbo',           -- VRBO
    'booking_com',    -- Booking.com
    'phone',          -- Phone booking
    'walk_in',        -- Walk-in
    'referral',       -- Referral
    'other'
  )),
  source_reference text,
  
  -- Special requests
  special_requests text,
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_reservations_property ON cc_pms_reservations(property_id, status);
CREATE INDEX IF NOT EXISTS idx_pms_reservations_unit ON cc_pms_reservations(unit_id, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_pms_reservations_dates ON cc_pms_reservations(check_in_date, check_out_date, status);
CREATE INDEX IF NOT EXISTS idx_pms_reservations_guest ON cc_pms_reservations(guest_email) WHERE guest_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pms_reservations_trip ON cc_pms_reservations(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pms_reservations_confirmation ON cc_pms_reservations(confirmation_number);

ALTER TABLE cc_pms_reservations ENABLE ROW LEVEL SECURITY;

-- ============ SEED BAMFIELD PROPERTIES ============

DO $$
DECLARE
  v_portal_id uuid;
  v_prop_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  IF v_portal_id IS NOT NULL THEN
    -- Bamfield Lodge
    INSERT INTO cc_properties (
      portal_id, name, code, slug, property_type,
      description, tagline,
      city, province, country,
      amenities_json, policies_json,
      base_rate_cad, cleaning_fee_cad,
      status, accepts_instant_book
    ) VALUES (
      v_portal_id, 'Bamfield Lodge', 'BFLD-LODGE', 'bamfield-lodge', 'lodge',
      'Historic waterfront lodge in the heart of Bamfield West, offering stunning views of Bamfield Inlet',
      'Your basecamp for West Coast adventures',
      'Bamfield', 'BC', 'Canada',
      '["wifi", "parking", "restaurant", "bar", "kayak_storage", "gear_room", "boat_launch"]'::jsonb,
      '{"check_in_time": "15:00", "check_out_time": "11:00", "min_stay_nights": 1, "pets_allowed": false, "cancellation_policy": "moderate"}'::jsonb,
      150.00, 50.00,
      'active', false
    )
    ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_prop_id;
    
    -- Add units for Bamfield Lodge
    IF v_prop_id IS NOT NULL THEN
      INSERT INTO cc_units (property_id, name, code, unit_number, unit_type, max_occupancy, bedrooms, bathrooms, base_rate_cad, amenities_json, status)
      VALUES
        (v_prop_id, 'Inlet View Room', 'IVR-1', '101', 'room', 2, 1, 1, 150.00, '["view", "private_bathroom"]'::jsonb, 'available'),
        (v_prop_id, 'Inlet View Room', 'IVR-2', '102', 'room', 2, 1, 1, 150.00, '["view", "private_bathroom"]'::jsonb, 'available'),
        (v_prop_id, 'Family Suite', 'FST-1', '201', 'suite', 4, 2, 1, 250.00, '["view", "private_bathroom", "kitchenette"]'::jsonb, 'available'),
        (v_prop_id, 'Captain''s Quarters', 'CPT-1', '301', 'suite', 2, 1, 1, 300.00, '["view", "private_bathroom", "deck", "fireplace"]'::jsonb, 'available')
      ON CONFLICT (property_id, code) DO NOTHING;
    END IF;
    
    -- Pachena Bay Campground
    INSERT INTO cc_properties (
      portal_id, name, code, slug, property_type,
      description,
      city, province, country,
      amenities_json, policies_json,
      base_rate_cad,
      status
    ) VALUES (
      v_portal_id, 'Pachena Bay Campground', 'PACH-CAMP', 'pachena-bay-campground', 'campground',
      'Beachfront camping at the southern trailhead of the West Coast Trail',
      'Bamfield', 'BC', 'Canada',
      '["parking", "fire_pits", "pit_toilets", "beach_access"]'::jsonb,
      '{"check_in_time": "14:00", "check_out_time": "12:00", "pets_allowed": true, "quiet_hours": "22:00-07:00"}'::jsonb,
      35.00,
      'active'
    )
    ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_prop_id;
    
    -- Add campsites
    IF v_prop_id IS NOT NULL THEN
      INSERT INTO cc_units (property_id, name, code, unit_number, unit_type, max_occupancy, base_rate_cad, amenities_json, status)
      VALUES
        (v_prop_id, 'Ocean View Site', 'OV-01', 'A1', 'tent_site', 6, 45.00, '["ocean_view", "fire_pit"]'::jsonb, 'available'),
        (v_prop_id, 'Ocean View Site', 'OV-02', 'A2', 'tent_site', 6, 45.00, '["ocean_view", "fire_pit"]'::jsonb, 'available'),
        (v_prop_id, 'Forest Site', 'FS-01', 'B1', 'tent_site', 4, 35.00, '["sheltered", "fire_pit"]'::jsonb, 'available'),
        (v_prop_id, 'RV Site with Hookups', 'RV-01', 'R1', 'rv_site', 6, 55.00, '["power_30amp", "water"]'::jsonb, 'available')
      ON CONFLICT (property_id, code) DO NOTHING;
    END IF;
    
    -- Update property unit counts
    UPDATE cc_properties SET 
      total_units = (SELECT COUNT(*) FROM cc_units WHERE property_id = cc_properties.id),
      updated_at = now()
    WHERE portal_id = v_portal_id;
    
  END IF;
END $$;

COMMIT;
