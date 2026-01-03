-- ============================================================================
-- MIGRATION 023 — PORTAL / PRIVATE-LABEL SYSTEM
-- ============================================================================

BEGIN;

-- ENUM TYPES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_status') THEN
    CREATE TYPE portal_status AS ENUM ('draft', 'active', 'paused', 'retired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_domain_status') THEN
    CREATE TYPE portal_domain_status AS ENUM ('pending', 'verified', 'active', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_audience_type') THEN
    CREATE TYPE portal_audience_type AS ENUM ('host', 'traveler', 'worker', 'contractor', 'buyer', 'coordinator', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publish_visibility') THEN
    CREATE TYPE publish_visibility AS ENUM ('public', 'tenant_only', 'portal_only', 'invite_only');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_membership_status') THEN
    CREATE TYPE portal_membership_status AS ENUM ('invited', 'active', 'suspended', 'left');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'casl_consent_status') THEN
    CREATE TYPE casl_consent_status AS ENUM ('unknown', 'implied', 'express', 'withdrawn');
  END IF;
END $$;

-- PORTALS
CREATE TABLE IF NOT EXISTS portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owning_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status portal_status NOT NULL DEFAULT 'draft',
  primary_audience portal_audience_type NOT NULL DEFAULT 'traveler',
  tagline TEXT,
  description TEXT,
  default_locale TEXT NOT NULL DEFAULT 'en-CA',
  default_currency TEXT NOT NULL DEFAULT 'CAD',
  supported_locales TEXT[] NOT NULL DEFAULT ARRAY['en-CA'],
  default_route TEXT NOT NULL DEFAULT '/',
  onboarding_flow_key TEXT,
  terms_url TEXT,
  privacy_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portals_status ON portals(status);
CREATE INDEX IF NOT EXISTS idx_portals_primary_audience ON portals(primary_audience);

-- PORTAL DOMAINS
CREATE TABLE IF NOT EXISTS portal_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status portal_domain_status NOT NULL DEFAULT 'pending',
  verification_method TEXT,
  verification_token TEXT,
  verified_at TIMESTAMPTZ,
  ssl_status TEXT DEFAULT 'unknown',
  ssl_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_domains_portal ON portal_domains(portal_id);

-- PORTAL THEME
CREATE TABLE IF NOT EXISTS portal_theme (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL UNIQUE REFERENCES portals(id) ON DELETE CASCADE,
  tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_version INTEGER NOT NULL DEFAULT 1,
  is_live BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PORTAL COPY
CREATE TABLE IF NOT EXISTS portal_copy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL DEFAULT 'ui',
  key TEXT NOT NULL,
  locale TEXT NOT NULL,
  value TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, namespace, key, locale)
);
CREATE INDEX IF NOT EXISTS idx_portal_copy_lookup ON portal_copy(portal_id, namespace, key, locale);

-- PORTAL FEATURE FLAGS
CREATE TABLE IF NOT EXISTS portal_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, flag_key)
);
CREATE INDEX IF NOT EXISTS idx_portal_feature_flags_portal ON portal_feature_flags(portal_id);

-- PORTAL AUDIENCE PROFILES
CREATE TABLE IF NOT EXISTS portal_audience_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  audience portal_audience_type NOT NULL,
  default_route TEXT NOT NULL DEFAULT '/',
  navigation JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarding_flow_key TEXT,
  theme_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, audience)
);

-- PORTAL MEMBERSHIPS
CREATE TABLE IF NOT EXISTS portal_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  status portal_membership_status NOT NULL DEFAULT 'invited',
  roles TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  preferred_locale TEXT,
  onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  casl_consent casl_consent_status NOT NULL DEFAULT 'unknown',
  casl_consent_at TIMESTAMPTZ,
  casl_withdrawn_at TIMESTAMPTZ,
  acquisition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, individual_id)
);
CREATE INDEX IF NOT EXISTS idx_portal_memberships_portal ON portal_memberships(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_memberships_individual ON portal_memberships(individual_id);

-- PORTAL PAGES
CREATE TABLE IF NOT EXISTS portal_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en-CA',
  title TEXT NOT NULL,
  description TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_id, slug, locale)
);

-- ADD PORTAL SCOPING TO OPPORTUNITIES
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility_scope publish_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS invite_token TEXT;
CREATE INDEX IF NOT EXISTS idx_opportunities_portal ON opportunities(portal_id);

-- ADD PORTAL SCOPING TO ASSETS
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility_scope publish_visibility NOT NULL DEFAULT 'public';
CREATE INDEX IF NOT EXISTS idx_assets_portal ON assets(portal_id);

-- PORTAL DOMAIN RESOLUTION VIEW
CREATE OR REPLACE VIEW v_portal_domain_resolution AS
SELECT d.domain, d.status AS domain_status, d.is_primary,
       p.id AS portal_id, p.slug AS portal_slug, p.name AS portal_name,
       p.status AS portal_status, p.primary_audience, p.default_locale, p.default_currency
FROM portal_domains d
JOIN portals p ON p.id = d.portal_id;

COMMIT;
