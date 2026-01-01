-- =====================================================
-- MIGRATION 007: Horse/Livestock/Heavy Equipment Trailer Expansion
-- Industry-standard trailer specialization for equestrian travelers
-- Uses TEXT columns for flexibility (no PostgreSQL ENUMs)
-- =====================================================

-- =====================================================
-- HORSE TRAILER SPECIFIC FIELDS
-- =====================================================

-- Horse identification
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_horse_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS horse_capacity INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS horse_load_config TEXT; -- straight_load, slant_load, reverse_slant, head_to_head, box_stall, stock_open
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS stall_length_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS stall_width_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS stall_height_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS horse_size_rating TEXT; -- pony, small, standard, warmblood, draft

-- Dividers
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS divider_type TEXT; -- full_height, partial, padded, air_flow, stud_wall, telescoping, removable, swing_out, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS divider_padded BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dividers_removable BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_head_dividers BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_butt_bars BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_breast_bars BOOLEAN DEFAULT false;

-- Mangers & Feeding
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS manger_type TEXT; -- standard_manger, drop_down_manger, hay_bag_only, walk_through, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_hay_rack BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS hay_rack_type TEXT; -- roof_mounted, rear_mounted, front_rack

-- Windows & Ventilation
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS drop_down_windows_head INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS drop_down_windows_butt INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS slider_windows INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS roof_vents INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS window_bars BOOLEAN DEFAULT false;

-- Doors & Access
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS escape_door_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS escape_door_side TEXT; -- streetside, curbside, both
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS walk_through_door BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rear_load_type TEXT; -- ramp, step_up, dutch_doors, swing_doors
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS side_ramp BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS rear_ramp_spring_assist BOOLEAN DEFAULT false;

-- Flooring & Safety
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS horse_floor_type TEXT; -- aluminum, wood, rubber_mat, rumber
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS floor_mats BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS kick_wall_padding BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lined_walls BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS insulated_walls BOOLEAN DEFAULT false;

-- Tie Systems
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tie_ring_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tie_system_type TEXT; -- fixed_rings, quick_release, panic_snaps

-- =====================================================
-- TACK ROOM / DRESSING ROOM
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_tack_room BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tack_room_type TEXT; -- front_tack, rear_tack, mid_tack, fold_up, collapsible
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tack_room_length_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tack_room_width TEXT; -- full_width, partial
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS saddle_rack_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS saddle_rack_type TEXT; -- swing_out, fixed, removable
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS bridle_hooks INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS blanket_bar BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tack_room_carpet BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS brush_tray BOOLEAN DEFAULT false;

-- =====================================================
-- LIVING QUARTERS (LQ) - For Work & Horse Trailers
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_living_quarters BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_certified BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_certification_type TEXT; -- rvia, tr_arnold, none

-- LQ Dimensions
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_short_wall_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_long_wall_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_width_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_ceiling_height_inches INTEGER;

-- Sleeping
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_sleep_capacity INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_bed_type TEXT; -- queen, full, dinette_converts, sofa_sleeper, bunk, cabover
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_bed_count INTEGER DEFAULT 1;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_cabover_bed BOOLEAN DEFAULT false;

-- Kitchen
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_kitchen BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_cooktop_type TEXT; -- 2_burner, 3_burner, induction, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_oven BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_microwave BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_microwave_type TEXT; -- standard, convection
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_refrigerator_type TEXT; -- 3_way, 12v_compressor, residential
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_refrigerator_cubic_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_sink_type TEXT; -- single, double, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_outdoor_kitchen BOOLEAN DEFAULT false;

-- Bathroom
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_bathroom BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_bathroom_type TEXT; -- wet_bath, dry_bath, half_bath
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_toilet_type TEXT; -- gravity, macerator, cassette, porta_potti
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_shower BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_shower_type TEXT; -- corner, radius, rectangular, outdoor
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_vanity BOOLEAN DEFAULT false;

-- Climate
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_ac_type TEXT; -- roof_ac, ducted, mini_split, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_ac_btu INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_heat_type TEXT; -- propane_furnace, heat_pump, electric, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_heat_btu INTEGER;

-- Water & Waste
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_fresh_water_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_gray_water_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_black_water_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_water_heater_type TEXT; -- tankless, 6_gal, 10_gal, none
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_water_heater_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_winterized BOOLEAN DEFAULT false;

-- Power
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_shore_power_amps INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_generator BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_generator_type TEXT; -- built_in, portable_mount
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_generator_watts INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_generator_fuel TEXT; -- gas, propane, diesel
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_solar BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_solar_watts INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_battery_type TEXT; -- lead_acid, agm, lithium
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_battery_amp_hours INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_inverter BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_inverter_watts INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_converter_amps INTEGER;

-- Entertainment & Comfort
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_tv_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_stereo BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_speaker_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_awning BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_awning_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_awning_power BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_has_slide_out BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_slide_out_count INTEGER DEFAULT 0;

-- Propane
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_propane_tank_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lq_propane_capacity_lbs INTEGER;

-- =====================================================
-- WORK / CONTRACTOR TRAILER FIELDS
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_work_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS work_trailer_type TEXT; -- contractor, mobile_workshop, service, fiber_splicing

-- Shelving & Storage
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_shelving BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS shelving_type TEXT; -- wood, metal, aluminum, adjustable
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS shelving_sides TEXT; -- one_side, both_sides, rear
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS shelf_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_parts_bins BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS parts_bin_count INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_tool_cabinets BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_overhead_storage BOOLEAN DEFAULT false;

-- Workbench
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_workbench BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS workbench_type TEXT; -- fixed, fold_down, slide_out
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS workbench_length_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS workbench_width_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS workbench_has_vise BOOLEAN DEFAULT false;

-- Tool Storage
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_ladder_rack BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ladder_rack_type TEXT; -- roof, interior_ceiling, side_mount
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_pipe_rack BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS pipe_rack_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_conduit_tube BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_lumber_rack BOOLEAN DEFAULT false;

-- Power Systems (Work Trailer)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_generator_mount BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS generator_mount_type TEXT; -- tongue, rear, enclosed_cabinet
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_shore_power BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS shore_power_amps_work INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS electrical_outlets INTEGER DEFAULT 0;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS outlet_type TEXT; -- 110v, 220v, mixed
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_air_compressor_mount BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_welder_outlet BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS welder_outlet_amps INTEGER;

-- Climate Control (Work)
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_hvac BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS hvac_type TEXT; -- mini_split, roof_ac, portable
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_exhaust_fan BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS exhaust_fan_cfm INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_dust_collection BOOLEAN DEFAULT false;

-- =====================================================
-- HEAVY EQUIPMENT TRAILER FIELDS
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_equipment_trailer BOOLEAN DEFAULT false;

-- Deck Configuration
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS deck_type TEXT; -- flatbed, step_deck, double_drop, lowboy_fixed, rgn, tilt_deck, deckover, split_deck, hydraulic_tail, beavertail, stretch

-- Deck Dimensions
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS deck_length_feet DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS deck_width_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS deck_height_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS well_length_feet DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS upper_deck_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lower_deck_length_feet DECIMAL(4,1);

-- For stretch/extendable trailers
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_extendable BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS extended_length_feet DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS retracted_length_feet DECIMAL(5,1);

-- Load Height Clearance
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS max_load_height_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS max_legal_height_feet DECIMAL(4,1);

-- Loading System
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS gooseneck_removable BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS gooseneck_type TEXT; -- fixed, hydraulic_detach, mechanical_detach
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_loading_ramps BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_type_equipment TEXT; -- flip_up, slide_in, hydraulic, air
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_width_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS ramp_capacity_lbs_equipment INTEGER;

-- Tilt Deck Specific
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tilt_type TEXT; -- gravity, hydraulic, power_up_gravity_down
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tilt_angle_degrees INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS stationary_front_feet DECIMAL(4,1);

-- Heavy Duty Axle Configuration
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS axle_count_equipment INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS axle_spacing_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS axle_capacity_per_axle_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_lift_axle BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS lift_axle_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_air_ride BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_spread_axle BOOLEAN DEFAULT false;

-- Tie Down System
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_stake_pockets BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS stake_pocket_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_rub_rails BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_winch BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS winch_capacity_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS winch_type TEXT; -- manual, electric, hydraulic
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_chain_tie_downs BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS chain_binder_count INTEGER;

-- Deck Surface
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS deck_surface_type TEXT; -- steel, wood, aluminum, apitong, rubber
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_d_rings BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS d_ring_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS d_ring_capacity_lbs INTEGER;

-- =====================================================
-- LIVESTOCK TRAILER FIELDS (Non-Horse)
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_livestock_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS livestock_type TEXT; -- cattle, sheep, goats, hogs, mixed
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS livestock_capacity_head INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_center_gate BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS center_gate_type TEXT; -- full, half, sliding
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_possum_belly BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS possum_belly_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_upper_deck BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS punch_floor BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_nose_gate BOOLEAN DEFAULT false;

-- =====================================================
-- DUMP TRAILER FIELDS
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_dump_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_type TEXT; -- end_dump, side_dump, belly_dump, bottom_dump
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_capacity_cubic_yards DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_bed_length_feet DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_bed_width_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_bed_height_inches INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_hydraulic_type TEXT; -- scissor, telescopic, dual_piston
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS dump_lift_capacity_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_tarp_system BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS tarp_type TEXT; -- roll_over, flip, electric, manual
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_barn_doors BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_spread_gate BOOLEAN DEFAULT false;

-- =====================================================
-- BOAT TRAILER FIELDS
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_boat_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS boat_trailer_type TEXT; -- bunk, roller, pwc, pontoon, sailboat
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS max_boat_length_feet INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS max_boat_weight_lbs INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS bunk_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS bunk_material TEXT; -- carpet, plastic, rubber
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS roller_count INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_keel_rollers BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_bow_stop BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_winch_stand BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_guide_ons BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS guide_on_type TEXT; -- post, carpet_bunk, pvc
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_mast_support BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS trailer_submersible BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_led_lights BOOLEAN DEFAULT false;

-- =====================================================
-- SPECIALTY TRAILER FIELDS
-- =====================================================

ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS is_specialty_trailer BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS specialty_type TEXT; -- generator, fuel, welding, pressure_wash, portable_toilet, custom

-- Generator Trailer
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS onboard_generator_kw DECIMAL(6,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS generator_fuel_type TEXT; -- diesel, gas, propane, natural_gas
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS generator_fuel_capacity_gallons DECIMAL(5,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_distribution_panel BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS outlet_count_120v INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS outlet_count_240v INTEGER;

-- Fuel Transfer Trailer
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fuel_tank_capacity_gallons DECIMAL(6,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS fuel_type_stored TEXT; -- diesel, gasoline, def
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_transfer_pump BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS transfer_pump_gpm DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_fuel_meter BOOLEAN DEFAULT false;

-- Welding Trailer
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS welder_type TEXT; -- mig, tig, stick, multi_process
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS welder_amps_max INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_cutting_torch BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS bottle_storage_count INTEGER;

-- Pressure Wash Trailer
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS pressure_washer_psi INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS pressure_washer_gpm DECIMAL(4,1);
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS water_tank_capacity_gallons INTEGER;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS has_hot_water BOOLEAN DEFAULT false;
ALTER TABLE trailer_profiles ADD COLUMN IF NOT EXISTS hose_reel_count INTEGER;

-- =====================================================
-- EXTENDED TRAILER TYPE VALUES (for trailer_type column)
-- =====================================================
-- Note: These are the industry-standard trailer types to use in the existing trailer_type TEXT column:
--
-- HORSE: horse_straight_load, horse_slant_load, horse_reverse_slant, horse_head_to_head, 
--        horse_stock_combo, horse_box_stall, horse_2_plus_1
-- LIVESTOCK: livestock_stock, livestock_pot, livestock_sheep_deck, livestock_hog
-- ENCLOSED: enclosed_cargo, enclosed_contractor, enclosed_mobile_workshop, enclosed_concession, 
--           enclosed_office, enclosed_fiber_splicing
-- UTILITY: utility_open, utility_landscape, utility_pipe_material, utility_atv
-- FLATBED: flatbed_standard, flatbed_tilt, flatbed_dovetail, flatbed_deckover
-- EQUIPMENT: equipment_car_hauler, equipment_step_deck, equipment_lowboy, equipment_rgn, 
--            equipment_double_drop, equipment_stretch, equipment_hydraulic_tail
-- DUMP: dump_standard, dump_gooseneck, dump_side_dump, dump_belly_dump, dump_end_dump
-- RV: rv_travel_trailer, rv_fifth_wheel, rv_toy_hauler, rv_popup, rv_teardrop
-- BOAT: boat_bunk, boat_roller, boat_pwc, boat_pontoon, boat_sailboat
-- SPECIALTY: specialty_generator, specialty_fuel, specialty_welding, specialty_pressure_wash, 
--            specialty_portable_toilet, specialty_custom
