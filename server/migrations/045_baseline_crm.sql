-- ============================================================================
-- BASELINE CRM V1: Places, People, Organizations
-- Migration: 045_baseline_crm.sql
-- 
-- Core CRM tables for tenant-level contact and location management.
-- All tables have RLS with tenant isolation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CRM Organizations (sovereign business entities)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(50) DEFAULT 'BC',
  postal_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'Canada',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_orgs_tenant ON crm_orgs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_orgs_name ON crm_orgs(tenant_id, name);

-- ----------------------------------------------------------------------------
-- CRM People (sovereign individuals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  org_id UUID REFERENCES crm_orgs(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  display_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  role_title VARCHAR(100),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(50) DEFAULT 'BC',
  postal_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'Canada',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_people_tenant ON crm_people(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_people_org ON crm_people(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_people_name ON crm_people(tenant_id, last_name, first_name);

-- ----------------------------------------------------------------------------
-- CRM Places (properties/sites/units)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  place_type VARCHAR(50) DEFAULT 'property',
  owner_person_id UUID REFERENCES crm_people(id) ON DELETE SET NULL,
  owner_org_id UUID REFERENCES crm_orgs(id) ON DELETE SET NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(50) DEFAULT 'BC',
  postal_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'Canada',
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_places_tenant ON crm_places(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_places_owner_person ON crm_places(owner_person_id);
CREATE INDEX IF NOT EXISTS idx_crm_places_owner_org ON crm_places(owner_org_id);
CREATE INDEX IF NOT EXISTS idx_crm_places_name ON crm_places(tenant_id, name);

-- ----------------------------------------------------------------------------
-- CRM Place Photos (media-first approach)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_place_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES crm_places(id) ON DELETE CASCADE,
  url VARCHAR(1000) NOT NULL,
  caption VARCHAR(500),
  taken_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_place_photos_place ON crm_place_photos(place_id);
CREATE INDEX IF NOT EXISTS idx_crm_place_photos_tenant ON crm_place_photos(tenant_id);

-- ----------------------------------------------------------------------------
-- RLS Policies
-- ----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE crm_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_place_photos ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners
ALTER TABLE crm_orgs FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_people FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_places FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_place_photos FORCE ROW LEVEL SECURITY;

-- CRM Orgs policies
DROP POLICY IF EXISTS crm_orgs_tenant_isolation ON crm_orgs;
CREATE POLICY crm_orgs_tenant_isolation ON crm_orgs
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  );

-- CRM People policies
DROP POLICY IF EXISTS crm_people_tenant_isolation ON crm_people;
CREATE POLICY crm_people_tenant_isolation ON crm_people
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  );

-- CRM Places policies
DROP POLICY IF EXISTS crm_places_tenant_isolation ON crm_places;
CREATE POLICY crm_places_tenant_isolation ON crm_places
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  );

-- CRM Place Photos policies
DROP POLICY IF EXISTS crm_place_photos_tenant_isolation ON crm_place_photos;
CREATE POLICY crm_place_photos_tenant_isolation ON crm_place_photos
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  );

-- ----------------------------------------------------------------------------
-- Update timestamp trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_orgs_updated_at ON crm_orgs;
CREATE TRIGGER trg_crm_orgs_updated_at
  BEFORE UPDATE ON crm_orgs
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

DROP TRIGGER IF EXISTS trg_crm_people_updated_at ON crm_people;
CREATE TRIGGER trg_crm_people_updated_at
  BEFORE UPDATE ON crm_people
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

DROP TRIGGER IF EXISTS trg_crm_places_updated_at ON crm_places;
CREATE TRIGGER trg_crm_places_updated_at
  BEFORE UPDATE ON crm_places
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
