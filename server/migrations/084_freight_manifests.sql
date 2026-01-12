BEGIN;

-- ============ FREIGHT MANIFESTS ============
-- Container for a sailing's freight cargo

CREATE TABLE IF NOT EXISTS cc_freight_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  operator_id uuid NOT NULL REFERENCES cc_transport_operators(id),
  sailing_id uuid REFERENCES cc_sailings(id) ON DELETE SET NULL,
  
  -- Identity
  manifest_number varchar(30) NOT NULL UNIQUE,
  -- Format: FRT-YYMMDD-XXXX (e.g., FRT-260115-A7K9)
  
  -- Route
  origin_location_id uuid REFERENCES cc_locations(id),
  destination_location_id uuid REFERENCES cc_locations(id),
  
  -- Timing
  manifest_date date NOT NULL,
  scheduled_departure time,
  
  -- Totals (calculated from items)
  total_items integer DEFAULT 0,
  total_weight_lbs numeric(10,2) DEFAULT 0,
  total_value_cad numeric(10,2) DEFAULT 0,
  
  -- Status
  status varchar DEFAULT 'draft' CHECK (status IN (
    'draft',        -- Being assembled
    'submitted',    -- Submitted for sailing
    'accepted',     -- Accepted by operator
    'loaded',       -- Loaded on vessel
    'in_transit',   -- On the water
    'arrived',      -- At destination
    'delivered',    -- All items delivered
    'partial',      -- Some items delivered
    'held',         -- Held for inspection/issues
    'cancelled'     -- Cancelled
  )),
  
  loaded_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  
  -- Shipper info
  shipper_name text,
  shipper_phone text,
  shipper_email text,
  shipper_business text,
  
  -- Consignee info (recipient)
  consignee_name text,
  consignee_phone text,
  consignee_email text,
  consignee_business text,
  consignee_location_id uuid REFERENCES cc_locations(id),
  
  -- Billing
  billing_method varchar DEFAULT 'prepaid' CHECK (billing_method IN (
    'prepaid', 'collect', 'third_party', 'account'
  )),
  billing_account_id uuid,
  freight_charges_cad numeric(10,2) DEFAULT 0,
  payment_status varchar DEFAULT 'pending',
  
  -- Notes
  special_instructions text,
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freight_manifests_sailing ON cc_freight_manifests(sailing_id) WHERE sailing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_freight_manifests_date ON cc_freight_manifests(manifest_date, status);
CREATE INDEX IF NOT EXISTS idx_freight_manifests_operator ON cc_freight_manifests(operator_id, status);
CREATE INDEX IF NOT EXISTS idx_freight_manifests_number ON cc_freight_manifests(manifest_number);

ALTER TABLE cc_freight_manifests ENABLE ROW LEVEL SECURITY;

-- ============ FREIGHT ITEMS ============
-- Individual items/packages on a manifest

CREATE TABLE IF NOT EXISTS cc_freight_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid NOT NULL REFERENCES cc_freight_manifests(id) ON DELETE CASCADE,
  
  -- Identity
  item_number integer NOT NULL, -- Sequence on manifest (1, 2, 3...)
  tracking_code varchar(20), -- Optional barcode/tracking
  
  -- Description
  description text NOT NULL,
  category varchar CHECK (category IN (
    'general',       -- General cargo
    'construction',  -- Building materials
    'groceries',     -- Food/supplies
    'equipment',     -- Tools/machinery
    'household',     -- Personal/household items
    'medical',       -- Medical supplies
    'hazmat',        -- Hazardous materials
    'refrigerated',  -- Cold chain
    'livestock',     -- Animals
    'vehicle',       -- Vehicles/ATVs
    'other'
  )),
  
  -- Dimensions
  quantity integer DEFAULT 1,
  weight_lbs numeric(10,2),
  length_in numeric(10,2),
  width_in numeric(10,2),
  height_in numeric(10,2),
  
  -- Value & Insurance
  declared_value_cad numeric(10,2),
  insured boolean DEFAULT false,
  insurance_value_cad numeric(10,2),
  
  -- Special handling
  special_handling text[],
  -- ['fragile', 'this_side_up', 'keep_dry', 'refrigerate', 'hazmat', 'oversized', 'heavy_lift']
  
  handling_instructions text,
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Not yet loaded
    'loaded',        -- On vessel
    'in_transit',    -- On the water
    'offloaded',     -- Removed from vessel
    'delivered',     -- Delivered to consignee
    'held',          -- Held for issues
    'damaged',       -- Damaged in transit
    'lost',          -- Lost
    'returned'       -- Returned to shipper
  )),
  
  loaded_at timestamptz,
  offloaded_at timestamptz,
  delivered_at timestamptz,
  
  -- Delivery details
  received_by text,
  delivery_signature text,
  delivery_notes text,
  
  -- Pricing
  item_charge_cad numeric(10,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(manifest_id, item_number)
);

CREATE INDEX IF NOT EXISTS idx_freight_items_manifest ON cc_freight_items(manifest_id, status);
CREATE INDEX IF NOT EXISTS idx_freight_items_tracking ON cc_freight_items(tracking_code) WHERE tracking_code IS NOT NULL;

ALTER TABLE cc_freight_items ENABLE ROW LEVEL SECURITY;

COMMIT;
