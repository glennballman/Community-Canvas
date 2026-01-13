BEGIN;

-- ============ VERIFIED IDENTITIES ============
-- Verified identity records for guests and operators

CREATE TABLE IF NOT EXISTS cc_verified_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  contact_id uuid,
  user_id uuid,
  
  -- Identity type
  identity_type varchar NOT NULL CHECK (identity_type IN (
    'guest', 'operator', 'staff', 'authority', 'owner'
  )),
  
  -- Basic info
  legal_name text NOT NULL,
  preferred_name text,
  email text,
  phone text,
  
  -- Address
  address_line1 text,
  address_line2 text,
  city varchar(100),
  province varchar(50),
  postal_code varchar(20),
  country varchar(50) DEFAULT 'Canada',
  
  -- Government ID
  id_type varchar CHECK (id_type IN (
    'drivers_license', 'passport', 'bc_id', 'nexus', 
    'status_card', 'military', 'other'
  )),
  id_number_hash text,
  id_issuing_authority text,
  id_expiry_date date,
  id_verified boolean DEFAULT false,
  id_verified_at timestamptz,
  id_verified_by text,
  
  -- Photo ID
  photo_id_url text,
  selfie_url text,
  photo_match_score numeric(5,2),
  
  -- Verification status
  verification_status varchar DEFAULT 'unverified' CHECK (verification_status IN (
    'unverified', 'pending', 'verified', 'expired', 'rejected', 'suspended'
  )),
  
  verification_level varchar DEFAULT 'none' CHECK (verification_level IN (
    'none', 'email', 'phone', 'basic', 'enhanced', 'trusted'
  )),
  
  verified_at timestamptz,
  verification_expires_at timestamptz,
  
  -- Trust score
  trust_score integer DEFAULT 50,
  trust_factors_json jsonb DEFAULT '{}'::jsonb,
  
  -- Violations link
  violation_history_id uuid REFERENCES cc_violation_history(id),
  
  -- Emergency contact
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  
  -- Preferences
  communication_preference varchar DEFAULT 'email' CHECK (communication_preference IN (
    'email', 'phone', 'sms', 'any'
  )),
  language_preference varchar DEFAULT 'en',
  
  -- Notes
  notes text,
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, email)
);

CREATE INDEX IF NOT EXISTS idx_verified_identities_portal ON cc_verified_identities(portal_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_verified_identities_email ON cc_verified_identities(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verified_identities_contact ON cc_verified_identities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verified_identities_trust ON cc_verified_identities(trust_score DESC);

ALTER TABLE cc_verified_identities ENABLE ROW LEVEL SECURITY;

-- ============ VESSEL REGISTRATIONS ============
-- Registered vessels for marine operations

CREATE TABLE IF NOT EXISTS cc_vessel_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  owner_identity_id uuid REFERENCES cc_verified_identities(id),
  
  -- Identity
  registration_number varchar(30) NOT NULL UNIQUE,
  
  -- Vessel details
  vessel_name text NOT NULL,
  vessel_type varchar NOT NULL CHECK (vessel_type IN (
    'kayak', 'canoe', 'sup', 'rowboat', 'sailboat', 
    'powerboat', 'yacht', 'fishing', 'commercial', 'other'
  )),
  
  -- Registration
  tc_registration text,
  hull_id text,
  
  -- Specs
  length_ft numeric(6,2),
  beam_ft numeric(6,2),
  draft_ft numeric(6,2),
  gross_tonnage numeric(8,2),
  
  -- Propulsion
  propulsion_type varchar CHECK (propulsion_type IN (
    'paddle', 'sail', 'outboard', 'inboard', 'jet', 'electric', 'hybrid'
  )),
  engine_hp integer,
  fuel_type varchar,
  
  -- Capacity
  max_passengers integer,
  max_crew integer,
  
  -- Safety
  safety_equipment_json jsonb DEFAULT '[]'::jsonb,
  last_safety_inspection date,
  safety_certificate_url text,
  
  -- Insurance
  insurance_provider text,
  insurance_policy_number text,
  insurance_expiry date,
  insurance_verified boolean DEFAULT false,
  
  -- Photos
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Verification
  verification_status varchar DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'expired', 'rejected', 'suspended'
  )),
  verified_at timestamptz,
  verified_by text,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'seasonal', 'sold', 'decommissioned'
  )),
  
  -- Home port
  home_port text,
  home_slip text,
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vessel_registrations_portal ON cc_vessel_registrations(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_vessel_registrations_owner ON cc_vessel_registrations(owner_identity_id);
CREATE INDEX IF NOT EXISTS idx_vessel_registrations_tc ON cc_vessel_registrations(tc_registration) WHERE tc_registration IS NOT NULL;

ALTER TABLE cc_vessel_registrations ENABLE ROW LEVEL SECURITY;

-- ============ VEHICLE REGISTRATIONS ============
-- Registered vehicles for parking and access

CREATE TABLE IF NOT EXISTS cc_vehicle_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  owner_identity_id uuid REFERENCES cc_verified_identities(id),
  
  -- Identity
  registration_number varchar(30) NOT NULL UNIQUE,
  
  -- Vehicle details
  plate_number varchar(20) NOT NULL,
  plate_province varchar(20) DEFAULT 'BC',
  
  vehicle_type varchar NOT NULL CHECK (vehicle_type IN (
    'car', 'suv', 'truck', 'van', 'rv', 'motorcycle', 
    'trailer', 'boat_trailer', 'commercial', 'other'
  )),
  
  make varchar(50),
  model varchar(50),
  year integer,
  color varchar(30),
  
  -- Trailer (if applicable)
  has_trailer boolean DEFAULT false,
  trailer_plate varchar(20),
  trailer_type varchar,
  trailer_length_ft numeric(5,2),
  
  -- Verification
  verification_status varchar DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'expired', 'rejected', 'suspended'
  )),
  verified_at timestamptz,
  
  -- Insurance
  insurance_verified boolean DEFAULT false,
  insurance_expiry date,
  
  -- Parking permits
  parking_permit_number text,
  parking_permit_expiry date,
  
  -- Access
  access_zones text[],
  
  -- Photos
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'expired', 'blacklisted'
  )),
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, plate_number, plate_province)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_portal ON cc_vehicle_registrations(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_owner ON cc_vehicle_registrations(owner_identity_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_plate ON cc_vehicle_registrations(plate_number, plate_province);

ALTER TABLE cc_vehicle_registrations ENABLE ROW LEVEL SECURITY;

-- ============ VERIFICATION REQUESTS ============
-- Pending verification requests

CREATE TABLE IF NOT EXISTS cc_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  identity_id uuid REFERENCES cc_verified_identities(id) ON DELETE CASCADE,
  
  -- Request details
  request_number varchar(20) NOT NULL UNIQUE,
  
  verification_type varchar NOT NULL CHECK (verification_type IN (
    'email', 'phone', 'id_document', 'selfie', 'address', 'enhanced'
  )),
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed', 'expired', 'cancelled'
  )),
  
  -- For email/phone verification
  verification_code varchar(10),
  code_expires_at timestamptz,
  code_attempts integer DEFAULT 0,
  
  -- For document verification
  document_url text,
  document_type varchar,
  
  -- Result
  result varchar CHECK (result IN ('pass', 'fail', 'manual_review')),
  result_details jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_identity ON cc_verification_requests(identity_id, status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON cc_verification_requests(status, created_at);

ALTER TABLE cc_verification_requests ENABLE ROW LEVEL SECURITY;

COMMIT;
