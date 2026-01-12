BEGIN;

-- ============ EXTEND CART ITEMS FOR TRANSPORT ============
-- Add transport-specific fields to cart items

ALTER TABLE cc_reservation_cart_items
  ADD COLUMN IF NOT EXISTS transport_request_id uuid REFERENCES cc_transport_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transport_type varchar CHECK (transport_type IN (
    'scheduled', 'on_demand', 'freight_only', 'charter'
  )),
  ADD COLUMN IF NOT EXISTS transport_details_json jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cart_items_transport 
  ON cc_reservation_cart_items(transport_request_id) 
  WHERE transport_request_id IS NOT NULL;

-- ============ TRANSPORT BOOKING CONFIRMATIONS ============
-- Track transport confirmations issued to guests

CREATE TABLE IF NOT EXISTS cc_transport_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  transport_request_id uuid NOT NULL REFERENCES cc_transport_requests(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES cc_reservations(id) ON DELETE SET NULL,
  cart_id uuid REFERENCES cc_reservation_carts(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES cc_trips(id) ON DELETE SET NULL,
  
  -- Confirmation details
  confirmation_number varchar(20) NOT NULL UNIQUE,
  qr_code_token varchar(30) UNIQUE,
  
  -- Guest info (denormalized for ticket)
  guest_name text NOT NULL,
  guest_email text,
  guest_phone text,
  
  -- Journey details (denormalized for ticket)
  sailing_date date NOT NULL,
  sailing_time time NOT NULL,
  operator_name text NOT NULL,
  vessel_name text,
  origin_name text NOT NULL,
  destination_name text NOT NULL,
  
  -- Manifest details
  passenger_count integer DEFAULT 1,
  passenger_names text[],
  kayak_count integer DEFAULT 0,
  bike_count integer DEFAULT 0,
  freight_description text,
  
  -- Pricing
  total_cad numeric(10,2),
  payment_status varchar DEFAULT 'pending',
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'checked_in', 'boarded', 'completed', 'cancelled', 'no_show'
  )),
  
  checked_in_at timestamptz,
  boarded_at timestamptz,
  
  -- Validity
  valid_from timestamptz DEFAULT now(),
  valid_to timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_confirmations_request ON cc_transport_confirmations(transport_request_id);
CREATE INDEX IF NOT EXISTS idx_transport_confirmations_trip ON cc_transport_confirmations(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_confirmations_number ON cc_transport_confirmations(confirmation_number);
CREATE INDEX IF NOT EXISTS idx_transport_confirmations_qr ON cc_transport_confirmations(qr_code_token) WHERE qr_code_token IS NOT NULL;

ALTER TABLE cc_transport_confirmations ENABLE ROW LEVEL SECURITY;

COMMIT;
