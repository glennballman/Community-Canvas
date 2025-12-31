-- =====================================================
-- ENHANCED PARTICIPANT & VEHICLE SCHEMA
-- Migration 004: Emergency contacts, trip passengers, documents, safety equipment
-- =====================================================

-- Add registration_expiry to vehicle_profiles if not exists
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS registration_expiry DATE;

-- =====================================================
-- EMERGENCY CONTACTS (multiple per participant)
-- =====================================================

CREATE TABLE IF NOT EXISTS participant_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  
  is_primary BOOLEAN DEFAULT false,
  contact_order INTEGER DEFAULT 1,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRIP PARTICIPANTS (passengers on a trip)
-- =====================================================

CREATE TABLE IF NOT EXISTS trip_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  participant_id UUID REFERENCES participant_profiles(id),
  trip_booking_id UUID REFERENCES trip_bookings(id) ON DELETE CASCADE,
  
  name VARCHAR(255),
  
  age_category VARCHAR(20),
  exact_age INTEGER,
  
  needs_car_seat BOOLEAN DEFAULT false,
  car_seat_type VARCHAR(30),
  mobility_aids TEXT[],
  accessibility_needs TEXT[],
  
  medical_conditions TEXT[],
  medications TEXT[],
  allergies TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DOCUMENT UPLOADS (licenses, certifications, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS participant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(255),
  
  extracted_data JSONB DEFAULT '{}',
  
  file_url VARCHAR(500),
  file_type VARCHAR(20),
  
  expiry_date DATE,
  is_verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  
  expiry_reminder_sent BOOLEAN DEFAULT false,
  
  auto_created_skill_ids UUID[],
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VEHICLE DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_profiles(id) ON DELETE CASCADE,
  
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(255),
  
  extracted_data JSONB DEFAULT '{}',
  
  file_url VARCHAR(500),
  file_type VARCHAR(20),
  
  expiry_date DATE,
  expiry_reminder_sent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENHANCED SAFETY EQUIPMENT CHECKLIST
-- =====================================================

CREATE TABLE IF NOT EXISTS safety_equipment_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  
  required_for_routes TEXT[],
  recommended_for_routes TEXT[],
  
  bc_ferries_allowed BOOLEAN DEFAULT true,
  bc_ferries_notes TEXT,
  
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0
);

-- =====================================================
-- VEHICLE SAFETY EQUIPMENT (what's in THIS vehicle)
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_safety_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_profiles(id) ON DELETE CASCADE,
  equipment_type_id VARCHAR(50) NOT NULL REFERENCES safety_equipment_types(id),
  
  present BOOLEAN DEFAULT false,
  condition VARCHAR(20),
  last_checked DATE,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(vehicle_id, equipment_type_id)
);

-- =====================================================
-- FLEET MANAGEMENT (multiple vehicles per owner)
-- =====================================================

ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS is_organization BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';

ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS is_fleet_vehicle BOOLEAN DEFAULT false;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES participant_profiles(id);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_participant ON participant_emergency_contacts(participant_id);
CREATE INDEX IF NOT EXISTS idx_trip_passengers_booking ON trip_passengers(trip_booking_id);
CREATE INDEX IF NOT EXISTS idx_participant_documents_participant ON participant_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_documents_type ON participant_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_participant_documents_expiry ON participant_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_safety_equipment_vehicle ON vehicle_safety_equipment(vehicle_id);
