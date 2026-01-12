BEGIN;

-- ============ TRIP PERMITS ============
-- Links permits to trips and tracks permit requirements for trip itinerary

CREATE TABLE IF NOT EXISTS cc_trip_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  trip_id uuid NOT NULL REFERENCES cc_trips(id) ON DELETE CASCADE,
  permit_id uuid REFERENCES cc_visitor_permits(id) ON DELETE SET NULL,
  permit_type_id uuid NOT NULL REFERENCES cc_permit_types(id),
  authority_id uuid NOT NULL REFERENCES cc_authorities(id),
  
  -- Requirement source
  requirement_source varchar NOT NULL CHECK (requirement_source IN (
    'location',       -- Required by location visited
    'activity',       -- Required by activity type
    'duration',       -- Required by trip duration
    'party_size',     -- Required by group size
    'vessel',         -- Required for vessel/boat
    'commercial',     -- Commercial operation requirement
    'manual'          -- Manually added
  )),
  
  source_location_id uuid REFERENCES cc_locations(id),
  source_description text,
  
  -- Status
  status varchar DEFAULT 'required' CHECK (status IN (
    'required',       -- Permit is required
    'recommended',    -- Permit is recommended
    'optional',       -- Optional enhancement
    'obtained',       -- Permit has been obtained
    'waived',         -- Requirement waived
    'not_applicable'  -- Determined not needed
  )),
  
  -- Timing
  required_by date,
  obtained_at timestamptz,
  
  -- Notes
  notes text,
  waiver_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(trip_id, permit_type_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_trip_permits_trip ON cc_trip_permits(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_trip_permits_permit ON cc_trip_permits(permit_id) WHERE permit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_trip_permits_type ON cc_trip_permits(permit_type_id);

ALTER TABLE cc_trip_permits ENABLE ROW LEVEL SECURITY;

COMMIT;
