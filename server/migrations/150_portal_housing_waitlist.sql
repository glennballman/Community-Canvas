-- Migration 150: Portal Housing Waitlist v1
-- Controlled resource + concierge routing for housing needs

-- A) cc_portal_housing_policies (minimal policy settings)
CREATE TABLE IF NOT EXISTS cc_portal_housing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL UNIQUE REFERENCES cc_portals(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  disclosure_text TEXT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- B) cc_portal_housing_offers (employer-provided capacity signals)
CREATE TABLE IF NOT EXISTS cc_portal_housing_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  employer_party_id UUID NULL,
  capacity_beds INTEGER NOT NULL DEFAULT 0,
  capacity_rooms INTEGER NOT NULL DEFAULT 0,
  nightly_cost_min_cents INTEGER NULL,
  nightly_cost_max_cents INTEGER NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (portal_id, tenant_id)
);

-- C) cc_portal_housing_waitlist_entries
CREATE TABLE IF NOT EXISTS cc_portal_housing_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  bundle_id UUID NULL REFERENCES cc_job_application_bundles(id) ON DELETE SET NULL,
  application_id UUID NULL REFERENCES cc_job_applications(id) ON DELETE SET NULL,
  applicant_individual_id UUID NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  preferred_start_date DATE NULL,
  preferred_end_date DATE NULL,
  budget_note TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'matched', 'waitlisted', 'closed')),
  assigned_to_identity_id UUID NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for waitlist
CREATE INDEX IF NOT EXISTS idx_housing_waitlist_portal_status ON cc_portal_housing_waitlist_entries(portal_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_housing_waitlist_email ON cc_portal_housing_waitlist_entries(portal_id, applicant_email);
CREATE INDEX IF NOT EXISTS idx_housing_waitlist_bundle ON cc_portal_housing_waitlist_entries(bundle_id) WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_housing_waitlist_application ON cc_portal_housing_waitlist_entries(application_id) WHERE application_id IS NOT NULL;

-- Indexes for offers
CREATE INDEX IF NOT EXISTS idx_housing_offers_portal ON cc_portal_housing_offers(portal_id);
CREATE INDEX IF NOT EXISTS idx_housing_offers_tenant ON cc_portal_housing_offers(tenant_id);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_housing_waitlist_unique_bundle 
  ON cc_portal_housing_waitlist_entries(portal_id, bundle_id) 
  WHERE bundle_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_housing_waitlist_unique_application 
  ON cc_portal_housing_waitlist_entries(portal_id, application_id) 
  WHERE application_id IS NOT NULL;

-- Enable RLS
ALTER TABLE cc_portal_housing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_portal_housing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_portal_housing_waitlist_entries ENABLE ROW LEVEL SECURITY;

-- RLS: Housing Policies
DROP POLICY IF EXISTS housing_policies_service_all ON cc_portal_housing_policies;
CREATE POLICY housing_policies_service_all ON cc_portal_housing_policies
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS housing_policies_portal_read ON cc_portal_housing_policies;
CREATE POLICY housing_policies_portal_read ON cc_portal_housing_policies
  FOR SELECT USING (
    portal_id = current_setting('app.portal_id', true)::uuid
  );

-- RLS: Housing Offers
DROP POLICY IF EXISTS housing_offers_service_all ON cc_portal_housing_offers;
CREATE POLICY housing_offers_service_all ON cc_portal_housing_offers
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS housing_offers_portal_read ON cc_portal_housing_offers;
CREATE POLICY housing_offers_portal_read ON cc_portal_housing_offers
  FOR SELECT USING (
    portal_id = current_setting('app.portal_id', true)::uuid
  );

DROP POLICY IF EXISTS housing_offers_tenant_manage ON cc_portal_housing_offers;
CREATE POLICY housing_offers_tenant_manage ON cc_portal_housing_offers
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- RLS: Waitlist Entries (portal staff only, tenants cannot read)
DROP POLICY IF EXISTS housing_waitlist_service_all ON cc_portal_housing_waitlist_entries;
CREATE POLICY housing_waitlist_service_all ON cc_portal_housing_waitlist_entries
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS housing_waitlist_portal_staff ON cc_portal_housing_waitlist_entries;
CREATE POLICY housing_waitlist_portal_staff ON cc_portal_housing_waitlist_entries
  FOR ALL USING (
    portal_id = current_setting('app.portal_id', true)::uuid
  );

COMMENT ON TABLE cc_portal_housing_policies IS 'Portal-level housing policy settings';
COMMENT ON TABLE cc_portal_housing_offers IS 'Employer-provided housing capacity signals';
COMMENT ON TABLE cc_portal_housing_waitlist_entries IS 'Housing needs queue for concierge routing';
