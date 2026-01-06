-- ============================================================
-- COMMUNITY CANVAS v2.8 - RENAME COOP TO SHARED RUN
-- Migration 040 - Terminology correction: "Coop" → "Shared Run"
-- ============================================================

-- Philosophy:
-- - "Co-op" has negative brand associations in Canada
-- - Renaming to "Shared Run" for clarity
-- - Tables are EMPTY, so this is safe rename
-- - Neighbors join to share mobilization costs
-- - This is SHARED BUNDLING, not competitive bidding

-- ============================================================
-- 1. RENAME TABLES
-- ============================================================

ALTER TABLE IF EXISTS coop_service_runs RENAME TO shared_service_runs;
ALTER TABLE IF EXISTS coop_run_members RENAME TO shared_run_members;
ALTER TABLE IF EXISTS coop_contractor_invites RENAME TO shared_run_invites;
ALTER TABLE IF EXISTS coop_outreach_campaigns RENAME TO shared_outreach_campaigns;
ALTER TABLE IF EXISTS coop_outreach_messages RENAME TO shared_outreach_messages;

-- ============================================================
-- 2. RENAME ENUM TYPES
-- ============================================================

ALTER TYPE IF EXISTS coop_run_status RENAME TO shared_run_status;
ALTER TYPE IF EXISTS coop_split_method RENAME TO shared_split_method;
ALTER TYPE IF EXISTS coop_member_status RENAME TO shared_member_status;
ALTER TYPE IF EXISTS coop_invite_status RENAME TO shared_invite_status;

-- ============================================================
-- 3. RENAME COLUMNS REFERENCING COOP
-- ============================================================

ALTER TABLE opportunities RENAME COLUMN coop_run_id TO shared_run_id;
ALTER TABLE shared_run_invites RENAME COLUMN coop_run_id TO shared_run_id;

-- ============================================================
-- 4. RENAME INDEXES
-- ============================================================

ALTER INDEX IF EXISTS coop_runs_tenant_idx RENAME TO shared_runs_tenant_idx;
ALTER INDEX IF EXISTS coop_runs_community_idx RENAME TO shared_runs_community_idx;
ALTER INDEX IF EXISTS coop_runs_contractor_idx RENAME TO shared_runs_contractor_idx;
ALTER INDEX IF EXISTS coop_runs_status_idx RENAME TO shared_runs_status_idx;
ALTER INDEX IF EXISTS coop_runs_trade_idx RENAME TO shared_runs_trade_idx;
ALTER INDEX IF EXISTS coop_members_run_idx RENAME TO shared_members_run_idx;
ALTER INDEX IF EXISTS coop_members_owner_idx RENAME TO shared_members_owner_idx;
ALTER INDEX IF EXISTS coop_members_status_idx RENAME TO shared_members_status_idx;
ALTER INDEX IF EXISTS coop_invites_run_idx RENAME TO shared_invites_run_idx;
ALTER INDEX IF EXISTS coop_invites_token_idx RENAME TO shared_invites_token_idx;
ALTER INDEX IF EXISTS coop_invites_status_idx RENAME TO shared_invites_status_idx;
ALTER INDEX IF EXISTS coop_campaigns_run_idx RENAME TO shared_campaigns_run_idx;
ALTER INDEX IF EXISTS coop_messages_campaign_idx RENAME TO shared_messages_campaign_idx;
ALTER INDEX IF EXISTS opportunities_coop_run_idx RENAME TO opportunities_shared_run_idx;

-- ============================================================
-- 5. UPDATE VIEW
-- ============================================================

DROP VIEW IF EXISTS coop_mobilization_estimates;

CREATE OR REPLACE VIEW shared_mobilization_estimates AS
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
FROM shared_service_runs r;

COMMENT ON VIEW shared_mobilization_estimates IS 
  'Computed mobilization splits for shared runs. Updates as members join/leave.';

-- ============================================================
-- 6. UPDATE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_shared_run_estimates(run_uuid UUID)
RETURNS void AS $$
DECLARE
  member_count INTEGER;
  total_units INTEGER;
  total_value NUMERIC;
  mob_fee NUMERIC;
  unit_price NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(unit_count), 0)
  INTO member_count, total_units
  FROM shared_run_members
  WHERE run_id = run_uuid AND status IN ('interested', 'joined', 'scheduled');
  
  SELECT mobilization_fee_total, (pricing_model->>'unit_price')::numeric
  INTO mob_fee, unit_price
  FROM shared_service_runs
  WHERE id = run_uuid;
  
  total_value := COALESCE(total_units * unit_price, 0) + COALESCE(mob_fee, 0);
  
  UPDATE shared_service_runs SET
    current_member_count = member_count,
    estimated_total_value = total_value,
    updated_at = now()
  WHERE id = run_uuid;
  
  UPDATE shared_run_members SET
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

DROP FUNCTION IF EXISTS recompute_coop_run_estimates(UUID);

-- ============================================================
-- 7. UPDATE TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS coop_member_recompute ON shared_run_members;

CREATE OR REPLACE FUNCTION trigger_recompute_shared_run()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_shared_run_estimates(OLD.run_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_shared_run_estimates(NEW.run_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shared_member_recompute ON shared_run_members;
CREATE TRIGGER shared_member_recompute
  AFTER INSERT OR UPDATE OR DELETE ON shared_run_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_shared_run();

DROP FUNCTION IF EXISTS trigger_recompute_coop_run();

-- ============================================================
-- 8. UPDATE RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS coop_runs_tenant ON shared_service_runs;
DROP POLICY IF EXISTS coop_members_tenant ON shared_run_members;
DROP POLICY IF EXISTS coop_invites_tenant ON shared_run_invites;
DROP POLICY IF EXISTS coop_campaigns_tenant ON shared_outreach_campaigns;
DROP POLICY IF EXISTS coop_messages_tenant ON shared_outreach_messages;

CREATE POLICY shared_runs_tenant ON shared_service_runs
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE tenant_id = current_setting('app.tenant_id', true)::uuid
    END
  );

CREATE POLICY shared_members_tenant ON shared_run_members
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE run_id IN (SELECT id FROM shared_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
    END
  );

CREATE POLICY shared_invites_tenant ON shared_run_invites
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE shared_run_id IN (SELECT id FROM shared_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
    END
  );

CREATE POLICY shared_campaigns_tenant ON shared_outreach_campaigns
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE run_id IN (SELECT id FROM shared_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
    END
  );

CREATE POLICY shared_messages_tenant ON shared_outreach_messages
  FOR ALL USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.tenant_id', true) IS NULL THEN false
      ELSE campaign_id IN (SELECT id FROM shared_outreach_campaigns WHERE 
        run_id IN (SELECT id FROM shared_service_runs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
      )
    END
  );

-- ============================================================
-- 9. UPDATE TABLE COMMENTS
-- ============================================================

COMMENT ON TABLE shared_service_runs IS 
  'Shared service runs. Neighbors join to share mobilization costs. NOT bidding.';

COMMENT ON TABLE shared_run_members IS 
  'Members who joined a shared run. Each brings their property + unit count.';

COMMENT ON TABLE shared_run_invites IS 
  'Invitations to contractors to claim/join shared runs.';

COMMENT ON TABLE shared_outreach_campaigns IS 
  'Contractor-initiated outreach to past customers. Triggers virality.';

-- ============================================================
-- 10. GRANT PRIVILEGES (for cc_app role)
-- ============================================================

GRANT ALL PRIVILEGES ON TABLE shared_service_runs TO cc_app;
GRANT ALL PRIVILEGES ON TABLE shared_run_members TO cc_app;
GRANT ALL PRIVILEGES ON TABLE shared_run_invites TO cc_app;
GRANT ALL PRIVILEGES ON TABLE shared_outreach_campaigns TO cc_app;
GRANT ALL PRIVILEGES ON TABLE shared_outreach_messages TO cc_app;
