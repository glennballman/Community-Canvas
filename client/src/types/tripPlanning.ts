export interface ParticipantProfile {
  id: string;
  name: string;
  email?: string;
  telephone?: string;
  emergency_contact_name?: string;
  emergency_contact_telephone?: string;
  country_of_origin?: string;
  languages: string[];
  medical_conditions: string[];
  dietary_restrictions: string[];
  fitness_level: number;
  swimming_ability: 'none' | 'basic' | 'strong' | 'lifeguard';
  skills?: ParticipantSkill[];
  created_at?: string;
}

export interface ParticipantSkill {
  id: string;
  participant_id: string;
  skill_category: SkillCategory;
  skill_type: string;
  skill_level: SkillLevel;
  certification_name?: string;
  certification_issuer?: string;
  certification_date?: string;
  certification_expiry?: string;
  verified: boolean;
}

export type SkillCategory = 'paddling' | 'driving' | 'backcountry' | 'water_safety' | 'emergency';
export type SkillLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'certified';

export interface VehicleProfile {
  id: string;
  owner_type: 'personal' | 'rental' | 'company';
  owner_id?: string;
  company_name?: string;
  year?: number;
  make?: string;
  model?: string;
  license_plate?: string;
  vehicle_class: VehicleClass;
  drive_type?: '2wd' | '4wd' | 'awd';
  fuel_type?: string;
  ground_clearance_inches?: number;
  length_feet?: number;
  height_feet?: number;
  towing_capacity_lbs?: number;
  passenger_capacity?: number;
  ferry_class?: string;
  rough_gravel_suitable: boolean;
  four_x_four_required_suitable: boolean;
  latest_assessment?: VehicleAssessment;
}

export type VehicleClass = 'sedan' | 'suv' | 'truck' | 'van' | 'cube_van' | 'rv_class_a' | 'rv_class_c' | 'motorcycle';

export interface VehicleAssessment {
  id: string;
  vehicle_id: string;
  assessment_date: string;
  tire_tread_condition: 'new' | 'good' | 'fair' | 'worn' | 'needs_replacement';
  tires_winter_rated: boolean;
  chains_available: boolean;
  spare_tire_condition?: string;
  last_service_date?: string;
  current_mileage?: number;
  oil_level?: string;
  coolant_level?: string;
  brake_condition?: string;
  has_first_aid_kit: boolean;
  has_fire_extinguisher: boolean;
  has_blankets: boolean;
  has_emergency_food: boolean;
  has_water: boolean;
  has_phone_charger: boolean;
  has_flashlight: boolean;
  windshield_washer_full: boolean;
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor' | 'not_roadworthy';
  notes?: string;
}

export interface RouteSegment {
  id: string;
  name: string;
  description?: string;
  start_location_name: string;
  end_location_name: string;
  distance_km: number;
  typical_duration_minutes: number;
  route_type: 'highway' | 'secondary' | 'gravel' | 'logging_road' | 'water' | 'air';
  road_surface?: string;
  minimum_vehicle_class?: string;
  winter_tires_required: boolean;
  high_clearance_recommended: boolean;
  hazards: string[];
  conditions_source?: string;
}

export interface RouteAlternative {
  id: string;
  primary_segment_id: string;
  alternative_type: 'route_segment' | 'ferry' | 'float_plane' | 'water_taxi' | 'delay';
  alternative_description?: string;
  trigger_conditions: string[];
  additional_time_minutes?: number;
  additional_cost_estimate?: number;
  provider_name?: string;
  provider_contact?: string;
  priority: number;
}

export interface TransportProvider {
  id: string;
  name: string;
  provider_type: 'ferry' | 'float_plane' | 'water_taxi' | 'bus' | 'shuttle' | 'train' | 'rental_car';
  telephone?: string;
  website?: string;
  reservation_url?: string;
  base_location?: string;
  service_area: string[];
  has_live_api: boolean;
  accepts_vehicles: boolean;
  accepts_kayaks: boolean;
  reservation_required: boolean;
  operating_season?: string;
}

export interface TripAssessment {
  participant_id: string;
  trip_id: string;
  qualified: boolean;
  gaps: SkillGap[];
  warnings: string[];
  required_actions: RequiredAction[];
}

export interface SkillGap {
  skill_category: string;
  skill_type: string;
  required_level: string;
  current_level: string;
  enforcement: 'required' | 'recommended' | 'advisory';
  resolution_options: ResolutionOption[];
}

export interface ResolutionOption {
  type: 'course' | 'experience' | 'equipment' | 'online';
  provider?: string;
  location?: string;
  duration?: string;
  cost?: number;
  description?: string;
}

export interface RequiredAction {
  type: 'skill_upgrade' | 'equipment_rental' | 'vehicle_upgrade' | 'reservation';
  skill_category?: string;
  skill_type?: string;
  required_level?: string;
  current_level?: string;
  resolution_options?: ResolutionOption[];
}

export interface RouteAssessment {
  vehicle: VehicleProfile;
  segments: SegmentAssessment[];
  warnings: string[];
  blockers: string[];
  recommendations: string[];
}

export interface SegmentAssessment {
  segment_id: string;
  segment_name: string;
  suitable: boolean;
  issues: string[];
}

export interface ServiceRun {
  id: string;
  company_name: string;
  service_type: string;
  destination_region: string;
  planned_date: string;
  planned_duration_days: number;
  total_job_slots: number;
  slots_filled: number;
  slots_available: number;
  crew_size?: number;
  logistics_cost_total: number;
  logistics_cost_per_slot: number;
  minimum_job_value?: number;
  status: 'planning' | 'published' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  reservation_deadline?: string;
  contact_email?: string;
  contact_phone?: string;
}

export const skillLevelColors: Record<SkillLevel, string> = {
  none: 'text-muted-foreground bg-muted',
  beginner: 'text-green-400 bg-green-500/20',
  intermediate: 'text-blue-400 bg-blue-500/20',
  advanced: 'text-purple-400 bg-purple-500/20',
  expert: 'text-orange-400 bg-orange-500/20',
  certified: 'text-yellow-400 bg-yellow-500/20'
};
