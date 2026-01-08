import { Router, Request, Response } from 'express';
import { serviceQuery, withServiceTransaction, tenantQuery, publicQuery, withTenantTransaction } from '../db/tenantDb';
import type { PoolClient } from 'pg';
import { requireAuth, requireTenant, requireSelfOrAdmin } from '../middleware/guards';
import { TenantRequest, getTenantContext } from '../middleware/tenantContext';
import type { Pool } from 'pg';

// Whitelist of allowed vehicle_profiles columns for dynamic updates/inserts
const ALLOWED_VEHICLE_COLUMNS = new Set([
  // Basic info
  'nickname', 'fleet_number', 'year', 'make', 'model', 'color', 'license_plate', 'vin',
  'vehicle_class', 'drive_type', 'fuel_type', 'owner_type', 'is_fleet_vehicle',
  'ground_clearance_inches', 'length_feet', 'height_feet', 'width_feet', 'passenger_capacity',
  'fleet_status', 'assigned_to_id', 'assigned_to_name', 'primary_photo_url', 'notes',
  // Commercial cargo
  'cargo_length_inches', 'cargo_width_inches', 'cargo_height_inches', 'cargo_volume_cubic_feet',
  'payload_capacity_lbs', 'gvwr_lbs',
  // Door configuration
  'rear_door_type', 'rear_door_width_inches', 'rear_door_height_inches',
  'has_side_door', 'side_door_type',
  // Liftgate
  'liftgate_type', 'liftgate_capacity_lbs', 'liftgate_platform_width_inches',
  'liftgate_platform_depth_inches', 'liftgate_power_type',
  // Loading ramp
  'has_loading_ramp', 'ramp_type', 'ramp_capacity_lbs',
  // Bed/cargo (trucks)
  'bed_length', 'bed_length_inches', 'has_bed_liner', 'bed_liner_type',
  'has_tonneau_cover', 'tonneau_type', 'has_truck_cap',
  // Towing configuration
  'towing_capacity_lbs', 'has_hitch', 'hitch_class', 'hitch_ball_size',
  'has_brake_controller', 'trailer_wiring', 'has_gooseneck_hitch', 'has_fifth_wheel_hitch',
  'primary_hitch_type', 'receiver_size_inches', 'hitch_class_type', 'ball_size', 'max_tongue_weight_lbs',
  // Gooseneck/Fifth wheel
  'gooseneck_ball_size', 'fifth_wheel_rail_type', 'fifth_wheel_hitch_brand',
  // Brake controller
  'brake_controller_type', 'brake_controller_brand', 'max_trailer_brakes',
  // Wiring
  'trailer_wiring_type', 'has_aux_12v_circuit',
  // RV features
  'is_rv', 'rv_sleep_capacity', 'rv_seatbelt_positions',
  // Tanks
  'fresh_water_gallons', 'gray_water_gallons', 'black_water_gallons',
  'propane_tank_count', 'propane_capacity_lbs', 'fuel_tank_gallons',
  // Power
  'generator_type', 'generator_watts', 'shore_power_amps',
  'has_solar', 'solar_watts', 'battery_type', 'battery_amp_hours',
  'has_inverter', 'inverter_watts',
  // Slideouts
  'slideout_count', 'slideout_type',
  // Climate
  'ac_type', 'ac_btu', 'heat_type', 'heat_btu',
  // RV amenities
  'rv_amenities'
]);

// Whitelist of allowed trailer_profiles columns for dynamic updates/inserts
const ALLOWED_TRAILER_COLUMNS = new Set([
  // Basic info
  'nickname', 'fleet_number', 'owner_type', 'trailer_type', 'trailer_type_class',
  'color', 'license_plate', 'vin', 'registration_expiry', 'notes', 'fleet_status',
  // Dimensions
  'length_feet', 'width_feet', 'height_feet',
  'interior_length_feet', 'interior_width_feet', 'interior_height_feet',
  // Weights
  'gvwr_lbs', 'empty_weight_lbs', 'payload_capacity_lbs', 'tongue_weight_lbs',
  // Coupler/Hitch
  'coupler_type', 'coupler_height_inches', 'coupler_adjustable',
  'required_hitch_type', 'required_ball_size_type', 'kingpin_weight_lbs',
  'hitch_type', 'required_ball_size',
  // Safety chains
  'safety_chain_rating_lbs', 'breakaway_system', 'breakaway_battery_type',
  // Axles & suspension
  'axle_type', 'axle_count', 'axle_capacity_lbs', 'suspension_type',
  'tire_size', 'spare_tire_included',
  // Brakes
  'trailer_brake_type', 'brake_type', 'brakes_on_all_axles', 'abs_brakes',
  // Wiring
  'trailer_wiring_type', 'wiring_type', 'has_breakaway_switch', 'has_aux_battery', 'has_reverse_lights',
  // Doors
  'rear_door_type', 'rear_door_width_inches', 'rear_door_height_inches',
  'side_door_type_detail', 'side_door_width_inches', 'has_side_door', 'gate_type',
  // Ramp
  'ramp_door_type', 'ramp_length_inches', 'ramp_capacity_lbs', 'ramp_transition_flap', 'dovetail_length_inches',
  // Interior
  'interior_lighting_type', 'has_e_track', 'e_track_rows', 'has_d_rings', 'd_ring_count',
  'wall_type', 'floor_type', 'has_tie_downs', 'tie_down_count',
  'has_interior_lighting', 'has_electrical_outlets',
  // Ventilation
  'has_roof_vent', 'roof_vent_count', 'has_side_vents',
  // Exterior
  'exterior_material', 'roof_type', 'has_ladder_rack', 'has_stone_guard', 'has_fenders', 'fender_type',
  'has_roof_rack',
  // Jack
  'jack_type', 'jack_capacity_lbs', 'rear_stabilizer_jacks',
  // RV trailer
  'is_rv_trailer', 'rv_sleep_capacity', 'rv_dry_weight_lbs',
  // Tanks
  'fresh_water_gallons', 'gray_water_gallons', 'black_water_gallons',
  'propane_tank_count', 'propane_capacity_lbs',
  // Power
  'shore_power_amps', 'has_solar', 'solar_watts', 'battery_type', 'battery_amp_hours',
  'has_inverter', 'inverter_watts', 'generator_type', 'generator_watts',
  // Slideouts
  'slideout_count', 'slideout_type',
  // Climate
  'ac_type', 'ac_btu', 'heat_type', 'heat_btu',
  // RV amenities
  'rv_amenities',
  // Toy hauler
  'is_toy_hauler', 'garage_length_feet', 'garage_width_feet', 'garage_height_feet',
  'fuel_station_gallons', 'tie_down_points',
  // Hitch status
  'currently_hitched_to', 'primary_photo_url',
  
  // =====================================================
  // HORSE TRAILER FIELDS (Migration 007)
  // =====================================================
  'is_horse_trailer', 'horse_capacity', 'horse_load_config', 'stall_length_inches',
  'stall_width_inches', 'stall_height_inches', 'horse_size_rating',
  // Dividers
  'divider_type', 'divider_padded', 'dividers_removable', 'has_head_dividers',
  'has_butt_bars', 'has_breast_bars',
  // Mangers & Feeding
  'manger_type', 'has_hay_rack', 'hay_rack_type',
  // Windows & Ventilation
  'drop_down_windows_head', 'drop_down_windows_butt', 'slider_windows', 'roof_vents', 'window_bars',
  // Doors & Access
  'escape_door_count', 'escape_door_side', 'walk_through_door', 'rear_load_type',
  'side_ramp', 'rear_ramp_spring_assist',
  // Flooring & Safety
  'horse_floor_type', 'floor_mats', 'kick_wall_padding', 'lined_walls', 'insulated_walls',
  // Tie Systems
  'tie_ring_count', 'tie_system_type',
  
  // =====================================================
  // TACK ROOM FIELDS
  // =====================================================
  'has_tack_room', 'tack_room_type', 'tack_room_length_inches', 'tack_room_width',
  'saddle_rack_count', 'saddle_rack_type', 'bridle_hooks', 'blanket_bar',
  'tack_room_carpet', 'brush_tray',
  
  // =====================================================
  // LIVING QUARTERS (LQ) FIELDS
  // =====================================================
  'has_living_quarters', 'lq_certified', 'lq_certification_type',
  // LQ Dimensions
  'lq_short_wall_feet', 'lq_long_wall_feet', 'lq_width_feet', 'lq_ceiling_height_inches',
  // Sleeping
  'lq_sleep_capacity', 'lq_bed_type', 'lq_bed_count', 'lq_has_cabover_bed',
  // Kitchen
  'lq_has_kitchen', 'lq_cooktop_type', 'lq_has_oven', 'lq_has_microwave', 'lq_microwave_type',
  'lq_refrigerator_type', 'lq_refrigerator_cubic_feet', 'lq_sink_type', 'lq_has_outdoor_kitchen',
  // Bathroom
  'lq_has_bathroom', 'lq_bathroom_type', 'lq_toilet_type', 'lq_has_shower',
  'lq_shower_type', 'lq_has_vanity',
  // Climate
  'lq_ac_type', 'lq_ac_btu', 'lq_heat_type', 'lq_heat_btu',
  // Water & Waste
  'lq_fresh_water_gallons', 'lq_gray_water_gallons', 'lq_black_water_gallons',
  'lq_water_heater_type', 'lq_water_heater_gallons', 'lq_winterized',
  // Power
  'lq_shore_power_amps', 'lq_has_generator', 'lq_generator_type', 'lq_generator_watts',
  'lq_generator_fuel', 'lq_has_solar', 'lq_solar_watts', 'lq_battery_type',
  'lq_battery_amp_hours', 'lq_has_inverter', 'lq_inverter_watts', 'lq_converter_amps',
  // Entertainment & Comfort
  'lq_tv_count', 'lq_has_stereo', 'lq_speaker_count', 'lq_has_awning', 'lq_awning_length_feet',
  'lq_awning_power', 'lq_has_slide_out', 'lq_slide_out_count',
  // Propane
  'lq_propane_tank_count', 'lq_propane_capacity_lbs',
  
  // =====================================================
  // WORK / CONTRACTOR TRAILER FIELDS
  // =====================================================
  'is_work_trailer', 'work_trailer_type',
  // Shelving & Storage
  'has_shelving', 'shelving_type', 'shelving_sides', 'shelf_count',
  'has_parts_bins', 'parts_bin_count', 'has_tool_cabinets', 'has_overhead_storage',
  // Workbench
  'has_workbench', 'workbench_type', 'workbench_length_inches', 'workbench_width_inches',
  'workbench_has_vise',
  // Tool Storage
  'ladder_rack_type', 'has_pipe_rack', 'pipe_rack_length_feet',
  'has_conduit_tube', 'has_lumber_rack',
  // Power Systems (Work)
  'has_generator_mount', 'generator_mount_type', 'has_shore_power', 'shore_power_amps_work',
  'electrical_outlets', 'outlet_type', 'has_air_compressor_mount', 'has_welder_outlet', 'welder_outlet_amps',
  // Climate Control (Work)
  'has_hvac', 'hvac_type', 'has_exhaust_fan', 'exhaust_fan_cfm', 'has_dust_collection',
  
  // =====================================================
  // HEAVY EQUIPMENT TRAILER FIELDS
  // =====================================================
  'is_equipment_trailer', 'deck_type',
  // Deck Dimensions
  'deck_length_feet', 'deck_width_inches', 'deck_height_inches', 'well_length_feet',
  'upper_deck_length_feet', 'lower_deck_length_feet',
  // Extendable
  'is_extendable', 'extended_length_feet', 'retracted_length_feet',
  // Load Height
  'max_load_height_feet', 'max_legal_height_feet',
  // Loading System
  'gooseneck_removable', 'gooseneck_type', 'has_loading_ramps', 'ramp_type_equipment',
  'ramp_length_feet', 'ramp_width_inches', 'ramp_capacity_lbs_equipment',
  // Tilt Deck
  'tilt_type', 'tilt_angle_degrees', 'stationary_front_feet',
  // Heavy Duty Axle
  'axle_count_equipment', 'axle_spacing_inches', 'axle_capacity_per_axle_lbs',
  'has_lift_axle', 'lift_axle_count', 'has_air_ride', 'has_spread_axle',
  // Tie Down System
  'has_stake_pockets', 'stake_pocket_count', 'has_rub_rails', 'has_winch',
  'winch_capacity_lbs', 'winch_type', 'has_chain_tie_downs', 'chain_binder_count',
  // Deck Surface
  'deck_surface_type', 'd_ring_capacity_lbs',
  
  // =====================================================
  // LIVESTOCK TRAILER FIELDS
  // =====================================================
  'is_livestock_trailer', 'livestock_type', 'livestock_capacity_head',
  'has_center_gate', 'center_gate_type', 'has_possum_belly', 'possum_belly_count',
  'has_upper_deck', 'punch_floor', 'has_nose_gate',
  
  // =====================================================
  // DUMP TRAILER FIELDS
  // =====================================================
  'is_dump_trailer', 'dump_type', 'dump_capacity_cubic_yards', 'dump_bed_length_feet',
  'dump_bed_width_inches', 'dump_bed_height_inches', 'dump_hydraulic_type',
  'dump_lift_capacity_lbs', 'has_tarp_system', 'tarp_type', 'has_barn_doors', 'has_spread_gate',
  
  // =====================================================
  // BOAT TRAILER FIELDS
  // =====================================================
  'is_boat_trailer', 'boat_trailer_type', 'max_boat_length_feet', 'max_boat_weight_lbs',
  'bunk_count', 'bunk_material', 'roller_count', 'has_keel_rollers', 'has_bow_stop',
  'has_winch_stand', 'has_guide_ons', 'guide_on_type', 'has_mast_support',
  'trailer_submersible', 'has_led_lights',
  
  // =====================================================
  // SPECIALTY TRAILER FIELDS
  // =====================================================
  'is_specialty_trailer', 'specialty_type',
  // Generator Trailer
  'onboard_generator_kw', 'generator_fuel_type', 'generator_fuel_capacity_gallons',
  'has_distribution_panel', 'outlet_count_120v', 'outlet_count_240v',
  // Fuel Transfer Trailer
  'fuel_tank_capacity_gallons', 'fuel_type_stored', 'has_transfer_pump',
  'transfer_pump_gpm', 'has_fuel_meter',
  // Welding Trailer
  'welder_type', 'welder_amps_max', 'has_cutting_torch', 'bottle_storage_count',
  // Pressure Wash Trailer
  'pressure_washer_psi', 'pressure_washer_gpm', 'water_tank_capacity_gallons',
  'has_hot_water', 'hose_reel_count',
  
  // =====================================================
  // OVERLANDER/EXPEDITION TRAILER FIELDS (Migration 008)
  // =====================================================
  'is_overlander', 'overlander_type',
  // Off-Road Capability
  'ground_clearance_inches', 'approach_angle_degrees', 'departure_angle_degrees', 'breakover_angle_degrees',
  // Suspension
  'suspension_type_offroad', 'articulating_hitch', 'hitch_articulation_degrees',
  // Tires
  'tire_size_offroad', 'tire_type',
  // Recovery/Protection
  'has_skid_plates', 'has_rock_sliders', 'has_recovery_points', 'recovery_point_count',
  // Rooftop Tent
  'has_rooftop_tent_mount', 'rooftop_tent_weight_capacity_lbs', 'roof_rack_type',
  // Galley/Outdoor Kitchen
  'has_slide_out_kitchen', 'kitchen_side', 'has_outdoor_shower', 'outdoor_shower_type',
  // Water
  'external_water_tank_gallons', 'has_water_filtration',
  // Fuel (Jerry Cans)
  'has_jerry_can_mounts', 'jerry_can_capacity_gallons',
  
  // =====================================================
  // TINY HOME ON WHEELS (THOW) FIELDS (Migration 008)
  // =====================================================
  'is_tiny_home', 'thow_certification', 'thow_square_feet', 'thow_loft_count',
  'thow_full_time_rated', 'thow_four_season', 'thow_composting_toilet', 'thow_incinerating_toilet',
  'registered_as',
  
  // =====================================================
  // SPECIALTY EQUIPMENT TRAILER FIELDS (Migration 008)
  // =====================================================
  'is_specialty_equipment', 'equipment_type', 'equipment_make', 'equipment_model',
  'equipment_power_type', 'equipment_hp',
  'requires_setup_time', 'setup_time_minutes', 'requires_level_ground', 'has_outriggers', 'license_plate_exempt',
  // Sawmill
  'sawmill_max_log_diameter_inches', 'sawmill_max_log_length_feet', 'sawmill_cut_width_inches',
  // Welder
  'welder_amp_rating',
  // Generator
  'generator_kw_rating', 'generator_voltage', 'generator_phase',
  // Pressure Washer
  'water_tank_gallons',
  // Air Compressor
  'compressor_cfm', 'compressor_psi_max', 'tank_gallons',
  // Light Tower
  'light_tower_height_feet', 'light_output_lumens', 'light_coverage_acres',
  // Fuel Transfer
  'fuel_type_stored', 'has_fuel_pump', 'fuel_pump_gpm',
  // Concrete Mixer
  'mixer_capacity_cubic_yards', 'mixer_drum_rpm'
]);

// Helper to filter and validate columns
function filterAllowedColumns(data: Record<string, any>, allowedColumns: Set<string>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (allowedColumns.has(key) && data[key] !== undefined) {
      filtered[key] = data[key];
    }
  }
  return filtered;
}

export function createFleetRouter(_db?: Pool) {
  // Note: _db parameter kept for backwards compatibility but unused - all queries use serviceQuery
  const router = Router();

  // =====================================================
  // FLEET VEHICLES
  // =====================================================

  // Fleet read: tenant context shows shared + tenant-owned, anonymous shows shared only
  router.get('/vehicles', async (req: Request, res: Response) => {
    try {
      const { status, assigned_to } = req.query;
      const ctx = getTenantContext(req);
      const hasTenantContext = !!ctx.tenant_id;
      
      let baseWhere = hasTenantContext 
        ? 'WHERE 1=1'  // tenantQuery + RLS handles visibility
        : 'WHERE v.tenant_id IS NULL';  // Public: shared assets only
      
      let query = `
        SELECT v.*, 
               p.name as assigned_to_display_name,
               (SELECT COUNT(*) FROM vehicle_photos WHERE vehicle_id = v.id) as photo_count,
               (SELECT COUNT(*) FROM cc_vehicle_safety_equipment WHERE vehicle_id = v.id AND present = true) as equipment_count
        FROM vehicle_profiles v
        LEFT JOIN cc_participant_profiles p ON v.assigned_to_id = p.id
        ${baseWhere}
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        params.push(status);
        query += ` AND v.fleet_status = $${paramIndex++}`;
      }
      
      if (assigned_to) {
        params.push(assigned_to);
        query += ` AND v.assigned_to_id = $${paramIndex++}`;
      }
      
      query += ' ORDER BY v.fleet_number, v.nickname, v.make, v.model';
      
      // tenantQuery for tenant context (RLS handles visibility), publicQuery for anonymous (shared only)
      const result = hasTenantContext 
        ? await tenantQuery(req, query, params)
        : await publicQuery(query, params);
      res.json({ vehicles: result.rows });
    } catch (error) {
      console.error('Error fetching fleet vehicles:', error);
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  });

  // Fleet read: tenant context shows shared + tenant-owned, anonymous shows shared only
  router.get('/vehicles/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ctx = getTenantContext(req);
      const hasTenantContext = !!ctx.tenant_id;
      
      // Tenant: RLS handles visibility; Anonymous: shared only
      const visibilityClause = hasTenantContext 
        ? '' 
        : ' AND v.tenant_id IS NULL';
      
      const query = `
        SELECT v.*, 
               p.name as assigned_to_display_name,
               (SELECT COUNT(*) FROM vehicle_photos WHERE vehicle_id = v.id) as photo_count,
               (SELECT COUNT(*) FROM cc_vehicle_safety_equipment WHERE vehicle_id = v.id AND present = true) as equipment_count
        FROM vehicle_profiles v
        LEFT JOIN cc_participant_profiles p ON v.assigned_to_id = p.id
        WHERE v.id = $1${visibilityClause}
      `;
      
      const result = hasTenantContext 
        ? await tenantQuery(req, query, [id])
        : await publicQuery(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      res.json({ vehicle: result.rows[0] });
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      res.status(500).json({ error: 'Failed to fetch vehicle' });
    }
  });

  // Fleet stats: tenant context shows combined counts, anonymous shows shared only
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      const hasTenantContext = !!ctx.tenant_id;
      
      // Anonymous: only count shared assets
      const whereClause = hasTenantContext ? '' : 'WHERE tenant_id IS NULL';
      
      const vehicleQuery = `
        SELECT 
          COUNT(*) as total_vehicles,
          COUNT(*) FILTER (WHERE fleet_status = 'available') as available,
          COUNT(*) FILTER (WHERE fleet_status = 'in_use') as in_use,
          COUNT(*) FILTER (WHERE fleet_status = 'maintenance') as maintenance,
          COUNT(*) FILTER (WHERE fleet_status = 'reserved') as reserved,
          COUNT(*) FILTER (WHERE fleet_status = 'retired') as retired
        FROM vehicle_profiles ${whereClause}
      `;
      
      const trailerQuery = `
        SELECT 
          COUNT(*) as total_trailers,
          COUNT(*) FILTER (WHERE fleet_status = 'available') as available,
          COUNT(*) FILTER (WHERE fleet_status = 'in_use') as in_use,
          COUNT(*) FILTER (WHERE fleet_status = 'maintenance') as maintenance
        FROM trailer_profiles ${whereClause}
      `;
      
      const [vehicleStats, trailerStats] = hasTenantContext
        ? await Promise.all([tenantQuery(req, vehicleQuery), tenantQuery(req, trailerQuery)])
        : await Promise.all([publicQuery(vehicleQuery), publicQuery(trailerQuery)]);
      
      res.json({
        vehicles: vehicleStats.rows[0],
        trailers: trailerStats.rows[0]
      });
    } catch (error) {
      console.error('Error fetching fleet stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // SECURITY: Require auth + tenant context for vehicle mutations (RLS enforces isolation)
  router.post('/vehicles', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      
      // Set defaults and required fields, inject tenant_id
      const rawData = {
        ...req.body,
        tenant_id: ctx.tenant_id,  // Enforce tenant ownership
        owner_type: req.body.owner_type || 'company',
        is_fleet_vehicle: true,
        fleet_status: req.body.fleet_status || 'available',
      };
      
      // Filter to only allowed columns (prevents SQL injection)
      const safeData = filterAllowedColumns(rawData, ALLOWED_VEHICLE_COLUMNS);
      safeData.tenant_id = ctx.tenant_id;  // Always include tenant_id
      
      const fields = Object.keys(safeData);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' });
      }
      
      const columns = fields.join(', ');
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      const values = fields.map(f => safeData[f]);
      
      // Use tenantQuery for RLS enforcement
      const result = await tenantQuery(req, `
        INSERT INTO vehicle_profiles (${columns})
        VALUES (${placeholders})
        RETURNING *
      `, values);
      
      res.json({ vehicle: result.rows[0] });
    } catch (error) {
      console.error('Error creating fleet vehicle:', error);
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  });

  // SECURITY: Require auth + tenant context for vehicle mutations (RLS enforces isolation)
  router.patch('/vehicles/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Filter to only allowed columns (prevents SQL injection)
      const safeUpdates = filterAllowedColumns(req.body, ALLOWED_VEHICLE_COLUMNS);
      
      const fields = Object.keys(safeUpdates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      // Build dynamic SET clause
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const values = fields.map(f => safeUpdates[f]);
      
      // Handle fleet_status side effects
      let extraSets = '';
      if (safeUpdates.fleet_status === 'in_use') {
        extraSets = ', last_check_out = NOW()';
      } else if (safeUpdates.fleet_status === 'available') {
        extraSets = ', last_check_in = NOW()';
      }
      
      values.push(id);
      
      // Use tenantQuery for RLS enforcement
      const result = await tenantQuery(req, `
        UPDATE vehicle_profiles 
        SET ${setClause}${extraSets}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      res.json({ vehicle: result.rows[0] });
    } catch (error) {
      console.error('Error updating vehicle:', error);
      res.status(500).json({ error: 'Failed to update vehicle' });
    }
  });

  // SECURITY: Require auth + tenant context for vehicle mutations (RLS enforces isolation)
  router.patch('/vehicles/:id/hitch', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        has_hitch, hitch_class, hitch_ball_size, 
        has_gooseneck_hitch, has_fifth_wheel_hitch, 
        has_brake_controller, trailer_wiring 
      } = req.body;
      
      // Use tenantQuery for RLS enforcement
      const result = await tenantQuery(req, `
        UPDATE vehicle_profiles 
        SET has_hitch = $1, hitch_class = $2, hitch_ball_size = $3,
            has_gooseneck_hitch = $4, has_fifth_wheel_hitch = $5,
            has_brake_controller = $6, trailer_wiring = $7,
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [has_hitch, hitch_class, hitch_ball_size, has_gooseneck_hitch, has_fifth_wheel_hitch, has_brake_controller, trailer_wiring, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating hitch config:', error);
      res.status(500).json({ error: 'Failed to update hitch configuration' });
    }
  });

  // =====================================================
  // VEHICLE PHOTOS
  // =====================================================

  // Photo reads: tenant context sees all accessible vehicles' photos, anonymous sees shared vehicles' photos only
  router.get('/vehicles/:id/photos', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ctx = getTenantContext(req);
      const hasTenantContext = !!ctx.tenant_id;
      
      // Join to vehicle_profiles to respect tenant visibility (RLS enforces access)
      const query = hasTenantContext
        ? `SELECT vp.* FROM vehicle_photos vp 
           JOIN vehicle_profiles v ON vp.vehicle_id = v.id 
           WHERE vp.vehicle_id = $1 
           ORDER BY vp.photo_order, vp.created_at`
        : `SELECT vp.* FROM vehicle_photos vp 
           JOIN vehicle_profiles v ON vp.vehicle_id = v.id 
           WHERE vp.vehicle_id = $1 AND v.tenant_id IS NULL
           ORDER BY vp.photo_order, vp.created_at`;
      
      const result = hasTenantContext
        ? await tenantQuery(req, query, [id])
        : await publicQuery(query, [id]);
      
      res.json({ photos: result.rows });
    } catch (error) {
      console.error('Error fetching photos:', error);
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  });

  // SECURITY: Require auth + tenant for photo mutations (ownership via vehicle_profiles)
  router.post('/vehicles/:id/photos', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { photo_type, photo_url, thumbnail_url, caption, photo_order } = req.body;
      
      // Use tenantTransaction with ownership check via vehicle_profiles
      const result = await withTenantTransaction(req, async (client: PoolClient) => {
        // Verify caller owns or has access to this vehicle (RLS enforces tenant isolation)
        const vehicleCheck = await client.query(
          'SELECT id FROM vehicle_profiles WHERE id = $1 FOR UPDATE',
          [id]
        );
        if (vehicleCheck.rows.length === 0) {
          throw new Error('VEHICLE_NOT_FOUND');
        }
        
        const insertResult = await client.query(`
          INSERT INTO vehicle_photos (vehicle_id, photo_type, photo_url, thumbnail_url, caption, photo_order)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [id, photo_type, photo_url, thumbnail_url || null, caption || null, photo_order || 0]);
        
        if (photo_type === 'primary') {
          await client.query(
            'UPDATE vehicle_profiles SET primary_photo_url = $1 WHERE id = $2',
            [photo_url, id]
          );
        }
        
        return insertResult.rows[0];
      });
      
      res.json(result);
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        return res.status(404).json({ error: 'Vehicle not found or access denied' });
      }
      console.error('Error adding photo:', error);
      res.status(500).json({ error: 'Failed to add photo' });
    }
  });

  // SECURITY: Require auth + tenant for photo deletion (ownership via vehicle_profiles)
  router.delete('/vehicles/:vehicleId/photos/:photoId', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { vehicleId, photoId } = req.params;
      
      // Use tenantTransaction with ownership check via vehicle_profiles
      await withTenantTransaction(req, async (client: PoolClient) => {
        // Verify caller owns or has access to this vehicle (RLS enforces tenant isolation)
        const vehicleCheck = await client.query(
          'SELECT id FROM vehicle_profiles WHERE id = $1 FOR UPDATE',
          [vehicleId]
        );
        if (vehicleCheck.rows.length === 0) {
          throw new Error('VEHICLE_NOT_FOUND');
        }
        
        await client.query(
          'DELETE FROM vehicle_photos WHERE id = $1 AND vehicle_id = $2',
          [photoId, vehicleId]
        );
      });
      
      res.json({ success: true });
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        return res.status(404).json({ error: 'Vehicle not found or access denied' });
      }
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  });

  // =====================================================
  // TRAILERS
  // =====================================================

  // Fleet read: tenant context shows shared + tenant-owned, anonymous shows shared only
  router.get('/trailers', async (req: Request, res: Response) => {
    try {
      const { status, type } = req.query;
      const ctx = getTenantContext(req);
      const hasTenantContext = !!ctx.tenant_id;
      
      let baseWhere = hasTenantContext 
        ? 'WHERE 1=1'  // tenantQuery + RLS handles visibility
        : 'WHERE t.tenant_id IS NULL';  // Public: shared assets only
      
      let query = `
        SELECT t.*, 
               v.nickname as hitched_to_nickname,
               v.fleet_number as hitched_to_fleet_number,
               (SELECT COUNT(*) FROM trailer_photos WHERE trailer_id = t.id) as photo_count
        FROM trailer_profiles t
        LEFT JOIN vehicle_profiles v ON t.currently_hitched_to = v.id
        ${baseWhere}
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        params.push(status);
        query += ` AND t.fleet_status = $${paramIndex++}`;
      }
      
      if (type) {
        params.push(type);
        query += ` AND t.trailer_type = $${paramIndex++}`;
      }
      
      query += ' ORDER BY t.fleet_number, t.nickname';
      
      // tenantQuery for tenant context (RLS handles visibility), publicQuery for anonymous (shared only)
      const result = hasTenantContext 
        ? await tenantQuery(req, query, params)
        : await publicQuery(query, params);
      res.json({ trailers: result.rows });
    } catch (error) {
      console.error('Error fetching trailers:', error);
      res.status(500).json({ error: 'Failed to fetch trailers' });
    }
  });

  // Fleet read: tenant context shows shared + tenant-owned, anonymous shows shared only
  router.get('/trailers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ctx = getTenantContext(req);
      const hasTenantContext = !!ctx.tenant_id;
      
      // Tenant: RLS handles visibility; Anonymous: shared only
      const visibilityClause = hasTenantContext 
        ? '' 
        : ' AND t.tenant_id IS NULL';
      
      const query = `
        SELECT t.*, 
               v.nickname as hitched_to_nickname,
               v.fleet_number as hitched_to_fleet_number,
               (SELECT COUNT(*) FROM trailer_photos WHERE trailer_id = t.id) as photo_count
        FROM trailer_profiles t
        LEFT JOIN vehicle_profiles v ON t.currently_hitched_to = v.id
        WHERE t.id = $1${visibilityClause}
      `;
      
      const result = hasTenantContext 
        ? await tenantQuery(req, query, [id])
        : await publicQuery(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Trailer not found' });
      }
      
      res.json({ trailer: result.rows[0] });
    } catch (error) {
      console.error('Error fetching trailer:', error);
      res.status(500).json({ error: 'Failed to fetch trailer' });
    }
  });

  // SECURITY: Require auth + tenant context for trailer mutations (RLS enforces isolation)
  router.post('/trailers', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      
      // Set defaults and required fields, inject tenant_id
      const rawData = {
        ...req.body,
        tenant_id: ctx.tenant_id,  // Enforce tenant ownership
        owner_type: req.body.owner_type || 'company',
        fleet_status: req.body.fleet_status || 'available',
      };
      
      // Filter to only allowed columns (prevents SQL injection)
      const safeData = filterAllowedColumns(rawData, ALLOWED_TRAILER_COLUMNS);
      safeData.tenant_id = ctx.tenant_id;  // Always include tenant_id
      
      const fields = Object.keys(safeData);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' });
      }
      
      const columns = fields.join(', ');
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      const values = fields.map(f => safeData[f]);
      
      // Use tenantQuery for RLS enforcement
      const result = await tenantQuery(req, `
        INSERT INTO trailer_profiles (${columns})
        VALUES (${placeholders})
        RETURNING *
      `, values);
      
      res.json({ trailer: result.rows[0] });
    } catch (error) {
      console.error('Error creating trailer:', error);
      res.status(500).json({ error: 'Failed to create trailer' });
    }
  });

  // SECURITY: Require auth + tenant context for trailer mutations (RLS enforces isolation)
  router.patch('/trailers/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Filter to only allowed columns (prevents SQL injection)
      const safeUpdates = filterAllowedColumns(req.body, ALLOWED_TRAILER_COLUMNS);
      
      const fields = Object.keys(safeUpdates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const values = fields.map(f => safeUpdates[f]);
      values.push(id);
      
      // Use tenantQuery for RLS enforcement
      const result = await tenantQuery(req, `
        UPDATE trailer_profiles 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Trailer not found' });
      }
      
      res.json({ trailer: result.rows[0] });
    } catch (error) {
      console.error('Error updating trailer:', error);
      res.status(500).json({ error: 'Failed to update trailer' });
    }
  });

  // SECURITY: Require auth + tenant context for trailer mutations (RLS enforces isolation)
  router.post('/trailers/:id/hitch', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { vehicle_id } = req.body;
      
      // Use tenantQuery for RLS enforcement - only see tenant's assets
      const trailerResult = await tenantQuery(req, 'SELECT * FROM trailer_profiles WHERE id = $1', [id]);
      if (trailerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trailer not found' });
      }
      const trailer = trailerResult.rows[0];
      
      const vehicleResult = await tenantQuery(req, 'SELECT * FROM vehicle_profiles WHERE id = $1', [vehicle_id]);
      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      const vehicle = vehicleResult.rows[0];
      
      const issues: string[] = [];
      const warnings: string[] = [];
      
      if (trailer.gvwr_lbs && vehicle.towing_capacity_lbs && trailer.gvwr_lbs > vehicle.towing_capacity_lbs) {
        issues.push(`Trailer GVWR (${trailer.gvwr_lbs} lbs) exceeds vehicle towing capacity (${vehicle.towing_capacity_lbs} lbs)`);
      }
      
      if (trailer.hitch_type === 'gooseneck' && !vehicle.has_gooseneck_hitch) {
        issues.push('Trailer requires gooseneck hitch');
      }
      if (trailer.hitch_type === 'fifth_wheel' && !vehicle.has_fifth_wheel_hitch) {
        issues.push('Trailer requires fifth wheel hitch');
      }
      
      if (trailer.hitch_type === 'ball' && trailer.required_ball_size && vehicle.hitch_ball_size !== trailer.required_ball_size) {
        if (vehicle.hitch_ball_size) {
          warnings.push(`Ball size mismatch: vehicle has ${vehicle.hitch_ball_size}", trailer needs ${trailer.required_ball_size}"`);
        } else {
          issues.push(`Trailer requires ${trailer.required_ball_size}" ball hitch`);
        }
      }
      
      if (trailer.brake_type === 'electric' && !vehicle.has_brake_controller) {
        issues.push('Trailer has electric brakes - vehicle needs brake controller');
      }
      
      if (trailer.wiring_type === '7_pin' && vehicle.trailer_wiring === '4_pin') {
        warnings.push('May need wiring adapter (trailer is 7-pin, vehicle is 4-pin)');
      }
      
      if (issues.length > 0) {
        return res.status(400).json({ 
          error: 'Compatibility issues',
          compatible: false,
          issues,
          warnings
        });
      }
      
      // Use tenantQuery for RLS enforcement
      await tenantQuery(req,
        'UPDATE trailer_profiles SET currently_hitched_to = $1, fleet_status = $2 WHERE id = $3',
        [vehicle_id, 'in_use', id]
      );
      
      res.json({ 
        success: true, 
        compatible: true,
        warnings,
        message: `Trailer "${trailer.nickname || trailer.fleet_number}" hitched to "${vehicle.nickname || vehicle.fleet_number}"`
      });
    } catch (error) {
      console.error('Error hitching trailer:', error);
      res.status(500).json({ error: 'Failed to hitch trailer' });
    }
  });

  // SECURITY: Require auth + tenant context for trailer mutations (RLS enforces isolation)
  router.post('/trailers/:id/unhitch', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Use tenantQuery for RLS enforcement
      await tenantQuery(req,
        'UPDATE trailer_profiles SET currently_hitched_to = NULL, fleet_status = $1 WHERE id = $2',
        ['available', id]
      );
      
      res.json({ success: true, message: 'Trailer unhitched' });
    } catch (error) {
      console.error('Error unhitching trailer:', error);
      res.status(500).json({ error: 'Failed to unhitch trailer' });
    }
  });

  // SECURITY: Require auth + tenant context for compatibility checks (prevents enumeration)
  router.post('/compatibility-check', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { vehicle_id, trailer_id } = req.body;
      
      // Use tenantQuery to only see shared + tenant-owned assets
      const trailerResult = await tenantQuery(req, 'SELECT * FROM trailer_profiles WHERE id = $1', [trailer_id]);
      const vehicleResult = await tenantQuery(req, 'SELECT * FROM vehicle_profiles WHERE id = $1', [vehicle_id]);
      
      if (trailerResult.rows.length === 0 || vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle or trailer not found' });
      }
      
      const trailer = trailerResult.rows[0];
      const vehicle = vehicleResult.rows[0];
      
      const issues: string[] = [];
      const warnings: string[] = [];
      
      if (trailer.gvwr_lbs && vehicle.towing_capacity_lbs && trailer.gvwr_lbs > vehicle.towing_capacity_lbs) {
        issues.push(`Trailer GVWR (${trailer.gvwr_lbs} lbs) exceeds vehicle towing capacity (${vehicle.towing_capacity_lbs} lbs)`);
      }
      
      if (trailer.hitch_type === 'gooseneck' && !vehicle.has_gooseneck_hitch) {
        issues.push('Trailer requires gooseneck hitch');
      }
      
      if (trailer.hitch_type === 'fifth_wheel' && !vehicle.has_fifth_wheel_hitch) {
        issues.push('Trailer requires fifth wheel hitch');
      }
      
      if (trailer.hitch_type === 'ball' && trailer.required_ball_size && vehicle.hitch_ball_size !== trailer.required_ball_size) {
        if (vehicle.hitch_ball_size) {
          warnings.push(`Ball size mismatch: vehicle has ${vehicle.hitch_ball_size}", trailer needs ${trailer.required_ball_size}"`);
        } else {
          warnings.push(`Unknown vehicle ball size - trailer needs ${trailer.required_ball_size}"`);
        }
      }
      
      if (trailer.brake_type === 'electric' && !vehicle.has_brake_controller) {
        issues.push('Trailer has electric brakes - vehicle needs brake controller');
      }
      
      if (trailer.wiring_type === '7_pin' && vehicle.trailer_wiring === '4_pin') {
        warnings.push('May need wiring adapter');
      }
      
      res.json({
        compatible: issues.length === 0,
        issues,
        warnings,
        vehicle: { id: vehicle.id, name: vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}` },
        trailer: { id: trailer.id, name: trailer.nickname || trailer.fleet_number }
      });
    } catch (error) {
      console.error('Error checking compatibility:', error);
      res.status(500).json({ error: 'Failed to check compatibility' });
    }
  });

  // ============================================
  // DRIVER QUALIFICATION CHECKING ENDPOINTS
  // ============================================

  // SECURITY: Require auth + tenant context for driver qualification checks
  router.post('/check-driver-qualification', requireAuth, requireTenant, async (req: Request, res: Response) => {
    try {
      const { driverId, trailerId, province = 'BC' } = req.body;

      if (!driverId || !trailerId) {
        return res.status(400).json({ 
          error: 'Missing required fields: driverId and trailerId' 
        });
      }

      // Use tenantQuery for RLS enforcement
      const result = await tenantQuery(req, `
        SELECT 
          (check_driver_trailer_qualification($1::uuid, $2::uuid, $3)).*
      `, [driverId, trailerId, province]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Qualification check failed' });
      }

      const row = result.rows[0];
      
      res.json({
        driverId,
        trailerId,
        province,
        qualification: {
          isQualified: row.is_qualified,
          issues: row.issues || [],
          warnings: row.warnings || [],
          requiredEndorsements: row.required_endorsements || []
        },
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking driver qualification:', error);
      res.status(500).json({ error: 'Failed to check driver qualification' });
    }
  });

  // SECURITY: Self-scoped - users can only view their own qualification summary
  router.get('/driver-qualification-summary/:driverId', requireAuth, requireSelfOrAdmin('driverId'), async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;

      // Use tenantTransaction for proper context isolation
      const { driverRow, qualRows } = await withTenantTransaction(req, async (client: PoolClient) => {
        const driverResult = await client.query(`
          SELECT 
            id, name,
            license_class, license_province, license_country, license_expiry,
            has_air_brake_endorsement,
            has_house_trailer_endorsement,
            has_heavy_trailer_endorsement,
            heavy_trailer_medical_expiry,
            fifth_wheel_experience, gooseneck_experience,
            horse_trailer_experience, boat_launching_experience
          FROM cc_participant_profiles
          WHERE id = $1
        `, [driverId]);

        if (driverResult.rows.length === 0) {
          throw new Error('DRIVER_NOT_FOUND');
        }

        const qualResult = await client.query(`
          SELECT * FROM get_driver_qualification_summary($1::uuid)
        `, [driverId]);

        return { driverRow: driverResult.rows[0], qualRows: qualResult.rows };
      });

      const driverData = driverRow;

      const trailerQualifications = qualRows.map((row: any) => ({
        trailerId: row.trailer_id,
        trailerName: row.trailer_nickname || row.trailer_type,
        trailerType: row.trailer_type,
        isQualified: row.is_qualified,
        issueCount: row.issue_count || 0,
        warningCount: row.warning_count || 0,
        primaryIssue: row.primary_issue
      }));

      const qualifiedCount = trailerQualifications.filter(t => t.isQualified).length;
      const totalCount = trailerQualifications.length;

      res.json({
        driver: {
          id: driverRow.id,
          name: driverRow.name || 'Unknown Driver',
          licenseClass: driverRow.license_class,
          licenseProvince: driverRow.license_province,
          licenseCountry: driverRow.license_country || 'CA',
          licenseExpiry: driverRow.license_expiry,
          endorsements: {
            airBrake: driverRow.has_air_brake_endorsement || false,
            houseTrailer: driverRow.has_house_trailer_endorsement || false,
            heavyTrailer: driverRow.has_heavy_trailer_endorsement || false
          },
          medicalExpiry: driverRow.heavy_trailer_medical_expiry,
          experience: {
            fifthWheel: driverRow.fifth_wheel_experience || false,
            gooseneck: driverRow.gooseneck_experience || false,
            horseTrailer: driverRow.horse_trailer_experience || false,
            boatLaunching: driverRow.boat_launching_experience || false
          }
        },
        summary: {
          qualifiedFor: qualifiedCount,
          totalTrailers: totalCount,
          percentageQualified: totalCount > 0 ? Math.round((qualifiedCount / totalCount) * 100) : 100
        },
        trailerQualifications,
        checkedAt: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message === 'DRIVER_NOT_FOUND') {
        return res.status(404).json({ error: 'Driver not found' });
      }
      console.error('Error getting driver qualification summary:', error);
      res.status(500).json({ error: 'Failed to get driver qualification summary' });
    }
  });

  // SECURITY: Self-scoped - users can only view their own qualifications
  router.get('/driver-qualifications/:driverId', requireAuth, requireSelfOrAdmin('driverId'), async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;

      // Use tenantTransaction for proper context isolation
      const result = await withTenantTransaction(req, async (client: PoolClient) => {
        const queryResult = await client.query(`
          SELECT 
            id, name, 
            license_class, license_province, license_country, license_expiry,
            has_air_brake_endorsement, air_brake_endorsement_date,
            has_house_trailer_endorsement, house_trailer_endorsement_date,
            has_heavy_trailer_endorsement, heavy_trailer_endorsement_date,
            heavy_trailer_medical_expiry,
            max_trailer_weight_certified_kg, max_combination_weight_certified_kg,
            double_tow_experience, fifth_wheel_experience, gooseneck_experience,
            heavy_equipment_loading_experience, horse_trailer_experience,
            livestock_handling_experience, boat_launching_experience,
            rv_driving_course_completed, rv_course_provider, rv_course_date
          FROM cc_participant_profiles
          WHERE id = $1
        `, [driverId]);

        if (queryResult.rows.length === 0) {
          throw new Error('DRIVER_NOT_FOUND');
        }

        return queryResult.rows[0];
      });

      res.json(result);
    } catch (error: any) {
      if (error.message === 'DRIVER_NOT_FOUND') {
        return res.status(404).json({ error: 'Driver not found' });
      }
      console.error('Error getting driver qualifications:', error);
      res.status(500).json({ error: 'Failed to get driver qualifications' });
    }
  });

  // SECURITY: Require auth + self-or-admin for driver qualification updates
  router.patch('/driver-qualifications/:driverId', requireAuth, requireSelfOrAdmin('driverId'), async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const updates = req.body;

      const allowedFields = new Set([
        'license_class', 'license_province', 'license_country', 'license_expiry',
        'has_air_brake_endorsement', 'air_brake_endorsement_date',
        'has_house_trailer_endorsement', 'house_trailer_endorsement_date',
        'has_heavy_trailer_endorsement', 'heavy_trailer_endorsement_date',
        'heavy_trailer_medical_expiry',
        'max_trailer_weight_certified_kg', 'max_combination_weight_certified_kg',
        'double_tow_experience', 'fifth_wheel_experience', 'gooseneck_experience',
        'heavy_equipment_loading_experience', 'horse_trailer_experience',
        'livestock_handling_experience', 'boat_launching_experience',
        'rv_driving_course_completed', 'rv_course_provider', 'rv_course_date'
      ]);

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.has(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(driverId);
      const query = `
        UPDATE cc_participant_profiles
        SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      // Use tenantTransaction for proper context (even though cc_participant_profiles 
      // doesn't have tenant_id, the guard already enforced self-or-admin)
      const result = await withTenantTransaction(req, async (client: PoolClient) => {
        return client.query(query, values);
      });

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      res.json({ success: true, driver: result.rows[0] });
    } catch (error) {
      console.error('Error updating driver qualifications:', error);
      res.status(500).json({ error: 'Failed to update driver qualifications' });
    }
  });

  return router;
}

export default createFleetRouter;
