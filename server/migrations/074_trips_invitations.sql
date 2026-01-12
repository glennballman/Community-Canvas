BEGIN;

-- ============ TRIPS ============
-- A trip is a container for a group's itinerary across multiple carts/reservations

CREATE TABLE IF NOT EXISTS cc_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  -- Access (public access code for sharing)
  access_code varchar NOT NULL UNIQUE,
  
  -- Trip info
  group_name varchar NOT NULL,
  trip_type varchar DEFAULT 'leisure' CHECK (trip_type IN (
    'leisure', 'business', 'wedding', 'reunion', 'corporate', 'expedition', 'other'
  )),
  
  -- Dates
  start_date date,
  end_date date,
  
  -- Primary contact
  primary_contact_name varchar,
  primary_contact_email varchar,
  primary_contact_phone varchar,
  
  -- Party composition
  expected_adults integer DEFAULT 1,
  expected_children integer DEFAULT 0,
  expected_infants integer DEFAULT 0,
  
  -- Status
  status varchar NOT NULL DEFAULT 'planning' CHECK (status IN (
    'planning', 'confirmed', 'in_progress', 'completed', 'cancelled'
  )),
  
  -- INTENT (trip-level planning)
  intent_json jsonb DEFAULT '{}'::jsonb,
  
  -- NEEDS (aggregated from party profiles)
  needs_json jsonb DEFAULT '{}'::jsonb,
  
  -- BUDGET
  budget_json jsonb DEFAULT '{}'::jsonb,
  
  -- Viral tracking
  viral_json jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_trips_access ON cc_trips(access_code);
CREATE INDEX IF NOT EXISTS idx_cc_trips_portal ON cc_trips(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_trips_status ON cc_trips(status, start_date);

ALTER TABLE cc_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_trips_tenant_isolation ON cc_trips;
CREATE POLICY cc_trips_tenant_isolation ON cc_trips
  USING (
    current_setting('app.current_tenant_id', true) = '__SERVICE__'
    OR tenant_id IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============ TRIP INVITATIONS ============
-- Invite party members, planners, or next destinations

CREATE TABLE IF NOT EXISTS cc_trip_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES cc_trips(id) ON DELETE CASCADE,
  
  -- Invitation type
  invitation_type varchar NOT NULL CHECK (invitation_type IN (
    'party_member',
    'co_planner',
    'kid_planner',
    'handoff_recipient',
    'partner_invite'
  )),
  
  -- Token for accepting
  token varchar NOT NULL UNIQUE,
  
  -- Recipient
  recipient_name varchar,
  recipient_email varchar,
  recipient_phone varchar,
  
  -- For handoffs
  handoff_id uuid,
  next_destination_name varchar,
  
  -- Message
  message_subject varchar,
  message_body text,
  sender_name varchar,
  
  -- Status
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'viewed', 'accepted', 'declined', 'expired'
  )),
  
  -- Tracking
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  
  -- Result (what was created when accepted)
  result_json jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_invitations_token ON cc_trip_invitations(token);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_trip ON cc_trip_invitations(trip_id);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_status ON cc_trip_invitations(status) WHERE status = 'pending';

ALTER TABLE cc_trip_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_trip_invitations_tenant_isolation ON cc_trip_invitations;
CREATE POLICY cc_trip_invitations_tenant_isolation ON cc_trip_invitations
  USING (
    current_setting('app.current_tenant_id', true) = '__SERVICE__'
    OR EXISTS (
      SELECT 1 FROM cc_trips t 
      WHERE t.id = cc_trip_invitations.trip_id 
      AND (t.tenant_id IS NULL OR t.tenant_id::text = current_setting('app.current_tenant_id', true))
    )
  );

-- ============ LINK CARTS TO TRIPS ============
-- Add foreign key now that trips table exists (trip_id column already exists in 073)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_cc_carts_trip' 
    AND table_name = 'cc_reservation_carts'
  ) THEN
    ALTER TABLE cc_reservation_carts
      ADD CONSTRAINT fk_cc_carts_trip 
      FOREIGN KEY (trip_id) REFERENCES cc_trips(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
