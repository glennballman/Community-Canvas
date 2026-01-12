BEGIN;

-- ============ TRANSPORT REQUESTS ============
-- Bookings for passengers, freight, kayaks on sailings or on-demand transport

CREATE TABLE IF NOT EXISTS cc_transport_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES cc_transport_operators(id) ON DELETE SET NULL,
  sailing_id uuid REFERENCES cc_sailings(id) ON DELETE SET NULL,
  
  -- Cart integration
  cart_id uuid REFERENCES cc_reservation_carts(id) ON DELETE SET NULL,
  cart_item_id uuid REFERENCES cc_reservation_cart_items(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES cc_trips(id) ON DELETE SET NULL,
  
  -- Identity
  request_number varchar(30) NOT NULL UNIQUE,
  -- Format: TR-YYMMDD-XXXX (e.g., TR-260115-A7K9)
  
  -- Request type
  request_type varchar NOT NULL CHECK (request_type IN (
    'scheduled',    -- Booking on a scheduled sailing
    'on_demand',    -- Water taxi / charter request
    'freight_only', -- Freight without passengers
    'charter'       -- Full vessel charter
  )),
  
  -- Route
  origin_location_id uuid REFERENCES cc_locations(id),
  destination_location_id uuid REFERENCES cc_locations(id),
  
  -- Timing
  requested_date date NOT NULL,
  requested_time time,
  flexible_window_minutes integer DEFAULT 0,
  
  -- What's being transported
  passenger_count integer DEFAULT 0,
  passenger_names text[], -- For manifest
  
  freight_description text,
  freight_weight_lbs integer DEFAULT 0,
  freight_pieces integer DEFAULT 0,
  freight_special_handling text[],
  -- ['fragile', 'refrigerated', 'hazmat', 'oversized']
  
  kayak_count integer DEFAULT 0,
  bike_count integer DEFAULT 0,
  
  -- Contact
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  
  -- Party needs (from trip if linked)
  needs_json jsonb DEFAULT '{}'::jsonb,
  -- {wheelchair: true, dietary: ['vegetarian'], pets: [{type: 'dog'}]}
  
  -- Pricing
  quoted_fare_cad numeric(10,2),
  freight_fee_cad numeric(10,2),
  kayak_fee_cad numeric(10,2),
  total_cad numeric(10,2),
  deposit_paid_cad numeric(10,2) DEFAULT 0,
  payment_status varchar DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'deposit_paid', 'paid', 'refunded', 'waived'
  )),
  
  -- Status
  status varchar NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',      -- Initial request
    'pending',        -- Awaiting operator confirmation
    'confirmed',      -- Operator confirmed
    'waitlisted',     -- On waitlist for full sailing
    'checked_in',     -- Passenger checked in
    'boarded',        -- On the vessel
    'completed',      -- Trip completed
    'cancelled',      -- Cancelled by requester
    'rejected',       -- Rejected by operator
    'no_show'         -- Didn't show up
  )),
  
  confirmed_at timestamptz,
  confirmed_by varchar,
  checked_in_at timestamptz,
  boarded_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  
  -- Operator notes
  operator_notes text,
  
  -- Special requests
  special_requests text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_requests_sailing ON cc_transport_requests(sailing_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_date ON cc_transport_requests(requested_date, status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_operator ON cc_transport_requests(operator_id, requested_date);
CREATE INDEX IF NOT EXISTS idx_transport_requests_trip ON cc_transport_requests(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_requests_cart ON cc_transport_requests(cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_requests_number ON cc_transport_requests(request_number);

ALTER TABLE cc_transport_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_transport_requests_policy ON cc_transport_requests
  FOR ALL USING (true);

COMMIT;
