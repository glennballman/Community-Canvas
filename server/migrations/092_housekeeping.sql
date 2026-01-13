BEGIN;

-- ============ HOUSEKEEPING TASKS ============
-- Cleaning and turnover tasks for units

CREATE TABLE IF NOT EXISTS cc_housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES cc_properties(id),
  unit_id uuid NOT NULL REFERENCES cc_units(id),
  reservation_id uuid REFERENCES cc_pms_reservations(id) ON DELETE SET NULL,
  
  -- Identity
  task_number varchar(20) NOT NULL UNIQUE,
  -- Format: HK-YYMMDD-XXXX
  
  -- Task type
  task_type varchar NOT NULL CHECK (task_type IN (
    'checkout_clean',   -- Standard checkout cleaning
    'turnover',         -- Full turnover between guests
    'deep_clean',       -- Deep cleaning
    'inspection',       -- Inspection only
    'touch_up',         -- Quick touch-up
    'linen_change',     -- Linen change only
    'guest_request',    -- During-stay guest request
    'maintenance_prep', -- Prep for maintenance
    'seasonal'          -- Seasonal deep clean
  )),
  
  -- Priority
  priority varchar DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  
  -- Scheduling
  scheduled_date date NOT NULL,
  scheduled_time time,
  due_by timestamptz,
  
  -- For turnovers
  checkout_reservation_id uuid REFERENCES cc_pms_reservations(id),
  checkin_reservation_id uuid REFERENCES cc_pms_reservations(id),
  guest_arrival_time time,
  
  -- Assignment
  assigned_to text,
  assigned_team text,
  assigned_at timestamptz,
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Not started
    'assigned',       -- Assigned to cleaner
    'in_progress',    -- Being cleaned
    'completed',      -- Cleaning done
    'inspected',      -- Passed inspection
    'failed',         -- Failed inspection
    'cancelled',      -- Cancelled
    'skipped'         -- Skipped (no turnover needed)
  )),
  
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Time tracking
  estimated_minutes integer DEFAULT 60,
  actual_minutes integer,
  
  -- Checklist
  checklist_json jsonb DEFAULT '[]'::jsonb,
  -- [{item: 'Make beds', done: true}, {item: 'Clean bathroom', done: true}]
  
  -- Inspection
  inspected_by text,
  inspected_at timestamptz,
  inspection_notes text,
  inspection_photos jsonb DEFAULT '[]'::jsonb,
  
  -- Issues found
  issues_found text,
  maintenance_needed boolean DEFAULT false,
  maintenance_request_id uuid,
  
  -- Supplies
  supplies_used jsonb DEFAULT '[]'::jsonb,
  -- [{item: 'Toilet paper', qty: 4}, {item: 'Soap bars', qty: 2}]
  
  -- Notes
  notes text,
  special_instructions text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_housekeeping_property ON cc_housekeeping_tasks(property_id, scheduled_date);
CREATE INDEX idx_housekeeping_unit ON cc_housekeeping_tasks(unit_id, status);
CREATE INDEX idx_housekeeping_date ON cc_housekeeping_tasks(scheduled_date, status);
CREATE INDEX idx_housekeeping_assigned ON cc_housekeeping_tasks(assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_housekeeping_number ON cc_housekeeping_tasks(task_number);

ALTER TABLE cc_housekeeping_tasks ENABLE ROW LEVEL SECURITY;

-- ============ MAINTENANCE REQUESTS ============
-- Repair and maintenance work orders

CREATE TABLE IF NOT EXISTS cc_maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES cc_properties(id),
  unit_id uuid REFERENCES cc_units(id),
  location_id uuid REFERENCES cc_locations(id),
  
  -- Source
  reported_by_type varchar DEFAULT 'staff' CHECK (reported_by_type IN (
    'guest', 'staff', 'housekeeping', 'inspection', 'owner', 'system'
  )),
  reported_by_name text,
  reported_by_contact text,
  reservation_id uuid REFERENCES cc_pms_reservations(id),
  housekeeping_task_id uuid REFERENCES cc_housekeeping_tasks(id),
  
  -- Identity
  request_number varchar(20) NOT NULL UNIQUE,
  -- Format: MR-YYMMDD-XXXX
  
  -- Category
  category varchar NOT NULL CHECK (category IN (
    'plumbing',       -- Plumbing issues
    'electrical',     -- Electrical issues
    'hvac',           -- Heating/cooling
    'appliance',      -- Appliance repair
    'structural',     -- Building structure
    'furniture',      -- Furniture repair
    'exterior',       -- Exterior/grounds
    'safety',         -- Safety concern
    'pest',           -- Pest control
    'general',        -- General maintenance
    'preventive'      -- Preventive maintenance
  )),
  
  -- Priority
  priority varchar DEFAULT 'normal' CHECK (priority IN (
    'low',            -- Can wait
    'normal',         -- Standard timeframe
    'high',           -- Needs attention soon
    'urgent',         -- Needs immediate attention
    'emergency'       -- Safety/habitability emergency
  )),
  
  -- Description
  title text NOT NULL,
  description text,
  location_detail text,  -- "Master bathroom sink"
  
  -- Photos
  photos_json jsonb DEFAULT '[]'::jsonb,
  
  -- Impact
  affects_habitability boolean DEFAULT false,
  unit_blocked boolean DEFAULT false,
  blocked_until date,
  
  -- Assignment
  assigned_to text,
  assigned_vendor text,
  assigned_at timestamptz,
  
  -- Scheduling
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,
  
  -- Status
  status varchar DEFAULT 'reported' CHECK (status IN (
    'reported',       -- Just reported
    'triaged',        -- Reviewed and prioritized
    'assigned',       -- Assigned to tech/vendor
    'scheduled',      -- Work scheduled
    'in_progress',    -- Work underway
    'parts_ordered',  -- Waiting for parts
    'on_hold',        -- On hold
    'completed',      -- Work completed
    'verified',       -- Verified fixed
    'cancelled'       -- Cancelled
  )),
  
  -- Timeline
  triaged_at timestamptz,
  work_started_at timestamptz,
  work_completed_at timestamptz,
  verified_at timestamptz,
  
  -- Resolution
  resolution_notes text,
  work_performed text,
  parts_used jsonb DEFAULT '[]'::jsonb,
  
  -- Costs
  labor_cost_cad numeric(10,2) DEFAULT 0,
  parts_cost_cad numeric(10,2) DEFAULT 0,
  vendor_cost_cad numeric(10,2) DEFAULT 0,
  total_cost_cad numeric(10,2) DEFAULT 0,
  
  -- Billing
  billable_to varchar CHECK (billable_to IN (
    'property', 'owner', 'guest', 'warranty', 'insurance'
  )),
  invoice_number text,
  
  -- Recurrence
  is_recurring boolean DEFAULT false,
  recurrence_schedule text,
  parent_request_id uuid REFERENCES cc_maintenance_requests(id),
  
  -- Notes
  internal_notes text,
  guest_visible_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_maintenance_property ON cc_maintenance_requests(property_id, status);
CREATE INDEX idx_maintenance_unit ON cc_maintenance_requests(unit_id, status) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_maintenance_category ON cc_maintenance_requests(category, priority);
CREATE INDEX idx_maintenance_status ON cc_maintenance_requests(status, priority);
CREATE INDEX idx_maintenance_assigned ON cc_maintenance_requests(assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_maintenance_number ON cc_maintenance_requests(request_number);

ALTER TABLE cc_maintenance_requests ENABLE ROW LEVEL SECURITY;

-- ============ HOUSEKEEPING CHECKLISTS ============
-- Reusable checklist templates

CREATE TABLE IF NOT EXISTS cc_housekeeping_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  property_id uuid REFERENCES cc_properties(id) ON DELETE CASCADE,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  
  -- What it applies to
  task_type varchar NOT NULL,
  unit_type varchar,  -- Optional: only for specific unit types
  
  -- Checklist items
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{item: 'Strip beds', category: 'Bedroom', order: 1, required: true},
  --  {item: 'Clean toilet', category: 'Bathroom', order: 10, required: true}]
  
  -- Time estimate
  estimated_minutes integer DEFAULT 60,
  
  -- Status
  status varchar DEFAULT 'active',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(property_id, code)
);

CREATE INDEX idx_checklists_property ON cc_housekeeping_checklists(property_id) WHERE property_id IS NOT NULL;

ALTER TABLE cc_housekeeping_checklists ENABLE ROW LEVEL SECURITY;

-- ============ SEED DEFAULT CHECKLISTS ============

DO $$
DECLARE
  v_portal_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  IF v_portal_id IS NOT NULL THEN
    -- Standard turnover checklist
    INSERT INTO cc_housekeeping_checklists (
      portal_id, name, code, task_type, estimated_minutes, items_json
    ) VALUES (
      v_portal_id, 'Standard Turnover', 'STD-TURN', 'turnover', 90,
      '[
        {"item": "Strip all beds", "category": "Bedroom", "order": 1, "required": true},
        {"item": "Make beds with fresh linens", "category": "Bedroom", "order": 2, "required": true},
        {"item": "Dust all surfaces", "category": "Bedroom", "order": 3, "required": true},
        {"item": "Vacuum/mop floors", "category": "Bedroom", "order": 4, "required": true},
        {"item": "Clean toilet", "category": "Bathroom", "order": 10, "required": true},
        {"item": "Clean shower/tub", "category": "Bathroom", "order": 11, "required": true},
        {"item": "Clean sink and mirror", "category": "Bathroom", "order": 12, "required": true},
        {"item": "Replace towels", "category": "Bathroom", "order": 13, "required": true},
        {"item": "Restock toiletries", "category": "Bathroom", "order": 14, "required": true},
        {"item": "Clean counters", "category": "Kitchen", "order": 20, "required": true},
        {"item": "Clean appliances", "category": "Kitchen", "order": 21, "required": true},
        {"item": "Check fridge - remove old items", "category": "Kitchen", "order": 22, "required": true},
        {"item": "Run dishwasher if needed", "category": "Kitchen", "order": 23, "required": false},
        {"item": "Take out trash", "category": "General", "order": 30, "required": true},
        {"item": "Check all lights working", "category": "General", "order": 31, "required": true},
        {"item": "Lock windows", "category": "General", "order": 32, "required": true},
        {"item": "Set thermostat", "category": "General", "order": 33, "required": true}
      ]'::jsonb
    ) ON CONFLICT (property_id, code) DO NOTHING;
    
    -- Quick touch-up checklist
    INSERT INTO cc_housekeeping_checklists (
      portal_id, name, code, task_type, estimated_minutes, items_json
    ) VALUES (
      v_portal_id, 'Quick Touch-Up', 'TOUCH-UP', 'touch_up', 30,
      '[
        {"item": "Make beds", "category": "Bedroom", "order": 1, "required": true},
        {"item": "Replace used towels", "category": "Bathroom", "order": 10, "required": true},
        {"item": "Wipe bathroom surfaces", "category": "Bathroom", "order": 11, "required": true},
        {"item": "Empty trash", "category": "General", "order": 20, "required": true},
        {"item": "Quick vacuum high-traffic areas", "category": "General", "order": 21, "required": false}
      ]'::jsonb
    ) ON CONFLICT (property_id, code) DO NOTHING;
    
    -- Campsite turnover
    INSERT INTO cc_housekeeping_checklists (
      portal_id, name, code, task_type, unit_type, estimated_minutes, items_json
    ) VALUES (
      v_portal_id, 'Campsite Turnover', 'CAMP-TURN', 'turnover', 'tent_site', 20,
      '[
        {"item": "Remove any trash", "category": "Site", "order": 1, "required": true},
        {"item": "Check fire pit - remove ashes", "category": "Site", "order": 2, "required": true},
        {"item": "Inspect picnic table", "category": "Site", "order": 3, "required": true},
        {"item": "Check for damage", "category": "Site", "order": 4, "required": true},
        {"item": "Rake/tidy site", "category": "Site", "order": 5, "required": false}
      ]'::jsonb
    ) ON CONFLICT (property_id, code) DO NOTHING;
  END IF;
END $$;

COMMIT;
