BEGIN;

-- ============ PROOF OF HANDLING ============
-- Documented events in freight chain of custody

CREATE TABLE IF NOT EXISTS cc_proof_of_handling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  manifest_id uuid REFERENCES cc_freight_manifests(id) ON DELETE CASCADE,
  item_id uuid REFERENCES cc_freight_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES cc_locations(id) ON DELETE SET NULL,
  
  -- Event type
  handling_type varchar NOT NULL CHECK (handling_type IN (
    'pickup',           -- Picked up from shipper
    'received',         -- Received at dock/warehouse
    'loaded',           -- Loaded onto vessel
    'in_transit',       -- Departed on vessel
    'offloaded',        -- Removed from vessel
    'warehoused',       -- Stored in warehouse
    'out_for_delivery', -- Left for final delivery
    'delivered',        -- Delivered to consignee
    'attempted',        -- Delivery attempted
    'returned',         -- Returned to shipper
    'damaged',          -- Damage documented
    'inspected',        -- Inspection event
    'held',             -- Held for issues
    'released'          -- Released from hold
  )),
  
  -- When & where
  handled_at timestamptz NOT NULL DEFAULT now(),
  location_name text,
  location_description text,
  
  -- Who
  handler_name text NOT NULL,
  handler_role varchar CHECK (handler_role IN (
    'shipper', 'driver', 'dock_worker', 'deckhand', 
    'captain', 'warehouse', 'delivery', 'consignee', 'inspector'
  )),
  handler_company text,
  
  -- Recipient (for delivery events)
  recipient_name text,
  recipient_signature text,
  recipient_id_type varchar,
  recipient_id_number varchar,
  
  -- Condition assessment
  condition varchar DEFAULT 'good' CHECK (condition IN (
    'good', 'fair', 'damaged', 'wet', 'opened', 'missing_items'
  )),
  condition_notes text,
  
  -- Weight verification
  verified_weight_lbs numeric(10,2),
  weight_variance_lbs numeric(10,2),
  
  -- Media
  photo_urls text[],
  document_urls text[],
  
  -- Notes
  notes text,
  internal_notes text,
  
  -- Geolocation (optional)
  lat numeric(9,6),
  lon numeric(9,6),
  
  -- Device info
  device_id varchar,
  app_version varchar,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_poh_manifest ON cc_proof_of_handling(manifest_id, handled_at);
CREATE INDEX idx_poh_item ON cc_proof_of_handling(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_poh_type ON cc_proof_of_handling(handling_type, handled_at);
CREATE INDEX idx_poh_location ON cc_proof_of_handling(location_id) WHERE location_id IS NOT NULL;

ALTER TABLE cc_proof_of_handling ENABLE ROW LEVEL SECURITY;

-- ============ HANDLING EXCEPTIONS ============
-- Issues/problems that need resolution

CREATE TABLE IF NOT EXISTS cc_handling_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  manifest_id uuid REFERENCES cc_freight_manifests(id) ON DELETE CASCADE,
  item_id uuid REFERENCES cc_freight_items(id) ON DELETE SET NULL,
  proof_of_handling_id uuid REFERENCES cc_proof_of_handling(id) ON DELETE SET NULL,
  
  -- Exception type
  exception_type varchar NOT NULL CHECK (exception_type IN (
    'damage',           -- Item damaged
    'shortage',         -- Missing items/quantity
    'overage',          -- Extra items received
    'wrong_item',       -- Wrong item delivered
    'refused',          -- Delivery refused
    'address_issue',    -- Can't locate/access
    'weather_delay',    -- Weather-related delay
    'mechanical',       -- Vehicle/vessel issue
    'documentation',    -- Paperwork problem
    'customs',          -- Customs/inspection hold
    'hazmat',           -- Hazmat issue
    'other'
  )),
  
  -- Severity
  severity varchar DEFAULT 'medium' CHECK (severity IN (
    'low', 'medium', 'high', 'critical'
  )),
  
  -- Details
  description text NOT NULL,
  
  -- Resolution
  status varchar DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'pending_action', 'resolved', 'closed'
  )),
  
  resolution_type varchar CHECK (resolution_type IN (
    'replaced', 'refunded', 'credited', 'repaired', 
    'accepted_as_is', 'insurance_claim', 'no_action', 'other'
  )),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by text,
  
  -- Financial impact
  claimed_amount_cad numeric(10,2),
  approved_amount_cad numeric(10,2),
  
  -- Media
  photo_urls text[],
  
  -- Notifications
  shipper_notified boolean DEFAULT false,
  consignee_notified boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_exceptions_manifest ON cc_handling_exceptions(manifest_id, status);
CREATE INDEX idx_exceptions_status ON cc_handling_exceptions(status, severity);

ALTER TABLE cc_handling_exceptions ENABLE ROW LEVEL SECURITY;

COMMIT;
