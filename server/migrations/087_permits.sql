BEGIN;

-- ============ VISITOR PERMITS ============
-- Individual permits issued to guests (not to be confused with cc_permits which is for work order compliance)

CREATE TABLE IF NOT EXISTS cc_visitor_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  authority_id uuid NOT NULL REFERENCES cc_authorities(id),
  permit_type_id uuid NOT NULL REFERENCES cc_permit_types(id),
  
  -- Cart/trip integration
  cart_id uuid REFERENCES cc_reservation_carts(id) ON DELETE SET NULL,
  cart_item_id uuid REFERENCES cc_reservation_cart_items(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES cc_trips(id) ON DELETE SET NULL,
  
  -- Identity
  permit_number varchar(30) NOT NULL UNIQUE,
  -- Format: PRM-AUTHORITY-YYMMDD-XXXX (e.g., PRM-PRNPR-260115-A7K9)
  
  -- Applicant
  applicant_name text NOT NULL,
  applicant_email text,
  applicant_phone text,
  applicant_address text,
  
  -- Group (for group permits)
  party_size integer DEFAULT 1,
  party_members text[],
  
  -- Validity
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  
  -- Location/activity specifics
  location_id uuid REFERENCES cc_locations(id),
  activity_description text,
  entry_point text,
  exit_point text,
  
  -- Vessel (for moorage/anchoring permits)
  vessel_name text,
  vessel_registration text,
  vessel_length_ft numeric(6,2),
  
  -- Fees
  base_fee_cad numeric(10,2) DEFAULT 0,
  person_fee_cad numeric(10,2) DEFAULT 0,
  day_fee_cad numeric(10,2) DEFAULT 0,
  night_fee_cad numeric(10,2) DEFAULT 0,
  total_fee_cad numeric(10,2) DEFAULT 0,
  
  -- Payment
  payment_status varchar DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'paid', 'waived', 'refunded', 'failed'
  )),
  payment_reference text,
  paid_at timestamptz,
  
  -- Status
  status varchar NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- Started but not submitted
    'submitted',    -- Submitted for review
    'pending',      -- Awaiting authority approval
    'approved',     -- Approved, awaiting payment
    'issued',       -- Paid and issued
    'active',       -- Currently valid
    'used',         -- Single-use permit used
    'expired',      -- Past valid_to date
    'cancelled',    -- Cancelled by applicant
    'revoked',      -- Revoked by authority
    'rejected'      -- Application rejected
  )),
  
  -- Approval tracking
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  issued_at timestamptz,
  
  -- Rejection/revocation
  rejection_reason text,
  revocation_reason text,
  
  -- Document
  qr_code_token varchar(30) UNIQUE,
  document_url text,
  
  -- Conditions/notes
  special_conditions text,
  authority_notes text,
  applicant_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_authority ON cc_visitor_permits(authority_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_type ON cc_visitor_permits(permit_type_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_dates ON cc_visitor_permits(valid_from, valid_to, status);
CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_applicant ON cc_visitor_permits(applicant_email) WHERE applicant_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_trip ON cc_visitor_permits(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_number ON cc_visitor_permits(permit_number);
CREATE INDEX IF NOT EXISTS idx_cc_visitor_permits_qr ON cc_visitor_permits(qr_code_token) WHERE qr_code_token IS NOT NULL;

ALTER TABLE cc_visitor_permits ENABLE ROW LEVEL SECURITY;

COMMIT;
