-- V3.3.1 Block 11: Access Credentials + Events
-- Issue QR codes, gate codes, and track access events for check-in validation

-- Create cc_access_credentials table
CREATE TABLE IF NOT EXISTS cc_access_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id),
  reservation_id uuid NOT NULL REFERENCES cc_reservations(id) ON DELETE CASCADE,
  reservation_item_id uuid REFERENCES cc_reservation_items(id),
  
  credential_type varchar NOT NULL CHECK (credential_type IN (
    'qr', 'short_code', 'gate_code', 'dock_power_token', 'key_code'
  )),
  
  qr_token varchar UNIQUE,
  short_code varchar,
  gate_code varchar,
  
  scope varchar NOT NULL CHECK (scope IN (
    'facility_access', 'gate', 'dock_power', 'parking_entry', 'parking_exit', 'room'
  )),
  
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  
  is_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES cc_individuals(id),
  revoked_reason varchar,
  
  issued_at timestamptz DEFAULT now(),
  issued_by uuid REFERENCES cc_individuals(id),
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_credentials_token ON cc_access_credentials(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_credentials_code ON cc_access_credentials(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_credentials_reservation ON cc_access_credentials(reservation_id);
CREATE INDEX IF NOT EXISTS idx_cc_credentials_valid ON cc_access_credentials(valid_until) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_cc_credentials_tenant ON cc_access_credentials(tenant_id);

ALTER TABLE cc_access_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_access_credentials_tenant_isolation ON cc_access_credentials;
CREATE POLICY cc_access_credentials_tenant_isolation ON cc_access_credentials
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Create cc_access_events table
CREATE TABLE IF NOT EXISTS cc_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id),
  
  credential_id uuid REFERENCES cc_access_credentials(id),
  facility_id uuid REFERENCES cc_facilities(id),
  inventory_unit_id uuid REFERENCES cc_inventory_units(id),
  
  event_type varchar NOT NULL CHECK (event_type IN (
    'validate', 'check_in', 'check_out', 
    'gate_open', 'gate_deny', 
    'power_connect', 'power_disconnect',
    'patrol_scan', 'manual_override'
  )),
  
  result varchar NOT NULL CHECK (result IN (
    'valid', 'invalid', 'expired', 'revoked', 'not_found', 'wrong_facility'
  )),
  
  validation_method varchar,
  actor_id uuid REFERENCES cc_individuals(id),
  device_id varchar,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_access_events_credential ON cc_access_events(credential_id);
CREATE INDEX IF NOT EXISTS idx_cc_access_events_facility ON cc_access_events(facility_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_cc_access_events_tenant ON cc_access_events(tenant_id);

ALTER TABLE cc_access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_access_events_tenant_isolation ON cc_access_events;
CREATE POLICY cc_access_events_tenant_isolation ON cc_access_events
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );
