-- Migration 008: Overlander, Tiny Home, and Specialty Equipment Trailer Fields
-- Using TEXT columns for flexibility (consistent with migrations 006, 007)

-- =============================================
-- PART 1: OVERLANDER/EXPEDITION TRAILER FIELDS
-- =============================================

-- Type flags
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_overlander BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS overlander_type TEXT; -- expedition, teardrop, popup, cargo

-- Off-Road Capability
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ground_clearance_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS approach_angle_degrees INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS departure_angle_degrees INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS breakover_angle_degrees INTEGER;

-- Suspension (off-road specific)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS suspension_type_offroad TEXT; 
  -- timbren_axleless, independent_coilover, airbag, torsion, leaf_spring, multi_link

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS articulating_hitch BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS hitch_articulation_degrees INTEGER;

-- Tires (off-road)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tire_size_offroad TEXT; -- 32", 35", etc.
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tire_type TEXT; -- all_terrain, mud_terrain, highway

-- Recovery/Protection
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_skid_plates BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_rock_sliders BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_recovery_points BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS recovery_point_count INTEGER;

-- Rooftop Tent Support
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_rooftop_tent_mount BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rooftop_tent_weight_capacity_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS roof_rack_type TEXT; -- exoskeleton, standard, none

-- Galley (outdoor kitchen)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_slide_out_kitchen BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS kitchen_side TEXT; -- driver, passenger, rear
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_outdoor_shower BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS outdoor_shower_type TEXT; -- solar_heated, tankless, pressurized

-- Water (overlander style)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS external_water_tank_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_water_filtration BOOLEAN DEFAULT false;

-- Fuel (jerry cans)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_jerry_can_mounts BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS jerry_can_capacity_gallons INTEGER;

-- =============================================
-- PART 2: TINY HOME ON WHEELS (THOW) FIELDS
-- =============================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_tiny_home BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_certification TEXT; -- rvia, noah, none, diy
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_square_feet INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_loft_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_full_time_rated BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_four_season BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_composting_toilet BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS thow_incinerating_toilet BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS registered_as TEXT; -- rv, travel_trailer, mobile_home, utility_trailer, park_model

-- =============================================
-- PART 3: SPECIALTY EQUIPMENT TRAILER FIELDS
-- =============================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_specialty_equipment BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS equipment_type TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS equipment_make TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS equipment_model TEXT;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS equipment_power_type TEXT; -- gas, diesel, electric, pto, hydraulic
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS equipment_hp INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS requires_setup_time BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS setup_time_minutes INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS requires_level_ground BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_outriggers BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS license_plate_exempt BOOLEAN DEFAULT false;

-- Sawmill specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS sawmill_max_log_diameter_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS sawmill_max_log_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS sawmill_cut_width_inches DECIMAL(4,1);

-- Welder specific  
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS welder_amp_rating INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS welder_type TEXT; -- mig, tig, stick, multi

-- Generator specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS generator_kw_rating DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS generator_voltage TEXT; -- 120v, 240v, 480v, multi
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS generator_phase TEXT; -- single, three

-- Pressure washer specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS pressure_washer_psi INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS pressure_washer_gpm DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS water_tank_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_hot_water BOOLEAN DEFAULT false;

-- Air compressor specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS compressor_cfm DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS compressor_psi_max INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tank_gallons INTEGER;

-- Light tower specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS light_tower_height_feet INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS light_output_lumens INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS light_coverage_acres DECIMAL(4,2);

-- Fuel transfer specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fuel_tank_capacity_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fuel_type_stored TEXT; -- gasoline, diesel, aviation, def
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_fuel_pump BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fuel_pump_gpm DECIMAL(4,1);

-- Concrete mixer specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS mixer_capacity_cubic_yards DECIMAL(4,2);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS mixer_drum_rpm INTEGER;
