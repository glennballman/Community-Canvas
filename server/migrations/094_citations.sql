BEGIN;

-- ============ CITATIONS ============
-- Formal citations issued for rule violations

CREATE TABLE IF NOT EXISTS cc_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid REFERENCES cc_properties(id),
  unit_id uuid REFERENCES cc_units(id),
  reservation_id uuid REFERENCES cc_pms_reservations(id),
  
  -- Source
  compliance_rule_id uuid REFERENCES cc_compliance_rules(id),
  compliance_check_id uuid REFERENCES cc_compliance_checks(id),
  incident_report_id uuid REFERENCES cc_incident_reports(id),
  
  -- Identity
  citation_number varchar(20) NOT NULL UNIQUE,
  -- Format: CIT-YYMMDD-XXXX
  
  -- Violator
  violator_type varchar DEFAULT 'guest' CHECK (violator_type IN (
    'guest', 'operator', 'property_owner', 'vessel', 'vehicle', 'other'
  )),
  violator_name text NOT NULL,
  violator_email text,
  violator_phone text,
  violator_address text,
  
  -- For guests
  guest_reservation_id uuid REFERENCES cc_pms_reservations(id),
  
  -- For vessels/vehicles
  vessel_name text,
  vessel_registration text,
  vehicle_plate text,
  vehicle_description text,
  
  -- Violation details
  violation_date date NOT NULL,
  violation_time time,
  violation_location text,
  lat numeric(9,6),
  lon numeric(9,6),
  
  -- Rule violated
  rule_code varchar(30),
  rule_name text NOT NULL,
  violation_description text NOT NULL,
  
  -- Evidence
  evidence_description text,
  photos_json jsonb DEFAULT '[]'::jsonb,
  witness_names text[],
  
  -- Offense tracking
  offense_number integer DEFAULT 1,  -- 1st, 2nd, 3rd offense
  prior_citations_json jsonb DEFAULT '[]'::jsonb,
  -- [{citation_number, date, rule_code}]
  
  -- Fine
  fine_amount_cad numeric(10,2) DEFAULT 0,
  fine_due_date date,
  
  -- Payment
  payment_status varchar DEFAULT 'unpaid' CHECK (payment_status IN (
    'unpaid', 'partial', 'paid', 'waived', 'appealed', 'sent_collections'
  )),
  amount_paid_cad numeric(10,2) DEFAULT 0,
  payment_date date,
  payment_reference text,
  
  -- Status
  status varchar DEFAULT 'issued' CHECK (status IN (
    'draft',          -- Not yet issued
    'issued',         -- Issued to violator
    'acknowledged',   -- Violator acknowledged
    'contested',      -- Under appeal
    'upheld',         -- Appeal denied
    'reduced',        -- Fine reduced on appeal
    'dismissed',      -- Citation dismissed
    'paid',           -- Fine paid
    'closed',         -- Closed (expired, collections, etc.)
    'void'            -- Voided (issued in error)
  )),
  
  -- Issuance
  issued_by text NOT NULL,
  issued_at timestamptz DEFAULT now(),
  served_method varchar CHECK (served_method IN (
    'in_person', 'email', 'mail', 'posted'
  )),
  served_at timestamptz,
  acknowledged_at timestamptz,
  
  -- Additional actions
  additional_action varchar CHECK (additional_action IN (
    'none', 'verbal_warning', 'written_warning', 'eviction', 
    'ban', 'referred_authority', 'police_called'
  )),
  action_notes text,
  
  -- Notes
  issuer_notes text,
  violator_statement text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citations_portal ON cc_citations(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_citations_property ON cc_citations(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citations_violator ON cc_citations(violator_email) WHERE violator_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citations_date ON cc_citations(violation_date DESC);
CREATE INDEX IF NOT EXISTS idx_citations_payment ON cc_citations(payment_status) WHERE payment_status = 'unpaid';
CREATE INDEX IF NOT EXISTS idx_citations_number ON cc_citations(citation_number);

ALTER TABLE cc_citations ENABLE ROW LEVEL SECURITY;

-- ============ CITATION APPEALS ============
-- Appeals against citations

CREATE TABLE IF NOT EXISTS cc_citation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  citation_id uuid NOT NULL REFERENCES cc_citations(id) ON DELETE CASCADE,
  
  -- Identity
  appeal_number varchar(20) NOT NULL UNIQUE,
  -- Format: APL-YYMMDD-XXXX
  
  -- Appellant
  appellant_name text NOT NULL,
  appellant_email text,
  appellant_phone text,
  
  -- Appeal details
  filed_at timestamptz DEFAULT now(),
  grounds text NOT NULL,  -- Reason for appeal
  supporting_evidence text,
  documents_json jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status varchar DEFAULT 'filed' CHECK (status IN (
    'filed',          -- Just submitted
    'under_review',   -- Being reviewed
    'hearing_scheduled', -- Hearing date set
    'decided',        -- Decision made
    'withdrawn'       -- Appellant withdrew
  )),
  
  -- Review
  assigned_to text,
  assigned_at timestamptz,
  
  -- Hearing
  hearing_date date,
  hearing_time time,
  hearing_location text,
  hearing_notes text,
  
  -- Decision
  decision varchar CHECK (decision IN (
    'upheld',         -- Citation stands
    'reduced',        -- Fine reduced
    'dismissed',      -- Citation dismissed
    'modified'        -- Other modification
  )),
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  
  -- If reduced/modified
  new_fine_amount_cad numeric(10,2),
  new_due_date date,
  
  -- Notes
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appeals_citation ON cc_citation_appeals(citation_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON cc_citation_appeals(status);

ALTER TABLE cc_citation_appeals ENABLE ROW LEVEL SECURITY;

-- ============ VIOLATION HISTORY ============
-- Track repeat offenders across reservations

CREATE TABLE IF NOT EXISTS cc_violation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Identifier (email is primary key for guests)
  identifier_type varchar NOT NULL CHECK (identifier_type IN (
    'email', 'phone', 'vessel_registration', 'vehicle_plate', 'name'
  )),
  identifier_value text NOT NULL,
  
  -- Stats
  total_citations integer DEFAULT 0,
  total_warnings integer DEFAULT 0,
  total_fines_cad numeric(10,2) DEFAULT 0,
  unpaid_fines_cad numeric(10,2) DEFAULT 0,
  
  -- Most recent
  last_citation_id uuid REFERENCES cc_citations(id),
  last_citation_date date,
  last_violation_type varchar,
  
  -- Status
  standing varchar DEFAULT 'good' CHECK (standing IN (
    'good',           -- No issues
    'warned',         -- Has warnings
    'probation',      -- On probation
    'restricted',     -- Limited booking
    'banned'          -- Cannot book
  )),
  
  ban_reason text,
  ban_until date,
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_violation_history_portal ON cc_violation_history(portal_id, standing);
CREATE INDEX IF NOT EXISTS idx_violation_history_identifier ON cc_violation_history(identifier_type, identifier_value);

ALTER TABLE cc_violation_history ENABLE ROW LEVEL SECURITY;

COMMIT;
