BEGIN;

-- ============ UNIT AVAILABILITY CALENDAR ============
-- Day-by-day availability and pricing overrides

CREATE TABLE IF NOT EXISTS cc_unit_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES cc_units(id) ON DELETE CASCADE,
  
  -- Date
  calendar_date date NOT NULL,
  
  -- Availability
  availability varchar DEFAULT 'available' CHECK (availability IN (
    'available',      -- Open for booking
    'booked',         -- Has a reservation
    'blocked',        -- Manually blocked
    'owner_use',      -- Owner using
    'maintenance',    -- Under maintenance
    'seasonal_close'  -- Seasonally closed
  )),
  
  -- Pricing override (if different from unit default)
  rate_cad numeric(10,2),
  min_stay_nights integer,
  
  -- Source
  source varchar DEFAULT 'manual' CHECK (source IN (
    'manual',         -- Manually set
    'reservation',    -- From PMS reservation
    'ical_import',    -- From iCal sync
    'seasonal_rule',  -- From seasonal rule
    'dynamic'         -- Dynamic pricing
  )),
  source_id uuid,     -- Reference to reservation, ical event, etc.
  source_ref text,    -- External reference (iCal UID, etc.)
  
  -- Block info
  block_reason text,
  blocked_by text,
  blocked_at timestamptz,
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(unit_id, calendar_date)
);

CREATE INDEX IF NOT EXISTS idx_unit_calendar_unit_date ON cc_unit_calendar(unit_id, calendar_date);
CREATE INDEX IF NOT EXISTS idx_unit_calendar_availability ON cc_unit_calendar(calendar_date, availability);
CREATE INDEX IF NOT EXISTS idx_unit_calendar_source ON cc_unit_calendar(source_id) WHERE source_id IS NOT NULL;

ALTER TABLE cc_unit_calendar ENABLE ROW LEVEL SECURITY;

-- ============ SEASONAL PRICING RULES ============
-- Reusable pricing rules for date ranges

CREATE TABLE IF NOT EXISTS cc_seasonal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links (can apply to property or specific unit)
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid REFERENCES cc_properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES cc_units(id) ON DELETE CASCADE,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  
  -- Date range (can be annual pattern or specific dates)
  start_date date,      -- Specific date or NULL for annual
  end_date date,
  start_month integer,  -- 1-12 for annual pattern
  start_day integer,    -- 1-31
  end_month integer,
  end_day integer,
  
  -- Pricing
  rate_type varchar DEFAULT 'fixed' CHECK (rate_type IN (
    'fixed',          -- Fixed rate
    'multiplier',     -- Multiply base rate
    'adjustment'      -- Add/subtract from base
  )),
  rate_value numeric(10,2),  -- The rate, multiplier, or adjustment amount
  
  -- Stay rules
  min_stay_nights integer,
  max_stay_nights integer,
  
  -- Booking rules
  booking_window_days integer,  -- How far in advance can book
  no_check_in_days integer[],   -- Days of week no check-in (0=Sun, 6=Sat)
  no_check_out_days integer[],
  
  -- Priority (higher = takes precedence)
  priority integer DEFAULT 0,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seasonal_rules_property ON cc_seasonal_rules(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seasonal_rules_unit ON cc_seasonal_rules(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seasonal_rules_dates ON cc_seasonal_rules(start_month, end_month) WHERE start_month IS NOT NULL;

ALTER TABLE cc_seasonal_rules ENABLE ROW LEVEL SECURITY;

-- ============ ICAL SYNC LOG ============
-- Track iCal imports/exports

CREATE TABLE IF NOT EXISTS cc_ical_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES cc_units(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_direction varchar NOT NULL CHECK (sync_direction IN ('import', 'export')),
  sync_url text,
  
  -- Results
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed'
  )),
  
  events_found integer DEFAULT 0,
  events_created integer DEFAULT 0,
  events_updated integer DEFAULT 0,
  events_removed integer DEFAULT 0,
  
  -- Error tracking
  error_message text,
  error_details jsonb,
  
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ical_sync_unit ON cc_ical_sync_log(unit_id, started_at DESC);

ALTER TABLE cc_ical_sync_log ENABLE ROW LEVEL SECURITY;

-- ============ SEED SEASONAL RULES FOR BAMFIELD ============

DO $$
DECLARE
  v_portal_id uuid;
  v_lodge_id uuid;
  v_camp_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  SELECT id INTO v_lodge_id FROM cc_properties WHERE code = 'BFLD-LODGE' LIMIT 1;
  SELECT id INTO v_camp_id FROM cc_properties WHERE code = 'PACH-CAMP' LIMIT 1;
  
  -- Peak Summer for Lodge (July-August)
  IF v_lodge_id IS NOT NULL THEN
    INSERT INTO cc_seasonal_rules (
      portal_id, property_id, name, code,
      start_month, start_day, end_month, end_day,
      rate_type, rate_value, min_stay_nights, priority, status
    ) VALUES (
      v_portal_id, v_lodge_id, 'Peak Summer', 'PEAK-SUM',
      7, 1, 8, 31,
      'multiplier', 1.5, 2, 10, 'active'
    ) ON CONFLICT DO NOTHING;
    
    -- Shoulder Season (May-June, September)
    INSERT INTO cc_seasonal_rules (
      portal_id, property_id, name, code,
      start_month, start_day, end_month, end_day,
      rate_type, rate_value, min_stay_nights, priority, status
    ) VALUES (
      v_portal_id, v_lodge_id, 'Shoulder Season', 'SHOULDER',
      5, 1, 6, 30,
      'multiplier', 1.2, 1, 5, 'active'
    ) ON CONFLICT DO NOTHING;
    
    -- Winter Low Season (November-March)
    INSERT INTO cc_seasonal_rules (
      portal_id, property_id, name, code,
      start_month, start_day, end_month, end_day,
      rate_type, rate_value, min_stay_nights, priority, status
    ) VALUES (
      v_portal_id, v_lodge_id, 'Winter Value', 'WINTER',
      11, 1, 3, 31,
      'multiplier', 0.8, 1, 5, 'active'
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Holiday Premium
  IF v_portal_id IS NOT NULL THEN
    INSERT INTO cc_seasonal_rules (
      portal_id, name, code,
      start_date, end_date,
      rate_type, rate_value, min_stay_nights, priority, status
    ) VALUES (
      v_portal_id, 'BC Day Weekend', 'BCDAY',
      '2026-08-01', '2026-08-03',
      'multiplier', 1.75, 3, 20, 'active'
    ) ON CONFLICT DO NOTHING;
    
    INSERT INTO cc_seasonal_rules (
      portal_id, name, code,
      start_date, end_date,
      rate_type, rate_value, min_stay_nights, priority, status
    ) VALUES (
      v_portal_id, 'Labour Day Weekend', 'LABOUR',
      '2026-09-05', '2026-09-07',
      'multiplier', 1.5, 2, 20, 'active'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMIT;
