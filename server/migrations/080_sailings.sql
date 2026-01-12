BEGIN;

-- ============ SAILING SCHEDULES ============
-- Recurring patterns for scheduled services (Lady Rose)

CREATE TABLE IF NOT EXISTS cc_sailing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES cc_transport_operators(id) ON DELETE CASCADE,
  
  -- Identity
  route_name text NOT NULL,
  route_code varchar(20),
  
  -- Route definition
  origin_location_id uuid REFERENCES cc_locations(id),
  destination_location_id uuid REFERENCES cc_locations(id),
  
  -- Recurrence
  days_of_week integer[] NOT NULL, -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  departure_time time NOT NULL,
  
  -- Seasonal availability
  seasonal_json jsonb DEFAULT '{}'::jsonb,
  
  -- Pricing
  base_fare_cad numeric(10,2),
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'seasonal', 'suspended')),
  effective_from date,
  effective_to date,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sailing_schedules_operator ON cc_sailing_schedules(operator_id, status);

ALTER TABLE cc_sailing_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_sailing_schedules_access ON cc_sailing_schedules
  FOR ALL USING (true);

-- ============ SAILINGS ============
-- Individual sailing instances (generated from schedule or on-demand)

CREATE TABLE IF NOT EXISTS cc_sailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  schedule_id uuid REFERENCES cc_sailing_schedules(id) ON DELETE SET NULL,
  operator_id uuid NOT NULL REFERENCES cc_transport_operators(id),
  asset_id uuid REFERENCES cc_transport_assets(id),
  
  -- Identity
  sailing_number varchar(30),
  
  -- Timing
  sailing_date date NOT NULL,
  scheduled_departure time NOT NULL,
  scheduled_arrival time,
  
  actual_departure_at timestamptz,
  actual_arrival_at timestamptz,
  
  -- Route
  origin_location_id uuid REFERENCES cc_locations(id),
  destination_location_id uuid REFERENCES cc_locations(id),
  
  -- Capacity tracking
  capacity_json jsonb DEFAULT '{}'::jsonb,
  
  -- State machine
  status varchar NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'boarding', 'departed', 'in_transit', 
    'arrived', 'completed', 'cancelled', 'delayed'
  )),
  
  -- Delay/cancel info
  delay_minutes integer,
  delay_reason text,
  cancellation_reason text,
  cancelled_at timestamptz,
  
  -- Weather
  weather_json jsonb DEFAULT '{}'::jsonb,
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(operator_id, sailing_number)
);

CREATE INDEX IF NOT EXISTS idx_sailings_date ON cc_sailings(sailing_date, status);
CREATE INDEX IF NOT EXISTS idx_sailings_operator ON cc_sailings(operator_id, sailing_date);
CREATE INDEX IF NOT EXISTS idx_sailings_schedule ON cc_sailings(schedule_id) WHERE schedule_id IS NOT NULL;

ALTER TABLE cc_sailings ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_sailings_access ON cc_sailings
  FOR ALL USING (true);

-- ============ PORT CALLS ============
-- Intermediate stops on a sailing

CREATE TABLE IF NOT EXISTS cc_port_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sailing_id uuid NOT NULL REFERENCES cc_sailings(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES cc_locations(id),
  
  -- Sequence
  stop_sequence integer NOT NULL,
  
  -- Timing
  scheduled_arrival time,
  scheduled_departure time,
  dwell_minutes integer DEFAULT 15,
  
  actual_arrival_at timestamptz,
  actual_departure_at timestamptz,
  
  -- What happens here
  operations_json jsonb DEFAULT '{}'::jsonb,
  
  -- Status
  status varchar DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'approaching', 'arrived', 'boarding', 'departed', 'skipped'
  )),
  
  skip_reason text,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_port_calls_sailing ON cc_port_calls(sailing_id, stop_sequence);
CREATE INDEX IF NOT EXISTS idx_port_calls_location ON cc_port_calls(location_id);

ALTER TABLE cc_port_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_port_calls_access ON cc_port_calls
  FOR ALL USING (true);

-- ============ SEED LADY ROSE SCHEDULES ============

DO $$
DECLARE
  v_lrms_id uuid;
  v_pahq_id uuid;
  v_wgd_id uuid;
  v_sec_id uuid;
  v_schedule_id uuid;
  v_sailing_id uuid;
BEGIN
  SELECT id INTO v_lrms_id FROM cc_transport_operators WHERE code = 'LRMS' LIMIT 1;
  
  SELECT id INTO v_pahq_id FROM cc_locations WHERE code = 'PAHQ' LIMIT 1;
  SELECT id INTO v_wgd_id FROM cc_locations WHERE code = 'WGD' LIMIT 1;
  SELECT id INTO v_sec_id FROM cc_locations WHERE code = 'SEC' LIMIT 1;
  
  IF v_lrms_id IS NOT NULL AND v_pahq_id IS NOT NULL THEN
    -- Summer schedule: Port Alberni to Bamfield (daily Jun-Sep)
    INSERT INTO cc_sailing_schedules (
      operator_id, route_name, route_code,
      origin_location_id, destination_location_id,
      days_of_week, departure_time,
      seasonal_json, base_fare_cad, status
    ) VALUES (
      v_lrms_id, 'Port Alberni - Bamfield (Summer)', 'PA-BAM-S',
      v_pahq_id, v_wgd_id,
      ARRAY[0,1,2,3,4,5,6], '08:00',
      '{"active_months": [6,7,8,9], "description": "Daily summer service"}'::jsonb,
      45.00, 'active'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_schedule_id;
    
    -- Shoulder season: Tue, Thu, Sat only
    INSERT INTO cc_sailing_schedules (
      operator_id, route_name, route_code,
      origin_location_id, destination_location_id,
      days_of_week, departure_time,
      seasonal_json, base_fare_cad, status
    ) VALUES (
      v_lrms_id, 'Port Alberni - Bamfield (Shoulder)', 'PA-BAM-SH',
      v_pahq_id, v_wgd_id,
      ARRAY[2,4,6], '08:00',
      '{"active_months": [5,10], "description": "Shoulder season - Tue/Thu/Sat"}'::jsonb,
      45.00, 'seasonal'
    )
    ON CONFLICT DO NOTHING;
    
    -- Winter: Tue, Sat only
    INSERT INTO cc_sailing_schedules (
      operator_id, route_name, route_code,
      origin_location_id, destination_location_id,
      days_of_week, departure_time,
      seasonal_json, base_fare_cad, status
    ) VALUES (
      v_lrms_id, 'Port Alberni - Bamfield (Winter)', 'PA-BAM-W',
      v_pahq_id, v_wgd_id,
      ARRAY[2,6], '08:00',
      '{"active_months": [11,12,1,2,3,4], "description": "Winter service - Tue/Sat only"}'::jsonb,
      45.00, 'seasonal'
    )
    ON CONFLICT DO NOTHING;
    
    -- Create a sample sailing for tomorrow
    INSERT INTO cc_sailings (
      schedule_id, operator_id,
      sailing_number, sailing_date, scheduled_departure,
      origin_location_id, destination_location_id,
      capacity_json, status
    ) VALUES (
      v_schedule_id, v_lrms_id,
      'LRMS-' || to_char(CURRENT_DATE + 1, 'YYYY-MM-DD') || '-0800',
      CURRENT_DATE + 1, '08:00',
      v_pahq_id, v_wgd_id,
      '{
        "passengers": {"total": 200, "booked": 45, "available": 155},
        "freight_lbs": {"total": 20000, "booked": 3500, "available": 16500},
        "kayaks": {"total": 40, "booked": 8, "available": 32}
      }'::jsonb,
      'scheduled'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_sailing_id;
    
    -- Add port calls for this sailing
    IF v_sailing_id IS NOT NULL AND v_sec_id IS NOT NULL THEN
      INSERT INTO cc_port_calls (
        sailing_id, location_id, stop_sequence,
        scheduled_arrival, scheduled_departure, dwell_minutes,
        operations_json
      ) VALUES (
        v_sailing_id, v_sec_id, 1,
        '11:00', '11:30', 30,
        '{"kayak_drop": true, "broken_group_staging": true}'::jsonb
      );
      
      INSERT INTO cc_port_calls (
        sailing_id, location_id, stop_sequence,
        scheduled_arrival, dwell_minutes,
        operations_json
      ) VALUES (
        v_sailing_id, v_wgd_id, 2,
        '12:30', 60,
        '{"final_stop": true, "freight_unload": true}'::jsonb
      );
    END IF;
    
  END IF;
END $$;

COMMIT;
