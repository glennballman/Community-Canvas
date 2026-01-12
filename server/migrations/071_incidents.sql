-- V3.3.1 Block 09: Incidents + Enforcement Workflow
-- Emergency incident management (firetruck blockage scenario)

-- Incidents table
CREATE TABLE IF NOT EXISTS cc_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id uuid REFERENCES cc_tenants(id),
  portal_id uuid REFERENCES cc_portals(id),
  
  incident_number varchar(20) NOT NULL,
  
  incident_type varchar(30) NOT NULL CHECK (incident_type IN (
    'road_blockage', 'illegal_parking', 'slip_violation', 
    'damage_report', 'safety_hazard', 'medical', 'fire', 'other'
  )),
  severity varchar(10) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'triaged', 'dispatched', 'resolved', 'closed', 'cancelled'
  )),
  
  location_label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  facility_id uuid REFERENCES cc_facilities(id),
  inventory_unit_id uuid REFERENCES cc_inventory_units(id),
  
  webcam_entity_id integer,
  photo_urls text[],
  
  narrative text,
  reporter_name varchar(200),
  reporter_contact varchar(200),
  
  dispatch_log jsonb DEFAULT '[]'::jsonb,
  
  resolved_at timestamptz,
  resolution text,
  resolved_by uuid REFERENCES cc_individuals(id),
  
  qa_seed_tag varchar(50),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES cc_individuals(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS cc_incidents_number_idx ON cc_incidents(incident_number);
CREATE INDEX IF NOT EXISTS cc_incidents_status_idx ON cc_incidents(tenant_id, status) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS cc_incidents_facility_idx ON cc_incidents(facility_id) WHERE facility_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cc_incidents_qa_idx ON cc_incidents(qa_seed_tag) WHERE qa_seed_tag IS NOT NULL;

ALTER TABLE cc_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_incidents_tenant_isolation ON cc_incidents;
CREATE POLICY cc_incidents_tenant_isolation ON cc_incidents
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
    OR community_id::text = current_setting('app.tenant_id', true)
  );

-- Incident actions table
CREATE TABLE IF NOT EXISTS cc_incident_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES cc_incidents(id) ON DELETE CASCADE,
  
  action_type varchar(30) NOT NULL CHECK (action_type IN (
    'dispatch_tow', 'notify_owner', 'issue_warning', 
    'call_police', 'call_fire', 'call_ambulance',
    'add_evidence', 'add_note', 'escalate', 'resolve'
  )),
  
  payload jsonb DEFAULT '{}'::jsonb,
  result varchar(20),
  
  performed_at timestamptz DEFAULT now(),
  performed_by uuid REFERENCES cc_individuals(id)
);

CREATE INDEX IF NOT EXISTS cc_incident_actions_incident_idx ON cc_incident_actions(incident_id);

ALTER TABLE cc_incident_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_incident_actions_tenant_isolation ON cc_incident_actions;
CREATE POLICY cc_incident_actions_tenant_isolation ON cc_incident_actions
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Tow requests table
CREATE TABLE IF NOT EXISTS cc_tow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES cc_incidents(id) ON DELETE CASCADE,
  incident_action_id uuid REFERENCES cc_incident_actions(id),
  
  priority varchar(15) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'emergency')),
  
  vehicle_plate varchar(20),
  vehicle_description text,
  
  location_label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  
  provider_name varchar(200),
  provider_contact varchar(100),
  
  status varchar(20) NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'acknowledged', 'en_route', 'on_scene', 'completed', 'cancelled'
  )),
  
  requested_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  
  notes text,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cc_tow_requests_incident_idx ON cc_tow_requests(incident_id);
CREATE INDEX IF NOT EXISTS cc_tow_requests_status_idx ON cc_tow_requests(status) WHERE status NOT IN ('completed', 'cancelled');

ALTER TABLE cc_tow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_tow_requests_tenant_isolation ON cc_tow_requests;
CREATE POLICY cc_tow_requests_tenant_isolation ON cc_tow_requests
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );
