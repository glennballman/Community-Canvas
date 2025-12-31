-- =====================================================
-- TRIP PLANNING FRAMEWORK - PHASE 1
-- Comprehensive participant, vehicle, route, and booking system
-- =====================================================

-- =====================================================
-- PARTICIPANT PROFILES
-- =====================================================

CREATE TABLE IF NOT EXISTS participant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  user_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  country_of_origin VARCHAR(100),
  languages TEXT[] DEFAULT ARRAY['English'],
  
  -- Medical/Dietary
  medical_conditions TEXT[],
  dietary_restrictions TEXT[],
  medications TEXT[],
  
  -- Physical
  fitness_level INTEGER DEFAULT 5 CHECK (fitness_level >= 1 AND fitness_level <= 10),
  swimming_ability VARCHAR(20) DEFAULT 'basic',
  mobility_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participant Skills & Certifications
CREATE TABLE IF NOT EXISTS participant_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  
  skill_category VARCHAR(50) NOT NULL,
  skill_type VARCHAR(50) NOT NULL,
  skill_level VARCHAR(20) NOT NULL,
  
  -- Certification details (if applicable)
  certification_name VARCHAR(255),
  certification_issuer VARCHAR(255),
  certification_date DATE,
  certification_expiry DATE,
  certification_number VARCHAR(100),
  
  -- Verification
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_date DATE,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skill Requirements Definition (what skills unlock what trips)
CREATE TABLE IF NOT EXISTS skill_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What this requirement applies to
  requirement_type VARCHAR(30) NOT NULL,
  requirement_target_id VARCHAR(100) NOT NULL,
  
  -- The skill required
  skill_category VARCHAR(50) NOT NULL,
  skill_type VARCHAR(50) NOT NULL,
  minimum_level VARCHAR(20) NOT NULL,
  
  -- Enforcement
  enforcement VARCHAR(20) DEFAULT 'required',
  
  -- If not met, what can resolve it?
  resolution_options JSONB DEFAULT '[]',
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VEHICLE PROFILES
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  owner_type VARCHAR(20) NOT NULL,
  owner_id UUID,
  company_name VARCHAR(255),
  
  -- Identity
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),
  license_plate VARCHAR(20),
  vin VARCHAR(50),
  color VARCHAR(50),
  
  -- Specifications
  vehicle_class VARCHAR(30) NOT NULL,
  drive_type VARCHAR(10),
  fuel_type VARCHAR(20),
  ground_clearance_inches DECIMAL(4,1),
  
  -- Dimensions (important for ferries, roads)
  length_feet DECIMAL(4,1),
  height_feet DECIMAL(4,1),
  width_feet DECIMAL(4,1),
  weight_lbs INTEGER,
  
  -- Capabilities
  towing_capacity_lbs INTEGER,
  passenger_capacity INTEGER,
  cargo_capacity_cubic_feet INTEGER,
  
  -- Ferry classification
  ferry_class VARCHAR(30),
  
  -- Route suitability (calculated/assessed)
  paved_road_suitable BOOLEAN DEFAULT true,
  good_gravel_suitable BOOLEAN DEFAULT true,
  rough_gravel_suitable BOOLEAN DEFAULT false,
  four_x_four_required_suitable BOOLEAN DEFAULT false,
  
  -- Insurance
  insurance_company VARCHAR(255),
  insurance_policy_number VARCHAR(100),
  insurance_expiry DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle Condition Assessments
CREATE TABLE IF NOT EXISTS vehicle_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_profiles(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES participant_profiles(id),
  assessment_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tire Assessment
  tire_tread_condition VARCHAR(20),
  tire_tread_depth_mm DECIMAL(4,1),
  tires_winter_rated BOOLEAN DEFAULT false,
  chains_available BOOLEAN DEFAULT false,
  spare_tire_condition VARCHAR(20),
  
  -- Mechanical
  last_service_date DATE,
  last_service_mileage INTEGER,
  current_mileage INTEGER,
  oil_level VARCHAR(20),
  coolant_level VARCHAR(20),
  brake_condition VARCHAR(20),
  battery_age_months INTEGER,
  known_issues TEXT[],
  
  -- Safety Equipment
  has_first_aid_kit BOOLEAN DEFAULT false,
  has_fire_extinguisher BOOLEAN DEFAULT false,
  has_reflective_triangles BOOLEAN DEFAULT false,
  has_jumper_cables BOOLEAN DEFAULT false,
  has_tow_strap BOOLEAN DEFAULT false,
  
  -- Emergency Supplies
  has_blankets BOOLEAN DEFAULT false,
  has_emergency_food BOOLEAN DEFAULT false,
  has_water BOOLEAN DEFAULT false,
  has_phone_charger BOOLEAN DEFAULT false,
  has_flashlight BOOLEAN DEFAULT false,
  windshield_washer_full BOOLEAN DEFAULT false,
  
  -- Documents
  registration_current BOOLEAN DEFAULT true,
  insurance_card_present BOOLEAN DEFAULT true,
  
  -- Overall Assessment
  overall_condition VARCHAR(20),
  notes TEXT,
  
  -- Next assessment due
  next_assessment_due DATE
);

-- =====================================================
-- ROUTE SEGMENTS (Enhanced)
-- =====================================================

CREATE TABLE IF NOT EXISTS route_segments (
  id VARCHAR(100) PRIMARY KEY,
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(150) UNIQUE,
  description TEXT,
  
  -- Geography
  start_location_name VARCHAR(255),
  start_lat DECIMAL(10, 7),
  start_lng DECIMAL(10, 7),
  end_location_name VARCHAR(255),
  end_lat DECIMAL(10, 7),
  end_lng DECIMAL(10, 7),
  
  -- Route Details
  distance_km DECIMAL(6, 1),
  typical_duration_minutes INTEGER,
  route_type VARCHAR(30) NOT NULL,
  road_surface VARCHAR(30),
  
  -- Highway Info
  highway_numbers TEXT[],
  
  -- Requirements
  minimum_vehicle_class VARCHAR(30),
  winter_tires_required BOOLEAN DEFAULT false,
  winter_tires_required_dates VARCHAR(50),
  chains_may_be_required BOOLEAN DEFAULT false,
  high_clearance_recommended BOOLEAN DEFAULT false,
  
  -- Hazards & Notes
  hazards TEXT[],
  notes TEXT,
  
  -- Data Sources
  conditions_source VARCHAR(100),
  conditions_source_id VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route Alternatives (what to do if segment is blocked)
CREATE TABLE IF NOT EXISTS route_alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  primary_segment_id VARCHAR(100) NOT NULL REFERENCES route_segments(id),
  alternative_segment_id VARCHAR(100) REFERENCES route_segments(id),
  
  -- Or it might be a completely different mode
  alternative_type VARCHAR(30) NOT NULL,
  alternative_description TEXT,
  
  -- When to use this alternative
  trigger_conditions TEXT[],
  
  -- Cost/time impact
  additional_time_minutes INTEGER,
  additional_cost_estimate INTEGER,
  
  -- Provider info if not a road segment
  provider_name VARCHAR(255),
  provider_contact VARCHAR(255),
  provider_booking_url VARCHAR(500),
  
  priority INTEGER DEFAULT 1,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRANSPORT PROVIDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS transport_providers (
  id VARCHAR(100) PRIMARY KEY,
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(150) UNIQUE,
  provider_type VARCHAR(30) NOT NULL,
  
  -- Contact
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  booking_url VARCHAR(500),
  
  -- Location/Coverage
  base_location VARCHAR(255),
  service_area TEXT[],
  
  -- Data Integration
  has_live_api BOOLEAN DEFAULT false,
  api_endpoint VARCHAR(500),
  api_type VARCHAR(30),
  data_update_frequency VARCHAR(30),
  last_data_update TIMESTAMPTZ,
  
  -- Capabilities
  accepts_vehicles BOOLEAN DEFAULT false,
  max_vehicle_length_feet DECIMAL(4,1),
  accepts_kayaks BOOLEAN DEFAULT false,
  accepts_bikes BOOLEAN DEFAULT false,
  accepts_pets BOOLEAN DEFAULT false,
  wheelchair_accessible BOOLEAN DEFAULT false,
  
  -- Booking
  reservation_required BOOLEAN DEFAULT false,
  reservation_recommended BOOLEAN DEFAULT true,
  advance_booking_days INTEGER,
  cancellation_policy TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  seasonal_operation BOOLEAN DEFAULT false,
  operating_season VARCHAR(100),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider Schedules
CREATE TABLE IF NOT EXISTS transport_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(100) NOT NULL REFERENCES transport_providers(id),
  
  -- Route
  route_name VARCHAR(255),
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  
  -- Schedule
  day_of_week INTEGER,
  departure_time TIME,
  arrival_time TIME,
  duration_minutes INTEGER,
  
  -- Seasonal
  valid_from DATE,
  valid_to DATE,
  
  -- Pricing
  adult_fare DECIMAL(8,2),
  child_fare DECIMAL(8,2),
  vehicle_fare DECIMAL(8,2),
  vehicle_overheight_fare DECIMAL(8,2),
  kayak_fare DECIMAL(8,2),
  bike_fare DECIMAL(8,2),
  
  -- Capacity
  passenger_capacity INTEGER,
  vehicle_capacity INTEGER,
  
  notes TEXT,
  
  -- Data freshness
  last_verified TIMESTAMPTZ,
  verified_by VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SERVICE RUNS (for businesses)
-- =====================================================

CREATE TABLE IF NOT EXISTS service_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider
  company_id UUID,
  company_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  
  -- Schedule
  destination_region VARCHAR(100) NOT NULL,
  planned_date DATE NOT NULL,
  planned_duration_days INTEGER DEFAULT 1,
  flexible_dates BOOLEAN DEFAULT false,
  date_flexibility_days INTEGER DEFAULT 0,
  
  -- Capacity
  total_job_slots INTEGER NOT NULL,
  slots_filled INTEGER DEFAULT 0,
  
  -- Crew
  crew_size INTEGER,
  crew_lead_name VARCHAR(255),
  
  -- Vehicle
  vehicle_id UUID REFERENCES vehicle_profiles(id),
  vehicle_description VARCHAR(255),
  
  -- Costs (shared among jobs)
  logistics_cost_total DECIMAL(10,2),
  
  -- Pricing
  minimum_job_value DECIMAL(10,2),
  
  -- Status
  status VARCHAR(30) DEFAULT 'planning',
  published_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  
  -- Booking
  booking_deadline DATE,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  booking_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Run Bookings (customer jobs)
CREATE TABLE IF NOT EXISTS service_run_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  
  -- Customer
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_address TEXT,
  customer_location_lat DECIMAL(10, 7),
  customer_location_lng DECIMAL(10, 7),
  
  -- Job Details
  job_description TEXT,
  job_reference VARCHAR(100),
  estimated_duration_hours DECIMAL(4,1),
  
  -- Pricing
  job_value DECIMAL(10,2),
  logistics_share DECIMAL(10,2),
  total_price DECIMAL(10,2),
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',
  
  -- Scheduling within the run
  preferred_time VARCHAR(50),
  scheduled_order INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRIP BOOKINGS (Enhanced)
-- =====================================================

CREATE TABLE IF NOT EXISTS trip_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What trip
  trip_id VARCHAR(100) REFERENCES road_trips(id),
  custom_trip BOOLEAN DEFAULT false,
  
  -- Who
  lead_participant_id UUID REFERENCES participant_profiles(id),
  group_name VARCHAR(255),
  group_size INTEGER DEFAULT 1,
  
  -- When
  start_date DATE NOT NULL,
  end_date DATE,
  flexible_dates BOOLEAN DEFAULT false,
  
  -- Budget
  budget_level VARCHAR(20) DEFAULT 'moderate',
  estimated_cost DECIMAL(10,2),
  
  -- Status
  status VARCHAR(30) DEFAULT 'planning',
  
  -- Assessment Results
  participant_assessment_complete BOOLEAN DEFAULT false,
  vehicle_assessment_complete BOOLEAN DEFAULT false,
  equipment_gaps_identified BOOLEAN DEFAULT false,
  skill_gaps_identified BOOLEAN DEFAULT false,
  all_requirements_met BOOLEAN DEFAULT false,
  
  -- Monitoring
  monitoring_active BOOLEAN DEFAULT false,
  last_conditions_check TIMESTAMPTZ,
  current_alert_level VARCHAR(20),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Booking Participants
CREATE TABLE IF NOT EXISTS trip_booking_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participant_profiles(id),
  
  role VARCHAR(30) DEFAULT 'participant',
  
  -- Individual assessment for this trip
  skills_verified BOOLEAN DEFAULT false,
  equipment_verified BOOLEAN DEFAULT false,
  requirements_met BOOLEAN DEFAULT false,
  gaps TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Booking Segments (actual booked items)
CREATE TABLE IF NOT EXISTS trip_booking_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
  
  segment_order INTEGER NOT NULL,
  segment_type VARCHAR(30) NOT NULL,
  
  -- What's booked
  provider_id VARCHAR(100),
  provider_name VARCHAR(255),
  provider_type VARCHAR(50),
  
  -- Schedule
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INTEGER,
  
  -- Location
  location_name VARCHAR(255),
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  
  -- Booking Details
  confirmation_number VARCHAR(100),
  booking_status VARCHAR(30) DEFAULT 'pending',
  
  -- Pricing
  cost DECIMAL(10,2),
  deposit_paid DECIMAL(10,2),
  balance_due DECIMAL(10,2),
  payment_due_date DATE,
  
  -- Requirements for this segment
  requirements_json JSONB DEFAULT '{}',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EQUIPMENT INVENTORY (for rentals)
-- =====================================================

CREATE TABLE IF NOT EXISTS equipment_types (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  
  -- For matching to requirements
  skill_category VARCHAR(50),
  skill_minimum VARCHAR(20),
  
  daily_rental_rate DECIMAL(8,2),
  weekly_rental_rate DECIMAL(8,2),
  purchase_price DECIMAL(10,2),
  
  -- What it unlocks
  unlocks_trip_types TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_participant_skills_participant ON participant_skills(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_skills_type ON participant_skills(skill_category, skill_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_profiles_owner ON vehicle_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assessments_vehicle ON vehicle_assessments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_type ON route_segments(route_type);
CREATE INDEX IF NOT EXISTS idx_transport_schedules_provider ON transport_schedules(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_runs_destination ON service_runs(destination_region, planned_date);
CREATE INDEX IF NOT EXISTS idx_service_runs_status ON service_runs(status);
CREATE INDEX IF NOT EXISTS idx_service_run_bookings_run ON service_run_bookings(service_run_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_trip ON trip_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_status ON trip_bookings(status);
CREATE INDEX IF NOT EXISTS idx_trip_booking_segments_booking ON trip_booking_segments(booking_id);
