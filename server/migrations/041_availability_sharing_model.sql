-- ============================================================
-- COMMUNITY CANVAS v2.9 - AVAILABILITY & SHARING MODEL
-- Migration 041 - Opt-in sharing, Availability Console support
-- ============================================================

-- ============================================================
-- 1. BUSINESS SHARING SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_sharing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  share_availability BOOLEAN DEFAULT false,
  share_pricing BOOLEAN DEFAULT false,
  allow_reservation_requests BOOLEAN DEFAULT false,
  allow_hold_requests BOOLEAN DEFAULT false,
  
  visible_to_communities UUID[] DEFAULT NULL,
  
  preferred_contact_method TEXT DEFAULT 'message',
  
  auto_respond_to_requests BOOLEAN DEFAULT false,
  auto_response_template TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS tenant_sharing_tenant_idx ON tenant_sharing_settings(tenant_id);

COMMENT ON TABLE tenant_sharing_settings IS 
  'Controls what each business shares with community operators';

-- ============================================================
-- 2. CATALOG ITEMS (Unified inventory across all business types)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE catalog_item_type AS ENUM (
    'rental',
    'accommodation',
    'parking',
    'moorage',
    'service',
    'experience',
    'product'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE catalog_item_status AS ENUM (
    'draft',
    'active',
    'hidden',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  item_type catalog_item_type NOT NULL,
  status catalog_item_status DEFAULT 'draft',
  
  category TEXT,
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',
  
  photos JSONB DEFAULT '[]'::jsonb,
  
  price_amount NUMERIC(10,2),
  price_unit TEXT,
  price_notes TEXT,
  price_is_approximate BOOLEAN DEFAULT false,
  
  capacity_min INTEGER,
  capacity_max INTEGER,
  capacity_unit TEXT,
  size_value NUMERIC(10,2),
  size_unit TEXT,
  
  requirements JSONB DEFAULT '{}'::jsonb,
  
  pickup_location TEXT,
  pickup_instructions TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  
  availability_type TEXT DEFAULT 'always',
  availability_rules JSONB DEFAULT '{}'::jsonb,
  
  imported_from TEXT,
  import_source_url TEXT,
  import_confidence NUMERIC(3,2),
  needs_review BOOLEAN DEFAULT false,
  
  sort_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  booking_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS catalog_items_tenant_idx ON catalog_items(tenant_id);
CREATE INDEX IF NOT EXISTS catalog_items_type_idx ON catalog_items(item_type);
CREATE INDEX IF NOT EXISTS catalog_items_status_idx ON catalog_items(status);
CREATE INDEX IF NOT EXISTS catalog_items_category_idx ON catalog_items(category);

-- ============================================================
-- 3. REAL-TIME AVAILABILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  
  is_available BOOLEAN DEFAULT true,
  quantity_available INTEGER DEFAULT 1,
  quantity_total INTEGER DEFAULT 1,
  
  price_override NUMERIC(10,2),
  
  notes TEXT,
  
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_date_range CHECK (date_end >= date_start)
);

CREATE INDEX IF NOT EXISTS catalog_availability_item_idx ON catalog_availability(catalog_item_id);
CREATE INDEX IF NOT EXISTS catalog_availability_dates_idx ON catalog_availability(date_start, date_end);

-- ============================================================
-- 4. HOLD REQUESTS (Operator requests temporary hold)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE hold_request_status AS ENUM (
    'pending',
    'approved',
    'declined',
    'expired',
    'converted',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS hold_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),
  business_tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  
  requesting_tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  requesting_user_id UUID REFERENCES cc_users(id),
  
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  party_size INTEGER,
  
  caller_name TEXT,
  caller_phone TEXT,
  caller_email TEXT,
  caller_notes TEXT,
  
  status hold_request_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES cc_users(id),
  response_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hold_requests_item_idx ON hold_requests(catalog_item_id);
CREATE INDEX IF NOT EXISTS hold_requests_business_idx ON hold_requests(business_tenant_id);
CREATE INDEX IF NOT EXISTS hold_requests_status_idx ON hold_requests(status);

-- ============================================================
-- 5. OPERATOR CALL LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS operator_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  operator_tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  operator_user_id UUID REFERENCES cc_users(id),
  
  caller_name TEXT,
  caller_phone TEXT,
  caller_email TEXT,
  
  need_type TEXT,
  need_summary TEXT,
  date_start DATE,
  date_end DATE,
  party_size INTEGER,
  special_requirements TEXT,
  
  outcome TEXT,
  outcome_notes TEXT,
  
  hold_request_ids UUID[] DEFAULT '{}',
  message_ids UUID[] DEFAULT '{}',
  
  call_started_at TIMESTAMPTZ DEFAULT now(),
  call_ended_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_call_logs_tenant_idx ON operator_call_logs(operator_tenant_id);
CREATE INDEX IF NOT EXISTS operator_call_logs_date_idx ON operator_call_logs(call_started_at);

-- ============================================================
-- 6. CATALOG IMPORT JOBS (AI scraping)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE import_job_status AS ENUM (
    'pending',
    'scanning',
    'review_needed',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS catalog_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_file_path TEXT,
  
  status import_job_status DEFAULT 'pending',
  progress_percent INTEGER DEFAULT 0,
  status_message TEXT,
  
  items_found INTEGER DEFAULT 0,
  items_imported INTEGER DEFAULT 0,
  items_need_review INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  
  raw_extraction JSONB,
  
  error_message TEXT,
  error_details JSONB,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES cc_users(id)
);

CREATE INDEX IF NOT EXISTS catalog_import_jobs_tenant_idx ON catalog_import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS catalog_import_jobs_status_idx ON catalog_import_jobs(status);

-- ============================================================
-- 7. VIEW: Unified availability for operators
-- ============================================================

CREATE OR REPLACE VIEW operator_availability_view AS
SELECT 
  ci.id as item_id,
  ci.tenant_id as business_tenant_id,
  t.name as business_name,
  ci.name as item_name,
  ci.short_description,
  ci.item_type,
  ci.category,
  ci.photos,
  ci.price_amount,
  ci.price_unit,
  ci.price_is_approximate,
  ci.capacity_min,
  ci.capacity_max,
  ci.capacity_unit,
  ci.size_value,
  ci.size_unit,
  ci.pickup_location,
  ci.requirements,
  tss.share_availability,
  tss.share_pricing,
  tss.allow_reservation_requests,
  tss.allow_hold_requests,
  tss.preferred_contact_method,
  tss.visible_to_communities
FROM catalog_items ci
JOIN cc_tenants t ON ci.tenant_id = t.id
LEFT JOIN tenant_sharing_settings tss ON ci.tenant_id = tss.tenant_id
WHERE ci.status = 'active'
  AND t.status = 'active';

COMMENT ON VIEW operator_availability_view IS 
  'Unified view of all catalog items with sharing settings for operator queries';

-- ============================================================
-- 8. FUNCTION: Search availability for operators
-- ============================================================

CREATE OR REPLACE FUNCTION search_operator_availability(
  p_community_tenant_id UUID,
  p_item_type TEXT DEFAULT NULL,
  p_date_start DATE DEFAULT NULL,
  p_date_end DATE DEFAULT NULL,
  p_capacity INTEGER DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  item_id UUID,
  business_tenant_id UUID,
  business_name TEXT,
  item_name TEXT,
  short_description TEXT,
  item_type catalog_item_type,
  category TEXT,
  photos JSONB,
  price_amount NUMERIC,
  price_unit TEXT,
  price_visible BOOLEAN,
  capacity_max INTEGER,
  pickup_location TEXT,
  can_request_hold BOOLEAN,
  sharing_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oav.item_id,
    oav.business_tenant_id,
    oav.business_name,
    oav.item_name,
    oav.short_description,
    oav.item_type,
    oav.category,
    oav.photos,
    CASE WHEN oav.share_pricing THEN oav.price_amount ELSE NULL END,
    CASE WHEN oav.share_pricing THEN oav.price_unit ELSE NULL END,
    oav.share_pricing,
    oav.capacity_max,
    oav.pickup_location,
    oav.allow_hold_requests,
    CASE 
      WHEN oav.share_availability AND oav.share_pricing THEN 'full'
      WHEN oav.share_availability THEN 'availability_only'
      ELSE 'limited'
    END
  FROM operator_availability_view oav
  WHERE oav.share_availability = true
    AND (oav.visible_to_communities IS NULL 
         OR p_community_tenant_id = ANY(oav.visible_to_communities))
    AND (p_item_type IS NULL OR oav.item_type::text = p_item_type)
    AND (p_capacity IS NULL OR oav.capacity_max >= p_capacity)
    AND (p_search_text IS NULL 
         OR oav.item_name ILIKE '%' || p_search_text || '%'
         OR oav.short_description ILIKE '%' || p_search_text || '%'
         OR oav.category ILIKE '%' || p_search_text || '%')
  ORDER BY oav.business_name, oav.item_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
