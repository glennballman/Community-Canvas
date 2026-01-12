BEGIN;

-- ============ TRIP HANDOFFS ============
-- Pass guest information to next destination

CREATE TABLE IF NOT EXISTS cc_trip_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES cc_trips(id) ON DELETE CASCADE,
  
  -- Source (current property)
  from_portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  from_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  -- Destination
  next_destination_name varchar NOT NULL,
  next_destination_address text,
  next_destination_phone varchar,
  next_destination_email varchar,
  next_destination_portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Timing
  planned_departure_date date,
  planned_departure_time time,
  actual_departure_at timestamptz,
  
  -- Transport
  transport_mode varchar CHECK (transport_mode IN (
    'self_drive', 'ferry', 'seaplane', 'water_taxi', 'shuttle', 'other'
  )),
  transport_details text,
  transport_booking_ref varchar,
  
  -- Consent for sharing
  consent_share_dietary boolean DEFAULT false,
  consent_share_accessibility boolean DEFAULT false,
  consent_share_medical boolean DEFAULT false,
  consent_share_preferences boolean DEFAULT false,
  
  -- Shared info snapshot (only what was consented)
  needs_snapshot jsonb DEFAULT '{}'::jsonb,
  
  -- Notes
  notes_for_next text,
  special_arrangements text,
  
  -- Partner notification
  partner_invitation_id uuid REFERENCES cc_trip_invitations(id) ON DELETE SET NULL,
  partner_invitation_sent boolean DEFAULT false,
  partner_invitation_sent_at timestamptz,
  partner_accepted boolean DEFAULT false,
  partner_accepted_at timestamptz,
  
  -- Status
  status varchar DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'acknowledged', 'completed', 'cancelled'
  )),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_handoffs_trip ON cc_trip_handoffs(trip_id);
CREATE INDEX IF NOT EXISTS idx_cc_handoffs_destination ON cc_trip_handoffs(next_destination_portal_id) WHERE next_destination_portal_id IS NOT NULL;

ALTER TABLE cc_trip_handoffs ENABLE ROW LEVEL SECURITY;

-- ============ TRIP ALERTS ============
-- Weather, travel, and operational alerts for trips

CREATE TABLE IF NOT EXISTS cc_trip_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES cc_trips(id) ON DELETE CASCADE,
  
  -- Alert type
  alert_type varchar NOT NULL CHECK (alert_type IN (
    'weather', 'ferry', 'flight', 'road', 'activity_cancelled',
    'booking_change', 'provider_message', 'emergency', 'reminder', 'system'
  )),
  
  -- Severity
  severity varchar NOT NULL DEFAULT 'info' CHECK (severity IN (
    'info', 'warning', 'critical', 'emergency'
  )),
  
  -- Content
  title varchar NOT NULL,
  message text NOT NULL,
  action_required boolean DEFAULT false,
  action_url text,
  action_label varchar,
  
  -- Context
  related_item_id uuid,
  related_item_type varchar,
  affected_date date,
  
  -- Source
  source varchar DEFAULT 'system' CHECK (source IN (
    'system', 'weather_service', 'ferry_api', 'provider', 'staff', 'auto'
  )),
  source_ref varchar,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'acknowledged', 'resolved', 'dismissed', 'expired'
  )),
  acknowledged_at timestamptz,
  acknowledged_by varchar,
  resolved_at timestamptz,
  
  -- Expiry
  expires_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_alerts_trip ON cc_trip_alerts(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_alerts_active ON cc_trip_alerts(trip_id, severity) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_cc_alerts_date ON cc_trip_alerts(affected_date) WHERE affected_date IS NOT NULL;

ALTER TABLE cc_trip_alerts ENABLE ROW LEVEL SECURITY;

COMMIT;
