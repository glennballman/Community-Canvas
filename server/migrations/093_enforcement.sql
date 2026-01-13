BEGIN;

-- ============ COMPLIANCE RULES ============
-- Rules that properties, guests, and operators must follow

CREATE TABLE IF NOT EXISTS cc_compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid REFERENCES cc_properties(id) ON DELETE CASCADE,
  authority_id uuid REFERENCES cc_authorities(id) ON DELETE SET NULL,
  
  -- Identity
  name text NOT NULL,
  code varchar(30),
  
  -- Category
  category varchar NOT NULL CHECK (category IN (
    'noise',           -- Noise regulations
    'occupancy',       -- Occupancy limits
    'parking',         -- Parking rules
    'pets',            -- Pet policies
    'fire_safety',     -- Fire safety
    'waste',           -- Waste disposal
    'water',           -- Water usage/conservation
    'wildlife',        -- Wildlife interaction
    'environmental',   -- Environmental protection
    'cultural',        -- Cultural site respect
    'boating',         -- Boating/marine rules
    'fishing',         -- Fishing regulations
    'camping',         -- Camping rules
    'trail',           -- Trail usage
    'commercial',      -- Commercial operation
    'permit',          -- Permit requirements
    'general'          -- General rules
  )),
  
  -- Rule details
  description text NOT NULL,
  rationale text,
  
  -- Applicability
  applies_to varchar[] DEFAULT ARRAY['guest'],
  -- ['guest', 'operator', 'property', 'vessel', 'vehicle']
  
  -- Enforcement
  enforcement_level varchar DEFAULT 'standard' CHECK (enforcement_level IN (
    'advisory',        -- Information only
    'standard',        -- Standard enforcement
    'strict',          -- Zero tolerance
    'seasonal'         -- Seasonal enforcement
  )),
  
  -- Penalties
  first_offense_action varchar DEFAULT 'warning',
  second_offense_action varchar DEFAULT 'citation',
  third_offense_action varchar DEFAULT 'eviction',
  
  fine_amount_cad numeric(10,2),
  
  -- Timing
  effective_date date,
  expiry_date date,
  seasonal_months integer[],  -- [6,7,8,9] for summer rules
  
  quiet_hours_start time,
  quiet_hours_end time,
  
  -- Reference
  bylaw_reference text,
  external_url text,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('draft', 'active', 'suspended', 'archived')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, code)
);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_portal ON cc_compliance_rules(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_category ON cc_compliance_rules(category, status);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_property ON cc_compliance_rules(property_id) WHERE property_id IS NOT NULL;

ALTER TABLE cc_compliance_rules ENABLE ROW LEVEL SECURITY;

-- ============ COMPLIANCE CHECKS ============
-- Scheduled or triggered compliance inspections

CREATE TABLE IF NOT EXISTS cc_compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid REFERENCES cc_properties(id),
  unit_id uuid REFERENCES cc_units(id),
  reservation_id uuid REFERENCES cc_pms_reservations(id),
  
  -- Identity
  check_number varchar(20) NOT NULL UNIQUE,
  -- Format: CHK-YYMMDD-XXXX
  
  -- Type
  check_type varchar NOT NULL CHECK (check_type IN (
    'routine',         -- Scheduled routine check
    'complaint',       -- Response to complaint
    'incident',        -- Following an incident
    'permit',          -- Permit compliance
    'safety',          -- Safety inspection
    'noise',           -- Noise complaint response
    'occupancy',       -- Occupancy verification
    'random',          -- Random spot check
    'followup'         -- Follow-up to previous issue
  )),
  
  -- Scheduling
  scheduled_at timestamptz,
  scheduled_by text,
  
  -- Assignment
  assigned_to text,
  assigned_at timestamptz,
  
  -- Execution
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Location
  location_description text,
  lat numeric(9,6),
  lon numeric(9,6),
  
  -- Findings
  status varchar DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',       -- Planned
    'in_progress',     -- Being conducted
    'completed',       -- Finished
    'compliant',       -- No issues found
    'non_compliant',   -- Issues found
    'cancelled'        -- Cancelled
  )),
  
  overall_result varchar CHECK (overall_result IN (
    'pass', 'fail', 'partial', 'not_applicable'
  )),
  
  -- Checklist results
  checklist_json jsonb DEFAULT '[]'::jsonb,
  -- [{rule_id: uuid, rule_name: '...', compliant: true, notes: '...'}]
  
  -- Evidence
  findings_summary text,
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Actions taken
  actions_taken text,
  warnings_issued integer DEFAULT 0,
  citations_issued integer DEFAULT 0,
  
  -- Follow-up
  requires_followup boolean DEFAULT false,
  followup_date date,
  followup_notes text,
  
  -- Notes
  inspector_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_portal ON cc_compliance_checks(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_property ON cc_compliance_checks(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_checks_scheduled ON cc_compliance_checks(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_number ON cc_compliance_checks(check_number);

ALTER TABLE cc_compliance_checks ENABLE ROW LEVEL SECURITY;

-- ============ INCIDENT REPORTS ============
-- Reports of incidents, complaints, and observations

CREATE TABLE IF NOT EXISTS cc_incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid REFERENCES cc_properties(id),
  unit_id uuid REFERENCES cc_units(id),
  reservation_id uuid REFERENCES cc_pms_reservations(id),
  location_id uuid REFERENCES cc_locations(id),
  
  -- Identity
  report_number varchar(20) NOT NULL UNIQUE,
  -- Format: INC-YYMMDD-XXXX
  
  -- Type
  incident_type varchar NOT NULL CHECK (incident_type IN (
    'noise_complaint',    -- Noise disturbance
    'property_damage',    -- Damage to property
    'safety_hazard',      -- Safety concern
    'rule_violation',     -- General rule violation
    'guest_conflict',     -- Guest-to-guest conflict
    'trespass',           -- Unauthorized access
    'wildlife',           -- Wildlife incident
    'environmental',      -- Environmental issue
    'medical',            -- Medical emergency
    'theft',              -- Theft report
    'vandalism',          -- Vandalism
    'fire',               -- Fire incident
    'accident',           -- Accident
    'other'
  )),
  
  -- Severity
  severity varchar DEFAULT 'moderate' CHECK (severity IN (
    'minor',           -- Minor issue
    'moderate',        -- Moderate concern
    'major',           -- Significant incident
    'critical',        -- Requires immediate action
    'emergency'        -- Emergency situation
  )),
  
  -- When & where
  incident_at timestamptz NOT NULL,
  reported_at timestamptz DEFAULT now(),
  location_description text,
  lat numeric(9,6),
  lon numeric(9,6),
  
  -- Reporter
  reported_by_type varchar DEFAULT 'staff' CHECK (reported_by_type IN (
    'guest', 'staff', 'neighbor', 'authority', 'anonymous', 'system'
  )),
  reported_by_name text,
  reported_by_contact text,
  reporter_reservation_id uuid REFERENCES cc_pms_reservations(id),
  
  -- Involved parties
  involved_parties_json jsonb DEFAULT '[]'::jsonb,
  -- [{name: '...', type: 'guest', reservation_id: uuid, role: 'subject'}]
  
  -- Description
  title text NOT NULL,
  description text,
  
  -- Evidence
  photos_json jsonb DEFAULT '[]'::jsonb,
  witness_statements jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status varchar DEFAULT 'reported' CHECK (status IN (
    'reported',        -- Just reported
    'investigating',   -- Under investigation
    'action_taken',    -- Action has been taken
    'resolved',        -- Resolved
    'escalated',       -- Escalated to authority
    'closed',          -- Closed (no action)
    'unfounded'        -- Found to be unfounded
  )),
  
  -- Response
  responded_by text,
  responded_at timestamptz,
  response_time_minutes integer,
  
  -- Investigation
  investigation_notes text,
  investigated_by text,
  
  -- Resolution
  resolution_type varchar CHECK (resolution_type IN (
    'verbal_warning',
    'written_warning',
    'citation_issued',
    'eviction',
    'repair_ordered',
    'no_action',
    'referred_authority',
    'other'
  )),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by text,
  
  -- Related records
  compliance_check_id uuid REFERENCES cc_compliance_checks(id),
  maintenance_request_id uuid REFERENCES cc_maintenance_requests(id),
  
  -- Costs
  damage_estimate_cad numeric(10,2),
  repair_cost_cad numeric(10,2),
  
  -- Follow-up
  requires_followup boolean DEFAULT false,
  followup_date date,
  
  -- Privacy
  guest_visible boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_portal ON cc_incident_reports(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_property ON cc_incident_reports(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_type ON cc_incident_reports(incident_type, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON cc_incident_reports(incident_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_number ON cc_incident_reports(report_number);

ALTER TABLE cc_incident_reports ENABLE ROW LEVEL SECURITY;

-- ============ SEED BAMFIELD COMPLIANCE RULES ============

DO $$
DECLARE
  v_portal_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  IF v_portal_id IS NOT NULL THEN
    -- Quiet Hours
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level, quiet_hours_start, quiet_hours_end,
      first_offense_action, second_offense_action, third_offense_action,
      status
    ) VALUES (
      v_portal_id, 'Quiet Hours', 'QUIET-HRS', 'noise',
      'Quiet hours are in effect from 10:00 PM to 7:00 AM. Excessive noise during these hours is prohibited.',
      'standard', '22:00', '07:00',
      'warning', 'citation', 'eviction',
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Occupancy Limits
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level, first_offense_action, fine_amount_cad,
      status
    ) VALUES (
      v_portal_id, 'Occupancy Limits', 'OCC-LIMIT', 'occupancy',
      'The number of guests must not exceed the maximum occupancy listed for the unit. Additional guests require approval and may incur extra fees.',
      'strict', 'citation', 100.00,
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Wildlife Interaction
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level, rationale,
      status
    ) VALUES (
      v_portal_id, 'Wildlife Non-Interference', 'WILDLIFE', 'wildlife',
      'Do not feed, approach, or disturb wildlife. Store food in bear-proof containers where provided. Report wildlife sightings to staff.',
      'strict',
      'Bamfield is home to bears, cougars, wolves, and marine mammals. Human food can habituate wildlife to human presence, creating dangerous situations.',
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Fire Safety
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level, seasonal_months,
      status
    ) VALUES (
      v_portal_id, 'Fire Restrictions', 'FIRE-SAFE', 'fire_safety',
      'Open fires only in designated fire pits. During fire bans, no open flames are permitted. Check current fire danger rating before starting any fire.',
      'strict', ARRAY[6,7,8,9],
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Waste Disposal
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level,
      status
    ) VALUES (
      v_portal_id, 'Waste Disposal', 'WASTE', 'waste',
      'All waste must be disposed of in designated receptacles. Pack out what you pack in for backcountry areas. No dumping of grey water except at designated stations.',
      'standard',
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Parking
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level, fine_amount_cad,
      status
    ) VALUES (
      v_portal_id, 'Parking Regulations', 'PARKING', 'parking',
      'Park only in designated areas. Display valid parking permit. No overnight parking without authorization. Boat trailers must use designated areas.',
      'standard', 50.00,
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Cultural Site Respect
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level, rationale,
      status
    ) VALUES (
      v_portal_id, 'Cultural Site Protocol', 'CULTURAL', 'cultural',
      'Respect all cultural and archaeological sites. Do not remove artifacts. Some areas require guided access. Photography may be restricted at certain locations.',
      'strict',
      'The Bamfield area is within the traditional territory of the Huu-ay-aht First Nations and contains many significant cultural sites.',
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
    
    -- Boating Safety
    INSERT INTO cc_compliance_rules (
      portal_id, name, code, category, description,
      enforcement_level,
      status
    ) VALUES (
      v_portal_id, 'Boating Safety', 'BOAT-SAFE', 'boating',
      'All vessels must comply with Transport Canada regulations. Life jackets required. No wake zones must be observed. Check marine weather before departure.',
      'strict',
      'active'
    ) ON CONFLICT (portal_id, code) DO NOTHING;
  END IF;
END $$;

COMMIT;
