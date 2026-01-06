-- ============================================================================
-- MIGRATION 051 — Resource Schedule Events (15-minute precision)
-- Community Canvas / CivOS
--
-- Goal
--   Create a canonical scheduling table for 15-minute precision scheduling.
--   Supports: booked, hold, maintenance, buffer event types.
--   Integrates with unified_assets as the resource table.
--
-- Time is stored as TIMESTAMPTZ ranges. UI layer snaps to 15-minute increments.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Event type enum
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_event_type') THEN
    CREATE TYPE schedule_event_type AS ENUM (
      'booked',
      'hold',
      'maintenance',
      'buffer'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_event_status') THEN
    CREATE TYPE schedule_event_status AS ENUM (
      'active',
      'cancelled'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Main schedule events table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS resource_schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  resource_id UUID NOT NULL REFERENCES unified_assets(id) ON DELETE CASCADE,
  
  event_type schedule_event_type NOT NULL,
  
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  status schedule_event_status NOT NULL DEFAULT 'active',
  
  title TEXT,
  notes TEXT,
  
  created_by_actor_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  related_entity_type TEXT,
  related_entity_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_time_range CHECK (ends_at > starts_at),
  CONSTRAINT valid_15min_start CHECK (EXTRACT(MINUTE FROM starts_at)::integer % 15 = 0),
  CONSTRAINT valid_15min_end CHECK (EXTRACT(MINUTE FROM ends_at)::integer % 15 = 0)
);

-- ---------------------------------------------------------------------------
-- 3) Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_schedule_events_tenant_resource 
  ON resource_schedule_events(tenant_id, resource_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_schedule_events_tenant_time 
  ON resource_schedule_events(tenant_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_schedule_events_resource_time 
  ON resource_schedule_events(resource_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_schedule_events_status 
  ON resource_schedule_events(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_schedule_events_related 
  ON resource_schedule_events(related_entity_type, related_entity_id) 
  WHERE related_entity_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Updated_at trigger
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_schedule_events_updated_at ON resource_schedule_events;
CREATE TRIGGER trg_schedule_events_updated_at
  BEFORE UPDATE ON resource_schedule_events
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) RLS Policies
-- ---------------------------------------------------------------------------

ALTER TABLE resource_schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_events_tenant_isolation ON resource_schedule_events;
CREATE POLICY schedule_events_tenant_isolation ON resource_schedule_events
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id = current_tenant_id()
  );

DROP POLICY IF EXISTS schedule_events_insert ON resource_schedule_events;
CREATE POLICY schedule_events_insert ON resource_schedule_events
  FOR INSERT
  WITH CHECK (
    is_service_mode()
    OR tenant_id = current_tenant_id()
  );

-- ---------------------------------------------------------------------------
-- 6) Helper function to snap time to 15-minute intervals
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION snap_to_15min(ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('hour', ts) + 
         (floor(EXTRACT(MINUTE FROM ts) / 15) * interval '15 minutes')
$$;

-- ---------------------------------------------------------------------------
-- 7) Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE resource_schedule_events IS 
  'Canonical 15-minute precision scheduling for all assets. Supports hold/maintenance/buffer blocks.';

COMMENT ON COLUMN resource_schedule_events.event_type IS 
  'booked = occupied by booking, hold = temporary reservation, maintenance = unavailable for service, buffer = cleaning/travel/prep time';

COMMENT ON COLUMN resource_schedule_events.related_entity_type IS 
  'Optional link to source entity: booking, project, service_run, work_request';

COMMENT ON FUNCTION snap_to_15min(TIMESTAMPTZ) IS 
  'Rounds a timestamp down to the nearest 15-minute boundary';

COMMIT;
