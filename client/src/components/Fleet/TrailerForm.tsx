import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Ruler,
  X,
  Check,
  Camera,
  Package,
  Link2,
  Caravan,
  Zap,
  Droplets,
  Home,
  Thermometer,
  Shield,
  CircleDot,
  Hammer,
  Truck,
  Fence,
  BedDouble,
  Mountain,
  Wrench,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { apiRequest, queryClient } from '@/lib/queryClient';

const trailerFormSchema = z.object({
  nickname: z.string().optional(),
  fleet_number: z.string().optional(),
  trailer_type: z.string().default('open_utility'),
  trailer_type_class: z.string().optional(),
  color: z.string().optional(),
  license_plate: z.string().optional(),
  vin: z.string().max(17).optional(),
  
  length_feet: z.coerce.number().optional().nullable(),
  width_feet: z.coerce.number().optional().nullable(),
  height_feet: z.coerce.number().optional().nullable(),
  interior_length_feet: z.coerce.number().optional().nullable(),
  interior_width_feet: z.coerce.number().optional().nullable(),
  interior_height_feet: z.coerce.number().optional().nullable(),
  gvwr_lbs: z.coerce.number().optional().nullable(),
  empty_weight_lbs: z.coerce.number().optional().nullable(),
  payload_capacity_lbs: z.coerce.number().optional().nullable(),
  
  coupler_type: z.string().default('ball_coupler'),
  coupler_height_inches: z.coerce.number().optional().nullable(),
  coupler_adjustable: z.boolean().default(false),
  required_hitch_type: z.string().optional(),
  required_ball_size_type: z.string().default('none'),
  kingpin_weight_lbs: z.coerce.number().optional().nullable(),
  tongue_weight_lbs: z.coerce.number().optional().nullable(),
  
  safety_chain_rating_lbs: z.coerce.number().optional().nullable(),
  breakaway_system: z.boolean().default(false),
  breakaway_battery_type: z.string().optional(),
  
  axle_type: z.string().default('single'),
  axle_count: z.coerce.number().default(1),
  axle_capacity_lbs: z.coerce.number().optional().nullable(),
  suspension_type: z.string().optional(),
  tire_size: z.string().optional(),
  spare_tire_included: z.boolean().default(false),
  
  trailer_brake_type: z.string().default('none'),
  brakes_on_all_axles: z.boolean().default(true),
  abs_brakes: z.boolean().default(false),
  
  trailer_wiring_type: z.string().default('none'),
  has_breakaway_switch: z.boolean().default(false),
  has_aux_battery: z.boolean().default(false),
  has_reverse_lights: z.boolean().default(false),
  
  rear_door_type: z.string().default('none'),
  rear_door_width_inches: z.coerce.number().optional().nullable(),
  rear_door_height_inches: z.coerce.number().optional().nullable(),
  has_side_door: z.boolean().default(false),
  side_door_type_detail: z.string().optional(),
  side_door_width_inches: z.coerce.number().optional().nullable(),
  
  ramp_door_type: z.string().optional(),
  ramp_length_inches: z.coerce.number().optional().nullable(),
  ramp_capacity_lbs: z.coerce.number().optional().nullable(),
  ramp_transition_flap: z.boolean().default(false),
  dovetail_length_inches: z.coerce.number().optional().nullable(),
  
  has_interior_lighting: z.boolean().default(false),
  interior_lighting_type: z.string().optional(),
  has_e_track: z.boolean().default(false),
  e_track_rows: z.coerce.number().optional().nullable(),
  has_d_rings: z.boolean().default(false),
  d_ring_count: z.coerce.number().optional().nullable(),
  floor_type: z.string().optional(),
  wall_type: z.string().optional(),
  
  has_roof_vent: z.boolean().default(false),
  roof_vent_count: z.coerce.number().optional().nullable(),
  has_side_vents: z.boolean().default(false),
  
  exterior_material: z.string().optional(),
  roof_type: z.string().optional(),
  has_roof_rack: z.boolean().default(false),
  has_ladder_rack: z.boolean().default(false),
  has_stone_guard: z.boolean().default(false),
  has_fenders: z.boolean().default(true),
  fender_type: z.string().optional(),
  
  jack_type: z.string().optional(),
  jack_capacity_lbs: z.coerce.number().optional().nullable(),
  rear_stabilizer_jacks: z.boolean().default(false),
  
  is_rv_trailer: z.boolean().default(false),
  rv_sleep_capacity: z.coerce.number().optional().nullable(),
  rv_dry_weight_lbs: z.coerce.number().optional().nullable(),
  
  fresh_water_gallons: z.coerce.number().optional().nullable(),
  gray_water_gallons: z.coerce.number().optional().nullable(),
  black_water_gallons: z.coerce.number().optional().nullable(),
  propane_tank_count: z.coerce.number().optional().nullable(),
  propane_capacity_lbs: z.coerce.number().optional().nullable(),
  
  shore_power_amps: z.coerce.number().optional().nullable(),
  has_solar: z.boolean().default(false),
  solar_watts: z.coerce.number().optional().nullable(),
  battery_type: z.string().optional(),
  battery_amp_hours: z.coerce.number().optional().nullable(),
  has_inverter: z.boolean().default(false),
  inverter_watts: z.coerce.number().optional().nullable(),
  
  slideout_count: z.coerce.number().default(0),
  slideout_type: z.string().optional(),
  
  ac_type: z.string().optional(),
  ac_btu: z.coerce.number().optional().nullable(),
  heat_type: z.string().optional(),
  heat_btu: z.coerce.number().optional().nullable(),
  
  is_toy_hauler: z.boolean().default(false),
  garage_length_feet: z.coerce.number().optional().nullable(),
  garage_width_feet: z.coerce.number().optional().nullable(),
  garage_height_feet: z.coerce.number().optional().nullable(),
  fuel_station_gallons: z.coerce.number().optional().nullable(),
  tie_down_points: z.coerce.number().optional().nullable(),
  
  fleet_status: z.string().default('available'),
  
  // =====================================================
  // HORSE TRAILER FIELDS
  // =====================================================
  is_horse_trailer: z.boolean().default(false),
  horse_capacity: z.coerce.number().optional().nullable(),
  horse_load_config: z.string().optional(),
  stall_length_inches: z.coerce.number().optional().nullable(),
  stall_width_inches: z.coerce.number().optional().nullable(),
  stall_height_inches: z.coerce.number().optional().nullable(),
  horse_size_rating: z.string().optional(),
  divider_type: z.string().optional(),
  divider_padded: z.boolean().default(false),
  dividers_removable: z.boolean().default(false),
  has_head_dividers: z.boolean().default(false),
  has_butt_bars: z.boolean().default(false),
  has_breast_bars: z.boolean().default(false),
  manger_type: z.string().optional(),
  has_hay_rack: z.boolean().default(false),
  hay_rack_type: z.string().optional(),
  drop_down_windows_head: z.coerce.number().optional().nullable(),
  drop_down_windows_butt: z.coerce.number().optional().nullable(),
  slider_windows: z.coerce.number().optional().nullable(),
  roof_vents: z.coerce.number().optional().nullable(),
  window_bars: z.boolean().default(false),
  escape_door_count: z.coerce.number().optional().nullable(),
  escape_door_side: z.string().optional(),
  walk_through_door: z.boolean().default(false),
  rear_load_type: z.string().optional(),
  side_ramp: z.boolean().default(false),
  rear_ramp_spring_assist: z.boolean().default(false),
  horse_floor_type: z.string().optional(),
  floor_mats: z.boolean().default(false),
  kick_wall_padding: z.boolean().default(false),
  lined_walls: z.boolean().default(false),
  insulated_walls: z.boolean().default(false),
  tie_ring_count: z.coerce.number().optional().nullable(),
  tie_system_type: z.string().optional(),
  
  // Tack Room
  has_tack_room: z.boolean().default(false),
  tack_room_type: z.string().optional(),
  tack_room_length_inches: z.coerce.number().optional().nullable(),
  tack_room_width: z.string().optional(),
  saddle_rack_count: z.coerce.number().optional().nullable(),
  saddle_rack_type: z.string().optional(),
  bridle_hooks: z.coerce.number().optional().nullable(),
  blanket_bar: z.boolean().default(false),
  tack_room_carpet: z.boolean().default(false),
  brush_tray: z.boolean().default(false),
  
  // Living Quarters
  has_living_quarters: z.boolean().default(false),
  lq_certified: z.boolean().default(false),
  lq_certification_type: z.string().optional(),
  lq_short_wall_feet: z.coerce.number().optional().nullable(),
  lq_long_wall_feet: z.coerce.number().optional().nullable(),
  lq_width_feet: z.coerce.number().optional().nullable(),
  lq_ceiling_height_inches: z.coerce.number().optional().nullable(),
  lq_sleep_capacity: z.coerce.number().optional().nullable(),
  lq_bed_type: z.string().optional(),
  lq_bed_count: z.coerce.number().optional().nullable(),
  lq_has_cabover_bed: z.boolean().default(false),
  lq_has_kitchen: z.boolean().default(false),
  lq_cooktop_type: z.string().optional(),
  lq_has_oven: z.boolean().default(false),
  lq_has_microwave: z.boolean().default(false),
  lq_refrigerator_type: z.string().optional(),
  lq_refrigerator_cubic_feet: z.coerce.number().optional().nullable(),
  lq_sink_type: z.string().optional(),
  lq_has_outdoor_kitchen: z.boolean().default(false),
  lq_has_bathroom: z.boolean().default(false),
  lq_bathroom_type: z.string().optional(),
  lq_toilet_type: z.string().optional(),
  lq_has_shower: z.boolean().default(false),
  lq_shower_type: z.string().optional(),
  lq_has_vanity: z.boolean().default(false),
  lq_ac_type: z.string().optional(),
  lq_ac_btu: z.coerce.number().optional().nullable(),
  lq_heat_type: z.string().optional(),
  lq_heat_btu: z.coerce.number().optional().nullable(),
  lq_fresh_water_gallons: z.coerce.number().optional().nullable(),
  lq_gray_water_gallons: z.coerce.number().optional().nullable(),
  lq_black_water_gallons: z.coerce.number().optional().nullable(),
  lq_water_heater_type: z.string().optional(),
  lq_water_heater_gallons: z.coerce.number().optional().nullable(),
  lq_winterized: z.boolean().default(false),
  lq_shore_power_amps: z.coerce.number().optional().nullable(),
  lq_has_generator: z.boolean().default(false),
  lq_generator_watts: z.coerce.number().optional().nullable(),
  lq_generator_fuel: z.string().optional(),
  lq_has_solar: z.boolean().default(false),
  lq_solar_watts: z.coerce.number().optional().nullable(),
  lq_battery_type: z.string().optional(),
  lq_battery_amp_hours: z.coerce.number().optional().nullable(),
  lq_has_inverter: z.boolean().default(false),
  lq_inverter_watts: z.coerce.number().optional().nullable(),
  lq_has_awning: z.boolean().default(false),
  lq_awning_length_feet: z.coerce.number().optional().nullable(),
  lq_has_slide_out: z.boolean().default(false),
  lq_slide_out_count: z.coerce.number().optional().nullable(),
  lq_propane_tank_count: z.coerce.number().optional().nullable(),
  lq_propane_capacity_lbs: z.coerce.number().optional().nullable(),
  
  // Work Trailer
  is_work_trailer: z.boolean().default(false),
  work_trailer_type: z.string().optional(),
  has_shelving: z.boolean().default(false),
  shelving_type: z.string().optional(),
  shelving_sides: z.string().optional(),
  shelf_count: z.coerce.number().optional().nullable(),
  has_parts_bins: z.boolean().default(false),
  parts_bin_count: z.coerce.number().optional().nullable(),
  has_tool_cabinets: z.boolean().default(false),
  has_overhead_storage: z.boolean().default(false),
  has_workbench: z.boolean().default(false),
  workbench_type: z.string().optional(),
  workbench_length_inches: z.coerce.number().optional().nullable(),
  workbench_width_inches: z.coerce.number().optional().nullable(),
  workbench_has_vise: z.boolean().default(false),
  ladder_rack_type: z.string().optional(),
  has_pipe_rack: z.boolean().default(false),
  pipe_rack_length_feet: z.coerce.number().optional().nullable(),
  has_conduit_tube: z.boolean().default(false),
  has_lumber_rack: z.boolean().default(false),
  has_generator_mount: z.boolean().default(false),
  generator_mount_type: z.string().optional(),
  has_shore_power: z.boolean().default(false),
  shore_power_amps_work: z.coerce.number().optional().nullable(),
  electrical_outlets: z.coerce.number().optional().nullable(),
  outlet_type: z.string().optional(),
  has_air_compressor_mount: z.boolean().default(false),
  has_welder_outlet: z.boolean().default(false),
  welder_outlet_amps: z.coerce.number().optional().nullable(),
  has_hvac: z.boolean().default(false),
  hvac_type: z.string().optional(),
  has_exhaust_fan: z.boolean().default(false),
  exhaust_fan_cfm: z.coerce.number().optional().nullable(),
  has_dust_collection: z.boolean().default(false),
  
  // Equipment Trailer
  is_equipment_trailer: z.boolean().default(false),
  deck_type: z.string().optional(),
  deck_length_feet: z.coerce.number().optional().nullable(),
  deck_width_inches: z.coerce.number().optional().nullable(),
  deck_height_inches: z.coerce.number().optional().nullable(),
  well_length_feet: z.coerce.number().optional().nullable(),
  upper_deck_length_feet: z.coerce.number().optional().nullable(),
  lower_deck_length_feet: z.coerce.number().optional().nullable(),
  is_extendable: z.boolean().default(false),
  extended_length_feet: z.coerce.number().optional().nullable(),
  retracted_length_feet: z.coerce.number().optional().nullable(),
  max_load_height_feet: z.coerce.number().optional().nullable(),
  max_legal_height_feet: z.coerce.number().optional().nullable(),
  gooseneck_removable: z.boolean().default(false),
  gooseneck_type: z.string().optional(),
  has_loading_ramps: z.boolean().default(false),
  ramp_type_equipment: z.string().optional(),
  ramp_length_feet: z.coerce.number().optional().nullable(),
  ramp_width_inches: z.coerce.number().optional().nullable(),
  ramp_capacity_lbs_equipment: z.coerce.number().optional().nullable(),
  tilt_type: z.string().optional(),
  tilt_angle_degrees: z.coerce.number().optional().nullable(),
  stationary_front_feet: z.coerce.number().optional().nullable(),
  axle_count_equipment: z.coerce.number().optional().nullable(),
  axle_spacing_inches: z.coerce.number().optional().nullable(),
  axle_capacity_per_axle_lbs: z.coerce.number().optional().nullable(),
  has_lift_axle: z.boolean().default(false),
  lift_axle_count: z.coerce.number().optional().nullable(),
  has_air_ride: z.boolean().default(false),
  has_spread_axle: z.boolean().default(false),
  has_stake_pockets: z.boolean().default(false),
  stake_pocket_count: z.coerce.number().optional().nullable(),
  has_rub_rails: z.boolean().default(false),
  has_winch: z.boolean().default(false),
  winch_capacity_lbs: z.coerce.number().optional().nullable(),
  winch_type: z.string().optional(),
  has_chain_tie_downs: z.boolean().default(false),
  chain_binder_count: z.coerce.number().optional().nullable(),
  deck_surface_type: z.string().optional(),
  d_ring_capacity_lbs: z.coerce.number().optional().nullable(),
  
  // Livestock Trailer
  is_livestock_trailer: z.boolean().default(false),
  livestock_type: z.string().optional(),
  livestock_capacity_head: z.coerce.number().optional().nullable(),
  has_center_gate: z.boolean().default(false),
  center_gate_type: z.string().optional(),
  has_possum_belly: z.boolean().default(false),
  possum_belly_count: z.coerce.number().optional().nullable(),
  has_upper_deck: z.boolean().default(false),
  punch_floor: z.boolean().default(false),
  has_nose_gate: z.boolean().default(false),
  
  // Dump Trailer
  is_dump_trailer: z.boolean().default(false),
  dump_type: z.string().optional(),
  dump_capacity_cubic_yards: z.coerce.number().optional().nullable(),
  dump_bed_length_feet: z.coerce.number().optional().nullable(),
  dump_bed_width_inches: z.coerce.number().optional().nullable(),
  dump_bed_height_inches: z.coerce.number().optional().nullable(),
  dump_hydraulic_type: z.string().optional(),
  dump_lift_capacity_lbs: z.coerce.number().optional().nullable(),
  has_tarp_system: z.boolean().default(false),
  tarp_type: z.string().optional(),
  has_barn_doors: z.boolean().default(false),
  has_spread_gate: z.boolean().default(false),
  
  // =====================================================
  // OVERLANDER/EXPEDITION TRAILER FIELDS
  // =====================================================
  is_overlander: z.boolean().default(false),
  overlander_type: z.string().optional(),
  // Off-Road Capability
  ground_clearance_inches: z.coerce.number().optional().nullable(),
  approach_angle_degrees: z.coerce.number().optional().nullable(),
  departure_angle_degrees: z.coerce.number().optional().nullable(),
  breakover_angle_degrees: z.coerce.number().optional().nullable(),
  // Suspension
  suspension_type_offroad: z.string().optional(),
  articulating_hitch: z.boolean().default(false),
  hitch_articulation_degrees: z.coerce.number().optional().nullable(),
  // Tires
  tire_size_offroad: z.string().optional(),
  tire_type: z.string().optional(),
  // Recovery/Protection
  has_skid_plates: z.boolean().default(false),
  has_rock_sliders: z.boolean().default(false),
  has_recovery_points: z.boolean().default(false),
  recovery_point_count: z.coerce.number().optional().nullable(),
  // Rooftop Tent
  has_rooftop_tent_mount: z.boolean().default(false),
  rooftop_tent_weight_capacity_lbs: z.coerce.number().optional().nullable(),
  roof_rack_type: z.string().optional(),
  // Galley/Outdoor Kitchen
  has_slide_out_kitchen: z.boolean().default(false),
  kitchen_side: z.string().optional(),
  has_outdoor_shower: z.boolean().default(false),
  outdoor_shower_type: z.string().optional(),
  // Water
  external_water_tank_gallons: z.coerce.number().optional().nullable(),
  has_water_filtration: z.boolean().default(false),
  // Fuel (Jerry Cans)
  has_jerry_can_mounts: z.boolean().default(false),
  jerry_can_capacity_gallons: z.coerce.number().optional().nullable(),
  
  // =====================================================
  // TINY HOME ON WHEELS (THOW) FIELDS
  // =====================================================
  is_tiny_home: z.boolean().default(false),
  thow_certification: z.string().optional(),
  thow_square_feet: z.coerce.number().optional().nullable(),
  thow_loft_count: z.coerce.number().optional().nullable(),
  thow_full_time_rated: z.boolean().default(false),
  thow_four_season: z.boolean().default(false),
  thow_composting_toilet: z.boolean().default(false),
  thow_incinerating_toilet: z.boolean().default(false),
  registered_as: z.string().optional(),
  
  // =====================================================
  // SPECIALTY EQUIPMENT TRAILER FIELDS
  // =====================================================
  is_specialty_equipment: z.boolean().default(false),
  equipment_type: z.string().optional(),
  equipment_make: z.string().optional(),
  equipment_model: z.string().optional(),
  equipment_power_type: z.string().optional(),
  equipment_hp: z.coerce.number().optional().nullable(),
  requires_setup_time: z.boolean().default(false),
  setup_time_minutes: z.coerce.number().optional().nullable(),
  requires_level_ground: z.boolean().default(false),
  has_outriggers: z.boolean().default(false),
  license_plate_exempt: z.boolean().default(false),
  // Sawmill
  sawmill_max_log_diameter_inches: z.coerce.number().optional().nullable(),
  sawmill_max_log_length_feet: z.coerce.number().optional().nullable(),
  sawmill_cut_width_inches: z.coerce.number().optional().nullable(),
  // Welder
  welder_amp_rating: z.coerce.number().optional().nullable(),
  // Generator
  generator_kw_rating: z.coerce.number().optional().nullable(),
  generator_voltage: z.string().optional(),
  generator_phase: z.string().optional(),
  // Pressure Washer
  water_tank_gallons: z.coerce.number().optional().nullable(),
  // Air Compressor
  compressor_cfm: z.coerce.number().optional().nullable(),
  compressor_psi_max: z.coerce.number().optional().nullable(),
  tank_gallons: z.coerce.number().optional().nullable(),
  // Light Tower
  light_tower_height_feet: z.coerce.number().optional().nullable(),
  light_output_lumens: z.coerce.number().optional().nullable(),
  light_coverage_acres: z.coerce.number().optional().nullable(),
  // Fuel Transfer
  fuel_type_stored: z.string().optional(),
  has_fuel_pump: z.boolean().default(false),
  fuel_pump_gpm: z.coerce.number().optional().nullable(),
  // Concrete Mixer
  mixer_capacity_cubic_yards: z.coerce.number().optional().nullable(),
  mixer_drum_rpm: z.coerce.number().optional().nullable(),
});

type TrailerFormData = z.infer<typeof trailerFormSchema>;

const TRAILER_TYPES = [
  { value: 'enclosed_cargo', label: 'Enclosed Cargo' },
  { value: 'open_utility', label: 'Open Utility' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'dump', label: 'Dump' },
  { value: 'car_hauler', label: 'Car Hauler' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'horse', label: 'Horse' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'travel_trailer', label: 'Travel Trailer' },
  { value: 'fifth_wheel_rv', label: 'Fifth Wheel RV' },
  { value: 'toy_hauler', label: 'Toy Hauler' },
  { value: 'popup_camper', label: 'Pop-up Camper' },
  { value: 'teardrop', label: 'Teardrop' },
  { value: 'overlander', label: 'Overlander/Expedition' },
  { value: 'tiny_home', label: 'Tiny Home (THOW)' },
  { value: 'boat', label: 'Boat' },
  { value: 'pwc', label: 'PWC/Jet Ski' },
  { value: 'pontoon', label: 'Pontoon' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'office', label: 'Office' },
  { value: 'specialty_equipment', label: 'Specialty Equipment' },
  { value: 'custom', label: 'Custom' },
];

const COUPLER_TYPES = [
  { value: 'ball_coupler', label: 'Ball Coupler' },
  { value: 'gooseneck_coupler', label: 'Gooseneck Coupler' },
  { value: 'fifth_wheel_kingpin', label: 'Fifth Wheel Kingpin' },
  { value: 'pintle_ring', label: 'Pintle Ring' },
  { value: 'adjustable_coupler', label: 'Adjustable Coupler' },
];

const HITCH_TYPES = [
  { value: 'any', label: 'Any' },
  { value: 'bumper_pull', label: 'Bumper Pull' },
  { value: 'gooseneck', label: 'Gooseneck' },
  { value: 'fifth_wheel', label: 'Fifth Wheel' },
  { value: 'pintle', label: 'Pintle' },
];

const BALL_SIZES = [
  { value: 'none', label: 'N/A' },
  { value: '1_7_8', label: '1-7/8" (Light)' },
  { value: '2', label: '2" (Common)' },
  { value: '2_5_16', label: '2-5/16" (Heavy)' },
  { value: '3', label: '3" (Extra Heavy)' },
];

const AXLE_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'tandem', label: 'Tandem (2)' },
  { value: 'triple', label: 'Triple (3)' },
  { value: 'quad', label: 'Quad (4)' },
];

const SUSPENSION_TYPES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'leaf_spring', label: 'Leaf Spring' },
  { value: 'torsion', label: 'Torsion' },
  { value: 'air_ride', label: 'Air Ride' },
];

const BRAKE_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'surge', label: 'Surge (Hydraulic)' },
  { value: 'electric', label: 'Electric' },
  { value: 'electric_hydraulic', label: 'Electric/Hydraulic' },
  { value: 'air', label: 'Air Brakes' },
];

const WIRING_TYPES = [
  { value: 'none', label: 'None' },
  { value: '4_pin_flat', label: '4-Pin Flat' },
  { value: '5_pin_flat', label: '5-Pin Flat' },
  { value: '6_pin_round', label: '6-Pin Round' },
  { value: '7_pin_rv_blade', label: '7-Pin RV Blade' },
  { value: '7_pin_round', label: '7-Pin Round' },
];

const REAR_DOOR_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'swing_doors', label: 'Swing Doors (Barn)' },
  { value: 'roll_up', label: 'Roll-Up' },
  { value: 'ramp_door', label: 'Ramp Door' },
  { value: 'ramp_spring_assist', label: 'Ramp (Spring Assist)' },
  { value: 'lift_gate_door', label: 'Liftgate Door' },
];

const RAMP_TYPES = [
  { value: 'na', label: 'N/A' },
  { value: 'fold_down', label: 'Fold Down' },
  { value: 'spring_assist', label: 'Spring Assist' },
  { value: 'power', label: 'Power' },
  { value: 'stowable', label: 'Stowable' },
];

const FLOOR_TYPES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'wood', label: 'Wood' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'rubber_coin', label: 'Rubber Coin' },
  { value: 'steel_tread', label: 'Steel Tread' },
];

const WALL_TYPES = [
  { value: 'na', label: 'N/A' },
  { value: 'plywood', label: 'Plywood' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'bare_studs', label: 'Bare Studs' },
];

const EXTERIOR_MATERIALS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'steel', label: 'Steel' },
  { value: 'fiberglass', label: 'Fiberglass' },
];

const ROOF_TYPES = [
  { value: 'na', label: 'N/A' },
  { value: 'flat', label: 'Flat' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'peaked', label: 'Peaked' },
];

const JACK_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'manual_crank', label: 'Manual Crank' },
  { value: 'power', label: 'Power' },
  { value: 'stabilizer', label: 'Stabilizer Only' },
];

const GENERATOR_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'gas', label: 'Gas' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'propane', label: 'Propane' },
];

const BATTERY_TYPES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'lead_acid', label: 'Lead Acid' },
  { value: 'agm', label: 'AGM' },
  { value: 'lithium', label: 'Lithium (LiFePO4)' },
];

const AC_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'roof', label: 'Roof Mount' },
  { value: 'basement', label: 'Basement' },
  { value: 'ducted', label: 'Ducted' },
];

const HEAT_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'propane', label: 'Propane Furnace' },
  { value: 'electric', label: 'Electric' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'hydronic', label: 'Hydronic' },
];

const HORSE_LOAD_CONFIGS = [
  { value: 'straight_load', label: 'Straight Load' },
  { value: 'slant_load', label: 'Slant Load' },
  { value: 'reverse_slant', label: 'Reverse Slant' },
  { value: 'head_to_head', label: 'Head to Head' },
  { value: 'box_stall', label: 'Box Stall' },
  { value: 'stock_open', label: 'Stock/Open' },
];

const HORSE_SIZE_RATINGS = [
  { value: 'pony', label: 'Pony (up to 14.2hh)' },
  { value: 'small', label: 'Small Horse (14.2-15.2hh)' },
  { value: 'standard', label: 'Standard (15.2-16.2hh)' },
  { value: 'warmblood', label: 'Warmblood (16.2-17.2hh)' },
  { value: 'draft', label: 'Draft (17.2hh+)' },
];

const DIVIDER_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'full_height', label: 'Full Height' },
  { value: 'partial', label: 'Partial Height' },
  { value: 'padded', label: 'Padded' },
  { value: 'air_flow', label: 'Air Flow' },
  { value: 'stud_wall', label: 'Stud Wall' },
  { value: 'telescoping', label: 'Telescoping' },
  { value: 'removable', label: 'Removable' },
  { value: 'swing_out', label: 'Swing Out' },
];

const MANGER_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'standard_manger', label: 'Standard Manger' },
  { value: 'drop_down_manger', label: 'Drop-Down Manger' },
  { value: 'hay_bag_only', label: 'Hay Bag Only' },
  { value: 'walk_through', label: 'Walk Through' },
];

const REAR_LOAD_TYPES = [
  { value: 'ramp', label: 'Ramp' },
  { value: 'step_up', label: 'Step Up' },
  { value: 'dutch_doors', label: 'Dutch Doors' },
  { value: 'swing_doors', label: 'Swing Doors' },
];

const HORSE_FLOOR_TYPES = [
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'wood', label: 'Wood' },
  { value: 'rubber_mat', label: 'Rubber Mat' },
  { value: 'rumber', label: 'Rumber (Recycled)' },
];

const TACK_ROOM_TYPES = [
  { value: 'front_tack', label: 'Front Tack' },
  { value: 'rear_tack', label: 'Rear Tack' },
  { value: 'mid_tack', label: 'Mid Tack' },
  { value: 'fold_up', label: 'Fold Up' },
  { value: 'collapsible', label: 'Collapsible' },
];

const SADDLE_RACK_TYPES = [
  { value: 'swing_out', label: 'Swing Out' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'removable', label: 'Removable' },
];

const LQ_BED_TYPES = [
  { value: 'queen', label: 'Queen' },
  { value: 'full', label: 'Full' },
  { value: 'dinette_converts', label: 'Dinette Converts' },
  { value: 'sofa_sleeper', label: 'Sofa Sleeper' },
  { value: 'bunk', label: 'Bunks' },
  { value: 'cabover', label: 'Cabover Bed' },
];

const LQ_COOKTOP_TYPES = [
  { value: 'none', label: 'None' },
  { value: '2_burner', label: '2-Burner' },
  { value: '3_burner', label: '3-Burner' },
  { value: 'induction', label: 'Induction' },
];

const LQ_REFRIGERATOR_TYPES = [
  { value: 'none', label: 'None' },
  { value: '3_way', label: '3-Way (Propane/12V/120V)' },
  { value: '12v_compressor', label: '12V Compressor' },
  { value: 'residential', label: 'Residential' },
];

const LQ_BATHROOM_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'wet_bath', label: 'Wet Bath' },
  { value: 'dry_bath', label: 'Dry Bath' },
  { value: 'half_bath', label: 'Half Bath' },
];

const LQ_TOILET_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'gravity', label: 'Gravity' },
  { value: 'macerator', label: 'Macerator' },
  { value: 'cassette', label: 'Cassette' },
  { value: 'porta_potti', label: 'Porta Potti' },
];

const WORK_TRAILER_TYPES = [
  { value: 'contractor', label: 'Contractor' },
  { value: 'mobile_workshop', label: 'Mobile Workshop' },
  { value: 'service', label: 'Service' },
  { value: 'fiber_splicing', label: 'Fiber Splicing' },
];

const SHELVING_TYPES = [
  { value: 'wood', label: 'Wood' },
  { value: 'metal', label: 'Metal' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'adjustable', label: 'Adjustable' },
];

const WORKBENCH_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'fold_down', label: 'Fold Down' },
  { value: 'slide_out', label: 'Slide Out' },
];

const DECK_TYPES = [
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'step_deck', label: 'Step Deck' },
  { value: 'double_drop', label: 'Double Drop' },
  { value: 'lowboy_fixed', label: 'Lowboy (Fixed)' },
  { value: 'rgn', label: 'RGN (Removable Gooseneck)' },
  { value: 'tilt_deck', label: 'Tilt Deck' },
  { value: 'deckover', label: 'Deckover' },
  { value: 'beavertail', label: 'Beavertail' },
  { value: 'hydraulic_tail', label: 'Hydraulic Tail' },
];

const GOOSENECK_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'hydraulic_detach', label: 'Hydraulic Detach' },
  { value: 'mechanical_detach', label: 'Mechanical Detach' },
];

const TILT_TYPES = [
  { value: 'gravity', label: 'Gravity Tilt' },
  { value: 'hydraulic', label: 'Hydraulic Tilt' },
  { value: 'power_up_gravity_down', label: 'Power Up/Gravity Down' },
];

const WINCH_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'electric', label: 'Electric' },
  { value: 'hydraulic', label: 'Hydraulic' },
];

const DECK_SURFACE_TYPES = [
  { value: 'steel', label: 'Steel' },
  { value: 'wood', label: 'Wood' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'apitong', label: 'Apitong' },
  { value: 'rubber', label: 'Rubber' },
];

const LIVESTOCK_TYPES = [
  { value: 'cattle', label: 'Cattle' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'goats', label: 'Goats' },
  { value: 'hogs', label: 'Hogs' },
  { value: 'mixed', label: 'Mixed' },
];

const DUMP_TYPES = [
  { value: 'end_dump', label: 'End Dump' },
  { value: 'side_dump', label: 'Side Dump' },
  { value: 'belly_dump', label: 'Belly Dump' },
  { value: 'bottom_dump', label: 'Bottom Dump' },
];

const DUMP_HYDRAULIC_TYPES = [
  { value: 'scissor', label: 'Scissor' },
  { value: 'telescopic', label: 'Telescopic' },
  { value: 'dual_piston', label: 'Dual Piston' },
];

const FLEET_STATUSES = [
  { value: 'available', label: 'Available', variant: 'default' as const },
  { value: 'in_use', label: 'In Use', variant: 'secondary' as const },
  { value: 'maintenance', label: 'Maintenance', variant: 'destructive' as const },
];

// =====================================================
// OVERLANDER/EXPEDITION CONSTANTS
// =====================================================
const OVERLANDER_TYPES = [
  { value: 'expedition', label: 'Expedition Trailer' },
  { value: 'teardrop_offroad', label: 'Off-Road Teardrop' },
  { value: 'popup_offroad', label: 'Off-Road Pop-up' },
  { value: 'cargo_converted', label: 'Cargo Converted' },
  { value: 'squaredrop', label: 'Squaredrop' },
  { value: 'custom_build', label: 'Custom Build' },
];

const OFFROAD_SUSPENSION_TYPES = [
  { value: 'timbren_axleless', label: 'Timbren Axle-less' },
  { value: 'independent_coilover', label: 'Independent Coilover' },
  { value: 'airbag', label: 'Air Bag' },
  { value: 'torsion', label: 'Torsion' },
  { value: 'leaf_spring', label: 'Leaf Spring' },
  { value: 'multi_link', label: 'Multi-Link' },
  { value: 'trailing_arm', label: 'Trailing Arm' },
];

const TIRE_TYPES = [
  { value: 'highway', label: 'Highway' },
  { value: 'all_terrain', label: 'All Terrain (A/T)' },
  { value: 'mud_terrain', label: 'Mud Terrain (M/T)' },
  { value: 'snow', label: 'Snow Rated' },
];

const ROOF_RACK_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'exoskeleton', label: 'Exoskeleton Cage' },
  { value: 'standard', label: 'Standard Rails' },
  { value: 'flush_mount', label: 'Flush Mount' },
  { value: 'crossbars', label: 'Crossbars Only' },
];

const KITCHEN_SIDES = [
  { value: 'driver', label: 'Driver Side' },
  { value: 'passenger', label: 'Passenger Side' },
  { value: 'rear', label: 'Rear' },
];

const OUTDOOR_SHOWER_TYPES = [
  { value: 'solar_heated', label: 'Solar Heated' },
  { value: 'tankless', label: 'Tankless' },
  { value: 'pressurized', label: 'Pressurized Cold' },
];

// =====================================================
// TINY HOME ON WHEELS (THOW) CONSTANTS
// =====================================================
const THOW_CERTIFICATION_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'rvia', label: 'RVIA Certified' },
  { value: 'noah', label: 'NOAH Certified' },
  { value: 'pac_west', label: 'Pac West' },
  { value: 'diy', label: 'DIY/Self-Built' },
];

const REGISTERED_AS_TYPES = [
  { value: 'rv', label: 'RV' },
  { value: 'travel_trailer', label: 'Travel Trailer' },
  { value: 'mobile_home', label: 'Mobile Home' },
  { value: 'utility_trailer', label: 'Utility Trailer' },
  { value: 'park_model', label: 'Park Model' },
];

// =====================================================
// SPECIALTY EQUIPMENT CONSTANTS
// =====================================================
const SPECIALTY_EQUIPMENT_TYPES = [
  { value: 'portable_sawmill', label: 'Portable Sawmill' },
  { value: 'welding_rig', label: 'Welding Rig' },
  { value: 'generator_trailer', label: 'Generator Trailer' },
  { value: 'pressure_washer', label: 'Pressure Washer' },
  { value: 'air_compressor', label: 'Air Compressor' },
  { value: 'light_tower', label: 'Light Tower' },
  { value: 'fuel_transfer', label: 'Fuel Transfer' },
  { value: 'concrete_mixer', label: 'Concrete Mixer' },
  { value: 'wood_chipper', label: 'Wood Chipper' },
  { value: 'stump_grinder', label: 'Stump Grinder' },
  { value: 'mobile_crane', label: 'Mobile Crane' },
  { value: 'boom_lift', label: 'Boom Lift' },
  { value: 'scissor_lift', label: 'Scissor Lift' },
];

const EQUIPMENT_POWER_TYPES = [
  { value: 'gas', label: 'Gasoline' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'pto', label: 'PTO (Tractor)' },
  { value: 'hydraulic', label: 'Hydraulic' },
];

const GENERATOR_VOLTAGES = [
  { value: '120v', label: '120V' },
  { value: '240v', label: '240V' },
  { value: '480v', label: '480V' },
  { value: 'multi', label: 'Multi-Voltage' },
];

const GENERATOR_PHASES = [
  { value: 'single', label: 'Single Phase' },
  { value: 'three', label: 'Three Phase' },
];

const FUEL_TYPES_STORED = [
  { value: 'gasoline', label: 'Gasoline' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'aviation', label: 'Aviation Fuel' },
  { value: 'def', label: 'DEF' },
];

interface TrailerFormProps {
  trailerId?: string;
  initialData?: Partial<TrailerFormData>;
  onSave: () => void;
  onCancel: () => void;
}

export function TrailerForm({ trailerId, initialData, onSave, onCancel }: TrailerFormProps) {
  const [activeTab, setActiveTab] = useState('basic');

  const trailerQuery = useQuery<{ trailer: TrailerFormData }>({
    queryKey: ['/api/v1/fleet/trailers', trailerId],
    enabled: !!trailerId,
  });

  const form = useForm<TrailerFormData>({
    resolver: zodResolver(trailerFormSchema),
    defaultValues: {
      nickname: '',
      fleet_number: '',
      trailer_type: 'open_utility',
      color: '',
      license_plate: '',
      vin: '',
      length_feet: undefined,
      width_feet: undefined,
      height_feet: undefined,
      gvwr_lbs: undefined,
      empty_weight_lbs: undefined,
      payload_capacity_lbs: undefined,
      coupler_type: 'ball_coupler',
      required_ball_size_type: 'none',
      tongue_weight_lbs: undefined,
      axle_type: 'single',
      axle_count: 1,
      trailer_brake_type: 'none',
      trailer_wiring_type: 'none',
      rear_door_type: 'none',
      floor_type: 'unknown',
      fleet_status: 'available',
      is_rv_trailer: false,
      is_toy_hauler: false,
      ...initialData,
    },
  });

  useEffect(() => {
    if (trailerQuery.data?.trailer) {
      const t = trailerQuery.data.trailer;
      form.reset({
        ...t,
        nickname: t.nickname || '',
        fleet_number: t.fleet_number || '',
        trailer_type: t.trailer_type || 'open_utility',
        color: t.color || '',
        license_plate: t.license_plate || '',
        vin: t.vin || '',
        coupler_type: t.coupler_type || 'ball_coupler',
        required_ball_size_type: t.required_ball_size_type || 'none',
        axle_type: t.axle_type || 'single',
        axle_count: t.axle_count || 1,
        trailer_brake_type: t.trailer_brake_type || 'none',
        trailer_wiring_type: t.trailer_wiring_type || 'none',
        rear_door_type: t.rear_door_type || 'none',
        floor_type: t.floor_type || 'unknown',
        fleet_status: t.fleet_status || 'available',
        is_rv_trailer: t.is_rv_trailer || false,
        is_toy_hauler: t.is_toy_hauler || false,
      });
    }
  }, [trailerQuery.data, form]);

  const createMutation = useMutation({
    mutationFn: async (data: TrailerFormData) => {
      const res = await apiRequest('POST', '/api/v1/fleet/trailers', data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to create trailer' }));
        throw new Error(error.message || 'Failed to create trailer');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet');
        }
      });
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TrailerFormData) => {
      const res = await apiRequest('PATCH', `/api/v1/fleet/trailers/${trailerId}`, data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to update trailer' }));
        throw new Error(error.message || 'Failed to update trailer');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet');
        }
      });
      onSave();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: TrailerFormData) {
    if (trailerId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  function onError(errors: any) {
    console.error('TrailerForm validation errors:', errors);
  }

  const watchedTrailerType = form.watch('trailer_type');
  const watchedIsRvTrailer = form.watch('is_rv_trailer');
  const watchedIsToyHauler = form.watch('is_toy_hauler');
  const watchedHasSolar = form.watch('has_solar');
  const watchedHasInverter = form.watch('has_inverter');
  const watchedCouplerType = form.watch('coupler_type');
  const watchedHasETrack = form.watch('has_e_track');
  const watchedHasDRings = form.watch('has_d_rings');
  const watchedIsHorseTrailer = form.watch('is_horse_trailer');
  const watchedHasLivingQuarters = form.watch('has_living_quarters');
  const watchedIsWorkTrailer = form.watch('is_work_trailer');
  const watchedIsEquipmentTrailer = form.watch('is_equipment_trailer');
  const watchedIsLivestockTrailer = form.watch('is_livestock_trailer');
  const watchedIsDumpTrailer = form.watch('is_dump_trailer');
  const watchedHasTackRoom = form.watch('has_tack_room');
  const watchedLqHasKitchen = form.watch('lq_has_kitchen');
  const watchedLqHasBathroom = form.watch('lq_has_bathroom');
  const watchedLqHasGenerator = form.watch('lq_has_generator');
  const watchedLqHasSolar = form.watch('lq_has_solar');
  const watchedLqHasInverter = form.watch('lq_has_inverter');
  const watchedHasShelving = form.watch('has_shelving');
  const watchedHasWorkbench = form.watch('has_workbench');
  const watchedHasWinch = form.watch('has_winch');
  const watchedIsOverlander = form.watch('is_overlander');
  const watchedIsTinyHome = form.watch('is_tiny_home');
  const watchedIsSpecialtyEquipment = form.watch('is_specialty_equipment');
  const watchedEquipmentType = form.watch('equipment_type');
  const watchedHasSlideOutKitchen = form.watch('has_slide_out_kitchen');
  const watchedHasOutdoorShower = form.watch('has_outdoor_shower');
  const watchedHasRecoveryPoints = form.watch('has_recovery_points');
  const watchedArticulatingHitch = form.watch('articulating_hitch');
  const watchedHasRooftopTentMount = form.watch('has_rooftop_tent_mount');
  const watchedRequiresSetupTime = form.watch('requires_setup_time');

  const isRvType = ['travel_trailer', 'fifth_wheel_rv', 'toy_hauler', 'popup_camper', 'teardrop'].includes(watchedTrailerType);
  const isEnclosedType = ['enclosed_cargo', 'travel_trailer', 'fifth_wheel_rv', 'toy_hauler', 'food_truck', 'office'].includes(watchedTrailerType);
  const isHorseType = ['horse', 'livestock'].includes(watchedTrailerType) || watchedIsHorseTrailer || watchedIsLivestockTrailer;
  const isEquipmentType = ['equipment', 'car_hauler', 'flatbed'].includes(watchedTrailerType) || watchedIsEquipmentTrailer;
  const isDumpType = watchedTrailerType === 'dump' || watchedIsDumpTrailer;
  const isOverlanderType = watchedTrailerType === 'overlander' || watchedIsOverlander;
  const isTinyHomeType = watchedTrailerType === 'tiny_home' || watchedIsTinyHome;
  const isSpecialtyEquipmentType = watchedTrailerType === 'specialty_equipment' || watchedIsSpecialtyEquipment;

  return (
    <Card className="max-h-[85vh] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Caravan className="w-5 h-5 text-primary" />
            <CardTitle>{trailerId ? 'Edit Trailer' : 'Add New Trailer'}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-trailer">
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit, onError)} 
              disabled={isPending}
              data-testid="button-save-trailer"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {isPending ? 'Saving...' : 'Save Trailer'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-4 justify-start flex-shrink-0 flex-wrap h-auto gap-1">
              <TabsTrigger value="basic" data-testid="tab-basic">
                <Caravan className="w-4 h-4 mr-1.5" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="specs" data-testid="tab-specs">
                <Ruler className="w-4 h-4 mr-1.5" />
                Specs
              </TabsTrigger>
              <TabsTrigger value="hitch" data-testid="tab-hitch">
                <Link2 className="w-4 h-4 mr-1.5" />
                Hitch
              </TabsTrigger>
              <TabsTrigger value="axles" data-testid="tab-axles">
                <CircleDot className="w-4 h-4 mr-1.5" />
                Axles
              </TabsTrigger>
              {isEnclosedType && (
                <TabsTrigger value="cargo" data-testid="tab-cargo">
                  <Package className="w-4 h-4 mr-1.5" />
                  Cargo
                </TabsTrigger>
              )}
              {isHorseType && (
                <TabsTrigger value="horse" data-testid="tab-horse">
                  <Fence className="w-4 h-4 mr-1.5" />
                  Horse
                </TabsTrigger>
              )}
              {(isHorseType || watchedHasLivingQuarters) && (
                <TabsTrigger value="lq" data-testid="tab-lq">
                  <BedDouble className="w-4 h-4 mr-1.5" />
                  LQ
                </TabsTrigger>
              )}
              {(watchedIsWorkTrailer || isEnclosedType) && (
                <TabsTrigger value="work" data-testid="tab-work">
                  <Hammer className="w-4 h-4 mr-1.5" />
                  Work
                </TabsTrigger>
              )}
              {(isEquipmentType || isDumpType) && (
                <TabsTrigger value="equipment" data-testid="tab-equipment">
                  <Truck className="w-4 h-4 mr-1.5" />
                  Equipment
                </TabsTrigger>
              )}
              {(isRvType || watchedIsRvTrailer) && (
                <TabsTrigger value="rv" data-testid="tab-rv">
                  <Home className="w-4 h-4 mr-1.5" />
                  RV
                </TabsTrigger>
              )}
              {isOverlanderType && (
                <TabsTrigger value="overlander" data-testid="tab-overlander">
                  <Mountain className="w-4 h-4 mr-1.5" />
                  Overlander
                </TabsTrigger>
              )}
              {isTinyHomeType && (
                <TabsTrigger value="tinyhome" data-testid="tab-tinyhome">
                  <Building2 className="w-4 h-4 mr-1.5" />
                  Tiny Home
                </TabsTrigger>
              )}
              {isSpecialtyEquipmentType && (
                <TabsTrigger value="specialty" data-testid="tab-specialty">
                  <Wrench className="w-4 h-4 mr-1.5" />
                  Specialty
                </TabsTrigger>
              )}
              <TabsTrigger value="photos" data-testid="tab-photos">
                <Camera className="w-4 h-4 mr-1.5" />
                Photos
              </TabsTrigger>
            </TabsList>

            <CardContent className="flex-1 overflow-y-auto pt-4">
              <TabsContent value="basic" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nickname</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., "Big Red"' {...field} data-testid="input-nickname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fleet_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fleet Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., T-001" {...field} data-testid="input-fleet-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="trailer_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trailer Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-trailer-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRAILER_TYPES.map(tt => (
                            <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input placeholder="White" {...field} data-testid="input-color" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="license_plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Plate</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ABC 123" 
                            className="font-mono" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-license-plate"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VIN</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="1UYFS..." 
                            className="font-mono text-sm"
                            maxLength={17}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-vin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fleet_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fleet Status</FormLabel>
                      <div className="flex gap-2 flex-wrap">
                        {FLEET_STATUSES.map(status => (
                          <Badge
                            key={status.value}
                            variant={field.value === status.value ? status.variant : 'outline'}
                            className={`cursor-pointer ${field.value === status.value ? '' : 'opacity-60'}`}
                            onClick={() => field.onChange(status.value)}
                            data-testid={`status-${status.value}`}
                          >
                            {status.label}
                          </Badge>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isRvType && (
                  <FormField
                    control={form.control}
                    name="is_rv_trailer"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">This is an RV Trailer</FormLabel>
                          <FormDescription>Enable RV features like tanks and power systems</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-rv" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </TabsContent>

              <TabsContent value="specs" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Overall Dimensions</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="length_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Length (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="16" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="width_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Width (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="height_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isEnclosedType && (
                  <>
                    <h4 className="font-medium text-sm">Interior Dimensions</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="interior_length_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="14" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="interior_width_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Width (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="6" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="interior_height_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Height (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="6" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                <h4 className="font-medium text-sm">Weight Ratings</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="gvwr_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GVWR (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="7000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Gross Vehicle Weight</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="empty_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empty Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payload_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payload (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Exterior</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="exterior_material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXTERIOR_MATERIALS.map(em => (
                              <SelectItem key={em.value} value={em.value}>{em.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roof_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Roof Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROOF_TYPES.map(rt => (
                              <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fender_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fender Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Steel, Aluminum..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_fenders"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Fenders</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_stone_guard"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Stone Guard</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_roof_rack"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Roof Rack</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_ladder_rack"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Ladder Rack</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="hitch" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Coupler Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="coupler_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coupler Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUPLER_TYPES.map(ct => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="required_ball_size_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Ball Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BALL_SIZES.map(bs => (
                              <SelectItem key={bs.value} value={bs.value}>{bs.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="coupler_height_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coupler Height (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="18" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Ground to coupler</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tongue_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tongue Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="700" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="coupler_adjustable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Adjustable Coupler</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {watchedCouplerType === 'fifth_wheel_kingpin' && (
                  <FormField
                    control={form.control}
                    name="kingpin_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kingpin Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Safety
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="safety_chain_rating_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Safety Chain Rating (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="7000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="breakaway_system"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Breakaway System</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Wiring</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="trailer_wiring_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wiring Connector</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WIRING_TYPES.map(wt => (
                              <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_breakaway_switch"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Breakaway Switch</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_aux_battery"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Aux Battery</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_reverse_lights"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Reverse Lights</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Jack</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="jack_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jack Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {JACK_TYPES.map(jt => (
                              <SelectItem key={jt.value} value={jt.value}>{jt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jack_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jack Capacity (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_stabilizer_jacks"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Rear Stabilizers</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="axles" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Axle Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="axle_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Axle Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AXLE_TYPES.map(at => (
                              <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="axle_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Axle Count</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="4" placeholder="2" {...field} value={field.value || 1} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="axle_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Axle Capacity (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="3500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Per axle</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="suspension_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suspension</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUSPENSION_TYPES.map(st => (
                              <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tire_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tire Size</FormLabel>
                        <FormControl>
                          <Input placeholder="ST225/75R15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="spare_tire_included"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Spare Tire Included</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Brakes</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="trailer_brake_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brake Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BRAKE_TYPES.map(bt => (
                              <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brakes_on_all_axles"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>All Axles</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="abs_brakes"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>ABS</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="cargo" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Doors</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rear_door_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rear Door Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REAR_DOOR_TYPES.map(rd => (
                              <SelectItem key={rd.value} value={rd.value}>{rd.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_door_width_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Door Width (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="60" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_door_height_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Door Height (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="72" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="has_side_door"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel>Has Side Door</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <h4 className="font-medium text-sm">Ramp Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="ramp_door_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ramp Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RAMP_TYPES.map(rt => (
                              <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ramp_length_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ramp Length (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="48" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ramp_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ramp Capacity (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Interior Features</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="floor_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FLOOR_TYPES.map(ft => (
                              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wall_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wall Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WALL_TYPES.map(wt => (
                              <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interior_lighting_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interior Lighting</FormLabel>
                        <FormControl>
                          <Input placeholder="LED, Fluorescent..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Tie-Down Systems</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_e_track"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>E-Track</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasETrack && (
                    <FormField
                      control={form.control}
                      name="e_track_rows"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Track Rows</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="has_d_rings"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>D-Rings</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasDRings && (
                    <FormField
                      control={form.control}
                      name="d_ring_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>D-Ring Count</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="8" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <h4 className="font-medium text-sm">Ventilation</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="has_roof_vent"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Roof Vents</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roof_vent_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vent Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_side_vents"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Side Vents</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="rv" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rv_sleep_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sleep Capacity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rv_dry_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dry Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Tanks
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="fresh_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fresh (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gray_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gray (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="black_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Black (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propane_tank_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propane Tanks</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propane_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propane (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Power Systems
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="shore_power_amps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shore Power (A)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="battery_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Battery Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BATTERY_TYPES.map(bt => (
                              <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="battery_amp_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Battery (Ah)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="200" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_solar"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Solar</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasSolar && (
                    <FormField
                      control={form.control}
                      name="solar_watts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Solar (W)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="400" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="has_inverter"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Inverter</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasInverter && (
                    <FormField
                      control={form.control}
                      name="inverter_watts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inverter (W)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2000" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Slideouts
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="slideout_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Slideouts</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slideout_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slideout Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Electric, Hydraulic..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Climate Control
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="ac_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AC Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AC_TYPES.map(at => (
                              <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ac_btu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AC BTU</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="15000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="heat_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heat Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HEAT_TYPES.map(ht => (
                              <SelectItem key={ht.value} value={ht.value}>{ht.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="heat_btu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heat BTU</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(watchedTrailerType === 'toy_hauler' || watchedIsToyHauler) && (
                  <>
                    <h4 className="font-medium text-sm">Toy Hauler Garage</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="garage_length_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Garage Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="12" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="garage_width_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Garage Width (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="8" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="garage_height_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Garage Height (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fuel_station_gallons"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fuel Station (gal)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              {/* HORSE/LIVESTOCK TAB */}
              <TabsContent value="horse" className="mt-0 space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <FormField
                    control={form.control}
                    name="is_horse_trailer"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Horse Trailer</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="is_livestock_trailer"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Livestock Trailer</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_living_quarters"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Has Living Quarters</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Fence className="w-4 h-4" />
                  Capacity & Configuration
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="horse_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horse Capacity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2, 3, 4..." {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="horse_load_config"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Load Configuration</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HORSE_LOAD_CONFIGS.map(lc => (
                              <SelectItem key={lc.value} value={lc.value}>{lc.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="horse_size_rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horse Size Rating</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HORSE_SIZE_RATINGS.map(sr => (
                              <SelectItem key={sr.value} value={sr.value}>{sr.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="divider_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Divider Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DIVIDER_TYPES.map(dt => (
                              <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Stall Dimensions</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="stall_length_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stall Length (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="84" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stall_width_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stall Width (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stall_height_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interior Height (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="84" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="dividers_removable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Dividers Removable</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="divider_padded"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Dividers Padded</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_hay_rack"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Hay Rack</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="floor_mats"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Floor Mats</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Windows & Doors</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="drop_down_windows_head"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drop Windows (Head)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="drop_down_windows_butt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drop Windows (Butt)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="escape_door_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escape Doors</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_load_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rear Load Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REAR_LOAD_TYPES.map(rt => (
                              <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Tack Room</h4>
                <FormField
                  control={form.control}
                  name="has_tack_room"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 w-fit">
                      <FormLabel className="mr-4">Has Tack Room</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchedHasTackRoom && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="tack_room_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tack Room Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TACK_ROOM_TYPES.map(tt => (
                                <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tack_room_length_inches"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tack Room Length (in)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="48" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="saddle_rack_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saddle Racks</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bridle_hooks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bridle Hooks</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="4" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {watchedIsLivestockTrailer && (
                  <>
                    <h4 className="font-medium text-sm">Livestock Configuration</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="livestock_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Livestock Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {LIVESTOCK_TYPES.map(lt => (
                                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="livestock_capacity_head"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacity (Head)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="20" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_center_gate"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Center Gate</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_possum_belly"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Possum Belly</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              {/* LIVING QUARTERS TAB */}
              <TabsContent value="lq" className="mt-0 space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <FormField
                    control={form.control}
                    name="has_living_quarters"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Has Living Quarters</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_certified"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>RVIA Certified</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <BedDouble className="w-4 h-4" />
                  Dimensions & Sleeping
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="lq_short_wall_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Wall (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="8" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_sleep_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sleep Capacity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_bed_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bed Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LQ_BED_TYPES.map(bt => (
                              <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_bed_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bed Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Kitchen</h4>
                <FormField
                  control={form.control}
                  name="lq_has_kitchen"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 w-fit">
                      <FormLabel className="mr-4">Has Kitchen</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchedLqHasKitchen && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="lq_cooktop_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cooktop Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LQ_COOKTOP_TYPES.map(ct => (
                                <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lq_refrigerator_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Refrigerator</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LQ_REFRIGERATOR_TYPES.map(rt => (
                                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lq_refrigerator_cubic_feet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fridge Size (cu ft)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.5" placeholder="6" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lq_has_microwave"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Microwave</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <h4 className="font-medium text-sm">Bathroom</h4>
                <FormField
                  control={form.control}
                  name="lq_has_bathroom"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 w-fit">
                      <FormLabel className="mr-4">Has Bathroom</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchedLqHasBathroom && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="lq_bathroom_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bathroom Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LQ_BATHROOM_TYPES.map(bt => (
                                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lq_toilet_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Toilet Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LQ_TOILET_TYPES.map(tt => (
                                <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lq_has_shower"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Shower</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <h4 className="font-medium text-sm">Water Tanks</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="lq_fresh_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fresh Water (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_gray_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gray Water (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="20" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_black_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Black Water (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="15" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_water_heater_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Water Heater (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="6" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Power</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="lq_shore_power_amps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shore Power (A)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lq_has_generator"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Generator</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedLqHasGenerator && (
                    <FormField
                      control={form.control}
                      name="lq_generator_watts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Generator (W)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="4000" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="lq_has_solar"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Solar</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedLqHasSolar && (
                    <FormField
                      control={form.control}
                      name="lq_solar_watts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Solar (W)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="400" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </TabsContent>

              {/* WORK TRAILER TAB */}
              <TabsContent value="work" className="mt-0 space-y-6">
                <FormField
                  control={form.control}
                  name="is_work_trailer"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 w-fit">
                      <FormLabel className="mr-4">Work/Contractor Trailer</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="work_trailer_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Trailer Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WORK_TRAILER_TYPES.map(wt => (
                              <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Shelving & Storage
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_shelving"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Shelving</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasShelving && (
                    <>
                      <FormField
                        control={form.control}
                        name="shelving_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shelving Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SHELVING_TYPES.map(st => (
                                  <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shelf_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shelf Count</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="6" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <FormField
                    control={form.control}
                    name="has_parts_bins"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Parts Bins</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_tool_cabinets"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Tool Cabinets</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Workbench</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_workbench"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Workbench</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasWorkbench && (
                    <>
                      <FormField
                        control={form.control}
                        name="workbench_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Workbench Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {WORKBENCH_TYPES.map(wt => (
                                  <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="workbench_length_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bench Length (in)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="60" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="workbench_has_vise"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Has Vise</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <h4 className="font-medium text-sm">Power & Utilities</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_shore_power"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Shore Power</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="electrical_outlets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outlet Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_generator_mount"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Generator Mount</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_air_compressor_mount"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Air Compressor Mount</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* EQUIPMENT TRAILER TAB */}
              <TabsContent value="equipment" className="mt-0 space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <FormField
                    control={form.control}
                    name="is_equipment_trailer"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Equipment Trailer</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="is_dump_trailer"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Dump Trailer</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Deck Configuration
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="deck_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deck Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DECK_TYPES.map(dt => (
                              <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deck_length_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deck Length (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="20" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deck_width_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deck Width (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="102" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deck_surface_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deck Surface</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DECK_SURFACE_TYPES.map(ds => (
                              <SelectItem key={ds.value} value={ds.value}>{ds.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Loading System</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_loading_ramps"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Loading Ramps</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gooseneck_removable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Removable Gooseneck</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gooseneck_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gooseneck Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GOOSENECK_TYPES.map(gt => (
                              <SelectItem key={gt.value} value={gt.value}>{gt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tilt_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tilt Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TILT_TYPES.map(tt => (
                              <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Tie Downs & Winch</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_stake_pockets"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Stake Pockets</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stake_pocket_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pocket Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="12" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_winch"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Winch</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasWinch && (
                    <>
                      <FormField
                        control={form.control}
                        name="winch_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Winch Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {WINCH_TYPES.map(wt => (
                                  <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="winch_capacity_lbs"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Winch Capacity (lbs)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="12000" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                {isDumpType && (
                  <>
                    <h4 className="font-medium text-sm">Dump Configuration</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="dump_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dump Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DUMP_TYPES.map(dt => (
                                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dump_capacity_cubic_yards"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacity (cu yd)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="14" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dump_hydraulic_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hydraulic Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DUMP_HYDRAULIC_TYPES.map(dh => (
                                  <SelectItem key={dh.value} value={dh.value}>{dh.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_tarp_system"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Tarp System</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              {/* =====================================================
                  OVERLANDER/EXPEDITION TAB
                  ===================================================== */}
              <TabsContent value="overlander" className="mt-0 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mountain className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Overlander/Expedition Trailer</h3>
                </div>

                {/* Overlander Classification */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Classification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="is_overlander"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Is Overlander/Expedition</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-overlander" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="overlander_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overlander Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-overlander-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OVERLANDER_TYPES.map(ot => (
                                <SelectItem key={ot.value} value={ot.value}>{ot.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Off-Road Capability */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Off-Road Capability</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="ground_clearance_inches"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ground Clearance (in)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="15" {...field} value={field.value ?? ''} data-testid="input-ground-clearance" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="approach_angle_degrees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approach Angle</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="45" {...field} value={field.value ?? ''} data-testid="input-approach-angle" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departure_angle_degrees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departure Angle</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="45" {...field} value={field.value ?? ''} data-testid="input-departure-angle" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="breakover_angle_degrees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Breakover Angle</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="30" {...field} value={field.value ?? ''} data-testid="input-breakover-angle" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Suspension & Tires */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Suspension & Tires</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="suspension_type_offroad"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Off-Road Suspension</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-suspension-offroad">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OFFROAD_SUSPENSION_TYPES.map(st => (
                                <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tire_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tire Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tire-type">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIRE_TYPES.map(tt => (
                                <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tire_size_offroad"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tire Size</FormLabel>
                          <FormControl>
                            <Input placeholder='e.g., 285/75R16' {...field} value={field.value ?? ''} data-testid="input-tire-size-offroad" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-col gap-2">
                      <FormField
                        control={form.control}
                        name="articulating_hitch"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Articulating Hitch</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-articulating-hitch" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {watchedArticulatingHitch && (
                        <FormField
                          control={form.control}
                          name="hitch_articulation_degrees"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Articulation (degrees)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="360" {...field} value={field.value ?? ''} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Recovery & Protection */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Recovery & Protection</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="has_skid_plates"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Skid Plates</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_rock_sliders"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Rock Sliders</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_recovery_points"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Recovery Points</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watchedHasRecoveryPoints && (
                      <FormField
                        control={form.control}
                        name="recovery_point_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Count</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="4" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Rooftop Tent & Roof Rack */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Roof Systems</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="has_rooftop_tent_mount"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>RTT Mount</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watchedHasRooftopTentMount && (
                      <FormField
                        control={form.control}
                        name="rooftop_tent_weight_capacity_lbs"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RTT Capacity (lbs)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="600" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="roof_rack_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Roof Rack Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ROOF_RACK_TYPES.map(rr => (
                                <SelectItem key={rr.value} value={rr.value}>{rr.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Outdoor Kitchen & Shower */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Outdoor Amenities</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <FormField
                        control={form.control}
                        name="has_slide_out_kitchen"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Slide-Out Kitchen</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {watchedHasSlideOutKitchen && (
                        <FormField
                          control={form.control}
                          name="kitchen_side"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Kitchen Side</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {KITCHEN_SIDES.map(ks => (
                                    <SelectItem key={ks.value} value={ks.value}>{ks.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <FormField
                        control={form.control}
                        name="has_outdoor_shower"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Outdoor Shower</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {watchedHasOutdoorShower && (
                        <FormField
                          control={form.control}
                          name="outdoor_shower_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shower Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {OUTDOOR_SHOWER_TYPES.map(os => (
                                    <SelectItem key={os.value} value={os.value}>{os.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Water & Fuel */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Water & Fuel Storage</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="external_water_tank_gallons"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Water Tank (gal)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="25" {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_water_filtration"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Water Filtration</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_jerry_can_mounts"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Jerry Can Mounts</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jerry_can_capacity_gallons"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jerry Capacity (gal)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="10" {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* =====================================================
                  TINY HOME ON WHEELS (THOW) TAB
                  ===================================================== */}
              <TabsContent value="tinyhome" className="mt-0 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Tiny Home on Wheels (THOW)</h3>
                </div>

                {/* Classification & Certification */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Classification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="is_tiny_home"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Is Tiny Home</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-tiny-home" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thow_certification"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certification</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-thow-certification">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {THOW_CERTIFICATION_TYPES.map(tc => (
                                <SelectItem key={tc.value} value={tc.value}>{tc.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>RVIA or NOAH certification for insurance/financing</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registered_as"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registered As</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-registered-as">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {REGISTERED_AS_TYPES.map(ra => (
                                <SelectItem key={ra.value} value={ra.value}>{ra.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Vehicle registration category</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thow_square_feet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Square Feet</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="200" {...field} value={field.value ?? ''} data-testid="input-thow-sqft" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Living Features */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Living Features</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="thow_loft_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Loft Count</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1" {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thow_full_time_rated"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Full-Time Rated</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thow_four_season"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>4-Season</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Bathroom */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Bathroom Options</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="thow_composting_toilet"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Composting Toilet</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thow_incinerating_toilet"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Incinerating Toilet</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* =====================================================
                  SPECIALTY EQUIPMENT TAB
                  ===================================================== */}
              <TabsContent value="specialty" className="mt-0 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Specialty Equipment Trailer</h3>
                </div>

                {/* Classification */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Classification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="is_specialty_equipment"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Is Specialty Equipment</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-specialty" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="equipment_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-equipment-type">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SPECIALTY_EQUIPMENT_TYPES.map(et => (
                                <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="equipment_make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Make</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Wood-Mizer" {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="equipment_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., LT35" {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="equipment_hp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horsepower</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="25" {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="equipment_power_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Power Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EQUIPMENT_POWER_TYPES.map(pt => (
                                <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="license_plate_exempt"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>License Plate Exempt</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Setup Requirements */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Setup Requirements</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="requires_setup_time"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Requires Setup</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watchedRequiresSetupTime && (
                      <FormField
                        control={form.control}
                        name="setup_time_minutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Setup Time (min)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="30" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="requires_level_ground"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Requires Level</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_outriggers"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>Outriggers</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Equipment-Specific Fields */}
                {watchedEquipmentType === 'portable_sawmill' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Sawmill Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="sawmill_max_log_diameter_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Log Diameter (in)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="28" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sawmill_max_log_length_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Log Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="21" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sawmill_cut_width_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cut Width (in)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="21" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'welding_rig' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Welder Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="welder_amp_rating"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amp Rating</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="300" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'generator_trailer' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Generator Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="generator_kw_rating"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>kW Rating</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="50" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="generator_voltage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voltage</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {GENERATOR_VOLTAGES.map(gv => (
                                  <SelectItem key={gv.value} value={gv.value}>{gv.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="generator_phase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phase</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {GENERATOR_PHASES.map(gp => (
                                  <SelectItem key={gp.value} value={gp.value}>{gp.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'pressure_washer' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Pressure Washer Specifications</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="pressure_washer_psi"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PSI</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="4000" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="pressure_washer_gpm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GPM</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="4.0" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="water_tank_gallons"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Water Tank (gal)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="200" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'air_compressor' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Air Compressor Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="compressor_cfm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CFM</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="185" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="compressor_psi_max"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max PSI</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="150" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tank_gallons"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tank Size (gal)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="60" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'light_tower' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Light Tower Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="light_tower_height_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tower Height (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="30" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="light_output_lumens"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Output (lumens)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="400000" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="light_coverage_acres"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Coverage (acres)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="5" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'fuel_transfer' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Fuel Transfer Specifications</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="fuel_tank_capacity_gallons"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tank Capacity (gal)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="500" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fuel_type_stored"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fuel Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {FUEL_TYPES_STORED.map(ft => (
                                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_fuel_pump"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Has Fuel Pump</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {watchedEquipmentType === 'concrete_mixer' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Concrete Mixer Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="mixer_capacity_cubic_yards"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacity (cu yd)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="2" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mixer_drum_rpm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Drum RPM</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="20" {...field} value={field.value ?? ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="photos" className="mt-0 space-y-6">
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Camera className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mt-2">Photo upload coming soon</p>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </form>
      </Form>
    </Card>
  );
}

export default TrailerForm;
