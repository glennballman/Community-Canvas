-- Migration 145: Campaign Apply (Application Bundles)
-- Allows candidates to apply to multiple jobs at once via portal campaigns

-- cc_job_application_bundles: Groups multiple applications into one submission
CREATE TABLE IF NOT EXISTS cc_job_application_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES cc_portals(id),
  campaign_key TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  applicant_location TEXT,
  housing_needed BOOLEAN NOT NULL DEFAULT false,
  work_permit_question TEXT,
  message TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'withdrawn')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundles_portal ON cc_job_application_bundles(portal_id);
CREATE INDEX IF NOT EXISTS idx_bundles_email ON cc_job_application_bundles(applicant_email);
CREATE INDEX IF NOT EXISTS idx_bundles_campaign ON cc_job_application_bundles(campaign_key);

-- cc_job_application_bundle_items: Individual job applications within a bundle
CREATE TABLE IF NOT EXISTS cc_job_application_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES cc_job_application_bundles(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES cc_job_postings(id),
  job_id UUID NOT NULL REFERENCES cc_jobs(id),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  application_id UUID REFERENCES cc_job_applications(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON cc_job_application_bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_job ON cc_job_application_bundle_items(job_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_tenant ON cc_job_application_bundle_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_application ON cc_job_application_bundle_items(application_id);

-- Unique constraint to prevent duplicate bundle items
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_items_unique_posting ON cc_job_application_bundle_items(bundle_id, job_posting_id);

-- Add campaign_settings to portal settings (JSONB column if not exists)
-- This stores which campaigns the portal supports

-- RLS Policies
ALTER TABLE cc_job_application_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_job_application_bundle_items ENABLE ROW LEVEL SECURITY;

-- Public cannot read bundles directly
-- Bundles are created via service mode

-- Service mode bypass for bundles
DROP POLICY IF EXISTS bundles_service_bypass ON cc_job_application_bundles;
CREATE POLICY bundles_service_bypass ON cc_job_application_bundles
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Portal staff can read bundles for their portal
DROP POLICY IF EXISTS bundles_portal_read ON cc_job_application_bundles;
CREATE POLICY bundles_portal_read ON cc_job_application_bundles
  FOR SELECT
  USING (
    portal_id IN (
      SELECT p.id FROM cc_portals p
      WHERE p.owning_tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- Service mode bypass for bundle items
DROP POLICY IF EXISTS bundle_items_service_bypass ON cc_job_application_bundle_items;
CREATE POLICY bundle_items_service_bypass ON cc_job_application_bundle_items
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can read bundle items for jobs they own
DROP POLICY IF EXISTS bundle_items_tenant_read ON cc_job_application_bundle_items;
CREATE POLICY bundle_items_tenant_read ON cc_job_application_bundle_items
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Comments
COMMENT ON TABLE cc_job_application_bundles IS 'Groups multiple job applications from a single campaign apply submission';
COMMENT ON TABLE cc_job_application_bundle_items IS 'Individual job applications within a campaign apply bundle';
COMMENT ON COLUMN cc_job_application_bundles.campaign_key IS 'Campaign identifier: hospitality_all, trades_all, crew_all, or custom';
COMMENT ON COLUMN cc_job_application_bundles.consent_given IS 'User confirmed sending application to multiple employers';
