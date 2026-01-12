BEGIN;

-- ============ TRANSPORT ALERTS ============
-- Delays, cancellations, weather holds, and operational notices

CREATE TABLE IF NOT EXISTS cc_transport_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES cc_transport_operators(id) ON DELETE CASCADE,
  sailing_id uuid REFERENCES cc_sailings(id) ON DELETE CASCADE,
  location_id uuid REFERENCES cc_locations(id) ON DELETE SET NULL,
  
  -- Alert type
  alert_type varchar NOT NULL CHECK (alert_type IN (
    'delay',           -- Sailing delayed
    'cancellation',    -- Sailing cancelled
    'weather_hold',    -- Weather-related hold
    'schedule_change', -- Schedule modification
    'capacity',        -- Capacity warning (almost full)
    'operational',     -- General operational notice
    'emergency',       -- Emergency situation
    'maintenance'      -- Vessel/dock maintenance
  )),
  
  -- Severity
  severity varchar NOT NULL DEFAULT 'info' CHECK (severity IN (
    'info',      -- Informational
    'warning',   -- Attention needed
    'critical',  -- Significant impact
    'emergency'  -- Immediate action required
  )),
  
  -- Content
  title varchar NOT NULL,
  message text NOT NULL,
  
  -- Impact
  affected_date date,
  affected_sailings uuid[], -- Multiple sailings can be affected
  delay_minutes integer,
  
  -- Actions
  action_required boolean DEFAULT false,
  action_url text,
  action_label varchar,
  
  -- Source
  source varchar DEFAULT 'operator' CHECK (source IN (
    'operator', 'system', 'weather_service', 'coast_guard', 'port_authority'
  )),
  source_ref varchar,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'acknowledged', 'resolved', 'expired'
  )),
  
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz,
  
  -- Notification tracking
  notifications_sent boolean DEFAULT false,
  notifications_sent_at timestamptz,
  affected_request_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_alerts_sailing ON cc_transport_alerts(sailing_id) WHERE sailing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_alerts_operator ON cc_transport_alerts(operator_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_alerts_active ON cc_transport_alerts(status, severity) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_transport_alerts_date ON cc_transport_alerts(affected_date) WHERE affected_date IS NOT NULL;

ALTER TABLE cc_transport_alerts ENABLE ROW LEVEL SECURITY;

COMMIT;
