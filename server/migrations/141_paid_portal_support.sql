-- Migration 141: Paid Portal Support for AdrenalineCanada
-- PSP-agnostic paid placement architecture

-- ============================================================================
-- STEP A: Extend cc_portal_distribution_policies with pricing metadata
-- ============================================================================
ALTER TABLE cc_portal_distribution_policies
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS billing_unit text DEFAULT 'perPosting',
  ADD COLUMN IF NOT EXISTS requires_checkout boolean DEFAULT false;

COMMENT ON COLUMN cc_portal_distribution_policies.price_cents IS 'Price in cents for paid portals';
COMMENT ON COLUMN cc_portal_distribution_policies.currency IS 'ISO 4217 currency code';
COMMENT ON COLUMN cc_portal_distribution_policies.billing_unit IS 'Billing unit: perPosting, perDay, perMonth';
COMMENT ON COLUMN cc_portal_distribution_policies.requires_checkout IS 'Whether checkout flow is required before publishing';

-- ============================================================================
-- STEP B: Seed/Update distribution policies for known portals
-- ============================================================================

-- Get portal IDs
DO $$
DECLARE
  v_canadadirect_id uuid;
  v_adrenaline_id uuid;
  v_bamfield_id uuid;
BEGIN
  SELECT id INTO v_canadadirect_id FROM cc_portals WHERE slug = 'canadadirect' LIMIT 1;
  SELECT id INTO v_adrenaline_id FROM cc_portals WHERE slug = 'adrenalinecanada' LIMIT 1;
  SELECT id INTO v_bamfield_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;

  -- CanadaDirect: free, requires moderation (already exists, update if needed)
  IF v_canadadirect_id IS NOT NULL THEN
    INSERT INTO cc_portal_distribution_policies (
      portal_id, is_accepting_job_postings, requires_moderation, pricing_model,
      price_cents, currency, billing_unit, requires_checkout, default_selected
    ) VALUES (
      v_canadadirect_id, true, true, 'free',
      NULL, 'CAD', 'perPosting', false, true
    ) ON CONFLICT (portal_id) DO UPDATE SET
      pricing_model = 'free',
      price_cents = NULL,
      requires_checkout = false,
      requires_moderation = true,
      updated_at = now();
  END IF;

  -- AdrenalineCanada: paid, $29 per posting, requires checkout
  IF v_adrenaline_id IS NOT NULL THEN
    INSERT INTO cc_portal_distribution_policies (
      portal_id, is_accepting_job_postings, requires_moderation, pricing_model,
      price_cents, currency, billing_unit, requires_checkout, default_selected
    ) VALUES (
      v_adrenaline_id, true, false, 'paid',
      2900, 'CAD', 'perPosting', true, true
    ) ON CONFLICT (portal_id) DO UPDATE SET
      pricing_model = 'paid',
      price_cents = 2900,
      currency = 'CAD',
      billing_unit = 'perPosting',
      requires_checkout = true,
      requires_moderation = false,
      updated_at = now();
  END IF;

  -- Bamfield: free, no moderation
  IF v_bamfield_id IS NOT NULL THEN
    INSERT INTO cc_portal_distribution_policies (
      portal_id, is_accepting_job_postings, requires_moderation, pricing_model,
      price_cents, currency, billing_unit, requires_checkout, default_selected
    ) VALUES (
      v_bamfield_id, true, false, 'free',
      NULL, 'CAD', 'perPosting', false, true
    ) ON CONFLICT (portal_id) DO UPDATE SET
      pricing_model = 'free',
      price_cents = NULL,
      requires_checkout = false,
      updated_at = now();
  END IF;
END $$;

-- ============================================================================
-- STEP C: PSP-agnostic paid publication intents table
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE paid_publication_intent_status AS ENUM (
    'requires_action', 'pending_payment', 'paid', 'failed', 'refunded', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_paid_publication_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  billing_unit text NOT NULL DEFAULT 'perPosting',
  status paid_publication_intent_status NOT NULL DEFAULT 'requires_action',
  psp_provider text,
  psp_reference text,
  psp_checkout_url text,
  psp_metadata jsonb DEFAULT '{}',
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, portal_id)
);

CREATE INDEX IF NOT EXISTS idx_paid_pub_intents_tenant ON cc_paid_publication_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paid_pub_intents_job ON cc_paid_publication_intents(job_id);
CREATE INDEX IF NOT EXISTS idx_paid_pub_intents_status ON cc_paid_publication_intents(status);

COMMENT ON TABLE cc_paid_publication_intents IS 'PSP-agnostic paid placement intents for job postings';
COMMENT ON COLUMN cc_paid_publication_intents.psp_provider IS 'Payment provider identifier (stripe, square, etc)';
COMMENT ON COLUMN cc_paid_publication_intents.psp_reference IS 'Payment provider transaction/session reference';
COMMENT ON COLUMN cc_paid_publication_intents.psp_checkout_url IS 'Redirect URL for hosted checkout';

-- RLS for paid publication intents
ALTER TABLE cc_paid_publication_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paid_pub_intents_tenant_read ON cc_paid_publication_intents;
CREATE POLICY paid_pub_intents_tenant_read ON cc_paid_publication_intents
  FOR SELECT USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  );

DROP POLICY IF EXISTS paid_pub_intents_service_manage ON cc_paid_publication_intents;
CREATE POLICY paid_pub_intents_service_manage ON cc_paid_publication_intents
  FOR ALL USING (is_service_mode());

-- ============================================================================
-- STEP D: Add draft publish_state if not exists
-- ============================================================================
-- Ensure 'draft' is a valid publish_state (if using enum, alter it; if text, no change needed)
-- cc_job_postings.publish_state is text, so 'draft' is already valid

-- ============================================================================
-- STEP E: Migration complete marker
-- ============================================================================
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (141, 'Paid portal support for AdrenalineCanada', now())
ON CONFLICT DO NOTHING;
