-- Migration 144: Add job publish validation fields
-- Adds housing_status, housing_cost, work_permit_support, work_permit_conditions, pay_unit
-- Required for CanadaDirect and AdrenalineCanada publish validation

-- Add pay_unit column with UI-compatible values (handles fresh installs)
-- Supports both legacy values (hour, day, week, month, year) and UI values (hourly, daily, weekly, monthly, annually, fixed)
-- Note: Existing installations should run admin migration to update constraint separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cc_jobs' AND column_name = 'pay_unit'
  ) THEN
    ALTER TABLE cc_jobs ADD COLUMN pay_unit TEXT NOT NULL DEFAULT 'hourly';
    ALTER TABLE cc_jobs ADD CONSTRAINT cc_jobs_pay_unit_check
      CHECK (pay_unit IN ('hourly', 'daily', 'weekly', 'monthly', 'annually', 'fixed', 'hour', 'day', 'week', 'month', 'year'));
  END IF;
  
  -- For existing installations: add new constraint with extended name (additive-only)
  -- The new constraint is more permissive and includes all values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cc_jobs_pay_unit_v2_check' 
    AND conrelid = 'cc_jobs'::regclass
  ) AND EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cc_jobs_pay_unit_check' 
    AND conrelid = 'cc_jobs'::regclass
    AND pg_get_constraintdef(oid) NOT LIKE '%hourly%'
  ) THEN
    -- Add new permissive constraint with different name (additive)
    ALTER TABLE cc_jobs ADD CONSTRAINT cc_jobs_pay_unit_v2_check
      CHECK (pay_unit IN ('hourly', 'daily', 'weekly', 'monthly', 'annually', 'fixed', 'hour', 'day', 'week', 'month', 'year'))
      NOT VALID;
    ALTER TABLE cc_jobs VALIDATE CONSTRAINT cc_jobs_pay_unit_v2_check;
    -- Note: Old constraint cc_jobs_pay_unit_check remains for backwards compatibility
    -- It will be satisfied as long as values are in both constraints
  END IF;
END $$;

-- Add housing_status column (more granular than housing_provided boolean)
ALTER TABLE cc_jobs ADD COLUMN IF NOT EXISTS housing_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (housing_status IN ('available', 'limited', 'none', 'unknown'));

-- Add housing cost range columns
ALTER TABLE cc_jobs ADD COLUMN IF NOT EXISTS housing_cost_min_cents INTEGER NULL;
ALTER TABLE cc_jobs ADD COLUMN IF NOT EXISTS housing_cost_max_cents INTEGER NULL;

-- Add work permit support columns
ALTER TABLE cc_jobs ADD COLUMN IF NOT EXISTS work_permit_support TEXT NOT NULL DEFAULT 'unknown'
  CHECK (work_permit_support IN ('none', 'consider', 'yes_with_conditions', 'unknown'));
ALTER TABLE cc_jobs ADD COLUMN IF NOT EXISTS work_permit_conditions TEXT NULL;

-- Add constraint for housing cost range validation (additive only - uses DO block to check if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cc_jobs_housing_cost_range_check' 
    AND conrelid = 'cc_jobs'::regclass
  ) THEN
    ALTER TABLE cc_jobs ADD CONSTRAINT cc_jobs_housing_cost_range_check
      CHECK (
        (housing_cost_min_cents IS NULL AND housing_cost_max_cents IS NULL) OR
        (housing_cost_min_cents IS NOT NULL AND housing_cost_max_cents IS NOT NULL 
         AND housing_cost_min_cents >= 0 
         AND housing_cost_max_cents >= housing_cost_min_cents)
      );
  END IF;
END $$;

-- Ensure CanadaDirect portal exists (moderated, free)
INSERT INTO cc_portals (id, slug, name, status, primary_audience, default_locale, default_currency, supported_locales, default_route, settings)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'canadadirect',
  'CanadaDirect',
  'active',
  'worker',
  'en-CA',
  'CAD',
  ARRAY['en-CA'],
  '/jobs',
  '{}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Ensure CanadaDirect distribution policy exists (moderated, no checkout)
INSERT INTO cc_portal_distribution_policies (
  portal_id, 
  is_accepting_job_postings,
  requires_moderation,
  requires_checkout,
  price_cents,
  currency
)
SELECT 
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  true,
  true,
  false,
  0,
  'CAD'
WHERE EXISTS (SELECT 1 FROM cc_portals WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (portal_id) DO NOTHING;

-- Add index for efficient portal lookup by slug
CREATE INDEX IF NOT EXISTS idx_cc_portals_slug ON cc_portals(slug);

-- Comment documenting the validation rules
COMMENT ON COLUMN cc_jobs.housing_status IS 'Housing availability: available, limited, none, unknown. Required for CanadaDirect/AdrenalineCanada.';
COMMENT ON COLUMN cc_jobs.work_permit_support IS 'Work permit support level: none, consider, yes_with_conditions, unknown. Required for CanadaDirect/AdrenalineCanada.';
COMMENT ON COLUMN cc_jobs.pay_unit IS 'Pay rate unit: hourly, daily, weekly, monthly, annually, fixed (or legacy: hour, day, week, month, year). Used with pay_min/pay_max.';
