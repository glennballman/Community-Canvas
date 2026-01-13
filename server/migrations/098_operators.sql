BEGIN;

-- ============ OPERATOR APPLICATIONS ============
-- Business operator registration applications

CREATE TABLE IF NOT EXISTS cc_operator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES cc_user_profiles(user_id) ON DELETE CASCADE,
  
  -- Application number
  application_number varchar(20) NOT NULL UNIQUE,
  -- Format: OPA-YYMMDD-XXXX
  
  -- Operator type
  operator_type varchar NOT NULL CHECK (operator_type IN (
    'accommodation',     -- Lodging provider
    'transport',         -- Transport operator
    'tour',              -- Tour operator
    'rental',            -- Equipment rental
    'food_beverage',     -- Restaurant/cafe
    'retail',            -- Retail shop
    'service',           -- Service provider
    'contractor',        -- Contractor/tradesperson
    'guide',             -- Licensed guide
    'artisan',           -- Artisan/craftsperson
    'other'
  )),
  
  -- Business info
  business_name text NOT NULL,
  business_legal_name text,
  business_number text,  -- BC business number
  gst_number text,
  pst_number text,
  
  -- Business type
  business_structure varchar CHECK (business_structure IN (
    'sole_proprietor', 'partnership', 'corporation', 
    'cooperative', 'nonprofit', 'first_nations'
  )),
  
  -- Contact
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  
  -- Address
  business_address_line1 text,
  business_address_line2 text,
  business_city varchar(100),
  business_province varchar(50) DEFAULT 'BC',
  business_postal_code varchar(20),
  
  -- Description
  business_description text,
  services_offered text[],
  service_areas text[],  -- Geographic areas served
  
  -- Capacity
  years_in_business integer,
  employee_count integer,
  seasonal_operation boolean DEFAULT false,
  operating_months integer[],  -- [5,6,7,8,9] for May-Sep
  
  -- Licensing
  business_license_number text,
  business_license_expiry date,
  insurance_provider text,
  insurance_policy_number text,
  insurance_expiry date,
  liability_coverage_amount numeric(12,2),
  
  -- For specific operator types
  transport_license text,  -- Transport operators
  food_safe_certificate text,  -- Food service
  guide_certification text,  -- Guides
  worksafe_account text,  -- Contractors
  
  -- Documents
  documents_json jsonb DEFAULT '[]'::jsonb,
  -- [{type: 'business_license', url: '...', verified: false}]
  
  -- References
  references_json jsonb DEFAULT '[]'::jsonb,
  -- [{name: '...', phone: '...', relationship: '...'}]
  
  -- Application status
  status varchar DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Not yet submitted
    'submitted',       -- Awaiting review
    'under_review',    -- Being reviewed
    'info_requested',  -- Additional info needed
    'approved',        -- Approved
    'rejected',        -- Rejected
    'withdrawn'        -- Withdrawn by applicant
  )),
  
  -- Review
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES cc_user_profiles(user_id),
  reviewed_at timestamptz,
  review_notes text,
  
  -- If rejected
  rejection_reason text,
  
  -- If approved
  approved_at timestamptz,
  approved_by uuid REFERENCES cc_user_profiles(user_id),
  
  -- Terms
  terms_accepted boolean DEFAULT false,
  terms_accepted_at timestamptz,
  code_of_conduct_accepted boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_apps_portal ON cc_operator_applications(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_operator_apps_user ON cc_operator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_operator_apps_type ON cc_operator_applications(operator_type, status);
CREATE INDEX IF NOT EXISTS idx_operator_apps_number ON cc_operator_applications(application_number);

ALTER TABLE cc_operator_applications ENABLE ROW LEVEL SECURITY;

-- ============ OPERATORS ============
-- Approved business operators

CREATE TABLE IF NOT EXISTS cc_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES cc_user_profiles(user_id),
  application_id uuid REFERENCES cc_operator_applications(id),
  identity_id uuid REFERENCES cc_verified_identities(id),
  tenant_id uuid REFERENCES cc_tenants(id),
  
  -- Operator number
  operator_number varchar(20) NOT NULL UNIQUE,
  -- Format: OPR-TYPE-YYMMDD-XXXX (e.g., OPR-ACC-260113-A7K9)
  
  -- Type
  operator_type varchar NOT NULL,
  operator_subtypes text[],  -- Additional categories
  
  -- Business info (copied from approved application)
  business_name text NOT NULL,
  business_legal_name text,
  business_number text,
  gst_number text,
  
  -- Contact
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  website_url text,
  
  -- Address
  business_address_json jsonb,
  
  -- Profile
  description text,
  tagline varchar(200),
  logo_url text,
  cover_photo_url text,
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Services
  services_offered text[],
  service_areas text[],
  amenities text[],
  
  -- Operation
  seasonal_operation boolean DEFAULT false,
  operating_months integer[],
  operating_hours_json jsonb,
  -- {monday: {open: '09:00', close: '17:00'}, ...}
  
  -- Capacity
  employee_count integer,
  
  -- Compliance
  business_license_number text,
  business_license_expiry date,
  insurance_expiry date,
  liability_coverage_amount numeric(12,2),
  
  -- Verification
  verification_status varchar DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'expired', 'suspended', 'revoked'
  )),
  verified_at timestamptz,
  verification_expires_at timestamptz,
  last_compliance_check date,
  
  -- Rating
  rating_average numeric(3,2) DEFAULT 0,
  rating_count integer DEFAULT 0,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'pending',         -- Awaiting setup completion
    'active',          -- Active operator
    'inactive',        -- Temporarily inactive
    'suspended',       -- Suspended (compliance issue)
    'closed'           -- Permanently closed
  )),
  
  -- Flags
  featured boolean DEFAULT false,
  accepts_online_booking boolean DEFAULT true,
  instant_confirmation boolean DEFAULT false,
  
  -- Financial
  commission_rate_percent numeric(5,2) DEFAULT 10.00,
  payout_method varchar DEFAULT 'bank_transfer',
  payout_details_json jsonb,
  
  -- Onboarding
  onboarding_completed boolean DEFAULT false,
  onboarding_completed_at timestamptz,
  
  -- Notes
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operators_portal ON cc_operators(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_operators_user ON cc_operators(user_id);
CREATE INDEX IF NOT EXISTS idx_operators_type ON cc_operators(operator_type, status);
CREATE INDEX IF NOT EXISTS idx_operators_number ON cc_operators(operator_number);
CREATE INDEX IF NOT EXISTS idx_operators_verification ON cc_operators(verification_status, verification_expires_at);

ALTER TABLE cc_operators ENABLE ROW LEVEL SECURITY;

-- ============ OPERATOR DOCUMENTS ============
-- Document storage and verification

CREATE TABLE IF NOT EXISTS cc_operator_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  operator_id uuid NOT NULL REFERENCES cc_operators(id) ON DELETE CASCADE,
  
  -- Document info
  document_type varchar NOT NULL CHECK (document_type IN (
    'business_license',
    'insurance_certificate',
    'gst_registration',
    'food_safe',
    'transport_license',
    'guide_certification',
    'worksafe_registration',
    'first_nations_permit',
    'environmental_permit',
    'health_inspection',
    'safety_certification',
    'other'
  )),
  
  document_name text NOT NULL,
  document_number text,
  
  -- File
  file_url text NOT NULL,
  file_type varchar(20),
  file_size_bytes integer,
  
  -- Dates
  issue_date date,
  expiry_date date,
  
  -- Verification
  verification_status varchar DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'rejected', 'expired'
  )),
  verified_by uuid REFERENCES cc_user_profiles(user_id),
  verified_at timestamptz,
  rejection_reason text,
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_docs_operator ON cc_operator_documents(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_docs_type ON cc_operator_documents(document_type, verification_status);
CREATE INDEX IF NOT EXISTS idx_operator_docs_expiry ON cc_operator_documents(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE cc_operator_documents ENABLE ROW LEVEL SECURITY;

COMMIT;
