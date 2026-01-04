-- =====================================================================
-- COMMUNITY CANVAS: EXTERNAL DATA → ENTITY GRAPH → CLAIM & BRIDGE
-- Migration 018: V2 Architecture (normalized, resolution-ready, outreach-safe)
-- =====================================================================

-- -----------------------------
-- Extensions
-- -----------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Note: PostGIS removed for Replit compatibility - using lat/lng columns instead

-- -----------------------------
-- ENUMS
-- -----------------------------
DO $$ BEGIN
  CREATE TYPE external_source AS ENUM ('airbnb','vrbo','booking','facebook','chamber','trades_dir','canadian_tire','home_depot','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE external_record_type AS ENUM ('property_listing','host_profile','service_provider','business_listing','product','poi','person_profile','equipment_listing','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM ('property','organization','person','product','equipment','service_provider','poi','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE link_status AS ENUM ('suggested','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_status AS ENUM ('none','pending','approved','rejected','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_type AS ENUM ('email','phone','website','social','platform_handle','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_basis AS ENUM ('unknown','provided_by_user','public_opt_in','direct_relationship','transactional_request','verified_owner','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE outreach_channel AS ENUM ('email','sms','phone','postal','in_app','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE outreach_result AS ENUM ('queued','sent','delivered','opened','clicked','replied','bounced','complained','unsubscribed','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 1) DATASET REGISTRY + SYNC HISTORY
-- =====================================================================

CREATE TABLE IF NOT EXISTS apify_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  apify_actor_id TEXT NOT NULL,
  apify_dataset_id TEXT,
  apify_run_id TEXT,

  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,

  source external_source NOT NULL DEFAULT 'other',
  record_type external_record_type NOT NULL DEFAULT 'other',

  country TEXT NOT NULL DEFAULT 'Canada',
  region TEXT,
  community_id UUID REFERENCES sr_communities(id),

  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_frequency_hours INTEGER NOT NULL DEFAULT 168,
  last_sync_at TIMESTAMPTZ,
  last_sync_record_count INTEGER,
  last_sync_error TEXT,

  api_key_ref TEXT,
  field_mapping JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apify_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES apify_datasets(id) ON DELETE CASCADE,

  apify_run_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  records_errored INTEGER NOT NULL DEFAULT 0,

  duration_seconds INTEGER,
  error_message TEXT,
  error_details JSONB,

  triggered_by TEXT NOT NULL DEFAULT 'manual',
  triggered_by_user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_apify_sync_history_dataset ON apify_sync_history(dataset_id);
CREATE INDEX IF NOT EXISTS idx_apify_sync_history_started ON apify_sync_history(started_at DESC);

-- =====================================================================
-- 2) EXTERNAL RECORDS (raw scraped evidence, many-per-real-world-entity)
-- =====================================================================

CREATE TABLE IF NOT EXISTS external_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  dataset_id UUID NOT NULL REFERENCES apify_datasets(id) ON DELETE CASCADE,
  source external_source NOT NULL,
  record_type external_record_type NOT NULL,

  external_id TEXT NOT NULL,
  external_url TEXT,

  name TEXT NOT NULL DEFAULT '',
  description TEXT,

  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT NOT NULL DEFAULT 'Canada',

  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  -- geom column removed - using lat/lng for distance calculations

  community_id UUID REFERENCES sr_communities(id),

  raw_data JSONB NOT NULL DEFAULT '{}',

  sync_hash TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ,

  pii_risk TEXT NOT NULL DEFAULT 'unknown' CHECK (pii_risk IN ('low','medium','high','unknown')),
  do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_records_source_id ON external_records(source, external_id);
CREATE INDEX IF NOT EXISTS idx_external_records_type ON external_records(record_type);
CREATE INDEX IF NOT EXISTS idx_external_records_community ON external_records(community_id);
CREATE INDEX IF NOT EXISTS idx_external_records_lat_lng ON external_records(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- PostGIS geom trigger removed - using lat/lng columns directly

-- =====================================================================
-- 3) CONTACT POINTS (with consent + verification)
-- =====================================================================

CREATE TABLE IF NOT EXISTS external_contact_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  external_record_id UUID REFERENCES external_records(id) ON DELETE CASCADE,

  contact_type contact_type NOT NULL,
  contact_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,

  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  consent consent_basis NOT NULL DEFAULT 'unknown',
  consent_notes TEXT,

  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(contact_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_external_contact_points_record ON external_contact_points(external_record_id);
CREATE INDEX IF NOT EXISTS idx_external_contact_points_value ON external_contact_points(contact_type, normalized_value);

-- =====================================================================
-- 4) CANONICAL ENTITIES (extend existing table with new columns)
-- =====================================================================
-- Note: The entities table already exists with entity_type_id, name, address_line1, province columns.
-- We add the columns needed for the V2 architecture without recreating the table.

-- Note: geom column removed for Replit compatibility - using lat/lng columns instead
ALTER TABLE entities ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES sr_communities(id);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';

CREATE INDEX IF NOT EXISTS idx_entities_community_v2 ON entities(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_lat_lng ON entities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- PostGIS geom trigger removed - using lat/lng columns directly

-- =====================================================================
-- 5) ENTITY LINKS (external_records → entities with confidence)
-- =====================================================================

CREATE TABLE IF NOT EXISTS entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  external_record_id UUID NOT NULL REFERENCES external_records(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  status link_status NOT NULL DEFAULT 'suggested',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  reasons JSONB NOT NULL DEFAULT '{}',
  resolver_version TEXT NOT NULL DEFAULT 'v1',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID,

  UNIQUE(external_record_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_record ON entity_links(external_record_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_entity ON entity_links(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_status ON entity_links(status);

-- =====================================================================
-- 6) CLAIMS (claim canonical entity, not external record)
-- =====================================================================

CREATE TABLE IF NOT EXISTS entity_claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  claimant_individual_id UUID REFERENCES cc_individuals(id),
  claimant_tenant_id UUID REFERENCES cc_tenants(id),

  claimant_email TEXT NOT NULL,
  claimant_name TEXT NOT NULL,

  verification_method TEXT CHECK (verification_method IN (
    'email_domain','phone_callback','document_upload','platform_proof','manual_review','existing_account'
  )),
  verification_data JSONB NOT NULL DEFAULT '{}',

  status claim_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID,
  review_notes TEXT,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_claim_requests_entity ON entity_claim_requests(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_claim_requests_status ON entity_claim_requests(status);

CREATE TABLE IF NOT EXISTS entity_claims (
  entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  claimed_by_individual_id UUID REFERENCES cc_individuals(id),
  claimed_by_tenant_id UUID REFERENCES cc_tenants(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claim_status claim_status NOT NULL DEFAULT 'approved',
  notes TEXT
);

-- =====================================================================
-- 7) INQUIRIES (bridge flow)
-- =====================================================================

CREATE TABLE IF NOT EXISTS entity_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  external_record_id UUID REFERENCES external_records(id) ON DELETE SET NULL,

  inquirer_individual_id UUID NOT NULL REFERENCES cc_individuals(id),

  inquiry_type TEXT NOT NULL CHECK (inquiry_type IN (
    'booking_request','rental_request','service_request','purchase_intent','general_inquiry'
  )),

  message TEXT,
  requested_dates JSONB,
  requested_quantity INTEGER,
  budget_range JSONB,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','outreach_queued','outreach_sent','owner_responded','connected','converted','declined','expired','cancelled'
  )),

  expires_at TIMESTAMPTZ,
  converted_object_type TEXT,
  converted_object_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (entity_id IS NOT NULL OR external_record_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_entity_inquiries_entity ON entity_inquiries(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_inquiries_record ON entity_inquiries(external_record_id);
CREATE INDEX IF NOT EXISTS idx_entity_inquiries_inquirer ON entity_inquiries(inquirer_individual_id);
CREATE INDEX IF NOT EXISTS idx_entity_inquiries_status ON entity_inquiries(status);

-- =====================================================================
-- 8) OUTREACH: templates + attempts + unsubscribes
-- =====================================================================

CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,

  entity_type entity_type NOT NULL,
  trigger_type TEXT NOT NULL,

  channel outreach_channel NOT NULL DEFAULT 'email',

  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  inquiry_id UUID REFERENCES entity_inquiries(id) ON DELETE SET NULL,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  external_record_id UUID REFERENCES external_records(id) ON DELETE SET NULL,

  template_id UUID REFERENCES outreach_templates(id) ON DELETE SET NULL,

  channel outreach_channel NOT NULL DEFAULT 'email',
  contact_point_id UUID REFERENCES external_contact_points(id) ON DELETE SET NULL,

  consent consent_basis NOT NULL DEFAULT 'unknown',
  result outreach_result NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error TEXT,

  sent_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_attempts_inquiry ON outreach_attempts(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_outreach_attempts_entity ON outreach_attempts(entity_id);
CREATE INDEX IF NOT EXISTS idx_outreach_attempts_result ON outreach_attempts(result);

CREATE TABLE IF NOT EXISTS unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel outreach_channel NOT NULL DEFAULT 'email',
  contact_type contact_type NOT NULL DEFAULT 'email',
  normalized_value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel, contact_type, normalized_value)
);

-- =====================================================================
-- 9) COMMUNITY GEO ENHANCEMENT
-- =====================================================================
-- Note: PostGIS geom column removed for Replit compatibility
-- Using existing lat/lng columns for distance calculations

CREATE INDEX IF NOT EXISTS idx_sr_communities_lat_lng ON sr_communities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =====================================================================
-- 10) COMMUNITY RESOLUTION FUNCTION (Euclidean distance fallback)
-- =====================================================================

CREATE OR REPLACE FUNCTION resolve_community(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_city TEXT DEFAULT NULL, p_region TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  IF p_city IS NOT NULL THEN
    SELECT id INTO v_id
    FROM sr_communities
    WHERE LOWER(name) = LOWER(p_city)
      AND (p_region IS NULL OR LOWER(region) = LOWER(p_region))
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- Euclidean fallback using latitude/longitude columns (no PostGIS)
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    SELECT id INTO v_id
    FROM sr_communities
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY SQRT(POWER(latitude - p_lat, 2) + POWER(longitude - p_lng, 2))
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 11) VIEWS (dashboards)
-- =====================================================================

CREATE OR REPLACE VIEW v_unclaimed_entities_with_inquiries AS
SELECT
  e.id AS entity_id,
  e.entity_type_id,
  e.name AS display_name,
  e.community_id,
  COUNT(i.id) FILTER (WHERE i.status = 'pending') AS pending_inquiries,
  MIN(i.created_at) AS oldest_inquiry
FROM entities e
LEFT JOIN entity_claims c ON c.entity_id = e.id
LEFT JOIN entity_inquiries i ON i.entity_id = e.id
WHERE c.entity_id IS NULL
GROUP BY e.id
HAVING COUNT(i.id) FILTER (WHERE i.status = 'pending') > 0
ORDER BY pending_inquiries DESC, oldest_inquiry ASC;

CREATE OR REPLACE VIEW v_external_records_needing_resolution AS
SELECT
  r.id,
  r.source,
  r.record_type,
  r.name,
  r.city,
  r.region,
  r.community_id,
  r.last_seen_at
FROM external_records r
LEFT JOIN LATERAL (
  SELECT 1
  FROM entity_links l
  WHERE l.external_record_id = r.id AND l.status = 'accepted'
  LIMIT 1
) accepted ON true
WHERE accepted IS NULL
ORDER BY r.last_seen_at DESC;

CREATE OR REPLACE VIEW v_entity_resolution_queue AS
SELECT
  el.id AS link_id,
  el.status,
  el.confidence,
  el.reasons,
  er.name AS record_name,
  er.source::text,
  er.city AS record_city,
  e.name AS entity_name,
  e.city AS entity_city,
  el.created_at
FROM entity_links el
JOIN external_records er ON er.id = el.external_record_id
JOIN entities e ON e.id = el.entity_id
WHERE el.status = 'suggested'
ORDER BY el.confidence DESC, el.created_at;

CREATE OR REPLACE VIEW v_outreach_ready AS
SELECT
  cp.id AS contact_point_id,
  cp.external_record_id,
  cp.contact_type,
  cp.contact_value,
  cp.consent,
  cp.is_verified,
  er.name AS record_name
FROM external_contact_points cp
JOIN external_records er ON er.id = cp.external_record_id
LEFT JOIN unsubscribes u 
  ON u.channel = 'email' 
  AND u.contact_type = cp.contact_type 
  AND u.normalized_value = cp.normalized_value
WHERE cp.do_not_contact = FALSE
  AND cp.consent IN ('provided_by_user','public_opt_in','transactional_request','verified_owner')
  AND u.id IS NULL;

-- =====================================================================
-- 12) SEED DATA: Default outreach templates
-- =====================================================================

INSERT INTO outreach_templates (name, slug, entity_type, trigger_type, channel, subject, body_text, body_html) VALUES
('Property Inquiry Notification', 'property-inquiry-notification', 'property', 'inquiry_received', 'email',
 'Someone is interested in {{property_name}}',
 'Hi {{owner_name}},\n\nSomeone in the Community Canvas network is interested in {{property_name}}.\n\nMessage: {{inquiry_message}}\n\nTo connect with them, claim your listing at: {{claim_url}}\n\nBest,\nCommunity Canvas Team',
 NULL),
('Service Provider Inquiry', 'service-provider-inquiry', 'service_provider', 'inquiry_received', 'email',
 'New service request for {{business_name}}',
 'Hi {{owner_name}},\n\nA Community Canvas member has a service request for {{business_name}}.\n\nDetails: {{inquiry_message}}\n\nClaim your listing to respond: {{claim_url}}\n\nBest,\nCommunity Canvas Team',
 NULL),
('Claim Reminder', 'claim-reminder', 'property', 'reminder', 'email',
 'Reminder: Claim your listing on Community Canvas',
 'Hi,\n\nYou have pending inquiries for your property. Claim your listing to respond and connect with interested parties.\n\nClaim here: {{claim_url}}\n\nBest,\nCommunity Canvas Team',
 NULL)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- VERIFY
-- =====================================================================
SELECT 'External Data Lake V2 schema installed successfully' AS status;
