-- =====================================================
-- PHASE 4A: FLEET MANAGEMENT BASICS
-- =====================================================

-- Add fleet columns to vehicle_profiles
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fleet_number VARCHAR(20);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fleet_status VARCHAR(30) DEFAULT 'available';
-- Status: available, in_use, maintenance, reserved, retired

ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES participant_profiles(id);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS last_check_out TIMESTAMPTZ;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS last_check_in TIMESTAMPTZ;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS primary_photo_url VARCHAR(500);

-- Vehicle photos
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_profiles(id) ON DELETE CASCADE,
  
  photo_type VARCHAR(30) NOT NULL, -- primary, exterior_front, exterior_rear, exterior_driver, exterior_passenger, interior_front, interior_rear, cargo_area, damage, other
  photo_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  photo_order INTEGER DEFAULT 0,
  
  caption TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  taken_by UUID REFERENCES participant_profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRAILER PROFILES
-- =====================================================

CREATE TABLE IF NOT EXISTS trailer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  nickname VARCHAR(100),
  fleet_number VARCHAR(20),
  
  -- Ownership
  owner_type VARCHAR(20) NOT NULL DEFAULT 'company', -- personal, company, rental
  organization_id UUID,
  
  -- Registration
  license_plate VARCHAR(20),
  registration_expiry DATE,
  vin VARCHAR(50),
  
  -- Type
  trailer_type VARCHAR(30) NOT NULL, -- enclosed_cargo, flatbed, utility, boat, car_hauler, dump, horse, rv_trailer, popup_camper, equipment
  
  -- Dimensions (exterior)
  length_feet DECIMAL(4,1),
  width_feet DECIMAL(4,1),
  height_feet DECIMAL(4,1),
  
  -- Interior dimensions (for enclosed)
  interior_length_feet DECIMAL(4,1),
  interior_width_feet DECIMAL(4,1),
  interior_height_feet DECIMAL(4,1),
  
  -- Capacity
  gvwr_lbs INTEGER, -- Gross Vehicle Weight Rating
  empty_weight_lbs INTEGER,
  payload_capacity_lbs INTEGER,
  
  -- Hitch Requirements
  hitch_type VARCHAR(20) NOT NULL DEFAULT 'ball', -- ball, gooseneck, fifth_wheel, pintle
  required_ball_size VARCHAR(20), -- 1_7_8, 2, 2_5_16
  tongue_weight_lbs INTEGER,
  
  -- Brakes & Electrical
  brake_type VARCHAR(20) DEFAULT 'none', -- none, surge, electric, air
  wiring_type VARCHAR(20) DEFAULT '4_pin', -- 4_pin, 5_pin, 7_pin
  
  -- Access
  gate_type VARCHAR(30), -- roll_up_door, swing_doors, ramp, lift_gate, drop_sides, none
  has_side_door BOOLEAN DEFAULT false,
  ramp_weight_capacity_lbs INTEGER,
  
  -- Features
  has_roof_rack BOOLEAN DEFAULT false,
  has_tie_downs BOOLEAN DEFAULT false,
  tie_down_count INTEGER,
  has_interior_lighting BOOLEAN DEFAULT false,
  has_electrical_outlets BOOLEAN DEFAULT false,
  has_ventilation BOOLEAN DEFAULT false,
  
  -- Floor
  floor_type VARCHAR(20), -- wood, aluminum, rubber_mat, steel
  
  -- Status
  fleet_status VARCHAR(30) DEFAULT 'available',
  currently_hitched_to UUID REFERENCES vehicle_profiles(id),
  
  -- Insurance
  insurance_company VARCHAR(255),
  insurance_policy_number VARCHAR(100),
  insurance_expiry DATE,
  
  -- Color for identification
  color VARCHAR(50),
  
  -- Primary photo
  primary_photo_url VARCHAR(500),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trailer photos
CREATE TABLE IF NOT EXISTS trailer_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id UUID NOT NULL REFERENCES trailer_profiles(id) ON DELETE CASCADE,
  
  photo_type VARCHAR(30) NOT NULL, -- primary, exterior_front, exterior_side, exterior_rear, interior, hitch, ramp, damage, other
  photo_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  photo_order INTEGER DEFAULT 0,
  
  caption TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HITCH COMPATIBILITY
-- =====================================================

-- Add hitch info to vehicles
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_hitch BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS hitch_class VARCHAR(10); -- I, II, III, IV, V
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS hitch_ball_size VARCHAR(20); -- 1_7_8, 2, 2_5_16
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_gooseneck_hitch BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_fifth_wheel_hitch BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_brake_controller BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS trailer_wiring VARCHAR(20); -- 4_pin, 7_pin

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_fleet_status ON vehicle_profiles(fleet_status);
CREATE INDEX IF NOT EXISTS idx_trailer_fleet_status ON trailer_profiles(fleet_status);
CREATE INDEX IF NOT EXISTS idx_trailer_photos_trailer ON trailer_photos(trailer_id);

-- =====================================================
-- SAMPLE FLEET DATA
-- =====================================================

-- Insert sample trailers
INSERT INTO trailer_profiles (nickname, fleet_number, owner_type, trailer_type, length_feet, width_feet, height_feet, interior_length_feet, interior_width_feet, interior_height_feet, gvwr_lbs, empty_weight_lbs, payload_capacity_lbs, hitch_type, required_ball_size, tongue_weight_lbs, brake_type, wiring_type, gate_type, has_tie_downs, tie_down_count, floor_type, color, notes) VALUES
('The Box', 'T-001', 'company', 'enclosed_cargo', 16, 7, 7, 15, 6.5, 6.5, 7000, 1800, 5200, 'ball', '2_5_16', 700, 'electric', '7_pin', 'ramp', true, 8, 'wood', 'White', 'Main enclosed cargo trailer for equipment transport'),
('Flatty', 'T-002', 'company', 'flatbed', 18, 7, 2, NULL, NULL, NULL, 10000, 2200, 7800, 'ball', '2_5_16', 1000, 'electric', '7_pin', 'none', true, 12, 'steel', 'Black', 'Flatbed for large materials, lumber, heavy equipment'),
('Utility', 'T-003', 'company', 'utility', 6, 4, 2, NULL, NULL, NULL, 2000, 400, 1600, 'ball', '2', 200, 'none', '4_pin', 'drop_sides', true, 4, 'steel', 'Gray', 'Small utility trailer for light loads')
ON CONFLICT DO NOTHING;
