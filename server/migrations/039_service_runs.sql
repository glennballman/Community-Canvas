-- ============================================================
-- COMMUNITY CANVAS v2.7 - SERVICE RUNS (PILE-ON)
-- Migration 039 - Cooperative Bundling, Not Competitive Bidding
-- ============================================================

-- Philosophy:
-- - Customer already has a contractor
-- - Neighbors join to split mobilization costs
-- - Contractor controls pricing and schedule
-- - More members = better margins for contractor
-- - Contractor triggers virality by inviting past customers

-- ============================================================
-- 1. EXTEND OPPORTUNITIES WITH INTAKE MODE
-- ============================================================

DO $$ BEGIN
  CREATE TYPE intake_mode AS ENUM (
    'bid',           -- Traditional: post job, get bids
    'run',           -- Service run: booked contractor, neighbors pile on
    'direct_award'   -- Direct: owner awards to specific contractor
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE opportunities 
  ADD COLUMN IF NOT EXISTS intake_mode intake_mode DEFAULT 'bid';

ALTER TABLE opportunities 
  ADD COLUMN IF NOT EXISTS service_run_id UUID;

CREATE INDEX IF NOT EXISTS opportunities_intake_mode_idx 
  ON opportunities(intake_mode);

CREATE INDEX IF NOT EXISTS opportunities_service_run_idx 
  ON opportunities(service_run_id) WHERE service_run_id IS NOT NULL;

-- ============================================================
-- 2. SERVICE RUNS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE run_status AS ENUM (
    'forming',       -- Accepting members
    'contractor_invited',  -- Waiting for contractor to claim
    'contractor_claimed',  -- Contractor has claimed
    'scheduled',     -- Date set
    'in_progress',   -- Work happening
    'completed',     -- All done
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE split_method AS ENUM (
    'flat',          -- Equal split among all members
    'pro_rata_units', -- Split by units (e.g., # of chimneys)
    'custom'         -- Contractor-defined formula
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS service_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  community_id UUID REFERENCES communities(id),
  
  -- What kind of work
  trade_category TEXT NOT NULL,
  service_description TEXT,
  
  -- Contractor (nullable until claimed)
  contractor_party_id UUID REFERENCES parties(id),
  contractor_name TEXT,
  contractor_website TEXT,
  contractor_contact_email TEXT,
  
  -- Run status
  status run_status DEFAULT 'forming',
  
  -- Service window
  window_start DATE,
  window_end DATE,
  preferred_months TEXT[],
  
  -- Capacity
  max_jobs INTEGER DEFAULT 20,
  min_members INTEGER DEFAULT 3,
  
  -- Pricing model (contractor sets)
  pricing_model JSONB DEFAULT '{}'::jsonb,
  
  -- Mobilization
  mobilization_fee_total NUMERIC(10,2),
  min_mobilization_threshold NUMERIC(10,2),
  split_method split_method DEFAULT 'flat',
  
  -- Computed estimates
  estimated_total_value NUMERIC(12,2),
  current_member_count INTEGER DEFAULT 0,
  
  -- Travel/logistics
  travel_origin TEXT,
  travel_distance_km INTEGER,
  travel_notes TEXT,
  
  -- Creator
  created_by_party_id UUID NOT NULL REFERENCES parties(id),
  created_by_individual_id UUID REFERENCES cc_individuals(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS service_runs_tenant_idx ON service_runs(tenant_id);
CREATE INDEX IF NOT EXISTS service_runs_community_idx ON service_runs(community_id);
CREATE INDEX IF NOT EXISTS service_runs_contractor_idx ON service_runs(contractor_party_id);
CREATE INDEX IF NOT EXISTS service_runs_status_idx ON service_runs(status) WHERE status IN ('forming', 'scheduled');
CREATE INDEX IF NOT EXISTS service_runs_trade_idx ON service_runs(trade_category);

COMMENT ON TABLE service_runs IS 
  'Cooperative service bundling. NOT bidding. Neighbors join to split mobilization.';

COMMENT ON COLUMN service_runs.mobilization_fee_total IS 
  'Total contractor mobilization cost. Split among members.';

COMMENT ON COLUMN service_runs.min_mobilization_threshold IS 
  'Minimum value to make trip worthwhile for contractor.';

-- ============================================================
-- 3. SERVICE RUN MEMBERS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM (
    'interested',
    'joined',
    'scheduled',
    'completed',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS service_run_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id),
  
  -- Member
  owner_party_id UUID NOT NULL REFERENCES parties(id),
  owner_individual_id UUID REFERENCES cc_individuals(id),
  
  -- What they need
  units JSONB DEFAULT '{}'::jsonb,
  unit_count INTEGER DEFAULT 1,
  
  -- Status
  status member_status DEFAULT 'interested',
  
  -- Location
  property_address TEXT,
  property_postal_code TEXT,
  property_community TEXT,
  
  -- Estimates
  estimated_unit_cost NUMERIC(10,2),
  estimated_mobilization_share NUMERIC(10,2),
  estimated_total NUMERIC(10,2),
  
  -- Final (after completion)
  final_cost NUMERIC(10,2),
  
  -- Notes
  access_notes TEXT,
  special_requirements TEXT,
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT now(),
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS run_members_run_idx ON service_run_members(run_id);
CREATE INDEX IF NOT EXISTS run_members_owner_idx ON service_run_members(owner_party_id);
CREATE INDEX IF NOT EXISTS run_members_status_idx ON service_run_members(run_id, status);

COMMENT ON TABLE service_run_members IS 
  'Customers who joined a service run. Each brings their property + unit count.';

-- ============================================================
-- 4. CONTRACTOR INVITES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'opened',
    'claimed',
    'declined',
    'bounced'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS contractor_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What run
  service_run_id UUID REFERENCES service_runs(id),
  
  -- Who we're inviting
  contractor_name TEXT NOT NULL,
  contractor_email TEXT,
  contractor_phone TEXT,
  contractor_website TEXT,
  
  -- How we found them
  source TEXT,
  source_notes TEXT,
  
  -- Invite details
  invite_method TEXT,
  invite_token TEXT UNIQUE,
  
  -- Status
  status invite_status DEFAULT 'pending',
  
  -- If claimed
  claimed_party_id UUID REFERENCES parties(id),
  claimed_at TIMESTAMPTZ,
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  
  -- Who invited
  invited_by_party_id UUID REFERENCES parties(id),
  invited_by_individual_id UUID REFERENCES cc_individuals(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_invites_run_idx ON contractor_invites(service_run_id);
CREATE INDEX IF NOT EXISTS contractor_invites_token_idx ON contractor_invites(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS contractor_invites_status_idx ON contractor_invites(status);

COMMENT ON TABLE contractor_invites IS 
  'Invitations to contractors to claim/join service runs.';

-- ============================================================
-- 5. CONTRACTOR OUTREACH CAMPAIGNS (Virality)
-- ============================================================

CREATE TABLE IF NOT EXISTS run_outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  run_id UUID NOT NULL REFERENCES service_runs(id),
  contractor_party_id UUID NOT NULL REFERENCES parties(id),
  
  -- Campaign details
  campaign_name TEXT,
  message_template TEXT,
  
  -- Targets
  target_emails TEXT[],
  target_phones TEXT[],
  
  -- Stats
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_joined INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS run_outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  campaign_id UUID NOT NULL REFERENCES run_outreach_campaigns(id),
  
  -- Recipient
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending',
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  -- Result
  resulted_in_member_id UUID REFERENCES service_run_members(id)
);

CREATE INDEX IF NOT EXISTS outreach_campaigns_run_idx ON run_outreach_campaigns(run_id);
CREATE INDEX IF NOT EXISTS outreach_messages_campaign_idx ON run_outreach_messages(campaign_id);

COMMENT ON TABLE run_outreach_campaigns IS 
  'Contractor-initiated outreach to past customers. Triggers virality.';

-- ============================================================
-- 6. MOBILIZATION SPLIT ESTIMATES VIEW
-- ============================================================

CREATE OR REPLACE VIEW run_mobilization_estimates AS
SELECT 
  r.id as run_id,
  r.mobilization_fee_total,
  r.split_method,
  r.current_member_count,
  CASE 
    WHEN r.split_method = 'flat' AND r.current_member_count > 0 THEN
      r.mobilization_fee_total / r.current_member_count
    ELSE NULL
  END as flat_share_per_member,
  r.min_mobilization_threshold,
  r.estimated_total_value,
  CASE 
    WHEN r.estimated_total_value > r.min_mobilization_threshold THEN true
    ELSE false
  END as threshold_met
FROM service_runs r;

COMMENT ON VIEW run_mobilization_estimates IS 
  'Computed mobilization splits. Updates as members join/leave.';

-- ============================================================
-- 7. FUNCTION: Recompute run estimates
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_run_estimates(run_uuid UUID)
RETURNS void AS $$
DECLARE
  member_count INTEGER;
  total_units INTEGER;
  total_value NUMERIC;
  mob_fee NUMERIC;
  unit_price NUMERIC;
BEGIN
  -- Count active members
  SELECT COUNT(*), COALESCE(SUM(unit_count), 0)
  INTO member_count, total_units
  FROM service_run_members
  WHERE run_id = run_uuid AND status IN ('interested', 'joined', 'scheduled');
  
  -- Get run details
  SELECT mobilization_fee_total, (pricing_model->>'unit_price')::numeric
  INTO mob_fee, unit_price
  FROM service_runs
  WHERE id = run_uuid;
  
  -- Compute total value
  total_value := COALESCE(total_units * unit_price, 0) + COALESCE(mob_fee, 0);
  
  -- Update run
  UPDATE service_runs SET
    current_member_count = member_count,
    estimated_total_value = total_value,
    updated_at = now()
  WHERE id = run_uuid;
  
  -- Update member estimates
  UPDATE service_run_members SET
    estimated_mobilization_share = CASE 
      WHEN member_count > 0 THEN mob_fee / member_count
      ELSE mob_fee
    END,
    estimated_unit_cost = unit_count * unit_price,
    estimated_total = (unit_count * unit_price) + CASE 
      WHEN member_count > 0 THEN mob_fee / member_count
      ELSE mob_fee
    END
  WHERE run_id = run_uuid AND status IN ('interested', 'joined', 'scheduled');
  
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. TRIGGER: Auto-recompute on member changes
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_recompute_run()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_run_estimates(OLD.run_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_run_estimates(NEW.run_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS run_member_recompute ON service_run_members;
CREATE TRIGGER run_member_recompute
  AFTER INSERT OR UPDATE OR DELETE ON service_run_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_run();
