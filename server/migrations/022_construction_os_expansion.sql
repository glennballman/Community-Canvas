-- Migration 022: Construction OS Expansion
-- 
-- Adds complete construction project lifecycle management:
-- - Pre-Award: Opportunities, Estimates, Bids
-- - Contracts and Change Orders
-- - Plan Packs: Materials, Crew, Equipment, Compliance, Accommodation
-- - Closeout: Deficiencies, Acceptance, Holdbacks
-- - Events/Outbox for cursor-based sync
-- - Lifecycle enforcement triggers

-- ============================================================================
-- SECTION 0: ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE party_type AS ENUM ('contractor', 'subcontractor', 'supplier', 'owner', 'consultant', 'government');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE party_status AS ENUM ('pending', 'approved', 'suspended', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_status AS ENUM ('draft', 'published', 'evaluating', 'awarded', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estimate_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM ('draft', 'submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM ('draft', 'pending_signature', 'active', 'on_hold', 'complete', 'terminated', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE change_order_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE work_order_phase_status AS ENUM (
    'created', 'planning', 'mobilizing', 'in_progress', 
    'substantial_completion', 'deficiency_period', 'final_completion', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM ('draft', 'submitted', 'approved', 'active', 'complete', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE closeout_status AS ENUM ('open', 'in_progress', 'resolved', 'accepted', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM (
    'opportunity_created', 'opportunity_published', 'bid_submitted', 'bid_accepted',
    'contract_signed', 'work_order_created', 'phase_transition', 'change_order_approved',
    'inspection_passed', 'deficiency_raised', 'acceptance_signed', 'payment_released'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 1: PARTIES (Companies/Contractors)
-- ============================================================================

CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  party_type party_type NOT NULL DEFAULT 'contractor',
  status party_status NOT NULL DEFAULT 'pending',
  
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  registration_number TEXT,
  tax_id TEXT,
  
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT DEFAULT 'BC',
  postal_code TEXT,
  country TEXT DEFAULT 'CA',
  
  certifications JSONB DEFAULT '[]',
  insurance_info JSONB DEFAULT '{}',
  bonding_capacity NUMERIC(15,2),
  
  rating NUMERIC(3,2),
  total_contracts INTEGER DEFAULT 0,
  total_value NUMERIC(15,2) DEFAULT 0,
  
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parties_tenant ON parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);
CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);

-- ============================================================================
-- SECTION 2: OPPORTUNITIES (Pre-Award Job Postings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_ref VARCHAR(20) UNIQUE,
  
  community_id UUID,
  owner_tenant_id UUID REFERENCES cc_tenants(id),
  
  title TEXT NOT NULL,
  description TEXT,
  scope_of_work TEXT,
  
  service_bundle_id UUID,
  work_category TEXT,
  
  site_address TEXT,
  site_latitude NUMERIC(10,7),
  site_longitude NUMERIC(10,7),
  -- site_geom column removed: using lat/lng with haversine functions (see migration 028)
  
  estimated_value_low NUMERIC(15,2),
  estimated_value_high NUMERIC(15,2),
  budget_ceiling NUMERIC(15,2),
  
  bid_deadline TIMESTAMPTZ,
  questions_deadline TIMESTAMPTZ,
  expected_start_date DATE,
  expected_duration_days INTEGER,
  
  requirements JSONB DEFAULT '{}',
  required_certifications TEXT[],
  insurance_requirements JSONB DEFAULT '{}',
  
  status opportunity_status NOT NULL DEFAULT 'draft',
  is_public BOOLEAN DEFAULT false,
  
  published_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  awarded_to_party_id UUID REFERENCES parties(id),
  award_reason TEXT,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(bid_deadline) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_opportunities_lat ON opportunities(site_latitude) WHERE site_latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_lng ON opportunities(site_longitude) WHERE site_longitude IS NOT NULL;

-- Add FK to sr_bundles if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sr_bundles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'opportunities_service_bundle_id_fkey'
    ) THEN
      ALTER TABLE opportunities 
        ADD CONSTRAINT opportunities_service_bundle_id_fkey 
        FOREIGN KEY (service_bundle_id) REFERENCES sr_bundles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Opportunity attachments
CREATE TABLE IF NOT EXISTS opportunity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_media_opp ON opportunity_media(opportunity_id);

-- Opportunity measurements/quantities
CREATE TABLE IF NOT EXISTS opportunity_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(15,4),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_measurements_opp ON opportunity_measurements(opportunity_id);

-- ============================================================================
-- SECTION 3: ESTIMATES (Versioned Quotes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_ref VARCHAR(20) UNIQUE,
  
  opportunity_id UUID REFERENCES opportunities(id),
  work_order_id UUID,
  
  party_id UUID REFERENCES parties(id),
  tenant_id UUID REFERENCES cc_tenants(id),
  
  title TEXT NOT NULL,
  description TEXT,
  
  status estimate_status NOT NULL DEFAULT 'draft',
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_opportunity ON estimates(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_estimates_party ON estimates(party_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);

-- Estimate versions for tracking changes
CREATE TABLE IF NOT EXISTS estimate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0.05,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  margin_percent NUMERIC(5,2),
  contingency_percent NUMERIC(5,2),
  
  valid_until DATE,
  notes TEXT,
  
  is_baseline BOOLEAN DEFAULT false,
  
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(estimate_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_estimate ON estimate_versions(estimate_id);

-- Estimate line items
CREATE TABLE IF NOT EXISTS estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_version_id UUID NOT NULL REFERENCES estimate_versions(id) ON DELETE CASCADE,
  
  line_number INTEGER NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  cost_type TEXT DEFAULT 'direct',
  is_optional BOOLEAN DEFAULT false,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_lines_version ON estimate_line_items(estimate_version_id);

-- Estimate allowances (contingencies, provisional sums)
CREATE TABLE IF NOT EXISTS estimate_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_version_id UUID NOT NULL REFERENCES estimate_versions(id) ON DELETE CASCADE,
  
  allowance_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  
  is_included_in_total BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_allowances_version ON estimate_allowances(estimate_version_id);

-- ============================================================================
-- SECTION 4: BIDS (Contractor Proposals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_ref VARCHAR(20) UNIQUE,
  
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  estimate_id UUID REFERENCES estimates(id),
  
  status bid_status NOT NULL DEFAULT 'draft',
  
  bid_amount NUMERIC(15,2),
  proposed_start_date DATE,
  proposed_duration_days INTEGER,
  
  technical_proposal TEXT,
  methodology TEXT,
  team_composition JSONB DEFAULT '[]',
  
  exceptions TEXT,
  clarifications TEXT,
  
  score_technical NUMERIC(5,2),
  score_price NUMERIC(5,2),
  score_overall NUMERIC(5,2),
  evaluation_notes TEXT,
  
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  evaluated_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(opportunity_id, party_id)
);

CREATE INDEX IF NOT EXISTS idx_bids_opportunity ON bids(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bids_party ON bids(party_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- Bid breakdown lines
CREATE TABLE IF NOT EXISTS bid_breakdown_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  
  line_number INTEGER NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  
  quantity NUMERIC(15,4),
  unit TEXT,
  unit_price NUMERIC(15,4),
  total_price NUMERIC(15,2),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bid_breakdown_bid ON bid_breakdown_lines(bid_id);

-- Bid messages/Q&A
CREATE TABLE IF NOT EXISTS bid_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
  
  from_party_id UUID REFERENCES parties(id),
  from_tenant_id UUID REFERENCES cc_tenants(id),
  
  message_type TEXT DEFAULT 'question',
  subject TEXT,
  body TEXT NOT NULL,
  
  is_public BOOLEAN DEFAULT false,
  
  parent_message_id UUID REFERENCES bid_messages(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bid_messages_opp ON bid_messages(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bid_messages_bid ON bid_messages(bid_id);

-- ============================================================================
-- SECTION 5: CONTRACTS (Binding Agreements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_ref VARCHAR(20) UNIQUE,
  
  opportunity_id UUID REFERENCES opportunities(id),
  bid_id UUID REFERENCES bids(id),
  
  owner_tenant_id UUID REFERENCES cc_tenants(id),
  contractor_party_id UUID NOT NULL REFERENCES parties(id),
  
  contract_type TEXT DEFAULT 'fixed_price',
  title TEXT NOT NULL,
  description TEXT,
  
  scope_of_work TEXT,
  
  contract_value NUMERIC(15,2) NOT NULL,
  approved_changes NUMERIC(15,2) DEFAULT 0,
  current_value NUMERIC(15,2) GENERATED ALWAYS AS (contract_value + COALESCE(approved_changes, 0)) STORED,
  
  retention_percent NUMERIC(5,2) DEFAULT 10,
  holdback_percent NUMERIC(5,2) DEFAULT 10,
  
  start_date DATE,
  substantial_completion_date DATE,
  final_completion_date DATE,
  warranty_end_date DATE,
  
  status contract_status NOT NULL DEFAULT 'draft',
  
  signed_at TIMESTAMPTZ,
  signed_by_owner UUID,
  signed_by_contractor UUID,
  
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT,
  
  terms_document_url TEXT,
  
  metadata JSONB DEFAULT '{}',
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contractor ON contracts(contractor_party_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Contract payment schedule
CREATE TABLE IF NOT EXISTS contract_payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  
  milestone_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  
  scheduled_date DATE,
  amount NUMERIC(15,2) NOT NULL,
  retention_amount NUMERIC(15,2) DEFAULT 0,
  net_amount NUMERIC(15,2) GENERATED ALWAYS AS (amount - COALESCE(retention_amount, 0)) STORED,
  
  status TEXT DEFAULT 'scheduled',
  
  invoice_number TEXT,
  invoiced_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_contract ON contract_payment_schedule(contract_id);

-- ============================================================================
-- SECTION 6: CHANGE ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_ref VARCHAR(20) UNIQUE,
  
  contract_id UUID NOT NULL REFERENCES contracts(id),
  work_order_id UUID,
  
  change_order_number INTEGER NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  
  status change_order_status NOT NULL DEFAULT 'draft',
  
  requested_by_party_id UUID REFERENCES parties(id),
  requested_by_tenant_id UUID REFERENCES cc_tenants(id),
  
  cost_impact NUMERIC(15,2) DEFAULT 0,
  time_impact_days INTEGER DEFAULT 0,
  
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(contract_id, change_order_number)
);

CREATE INDEX IF NOT EXISTS idx_change_orders_contract ON change_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);

-- Change order line items
CREATE TABLE IF NOT EXISTS change_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  
  quantity NUMERIC(15,4),
  unit TEXT,
  unit_cost NUMERIC(15,4),
  total_cost NUMERIC(15,2),
  
  is_addition BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_co_lines_co ON change_order_lines(change_order_id);

-- Change order impacts
CREATE TABLE IF NOT EXISTS change_order_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  
  impact_type TEXT NOT NULL,
  description TEXT,
  
  original_value TEXT,
  new_value TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_co_impacts_co ON change_order_impacts(change_order_id);

-- ============================================================================
-- SECTION 7: PLAN PACKS (Materials, Crew, Equipment, Compliance, Accommodation)
-- ============================================================================

-- Materials Plan
CREATE TABLE IF NOT EXISTS materials_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  title TEXT NOT NULL,
  description TEXT,
  status plan_status NOT NULL DEFAULT 'draft',
  
  total_cost_estimate NUMERIC(15,2) DEFAULT 0,
  
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_plans_wo ON materials_plans(work_order_id);

-- Crew Plan
CREATE TABLE IF NOT EXISTS crew_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  title TEXT NOT NULL,
  description TEXT,
  status plan_status NOT NULL DEFAULT 'draft',
  
  total_labor_hours INTEGER DEFAULT 0,
  total_labor_cost NUMERIC(15,2) DEFAULT 0,
  
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_plans_wo ON crew_plans(work_order_id);

-- Equipment Plan
CREATE TABLE IF NOT EXISTS equipment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  title TEXT NOT NULL,
  description TEXT,
  status plan_status NOT NULL DEFAULT 'draft',
  
  total_equipment_cost NUMERIC(15,2) DEFAULT 0,
  
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_plans_wo ON equipment_plans(work_order_id);

-- Compliance Plan
CREATE TABLE IF NOT EXISTS compliance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  title TEXT NOT NULL,
  description TEXT,
  status plan_status NOT NULL DEFAULT 'draft',
  
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_plans_wo ON compliance_plans(work_order_id);

-- Accommodation Plan
CREATE TABLE IF NOT EXISTS accommodation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  title TEXT NOT NULL,
  description TEXT,
  status plan_status NOT NULL DEFAULT 'draft',
  
  crew_count INTEGER,
  nights_required INTEGER,
  total_accommodation_cost NUMERIC(15,2) DEFAULT 0,
  
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_plans_wo ON accommodation_plans(work_order_id);

-- ============================================================================
-- SECTION 8: CREW DETAILS
-- ============================================================================

-- Crew roles
CREATE TABLE IF NOT EXISTS crew_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_plan_id UUID NOT NULL REFERENCES crew_plans(id) ON DELETE CASCADE,
  
  role_name TEXT NOT NULL,
  description TEXT,
  
  quantity_required INTEGER NOT NULL DEFAULT 1,
  hourly_rate NUMERIC(10,2),
  
  required_certifications TEXT[],
  min_experience_years INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_roles_plan ON crew_roles(crew_plan_id);

-- Crew requirements (per work order)
CREATE TABLE IF NOT EXISTS crew_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  crew_plan_id UUID REFERENCES crew_plans(id),
  
  role_name TEXT NOT NULL,
  quantity_required INTEGER NOT NULL DEFAULT 1,
  
  start_date DATE,
  end_date DATE,
  
  required_certifications TEXT[],
  
  status TEXT DEFAULT 'open',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_requirements_wo ON crew_requirements(work_order_id);

-- Crew assignments
CREATE TABLE IF NOT EXISTS crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_requirement_id UUID REFERENCES crew_requirements(id),
  crew_plan_id UUID REFERENCES crew_plans(id),
  work_order_id UUID NOT NULL,
  
  individual_id UUID,
  worker_name TEXT,
  
  role_name TEXT NOT NULL,
  
  start_date DATE NOT NULL,
  end_date DATE,
  
  hourly_rate NUMERIC(10,2),
  status TEXT DEFAULT 'assigned',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_assignments_wo ON crew_assignments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_individual ON crew_assignments(individual_id);

-- Crew lodging links (connects to accommodation bookings)
CREATE TABLE IF NOT EXISTS crew_lodging_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_assignment_id UUID NOT NULL REFERENCES crew_assignments(id) ON DELETE CASCADE,
  accommodation_plan_id UUID REFERENCES accommodation_plans(id),
  
  booking_id UUID,
  asset_id UUID,
  
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  
  nightly_rate NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  
  status TEXT DEFAULT 'confirmed',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_lodging_assignment ON crew_lodging_links(crew_assignment_id);

-- Worker verification events
CREATE TABLE IF NOT EXISTS worker_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_assignment_id UUID NOT NULL REFERENCES crew_assignments(id) ON DELETE CASCADE,
  
  verification_type TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID,
  
  result TEXT NOT NULL,
  notes TEXT,
  
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_verification_assignment ON worker_verification_events(crew_assignment_id);

-- ============================================================================
-- SECTION 9: EQUIPMENT DETAILS
-- ============================================================================

-- Equipment requirements
CREATE TABLE IF NOT EXISTS equipment_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  equipment_plan_id UUID REFERENCES equipment_plans(id),
  
  equipment_type TEXT NOT NULL,
  description TEXT,
  
  quantity_required INTEGER NOT NULL DEFAULT 1,
  
  start_date DATE,
  end_date DATE,
  
  specifications JSONB DEFAULT '{}',
  
  status TEXT DEFAULT 'open',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_requirements_wo ON equipment_requirements(work_order_id);

-- Equipment assignments
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_requirement_id UUID REFERENCES equipment_requirements(id),
  equipment_plan_id UUID REFERENCES equipment_plans(id),
  work_order_id UUID NOT NULL,
  
  asset_id UUID,
  equipment_name TEXT NOT NULL,
  
  start_date DATE NOT NULL,
  end_date DATE,
  
  daily_rate NUMERIC(10,2),
  status TEXT DEFAULT 'assigned',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_assignments_wo ON equipment_assignments(work_order_id);

-- Equipment rentals (external equipment)
CREATE TABLE IF NOT EXISTS equipment_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_assignment_id UUID REFERENCES equipment_assignments(id),
  work_order_id UUID NOT NULL,
  
  supplier_party_id UUID REFERENCES parties(id),
  
  equipment_description TEXT NOT NULL,
  
  rental_start DATE NOT NULL,
  rental_end DATE,
  
  daily_rate NUMERIC(10,2),
  delivery_fee NUMERIC(10,2),
  total_cost NUMERIC(15,2),
  
  po_number TEXT,
  
  status TEXT DEFAULT 'reserved',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_rentals_wo ON equipment_rentals(work_order_id);

-- Tool manifests
CREATE TABLE IF NOT EXISTS tool_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  equipment_plan_id UUID REFERENCES equipment_plans(id),
  
  manifest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  items JSONB NOT NULL DEFAULT '[]',
  
  prepared_by UUID,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_manifests_wo ON tool_manifests(work_order_id);

-- ============================================================================
-- SECTION 10: MATERIALS ENHANCED
-- ============================================================================

-- Materials quotes
CREATE TABLE IF NOT EXISTS materials_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materials_plan_id UUID REFERENCES materials_plans(id),
  work_order_id UUID NOT NULL,
  
  supplier_party_id UUID REFERENCES parties(id),
  supplier_name TEXT,
  
  quote_number TEXT,
  quote_date DATE,
  valid_until DATE,
  
  items JSONB NOT NULL DEFAULT '[]',
  
  subtotal NUMERIC(15,2),
  tax_amount NUMERIC(15,2),
  total NUMERIC(15,2),
  
  status TEXT DEFAULT 'received',
  
  selected BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_quotes_wo ON materials_quotes(work_order_id);
CREATE INDEX IF NOT EXISTS idx_materials_quotes_plan ON materials_quotes(materials_plan_id);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(20) UNIQUE,
  
  work_order_id UUID NOT NULL,
  materials_plan_id UUID REFERENCES materials_plans(id),
  materials_quote_id UUID REFERENCES materials_quotes(id),
  
  supplier_party_id UUID REFERENCES parties(id),
  supplier_name TEXT,
  
  shipping_address TEXT,
  
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  shipping_cost NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  
  status TEXT DEFAULT 'draft',
  
  ordered_at TIMESTAMPTZ,
  expected_delivery DATE,
  
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_wo ON purchase_orders(work_order_id);

-- Purchase order lines
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  
  quantity NUMERIC(15,4) NOT NULL,
  unit TEXT,
  unit_price NUMERIC(15,4),
  total_price NUMERIC(15,2),
  
  received_quantity NUMERIC(15,4) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po ON purchase_order_lines(purchase_order_id);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(20),
  
  purchase_order_id UUID REFERENCES purchase_orders(id),
  work_order_id UUID NOT NULL,
  
  received_by UUID,
  received_at TIMESTAMPTZ DEFAULT now(),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_po ON receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_wo ON receipts(work_order_id);

-- Receipt lines
CREATE TABLE IF NOT EXISTS receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES purchase_order_lines(id),
  
  description TEXT NOT NULL,
  quantity_received NUMERIC(15,4) NOT NULL,
  
  condition TEXT DEFAULT 'good',
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON receipt_lines(receipt_id);

-- Materials substitutions
CREATE TABLE IF NOT EXISTS materials_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  materials_plan_id UUID REFERENCES materials_plans(id),
  
  original_item TEXT NOT NULL,
  substitute_item TEXT NOT NULL,
  reason TEXT,
  
  cost_difference NUMERIC(15,2) DEFAULT 0,
  
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_subs_wo ON materials_substitutions(work_order_id);

-- ============================================================================
-- SECTION 11: MOBILIZATION ENHANCED
-- ============================================================================

-- Mobilization manifests
CREATE TABLE IF NOT EXISTS mobilization_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_ref VARCHAR(20) UNIQUE,
  
  work_order_id UUID NOT NULL,
  
  departure_location TEXT,
  destination_location TEXT,
  
  departure_date DATE,
  arrival_date DATE,
  
  total_weight_kg NUMERIC(10,2),
  total_volume_m3 NUMERIC(10,2),
  
  status TEXT DEFAULT 'draft',
  
  prepared_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobilization_manifests_wo ON mobilization_manifests(work_order_id);

-- Manifest items
CREATE TABLE IF NOT EXISTS manifest_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id UUID NOT NULL REFERENCES mobilization_manifests(id) ON DELETE CASCADE,
  
  item_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  quantity INTEGER DEFAULT 1,
  weight_kg NUMERIC(10,2),
  
  asset_id UUID,
  equipment_assignment_id UUID REFERENCES equipment_assignments(id),
  
  special_handling TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manifest_items_manifest ON manifest_items(manifest_id);

-- Transport bookings
CREATE TABLE IF NOT EXISTS transport_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id UUID REFERENCES mobilization_manifests(id),
  work_order_id UUID NOT NULL,
  
  transport_type TEXT NOT NULL,
  carrier_name TEXT,
  
  booking_reference TEXT,
  
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  
  departure_datetime TIMESTAMPTZ,
  arrival_datetime TIMESTAMPTZ,
  
  cost NUMERIC(15,2),
  
  status TEXT DEFAULT 'booked',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_bookings_wo ON transport_bookings(work_order_id);

-- Route constraints
CREATE TABLE IF NOT EXISTS route_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  
  constraint_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  affects_route TEXT,
  
  valid_from DATE,
  valid_until DATE,
  
  source TEXT,
  source_url TEXT,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_constraints_wo ON route_constraints(work_order_id);

-- ============================================================================
-- SECTION 12: COMPLIANCE DETAILS
-- ============================================================================

-- Permits
CREATE TABLE IF NOT EXISTS permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  compliance_plan_id UUID REFERENCES compliance_plans(id),
  
  permit_type TEXT NOT NULL,
  issuing_authority TEXT,
  
  permit_number TEXT,
  
  application_date DATE,
  issued_date DATE,
  expiry_date DATE,
  
  status TEXT DEFAULT 'pending',
  
  conditions TEXT,
  document_url TEXT,
  
  cost NUMERIC(10,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permits_wo ON permits(work_order_id);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  compliance_plan_id UUID REFERENCES compliance_plans(id),
  permit_id UUID REFERENCES permits(id),
  
  inspection_type TEXT NOT NULL,
  inspector_name TEXT,
  inspector_organization TEXT,
  
  scheduled_date DATE,
  completed_date DATE,
  
  result TEXT,
  notes TEXT,
  
  deficiencies_found INTEGER DEFAULT 0,
  
  report_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_wo ON inspections(work_order_id);

-- Safety requirements
CREATE TABLE IF NOT EXISTS safety_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  compliance_plan_id UUID REFERENCES compliance_plans(id),
  
  requirement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  is_mandatory BOOLEAN DEFAULT true,
  
  verification_method TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  
  status TEXT DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_requirements_wo ON safety_requirements(work_order_id);

-- Funding requirements
CREATE TABLE IF NOT EXISTS funding_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  requirement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  amount_required NUMERIC(15,2),
  
  document_type TEXT,
  document_url TEXT,
  
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  
  status TEXT DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funding_requirements_wo ON funding_requirements(work_order_id);

-- ============================================================================
-- SECTION 13: CLOSEOUT
-- ============================================================================

-- Deficiency items
CREATE TABLE IF NOT EXISTS deficiency_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deficiency_ref VARCHAR(20),
  
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  inspection_id UUID REFERENCES inspections(id),
  
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  
  severity TEXT DEFAULT 'minor',
  category TEXT,
  
  status closeout_status NOT NULL DEFAULT 'open',
  
  identified_by UUID,
  identified_at TIMESTAMPTZ DEFAULT now(),
  
  assigned_to_party_id UUID REFERENCES parties(id),
  
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  
  photos JSONB DEFAULT '[]',
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deficiency_items_wo ON deficiency_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_deficiency_items_status ON deficiency_items(status);

-- Closeout documents
CREATE TABLE IF NOT EXISTS closeout_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  file_url TEXT,
  
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  
  status TEXT DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closeout_docs_wo ON closeout_documents(work_order_id);

-- Acceptance certificates
CREATE TABLE IF NOT EXISTS acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_ref VARCHAR(20) UNIQUE,
  
  work_order_id UUID NOT NULL,
  contract_id UUID REFERENCES contracts(id),
  
  acceptance_type TEXT NOT NULL,
  
  accepted_scope TEXT,
  exceptions TEXT,
  
  accepted_at TIMESTAMPTZ,
  accepted_by_owner UUID,
  accepted_by_contractor UUID,
  
  warranty_start_date DATE,
  warranty_end_date DATE,
  
  document_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acceptances_wo ON acceptances(work_order_id);

-- Holdbacks
CREATE TABLE IF NOT EXISTS holdbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  work_order_id UUID NOT NULL,
  
  holdback_type TEXT NOT NULL,
  
  amount NUMERIC(15,2) NOT NULL,
  
  hold_until DATE,
  
  released_amount NUMERIC(15,2) DEFAULT 0,
  release_date TIMESTAMPTZ,
  release_authorized_by UUID,
  
  status TEXT DEFAULT 'held',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holdbacks_contract ON holdbacks(contract_id);
CREATE INDEX IF NOT EXISTS idx_holdbacks_wo ON holdbacks(work_order_id);

-- ============================================================================
-- SECTION 14: EVENTS (Cursor-based Sync)
-- ============================================================================

-- Events table for tracking all system events
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  event_type event_type NOT NULL,
  
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  
  tenant_id UUID,
  actor_id UUID,
  
  payload JSONB NOT NULL DEFAULT '{}',
  
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  cursor BIGINT GENERATED ALWAYS AS IDENTITY
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_cursor ON events(cursor);
CREATE INDEX IF NOT EXISTS idx_events_occurred ON events(occurred_at);

-- Event subscriptions
CREATE TABLE IF NOT EXISTS event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  subscriber_name TEXT NOT NULL,
  subscriber_url TEXT,
  
  event_types event_type[] NOT NULL,
  
  filter_criteria JSONB DEFAULT '{}',
  
  last_cursor BIGINT DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_subs_active ON event_subscriptions(is_active) WHERE is_active = true;

-- Event outbox for reliable delivery
CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_id BIGINT NOT NULL,
  subscription_id UUID NOT NULL REFERENCES event_subscriptions(id),
  
  status TEXT NOT NULL DEFAULT 'pending',
  
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_pending ON event_outbox(status, next_retry_at) WHERE status = 'pending';

-- ============================================================================
-- SECTION 15: WORK ORDER ENHANCEMENTS
-- ============================================================================

-- Add new columns to work_orders if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'contract_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN contract_id UUID REFERENCES contracts(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'phase_status'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN phase_status work_order_phase_status DEFAULT 'created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'finance_status'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN finance_status TEXT DEFAULT 'unfunded';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'baseline_estimate_version_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN baseline_estimate_version_id UUID REFERENCES estimate_versions(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'opportunity_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN opportunity_id UUID REFERENCES opportunities(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_orders_contract ON work_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_phase ON work_orders(phase_status);
CREATE INDEX IF NOT EXISTS idx_work_orders_opportunity ON work_orders(opportunity_id);

-- Add FKs to plan tables for work_order_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'materials_plans_work_order_id_fkey'
  ) THEN
    ALTER TABLE materials_plans 
      ADD CONSTRAINT materials_plans_work_order_id_fkey 
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'crew_plans_work_order_id_fkey'
  ) THEN
    ALTER TABLE crew_plans 
      ADD CONSTRAINT crew_plans_work_order_id_fkey 
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'equipment_plans_work_order_id_fkey'
  ) THEN
    ALTER TABLE equipment_plans 
      ADD CONSTRAINT equipment_plans_work_order_id_fkey 
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'compliance_plans_work_order_id_fkey'
  ) THEN
    ALTER TABLE compliance_plans 
      ADD CONSTRAINT compliance_plans_work_order_id_fkey 
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'accommodation_plans_work_order_id_fkey'
  ) THEN
    ALTER TABLE accommodation_plans 
      ADD CONSTRAINT accommodation_plans_work_order_id_fkey 
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- SECTION 16: LIFECYCLE TRIGGERS
-- ============================================================================

-- Function to log phase transitions
CREATE OR REPLACE FUNCTION log_work_order_phase_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.phase_status IS DISTINCT FROM NEW.phase_status THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, tenant_id, payload)
    VALUES (
      'phase_transition',
      'work_order',
      NEW.id,
      NEW.community_id,
      jsonb_build_object(
        'from_phase', OLD.phase_status,
        'to_phase', NEW.phase_status,
        'transitioned_at', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for phase transitions
DROP TRIGGER IF EXISTS trg_work_order_phase_transition ON work_orders;
CREATE TRIGGER trg_work_order_phase_transition
  AFTER UPDATE OF phase_status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_work_order_phase_transition();

-- Function to log contract status changes
CREATE OR REPLACE FUNCTION log_contract_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, tenant_id, payload)
    VALUES (
      CASE NEW.status
        WHEN 'active' THEN 'contract_signed'::event_type
        ELSE 'phase_transition'::event_type
      END,
      'contract',
      NEW.id,
      NEW.owner_tenant_id,
      jsonb_build_object(
        'from_status', OLD.status,
        'to_status', NEW.status,
        'changed_at', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contract_status_change ON contracts;
CREATE TRIGGER trg_contract_status_change
  AFTER UPDATE OF status ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION log_contract_status_change();

-- Function to log opportunity status changes
CREATE OR REPLACE FUNCTION log_opportunity_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, tenant_id, payload)
    VALUES (
      CASE NEW.status
        WHEN 'published' THEN 'opportunity_published'::event_type
        ELSE 'opportunity_created'::event_type
      END,
      'opportunity',
      NEW.id,
      NEW.owner_tenant_id,
      jsonb_build_object(
        'from_status', OLD.status,
        'to_status', NEW.status,
        'changed_at', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunity_status_change ON opportunities;
CREATE TRIGGER trg_opportunity_status_change
  AFTER UPDATE OF status ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION log_opportunity_status_change();

-- Function to log bid submissions
CREATE OR REPLACE FUNCTION log_bid_submission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, payload)
    VALUES (
      'bid_submitted',
      'bid',
      NEW.id,
      jsonb_build_object(
        'opportunity_id', NEW.opportunity_id,
        'party_id', NEW.party_id,
        'bid_amount', NEW.bid_amount,
        'submitted_at', NEW.submitted_at
      )
    );
  END IF;
  
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, payload)
    VALUES (
      'bid_accepted',
      'bid',
      NEW.id,
      jsonb_build_object(
        'opportunity_id', NEW.opportunity_id,
        'party_id', NEW.party_id,
        'bid_amount', NEW.bid_amount,
        'accepted_at', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bid_submission ON bids;
CREATE TRIGGER trg_bid_submission
  AFTER INSERT OR UPDATE OF status ON bids
  FOR EACH ROW
  EXECUTE FUNCTION log_bid_submission();

-- Function to log change order approvals
CREATE OR REPLACE FUNCTION log_change_order_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, payload)
    VALUES (
      'change_order_approved',
      'change_order',
      NEW.id,
      jsonb_build_object(
        'contract_id', NEW.contract_id,
        'cost_impact', NEW.cost_impact,
        'time_impact_days', NEW.time_impact_days,
        'approved_at', NEW.approved_at
      )
    );
    
    -- Update contract approved_changes
    UPDATE contracts 
    SET approved_changes = COALESCE(approved_changes, 0) + COALESCE(NEW.cost_impact, 0),
        updated_at = now()
    WHERE id = NEW.contract_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_change_order_approval ON change_orders;
CREATE TRIGGER trg_change_order_approval
  AFTER UPDATE OF status ON change_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_change_order_approval();

-- Function to log inspection results
CREATE OR REPLACE FUNCTION log_inspection_result()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result = 'passed' AND (OLD.result IS NULL OR OLD.result != 'passed') THEN
    INSERT INTO events (event_type, aggregate_type, aggregate_id, payload)
    VALUES (
      'inspection_passed',
      'inspection',
      NEW.id,
      jsonb_build_object(
        'work_order_id', NEW.work_order_id,
        'inspection_type', NEW.inspection_type,
        'completed_at', NEW.completed_date
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inspection_result ON inspections;
CREATE TRIGGER trg_inspection_result
  AFTER UPDATE OF result ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION log_inspection_result();

-- ============================================================================
-- SECTION 17: HELPER FUNCTIONS
-- ============================================================================

-- Function to generate sequential refs
CREATE OR REPLACE FUNCTION generate_sequential_ref(prefix TEXT, seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
BEGIN
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  RETURN prefix || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequences for refs if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'opportunity_ref_seq') THEN
    CREATE SEQUENCE opportunity_ref_seq START 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'contract_ref_seq') THEN
    CREATE SEQUENCE contract_ref_seq START 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'change_order_ref_seq') THEN
    CREATE SEQUENCE change_order_ref_seq START 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'estimate_ref_seq') THEN
    CREATE SEQUENCE estimate_ref_seq START 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'bid_ref_seq') THEN
    CREATE SEQUENCE bid_ref_seq START 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'po_ref_seq') THEN
    CREATE SEQUENCE po_ref_seq START 1000;
  END IF;
END $$;

-- Auto-generate opportunity_ref
CREATE OR REPLACE FUNCTION set_opportunity_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opportunity_ref IS NULL THEN
    NEW.opportunity_ref := generate_sequential_ref('OPP', 'opportunity_ref_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_opportunity_ref ON opportunities;
CREATE TRIGGER trg_set_opportunity_ref
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION set_opportunity_ref();

-- Auto-generate contract_ref
CREATE OR REPLACE FUNCTION set_contract_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_ref IS NULL THEN
    NEW.contract_ref := generate_sequential_ref('CTR', 'contract_ref_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_contract_ref ON contracts;
CREATE TRIGGER trg_set_contract_ref
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_contract_ref();

-- Auto-generate estimate_ref
CREATE OR REPLACE FUNCTION set_estimate_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estimate_ref IS NULL THEN
    NEW.estimate_ref := generate_sequential_ref('EST', 'estimate_ref_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_estimate_ref ON estimates;
CREATE TRIGGER trg_set_estimate_ref
  BEFORE INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION set_estimate_ref();

-- Auto-generate bid_ref
CREATE OR REPLACE FUNCTION set_bid_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bid_ref IS NULL THEN
    NEW.bid_ref := generate_sequential_ref('BID', 'bid_ref_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_bid_ref ON bids;
CREATE TRIGGER trg_set_bid_ref
  BEFORE INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION set_bid_ref();

-- Auto-generate po_number
CREATE OR REPLACE FUNCTION set_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL THEN
    NEW.po_number := generate_sequential_ref('PO', 'po_ref_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_po_number ON purchase_orders;
CREATE TRIGGER trg_set_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_po_number();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Update timestamp
DO $$
BEGIN
  RAISE NOTICE 'Migration 022: Construction OS Expansion completed at %', now();
END $$;
