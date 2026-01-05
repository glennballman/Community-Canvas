-- ============================================================
-- COMMUNITY CANVAS v2.6 - CONTRACTOR FINANCING LAYER
-- Migration 036 - Materials, Equipment, Labour Finance
-- ============================================================

-- Philosophy:
-- - Finance execution, not speculation
-- - Financing only when real job + verified counterparty exists
-- - Contractor-first: they can't float $80K for 90 days
-- - Government/FN contracts are basically guaranteed money (factoring)
-- - Platform becomes finance-grade, not gig marketplace

-- ============================================================
-- 1. FINANCING ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE financing_category AS ENUM (
    'materials_advance',      -- Lumber, roofing, concrete, fixtures
    'labour_bridge',          -- Pay crew weekly before milestone
    'equipment_finance',      -- Excavator, crane, barge mobilization
    'receivable_factoring',   -- Advance against signed gov/FN contract
    'mobilization_advance'    -- Travel, accommodation, fuel
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE financing_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'funded',
    'partially_repaid',
    'repaid',
    'defaulted',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_type AS ENUM (
    'crown',           -- BDC, EDC
    'bank',            -- Traditional banks
    'fn_finance',      -- FNFA, Indigenous finance authorities
    'credit_union',    -- Regional credit unions
    'private',         -- Private factoring firms
    'platform'         -- Community Canvas internal (future)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE repayment_source AS ENUM (
    'owner_payment',
    'government_payment',
    'first_nation_payment',
    'milestone_payment',
    'holdback_release'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE disbursement_type AS ENUM (
    'vendor_direct',       -- Pay supplier directly
    'contractor_direct',   -- Pay contractor
    'escrow_hold'          -- Hold in escrow until conditions met
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. FINANCING PRODUCTS (Available Programs)
-- ============================================================

CREATE TABLE IF NOT EXISTS financing_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider info
  provider_name TEXT NOT NULL,
  provider_type provider_type NOT NULL,
  provider_contact_email TEXT,
  provider_contact_phone TEXT,
  provider_website TEXT,
  
  -- Product details
  product_name TEXT NOT NULL,
  product_code TEXT UNIQUE,
  product_category financing_category NOT NULL,
  product_description TEXT,
  
  -- Eligibility
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),
  eligible_counterparties TEXT[] DEFAULT ARRAY['government', 'first_nation', 'municipal'],
  eligible_provinces TEXT[] DEFAULT ARRAY['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'],
  requires_signed_contract BOOLEAN DEFAULT true,
  requires_verified_scope BOOLEAN DEFAULT true,
  min_contractor_trust_score INTEGER DEFAULT 50,
  
  -- Terms
  advance_percent NUMERIC(5,2),          -- e.g., 70.00 = 70%
  fee_percent NUMERIC(5,2),              -- e.g., 2.50 = 2.5%
  interest_annual_percent NUMERIC(5,2),  -- e.g., 8.00 = 8% APR
  typical_term_days INTEGER,
  max_term_days INTEGER,
  
  -- Platform commission
  platform_referral_fee_percent NUMERIC(5,2) DEFAULT 1.00,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  notes TEXT,
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financing_products_category_idx ON financing_products(product_category);
CREATE INDEX IF NOT EXISTS financing_products_active_idx ON financing_products(is_active) WHERE is_active;

-- ============================================================
-- 3. CONTRACTOR FINANCING REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS contractor_financing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request reference
  request_ref TEXT UNIQUE DEFAULT 'FIN-' || SUBSTRING(gen_random_uuid()::text, 1, 8),
  
  -- Links
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  conversation_id UUID REFERENCES conversations(id),
  contractor_party_id UUID NOT NULL REFERENCES parties(id),
  requested_by_individual_id UUID REFERENCES cc_individuals(id),
  
  -- Financing type
  financing_type financing_category NOT NULL,
  
  -- Amount
  amount_requested NUMERIC(12,2) NOT NULL,
  amount_approved NUMERIC(12,2),
  amount_funded NUMERIC(12,2),
  currency CHAR(3) DEFAULT 'CAD',
  
  -- Use of funds (structured)
  use_of_funds JSONB NOT NULL,
  
  -- Bill of Materials link (if exists)
  bom_id UUID,
  
  -- Repayment
  repayment_source repayment_source NOT NULL,
  related_milestone_id UUID REFERENCES payment_milestones(id),
  expected_repayment_date DATE,
  actual_repayment_date DATE,
  
  -- Status
  status financing_status DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ,
  status_history JSONB DEFAULT '[]'::jsonb,
  
  -- Provider assignment
  financing_product_id UUID REFERENCES financing_products(id),
  provider_name TEXT,
  provider_reference TEXT,
  provider_notes TEXT,
  
  -- Terms (copied from product or negotiated)
  approved_advance_percent NUMERIC(5,2),
  approved_fee_percent NUMERIC(5,2),
  approved_interest_percent NUMERIC(5,2),
  approved_term_days INTEGER,
  
  -- Platform fees
  platform_fee_percent NUMERIC(5,2),
  platform_fee_amount NUMERIC(12,2),
  
  -- Eligibility signals (auto-computed)
  eligibility_signals JSONB,
  
  -- Documents
  supporting_documents JSONB,
  
  -- Finance pack (generated PDF reference)
  finance_pack_url TEXT,
  finance_pack_generated_at TIMESTAMPTZ,
  
  -- Rejection/cancellation
  rejection_reason TEXT,
  cancelled_reason TEXT,
  cancelled_by_party_id UUID REFERENCES parties(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financing_requests_opportunity_idx ON contractor_financing_requests(opportunity_id);
CREATE INDEX IF NOT EXISTS financing_requests_contractor_idx ON contractor_financing_requests(contractor_party_id);
CREATE INDEX IF NOT EXISTS financing_requests_status_idx ON contractor_financing_requests(status);

-- ============================================================
-- 4. FINANCING DISBURSEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS financing_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  financing_request_id UUID NOT NULL REFERENCES contractor_financing_requests(id),
  
  -- Disbursement details
  disbursement_type disbursement_type NOT NULL,
  
  amount NUMERIC(12,2) NOT NULL,
  currency CHAR(3) DEFAULT 'CAD',
  
  -- Recipient
  paid_to_name TEXT NOT NULL,
  paid_to_party_id UUID REFERENCES parties(id),
  paid_to_vendor_id UUID,
  
  -- Payment details
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Timing
  scheduled_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  
  -- Proof
  proof JSONB,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'confirmed', 'failed', 'cancelled')),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disbursements_request_idx ON financing_disbursements(financing_request_id);

-- ============================================================
-- 5. FINANCING REPAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS financing_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  financing_request_id UUID NOT NULL REFERENCES contractor_financing_requests(id),
  
  -- Source
  source_type repayment_source NOT NULL,
  source_milestone_id UUID REFERENCES payment_milestones(id),
  
  -- Amount
  principal_amount NUMERIC(12,2) NOT NULL,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  interest_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  currency CHAR(3) DEFAULT 'CAD',
  
  -- Payment details
  payment_reference TEXT,
  
  -- Timing
  expected_date DATE,
  received_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'expected' CHECK (status IN ('expected', 'received', 'partial', 'late', 'defaulted')),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repayments_request_idx ON financing_repayments(financing_request_id);

-- ============================================================
-- 6. SEED INITIAL FINANCING PRODUCTS
-- ============================================================

INSERT INTO financing_products (
  provider_name, provider_type, product_name, product_code, product_category,
  product_description, min_amount, max_amount,
  eligible_counterparties, requires_signed_contract, requires_verified_scope,
  advance_percent, fee_percent, interest_annual_percent, typical_term_days
) VALUES 
  -- BDC Materials Advance
  (
    'BDC', 'crown', 'Construction Materials Advance', 'BDC-MAT-001', 'materials_advance',
    'Advance up to 70% of verified materials costs for government/FN contracts',
    25000, 500000,
    ARRAY['government', 'first_nation', 'municipal'],
    true, true,
    70.00, 2.50, 8.00, 90
  ),
  -- FNFA Materials
  (
    'First Nations Finance Authority', 'fn_finance', 'FN Community Materials Program', 'FNFA-MAT-001', 'materials_advance',
    'Materials financing for First Nations community infrastructure projects',
    10000, 250000,
    ARRAY['first_nation'],
    true, true,
    75.00, 2.00, 6.50, 120
  ),
  -- Labour Bridge
  (
    'BDC', 'crown', 'Labour Bridge Facility', 'BDC-LAB-001', 'labour_bridge',
    'Bridge financing for payroll during government contract execution',
    15000, 200000,
    ARRAY['government', 'first_nation', 'municipal'],
    true, true,
    80.00, 3.00, 10.00, 60
  ),
  -- Receivable Factoring
  (
    'Regional Construction Finance', 'private', 'Government Receivable Factoring', 'RCF-FACT-001', 'receivable_factoring',
    'Advance against signed government/FN contracts with verified payment terms',
    50000, 2000000,
    ARRAY['government', 'first_nation'],
    true, true,
    85.00, 3.50, 0.00, 90
  ),
  -- Equipment/Mobilization
  (
    'BDC', 'crown', 'Equipment Mobilization Advance', 'BDC-MOB-001', 'mobilization_advance',
    'Financing for equipment transport, barge fees, crane rental for remote sites',
    10000, 150000,
    ARRAY['government', 'first_nation', 'municipal'],
    true, true,
    65.00, 3.00, 9.00, 45
  )
ON CONFLICT (product_code) DO NOTHING;

-- ============================================================
-- 7. ADD OWNER TYPE TO OPPORTUNITIES (if not exists)
-- ============================================================

DO $$ BEGIN
  ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS owner_type TEXT 
    CHECK (owner_type IN ('private', 'commercial', 'government', 'first_nation', 'municipal', 'non_profit'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 8. COMMENTS
-- ============================================================

COMMENT ON TABLE contractor_financing_requests IS 
  'Finance execution, not speculation. Only for real jobs with verified counterparties.';

COMMENT ON TABLE financing_products IS 
  'Available financing programs. Contractor-friendly, not lender-first.';
