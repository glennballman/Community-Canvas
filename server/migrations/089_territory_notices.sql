BEGIN;

-- ============ TERRITORY NOTICES ============
-- Acknowledgments and notices for First Nations territories

CREATE TABLE IF NOT EXISTS cc_territory_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  authority_id uuid NOT NULL REFERENCES cc_authorities(id),
  trip_id uuid REFERENCES cc_trips(id) ON DELETE SET NULL,
  permit_id uuid REFERENCES cc_visitor_permits(id) ON DELETE SET NULL,
  
  -- Identity
  notice_number varchar(30) NOT NULL UNIQUE,
  -- Format: TAN-NATION-YYMMDD-XXXX (e.g., TAN-HFN-260115-A7K9)
  
  -- Visitor
  visitor_name text NOT NULL,
  visitor_email text,
  visitor_phone text,
  party_size integer DEFAULT 1,
  party_members text[],
  
  -- Visit details
  visit_purpose varchar CHECK (visit_purpose IN (
    'recreation',     -- Tourism/recreation
    'transit',        -- Passing through
    'research',       -- Scientific research
    'education',      -- Educational visit
    'commercial',     -- Commercial activity
    'cultural',       -- Cultural exchange/learning
    'other'
  )),
  visit_description text,
  
  -- Dates
  entry_date date NOT NULL,
  exit_date date,
  
  -- Locations
  entry_point text,
  planned_areas text[],
  -- ['Deer Group Islands', 'Diana Island', 'Bamfield Inlet']
  
  -- Acknowledgments
  acknowledgments_json jsonb DEFAULT '{}'::jsonb,
  -- {territory_acknowledged: true, 
  --  cultural_respect_agreed: true,
  --  leave_no_trace_agreed: true,
  --  sacred_sites_respect: true,
  --  timestamp: '2026-01-15T10:30:00Z'}
  
  -- Cultural protocol
  orientation_completed boolean DEFAULT false,
  orientation_date timestamptz,
  cultural_guide_requested boolean DEFAULT false,
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Not yet acknowledged
    'acknowledged',   -- Visitor acknowledged
    'active',         -- Currently in territory
    'completed',      -- Visit completed
    'expired',        -- Past exit date
    'cancelled'
  )),
  
  acknowledged_at timestamptz,
  
  -- Vessel (if applicable)
  vessel_name text,
  vessel_type text,
  vessel_registration text,
  
  -- Notes
  visitor_notes text,
  authority_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_territory_notices_authority ON cc_territory_notices(authority_id, status);
CREATE INDEX IF NOT EXISTS idx_territory_notices_trip ON cc_territory_notices(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_territory_notices_dates ON cc_territory_notices(entry_date, exit_date);
CREATE INDEX IF NOT EXISTS idx_territory_notices_number ON cc_territory_notices(notice_number);

ALTER TABLE cc_territory_notices ENABLE ROW LEVEL SECURITY;

-- ============ CULTURAL SITES ============
-- Sacred sites and areas with special protocols

CREATE TABLE IF NOT EXISTS cc_cultural_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  authority_id uuid NOT NULL REFERENCES cc_authorities(id),
  location_id uuid REFERENCES cc_locations(id) ON DELETE SET NULL,
  
  -- Identity
  name text NOT NULL,
  traditional_name text,
  
  site_type varchar CHECK (site_type IN (
    'sacred',           -- Sacred/spiritual site
    'burial',           -- Burial ground
    'archaeological',   -- Archaeological site
    'cultural',         -- Cultural significance
    'historical',       -- Historical importance
    'ecological',       -- Ecological protection
    'restricted'        -- General restricted area
  )),
  
  -- Location
  description text,
  lat numeric(9,6),
  lon numeric(9,6),
  boundary_json jsonb DEFAULT '{}'::jsonb,
  
  -- Access rules
  access_level varchar DEFAULT 'restricted' CHECK (access_level IN (
    'open',           -- Open to visitors
    'guided_only',    -- Guided tours only
    'restricted',     -- Limited access
    'closed',         -- No public access
    'seasonal'        -- Seasonally restricted
  )),
  
  restrictions_json jsonb DEFAULT '{}'::jsonb,
  -- {no_photography: true, no_camping: true, 
  --  quiet_zone: true, no_harvesting: true,
  --  seasonal_closure: {months: [3,4,5], reason: 'Nesting season'}}
  
  -- Protocol
  protocol_description text,
  required_acknowledgment text,
  
  -- Status
  status varchar DEFAULT 'active',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cultural_sites_authority ON cc_cultural_sites(authority_id);
CREATE INDEX IF NOT EXISTS idx_cultural_sites_location ON cc_cultural_sites(location_id) WHERE location_id IS NOT NULL;

ALTER TABLE cc_cultural_sites ENABLE ROW LEVEL SECURITY;

-- ============ SEED HFN CULTURAL SITES ============

DO $$
DECLARE
  v_portal_id uuid;
  v_hfn_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  SELECT id INTO v_hfn_id FROM cc_authorities WHERE code = 'HFN' LIMIT 1;
  
  IF v_hfn_id IS NOT NULL THEN
    -- Kiixin (historic village)
    INSERT INTO cc_cultural_sites (
      portal_id, authority_id, name, traditional_name, site_type,
      description, access_level, protocol_description, status
    ) VALUES (
      v_portal_id, v_hfn_id, 
      'Kiixin National Historic Site', 'Kiixin',
      'historical',
      'Ancient Huu-ay-aht village site with traditional longhouse remains and cultural artifacts',
      'guided_only',
      'Visits require a guided tour with a Huu-ay-aht cultural interpreter. Please respect all marked areas.',
      'active'
    ) ON CONFLICT DO NOTHING;
    
    -- Diana Island
    INSERT INTO cc_cultural_sites (
      portal_id, authority_id, name, site_type,
      description, access_level, restrictions_json, protocol_description, status
    ) VALUES (
      v_portal_id, v_hfn_id,
      'Diana Island', 'cultural',
      'Island within Huu-ay-aht traditional territory with cultural significance',
      'restricted',
      '{"camping_by_permission": true, "notify_hfn": true}'::jsonb,
      'Contact Huu-ay-aht First Nations office before planning extended stays',
      'active'
    ) ON CONFLICT DO NOTHING;
    
    -- Deer Group Islands
    INSERT INTO cc_cultural_sites (
      portal_id, authority_id, name, site_type,
      description, access_level, restrictions_json, status
    ) VALUES (
      v_portal_id, v_hfn_id,
      'Deer Group Islands', 'cultural',
      'Island group within Huu-ay-aht traditional territory, popular kayaking destination',
      'open',
      '{"leave_no_trace": true, "respect_wildlife": true, "no_harvesting": true}'::jsonb,
      'active'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMIT;
