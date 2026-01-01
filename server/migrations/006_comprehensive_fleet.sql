-- Migration 006: Comprehensive Fleet Characteristics
-- Based on industry research for vehicles, trailers, RVs, and all specifications

-- =====================================================
-- VEHICLE ENUMS
-- =====================================================

-- Vehicle class types
DO $$ BEGIN
  CREATE TYPE vehicle_class_type AS ENUM (
    'sedan', 'coupe', 'hatchback', 'wagon',
    'suv_compact', 'suv_midsize', 'suv_fullsize',
    'pickup_midsize', 'pickup_fullsize', 'pickup_heavy_duty',
    'minivan', 'passenger_van', 'cargo_van', 'cargo_van_high_roof',
    'cube_van', 'box_truck', 'flatbed_truck', 'stake_truck',
    'rv_class_a', 'rv_class_b', 'rv_class_c',
    'motorcycle', 'atv', 'utv'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Liftgate types
DO $$ BEGIN
  CREATE TYPE liftgate_type AS ENUM (
    'none', 'tuck_under', 'rail_gate', 'cantilever', 'column_lift', 'side_loader'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rear door types
DO $$ BEGIN
  CREATE TYPE rear_door_type AS ENUM (
    'none', 'swing_doors', 'roll_up', 'ramp_door', 'ramp_spring_assist', 'lift_gate_door'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Hitch types
DO $$ BEGIN
  CREATE TYPE hitch_type_enum AS ENUM (
    'none', 'bumper_pull', 'gooseneck', 'fifth_wheel', 'pintle', 'weight_distribution'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ball sizes
DO $$ BEGIN
  CREATE TYPE ball_size_type AS ENUM (
    'none', '1_7_8', '2', '2_5_16', '3'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Hitch classes
DO $$ BEGIN
  CREATE TYPE hitch_class_type AS ENUM (
    'none', 'class_i', 'class_ii', 'class_iii', 'class_iv', 'class_v'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Wiring connector types
DO $$ BEGIN
  CREATE TYPE wiring_connector_type AS ENUM (
    'none', '4_pin_flat', '5_pin_flat', '6_pin_round', '7_pin_rv_blade', '7_pin_round'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TRAILER ENUMS
-- =====================================================

-- Trailer type enum
DO $$ BEGIN
  CREATE TYPE trailer_type_enum AS ENUM (
    'enclosed_cargo', 'open_utility', 'flatbed', 'dump',
    'car_hauler', 'equipment', 'landscaping', 'motorcycle',
    'horse', 'livestock', 'stock',
    'travel_trailer', 'fifth_wheel_rv', 'toy_hauler', 'popup_camper', 'teardrop',
    'boat', 'pwc', 'pontoon',
    'food_truck', 'office', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Coupler types
DO $$ BEGIN
  CREATE TYPE coupler_type AS ENUM (
    'ball_coupler', 'gooseneck_coupler', 'fifth_wheel_kingpin', 'pintle_ring', 'adjustable_coupler'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trailer brake types
DO $$ BEGIN
  CREATE TYPE trailer_brake_type AS ENUM (
    'none', 'surge', 'electric', 'electric_hydraulic', 'air'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Axle types
DO $$ BEGIN
  CREATE TYPE axle_type AS ENUM (
    'single', 'tandem', 'triple', 'quad'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- VEHICLE PROFILES - New Columns
-- =====================================================

-- Vehicle classification
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS vehicle_class TEXT;

-- Commercial Vehicle Features (cargo dimensions)
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS cargo_length_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS cargo_width_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS cargo_height_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS cargo_volume_cubic_feet INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS payload_capacity_lbs INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS gvwr_lbs INTEGER;

-- Door Configuration
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS rear_door_type TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS rear_door_width_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS rear_door_height_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_side_door BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS side_door_type TEXT;

-- Liftgate Configuration
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS liftgate_type TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS liftgate_capacity_lbs INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS liftgate_platform_width_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS liftgate_platform_depth_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS liftgate_power_type TEXT;

-- Loading Ramp
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_loading_ramp BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS ramp_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS ramp_capacity_lbs INTEGER;

-- Bed/Cargo Configuration (Trucks)
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS bed_length TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS bed_length_inches INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_bed_liner BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS bed_liner_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_tonneau_cover BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS tonneau_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_truck_cap BOOLEAN DEFAULT false;

-- Towing Configuration (Enhanced)
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS primary_hitch_type TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS receiver_size_inches DECIMAL(3,2);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS hitch_class_type TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS ball_size TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS max_tongue_weight_lbs INTEGER;

-- Gooseneck/Fifth Wheel specifics
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS gooseneck_ball_size TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fifth_wheel_rail_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fifth_wheel_hitch_brand TEXT;

-- Brake controller
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS brake_controller_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS brake_controller_brand TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS max_trailer_brakes INTEGER;

-- Wiring
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS trailer_wiring_type TEXT DEFAULT 'none';
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_aux_12v_circuit BOOLEAN DEFAULT false;

-- RV-Specific Features
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS is_rv BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS rv_sleep_capacity INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS rv_seatbelt_positions INTEGER;

-- Tanks
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fresh_water_gallons INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS gray_water_gallons INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS black_water_gallons INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS propane_tank_count INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS propane_capacity_lbs INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fuel_tank_gallons INTEGER;

-- Power
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS generator_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS generator_watts INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS shore_power_amps INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_solar BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS solar_watts INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS battery_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS battery_amp_hours INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS has_inverter BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS inverter_watts INTEGER;

-- Slideouts
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS slideout_count INTEGER DEFAULT 0;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS slideout_type TEXT;

-- Climate
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS ac_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS ac_btu INTEGER;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS heat_type TEXT;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS heat_btu INTEGER;

-- RV Amenities (JSONB)
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS rv_amenities JSONB DEFAULT '{}';

-- =====================================================
-- TRAILER PROFILES - New Columns
-- =====================================================

-- Trailer classification
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS trailer_type_class TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS coupler_type TEXT;

-- Coupler/Hitch Details
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS coupler_height_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS coupler_adjustable BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS required_hitch_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS required_ball_size_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS kingpin_weight_lbs INTEGER;

-- Safety Chains
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS safety_chain_rating_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS breakaway_system BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS breakaway_battery_type TEXT;

-- Axles & Suspension
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS axle_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS axle_count INTEGER DEFAULT 1;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS axle_capacity_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS suspension_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tire_size TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS spare_tire_included BOOLEAN DEFAULT false;

-- Brakes (Enhanced)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS trailer_brake_type TEXT DEFAULT 'none';
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS brakes_on_all_axles BOOLEAN DEFAULT true;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS abs_brakes BOOLEAN DEFAULT false;

-- Wiring
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS trailer_wiring_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_breakaway_switch BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_aux_battery BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_reverse_lights BOOLEAN DEFAULT false;

-- Doors (Cargo/Enclosed Trailers)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rear_door_type TEXT DEFAULT 'none';
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rear_door_width_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rear_door_height_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS side_door_type_detail TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS side_door_width_inches INTEGER;

-- Ramp Configuration
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_door_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_length_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_capacity_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_transition_flap BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dovetail_length_inches INTEGER;

-- Interior Features
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS interior_lighting_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_e_track BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS e_track_rows INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_d_rings BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS d_ring_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS wall_type TEXT;

-- Ventilation
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_roof_vent BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS roof_vent_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_side_vents BOOLEAN DEFAULT false;

-- Exterior Features
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS exterior_material TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS roof_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_ladder_rack BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_stone_guard BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_fenders BOOLEAN DEFAULT true;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fender_type TEXT;

-- Jack Configuration
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS jack_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS jack_capacity_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rear_stabilizer_jacks BOOLEAN DEFAULT false;

-- RV Trailer Specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_rv_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rv_sleep_capacity INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rv_dry_weight_lbs INTEGER;

-- Tanks
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fresh_water_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS gray_water_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS black_water_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS propane_tank_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS propane_capacity_lbs INTEGER;

-- Power
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS shore_power_amps INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_solar BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS solar_watts INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS battery_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS battery_amp_hours INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_inverter BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS inverter_watts INTEGER;

-- Slideouts
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS slideout_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS slideout_type TEXT;

-- Climate
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ac_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ac_btu INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS heat_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS heat_btu INTEGER;

-- RV Amenities (JSONB)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rv_amenities JSONB DEFAULT '{}';

-- Toy Hauler Specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_toy_hauler BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS garage_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS garage_width_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS garage_height_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fuel_station_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tie_down_points INTEGER;

-- =====================================================
-- VEHICLE CLASS SPECIFICATIONS (for auto-fill)
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_class_specs (
  id SERIAL PRIMARY KEY,
  vehicle_class VARCHAR(50) NOT NULL UNIQUE,
  typical_length_feet DECIMAL(4,1),
  typical_height_feet DECIMAL(4,1),
  typical_width_feet DECIMAL(4,1),
  typical_cargo_volume_cubic_feet INTEGER,
  typical_payload_lbs INTEGER,
  typical_towing_capacity_lbs INTEGER,
  typical_hitch_class VARCHAR(10),
  typical_receiver_size DECIMAL(3,2),
  suitable_paved BOOLEAN DEFAULT true,
  suitable_good_gravel BOOLEAN DEFAULT true,
  suitable_rough_gravel BOOLEAN DEFAULT false,
  suitable_4x4_required BOOLEAN DEFAULT false,
  bc_ferries_class VARCHAR(20),
  description TEXT
);

-- Seed vehicle class specs
INSERT INTO vehicle_class_specs (vehicle_class, typical_length_feet, typical_height_feet, typical_cargo_volume_cubic_feet, typical_payload_lbs, typical_towing_capacity_lbs, typical_hitch_class, suitable_rough_gravel, suitable_4x4_required, bc_ferries_class, description) VALUES
('sedan', 15.5, 4.8, NULL, NULL, 1000, 'class_i', false, false, 'standard', 'Standard 4-door sedan'),
('suv_compact', 15, 5.5, NULL, NULL, 3500, 'class_ii', false, false, 'standard', 'Compact crossover/SUV like RAV4, CR-V'),
('suv_midsize', 16, 5.8, NULL, NULL, 5000, 'class_iii', true, false, 'standard', 'Midsize SUV like 4Runner, Explorer'),
('suv_fullsize', 17.5, 6.3, NULL, NULL, 8000, 'class_iv', true, true, 'standard', 'Full-size SUV like Tahoe, Expedition'),
('pickup_midsize', 18, 5.8, NULL, 1500, 7000, 'class_iii', true, false, 'standard', 'Midsize pickup like Tacoma, Ranger'),
('pickup_fullsize', 20, 6.3, NULL, 2500, 12000, 'class_iv', true, true, 'standard', 'Full-size pickup like F-150, Silverado'),
('pickup_heavy_duty', 22, 6.5, NULL, 4000, 20000, 'class_v', true, true, 'oversize', 'HD truck like F-250, 2500 series'),
('cargo_van', 19, 6.5, 250, 2800, 6000, 'class_ii', false, false, 'standard', 'Standard cargo van like Transit, Sprinter'),
('cargo_van_high_roof', 20, 8.5, 400, 3500, 6000, 'class_ii', false, false, 'overheight', 'High-roof cargo van, may be overheight'),
('cube_van', 24, 10.5, 800, 4300, NULL, NULL, false, false, 'commercial', 'Box truck / cube van 14-16ft'),
('box_truck', 30, 12.5, 1200, 10000, NULL, NULL, false, false, 'commercial', 'Large box truck 20-26ft'),
('rv_class_a', 38, 12.5, NULL, NULL, 10000, 'class_v', false, false, 'oversize', 'Class A motorhome, bus-style'),
('rv_class_b', 22, 8.5, NULL, NULL, 3500, 'class_ii', true, false, 'overheight', 'Class B camper van'),
('rv_class_c', 28, 10.5, NULL, NULL, 5000, 'class_iii', false, false, 'overheight', 'Class C motorhome with cabover')
ON CONFLICT (vehicle_class) DO NOTHING;

-- =====================================================
-- TRAILER TYPE SPECIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS trailer_type_specs (
  id SERIAL PRIMARY KEY,
  trailer_type VARCHAR(50) NOT NULL UNIQUE,
  typical_length_range VARCHAR(20),
  typical_width_feet DECIMAL(4,1),
  typical_height_feet DECIMAL(4,1),
  typical_gvwr_range VARCHAR(20),
  typical_payload_lbs INTEGER,
  typical_hitch_type VARCHAR(30),
  typical_ball_size VARCHAR(10),
  typical_brake_type VARCHAR(20),
  typical_wiring VARCHAR(20),
  typical_rear_door VARCHAR(30),
  typical_side_door VARCHAR(30),
  description TEXT
);

-- Seed trailer type specs
INSERT INTO trailer_type_specs (trailer_type, typical_length_range, typical_width_feet, typical_gvwr_range, typical_hitch_type, typical_ball_size, typical_brake_type, typical_wiring, typical_rear_door, description) VALUES
('enclosed_cargo', '6-24', 7, '3500-14000', 'bumper_pull', '2_5_16', 'electric', '7_pin_rv_blade', 'ramp_door', 'Enclosed cargo trailer for tools, equipment'),
('open_utility', '4-16', 6, '2000-7000', 'bumper_pull', '2', 'surge', '4_pin_flat', 'none', 'Open utility trailer with sides'),
('flatbed', '16-40', 8.5, '7000-25000', 'gooseneck', '2_5_16', 'electric', '7_pin_rv_blade', 'none', 'Flatbed for equipment, vehicles'),
('dump', '10-16', 7, '7000-14000', 'bumper_pull', '2_5_16', 'electric', '7_pin_rv_blade', 'none', 'Dump trailer for aggregate, debris'),
('car_hauler', '16-24', 8.5, '7000-14000', 'bumper_pull', '2_5_16', 'electric', '7_pin_rv_blade', 'ramp_door', 'Open or enclosed car transport'),
('travel_trailer', '16-35', 8, '5000-12000', 'bumper_pull', '2_5_16', 'electric', '7_pin_rv_blade', 'swing_doors', 'Travel trailer RV for camping'),
('fifth_wheel_rv', '28-42', 8, '10000-18000', 'fifth_wheel', 'none', 'electric', '7_pin_rv_blade', 'swing_doors', 'Fifth wheel RV for extended stays'),
('toy_hauler', '20-40', 8.5, '10000-16000', 'bumper_pull', '2_5_16', 'electric', '7_pin_rv_blade', 'ramp_door', 'RV with garage for ATVs, motorcycles'),
('boat', '14-30', 8.5, '3500-10000', 'bumper_pull', '2', 'surge', '4_pin_flat', 'none', 'Boat trailer with bunks or rollers'),
('horse', '14-24', 7, '7000-14000', 'bumper_pull', '2_5_16', 'electric', '7_pin_rv_blade', 'swing_doors', 'Horse trailer, 2-4 horse capacity')
ON CONFLICT (trailer_type) DO NOTHING;

-- Done
SELECT 'Migration 006 completed successfully' as status;
