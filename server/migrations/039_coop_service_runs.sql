-- ============================================================
-- COMMUNITY CANVAS v2.7 - COOPERATIVE SERVICE RUNS
-- Migration 039 - Cooperative Bundling (Separate from Legacy Service Runs)
-- ============================================================

-- Philosophy:
-- - Customer already has a contractor
-- - Neighbors join to split mobilization costs
-- - Contractor controls pricing and schedule
-- - More members = better margins for contractor
-- - This is SEPARATE from legacy service_runs table

-- ============================================================
-- 1. EXTEND OPPORTUNITIES WITH INTAKE MODE
-- ============================================================

DO $$ BEGIN
  CREATE TYPE intake_mode AS ENUM (
    'bid',
    'run',
    'direct_award'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE opportunities 
  ADD COLUMN IF NOT EXISTS intake_mode intake_mode DEFAULT 'bid';

ALTER TABLE opportunities 
  ADD COLUMN IF NOT EXISTS coop_run_id UUID;

CREATE INDEX IF NOT EXISTS opportunities_intake_mode_idx 
  ON opportunities(intake_mode);

CREATE INDEX IF NOT EXISTS opportunities_coop_run_idx 
  ON opportunities(coop_run_id) WHERE coop_run_id IS NOT NULL;

-- ============================================================
-- 2. COOPERATIVE SERVICE RUNS (New table, distinct from legacy)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE coop_run_status AS ENUM (
    'forming',
    'contractor_invited',
    'contractor_claimed',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coop_split_method AS ENUM (
    'flat',
    'pro_rata_units',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS coop_service_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context (using correct table names)
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  community_id UUID,
  
  -- What kind of work
  trade_category TEXT NOT NULL,
  service_description TEXT,
  
  -- Contractor (nullable until claimed)
  contractor_party_id UUID REFERENCES parties(id),
  contractor_name TEXT,
  contractor_website TEXT,
  contractor_contact_email TEXT,
  
  -- Run status
  status coop_run_status DEFAULT 'forming',
  
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
  split_method coop_split_method DEFAULT 'flat',
  
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

CREATE INDEX IF NOT EXISTS coop_runs_tenant_idx ON coop_service_runs(tenant_id);
CREATE INDEX IF NOT EXISTS coop_runs_community_idx ON coop_service_runs(community_id);
CREATE INDEX IF NOT EXISTS coop_runs_contractor_idx ON coop_service_runs(contractor_party_id);
CREATE INDEX IF NOT EXISTS coop_runs_status_idx ON coop_service_runs(status) WHERE status IN ('forming', 'scheduled');
CREATE INDEX IF NOT EXISTS coop_runs_trade_idx ON coop_service_runs(trade_category);

COMMENT ON TABLE coop_service_runs IS 
  'Cooperative service bundling. NOT bidding. Neighbors join to split mobilization.';

-- ============================================================
-- 3. COOPERATIVE RUN MEMBERS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE coop_member_status AS ENUM (
    'interested',
    'joined',
    'scheduled',
    'completed',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS coop_run_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  run_id UUID NOT NULL REFERENCES coop_service_runs(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id),
  
  -- Member
  owner_party_id UUID NOT NULL REFERENCES parties(id),
  owner_individual_id UUID REFERENCES cc_individuals(id),
  
  -- What they need
  units JSONB DEFAULT '{}'::jsonb,
  unit_count INTEGER DEFAULT 1,
  
  -- Status
  status coop_member_status DEFAULT 'interested',
  
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

CREATE INDEX IF NOT EXISTS coop_members_run_idx ON coop_run_members(run_id);
CREATE INDEX IF NOT EXISTS coop_members_owner_idx ON coop_run_members(owner_party_id);
CREATE INDEX IF NOT EXISTS coop_members_status_idx ON coop_run_members(run_id, status);

COMMENT ON TABLE coop_run_members IS 
  'Customers who joined a coop run. Each brings their property + unit count.';

-- ============================================================
-- 4. COOP CONTRACTOR INVITES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE coop_invite_status AS ENUM (
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

CREATE TABLE IF NOT EXISTS coop_contractor_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What run
  coop_run_id UUID REFERENCES coop_service_runs(id),
  
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
  status coop_invite_status DEFAULT 'pending',
  
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

CREATE INDEX IF NOT EXISTS coop_invites_run_idx ON coop_contractor_invites(coop_run_id);
CREATE INDEX IF NOT EXISTS coop_invites_token_idx ON coop_contractor_invites(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS coop_invites_status_idx ON coop_contractor_invites(status);

COMMENT ON TABLE coop_contractor_invites IS 
  'Invitations to contractors to claim/join coop runs.';

-- ============================================================
-- 5. COOP OUTREACH CAMPAIGNS (Virality)
-- ============================================================

CREATE TABLE IF NOT EXISTS coop_outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  run_id UUID NOT NULL REFERENCES coop_service_runs(id),
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

CREATE TABLE IF NOT EXISTS coop_outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  campaign_id UUID NOT NULL REFERENCES coop_outreach_campaigns(id),
  
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
  resulted_in_member_id UUID REFERENCES coop_run_members(id)
);

CREATE INDEX IF NOT EXISTS coop_campaigns_run_idx ON coop_outreach_campaigns(run_id);
CREATE INDEX IF NOT EXISTS coop_messages_campaign_idx ON coop_outreach_messages(campaign_id);

COMMENT ON TABLE coop_outreach_campaigns IS 
  'Contractor-initiated outreach to past customers. Triggers virality.';

-- ============================================================
-- 6. MOBILIZATION SPLIT ESTIMATES VIEW
-- ============================================================

CREATE OR REPLACE VIEW coop_mobilization_estimates AS
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
FROM coop_service_runs r;

COMMENT ON VIEW coop_mobilization_estimates IS 
  'Computed mobilization splits. Updates as members join/leave.';

-- ============================================================
-- 7. FUNCTION: Recompute coop run estimates
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_coop_run_estimates(run_uuid UUID)
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
  FROM coop_run_members
  WHERE run_id = run_uuid AND status IN ('interested', 'joined', 'scheduled');
  
  -- Get run details
  SELECT mobilization_fee_total, (pricing_model->>'unit_price')::numeric
  INTO mob_fee, unit_price
  FROM coop_service_runs
  WHERE id = run_uuid;
  
  -- Compute total value
  total_value := COALESCE(total_units * unit_price, 0) + COALESCE(mob_fee, 0);
  
  -- Update run
  UPDATE coop_service_runs SET
    current_member_count = member_count,
    estimated_total_value = total_value,
    updated_at = now()
  WHERE id = run_uuid;
  
  -- Update member estimates
  UPDATE coop_run_members SET
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

CREATE OR REPLACE FUNCTION trigger_recompute_coop_run()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_coop_run_estimates(OLD.run_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_coop_run_estimates(NEW.run_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coop_member_recompute ON coop_run_members;
CREATE TRIGGER coop_member_recompute
  AFTER INSERT OR UPDATE OR DELETE ON coop_run_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_coop_run();

-- ============================================================
-- 9. ROLE GRANTS (for cc_app role used by application)
-- ============================================================

GRANT ALL PRIVILEGES ON TABLE coop_service_runs TO cc_app;
GRANT ALL PRIVILEGES ON TABLE coop_run_members TO cc_app;
GRANT ALL PRIVILEGES ON TABLE coop_contractor_invites TO cc_app;
GRANT ALL PRIVILEGES ON TABLE coop_outreach_campaigns TO cc_app;
GRANT ALL PRIVILEGES ON TABLE coop_outreach_messages TO cc_app;

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on coop tables
ALTER TABLE coop_service_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coop_run_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE coop_contractor_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE coop_outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE coop_outreach_messages ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped access policies with service mode bypass using CASE
-- The CASE expression handles the __SERVICE__ sentinel without attempting UUID cast
CREATE POLICY coop_runs_tenant ON coop_service_runs
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE tenant_id = current_setting('app.tenant_id', true)::uuid
    END
  );

CREATE POLICY coop_members_tenant ON coop_run_members
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE run_id IN (SELECT id FROM coop_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
    END
  );

CREATE POLICY coop_invites_tenant ON coop_contractor_invites
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE coop_run_id IN (SELECT id FROM coop_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
    END
  );

CREATE POLICY coop_campaigns_tenant ON coop_outreach_campaigns
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE run_id IN (SELECT id FROM coop_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
    END
  );

CREATE POLICY coop_messages_tenant ON coop_outreach_messages
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE campaign_id IN (SELECT id FROM coop_outreach_campaigns WHERE 
        run_id IN (SELECT id FROM coop_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
      )
    END
  );
