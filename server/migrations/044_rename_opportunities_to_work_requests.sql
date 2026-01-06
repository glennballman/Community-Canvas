-- Migration 044: Rename opportunities → work_requests
-- 
-- Global semantic rename as tables are effectively empty.
-- "Opportunity" terminology replaced with "Work Request" for clarity.
-- This avoids confusion with future "Job Posting" feature for employment.
--
-- Key renames:
--   opportunities → work_requests
--   opportunity_media → work_request_media  
--   opportunity_measurements → work_request_measurements
--   opportunity_status enum → work_request_status
--   opportunity_id FK columns → work_request_id
--   opportunity_ref → work_request_ref

-- ============================================================================
-- STEP 1: DISABLE TRIGGERS TEMPORARILY
-- ============================================================================
ALTER TABLE opportunities DISABLE TRIGGER ALL;

-- ============================================================================
-- STEP 2: DROP RLS POLICIES (will recreate with new names)
-- ============================================================================
DROP POLICY IF EXISTS opportunity_isolation ON opportunities;

-- ============================================================================
-- STEP 3: DROP OLD TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_opportunity_status_change ON opportunities;
DROP TRIGGER IF EXISTS trg_set_opportunity_ref ON opportunities;
DROP TRIGGER IF EXISTS trg_opportunities_grid ON opportunities;

-- ============================================================================
-- STEP 4: RENAME ENUM TYPE
-- ============================================================================
ALTER TYPE opportunity_status RENAME TO work_request_status;

-- ============================================================================
-- STEP 5: RENAME CORE TABLES
-- ============================================================================
ALTER TABLE opportunities RENAME TO work_requests;
ALTER TABLE opportunity_media RENAME TO work_request_media;
ALTER TABLE opportunity_measurements RENAME TO work_request_measurements;

-- ============================================================================
-- STEP 6: RENAME COLUMNS IN work_requests TABLE
-- ============================================================================
ALTER TABLE work_requests RENAME COLUMN opportunity_ref TO work_request_ref;

-- ============================================================================
-- STEP 7: RENAME FK COLUMNS IN ALL REFERENCING TABLES
-- ============================================================================
ALTER TABLE bids RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE bid_messages RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE contracts RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE conversations RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE estimates RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE payment_promises RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE work_orders RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE work_request_media RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE work_request_measurements RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE spatial_constraints RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE bundle_members RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE verification_tasks RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE financing_referrals RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE private_feedback RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE contractor_financing_requests RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE contractor_feedback RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE public_appreciations RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE serious_issue_reports RENAME COLUMN opportunity_id TO work_request_id;
ALTER TABLE service_run_members RENAME COLUMN opportunity_id TO work_request_id;
-- Note: coop_run_members was renamed to shared_run_members in migration 040

-- Handle tables that may or may not exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coop_run_members' AND column_name = 'opportunity_id') THEN
    ALTER TABLE coop_run_members RENAME COLUMN opportunity_id TO work_request_id;
  END IF;
END $$;

-- Special case: related_opportunity_id in private_preferences
ALTER TABLE private_preferences RENAME COLUMN related_opportunity_id TO related_work_request_id;

-- Special case: initiated_by_opportunity_id in bundle_opportunities  
ALTER TABLE bundle_opportunities RENAME COLUMN initiated_by_opportunity_id TO initiated_by_work_request_id;

-- ============================================================================
-- STEP 8: RENAME INDEXES
-- ============================================================================
-- Core table indexes
ALTER INDEX IF EXISTS opportunities_opportunity_ref_key RENAME TO work_requests_work_request_ref_key;
ALTER INDEX IF EXISTS opportunities_shared_run_idx RENAME TO work_requests_shared_run_idx;
ALTER INDEX IF EXISTS idx_opportunities_site_grid RENAME TO idx_work_requests_site_grid;
ALTER INDEX IF EXISTS idx_opportunities_portal RENAME TO idx_work_requests_portal;
ALTER INDEX IF EXISTS opportunities_intake_mode_idx RENAME TO work_requests_intake_mode_idx;

-- Media table indexes
ALTER INDEX IF EXISTS opportunity_media_pkey RENAME TO work_request_media_pkey;
ALTER INDEX IF EXISTS idx_opportunity_media_opp RENAME TO idx_work_request_media_req;

-- Measurements table indexes
ALTER INDEX IF EXISTS opportunity_measurements_pkey RENAME TO work_request_measurements_pkey;
ALTER INDEX IF EXISTS idx_opportunity_measurements_opp RENAME TO idx_work_request_measurements_req;

-- FK indexes on other tables
ALTER INDEX IF EXISTS conversations_opportunity_idx RENAME TO conversations_work_request_idx;
ALTER INDEX IF EXISTS conversations_opportunity_id_contractor_party_id_key RENAME TO conversations_work_request_id_contractor_party_id_key;
ALTER INDEX IF EXISTS payment_promises_opportunity_idx RENAME TO payment_promises_work_request_idx;
ALTER INDEX IF EXISTS spatial_opportunity_idx RENAME TO spatial_work_request_idx;
ALTER INDEX IF EXISTS bundle_members_opportunity_idx RENAME TO bundle_members_work_request_idx;
ALTER INDEX IF EXISTS bundle_members_bundle_id_opportunity_id_key RENAME TO bundle_members_bundle_id_work_request_id_key;
ALTER INDEX IF EXISTS verification_opportunity_idx RENAME TO verification_work_request_idx;
ALTER INDEX IF EXISTS financing_opportunity_idx RENAME TO financing_work_request_idx;
ALTER INDEX IF EXISTS private_feedback_opportunity_idx RENAME TO private_feedback_work_request_idx;
ALTER INDEX IF EXISTS financing_requests_opportunity_idx RENAME TO financing_requests_work_request_idx;
ALTER INDEX IF EXISTS idx_estimates_opportunity RENAME TO idx_estimates_work_request;
ALTER INDEX IF EXISTS idx_bids_opportunity RENAME TO idx_bids_work_request;
ALTER INDEX IF EXISTS bids_opportunity_id_party_id_key RENAME TO bids_work_request_id_party_id_key;

-- ============================================================================
-- STEP 9: RENAME SEQUENCES
-- ============================================================================
ALTER SEQUENCE IF EXISTS opportunity_ref_seq RENAME TO work_request_ref_seq;

-- ============================================================================
-- STEP 10: RECREATE TRIGGERS WITH NEW NAMES
-- ============================================================================

-- Grid trigger for geo coordinates
CREATE OR REPLACE TRIGGER trg_work_requests_grid 
  BEFORE INSERT OR UPDATE OF site_latitude, site_longitude ON work_requests
  FOR EACH ROW EXECUTE FUNCTION set_grid_cells();

-- Status change trigger (update function reference)
DROP FUNCTION IF EXISTS handle_opportunity_status_change() CASCADE;

CREATE OR REPLACE FUNCTION handle_work_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'published' AND OLD.status = 'draft' THEN
      INSERT INTO events (event_type, entity_type, entity_id, payload, tenant_id)
      VALUES (
        'opportunity_published'::event_type,
        'work_request',
        NEW.id,
        jsonb_build_object('work_request_id', NEW.id, 'title', NEW.title),
        NEW.owner_tenant_id
      );
    END IF;
    
    IF NEW.status = 'awarded' THEN
      INSERT INTO events (event_type, entity_type, entity_id, payload, tenant_id)
      VALUES (
        'bid_accepted'::event_type,
        'work_request',
        NEW.id,
        jsonb_build_object('work_request_id', NEW.id, 'title', NEW.title),
        NEW.owner_tenant_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_request_status_change
  AFTER UPDATE OF status ON work_requests
  FOR EACH ROW EXECUTE FUNCTION handle_work_request_status_change();

-- Ref generation trigger
DROP FUNCTION IF EXISTS set_opportunity_ref() CASCADE;

CREATE OR REPLACE FUNCTION set_work_request_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.work_request_ref IS NULL THEN
    NEW.work_request_ref := 'WR-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('work_request_ref_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_work_request_ref
  BEFORE INSERT ON work_requests
  FOR EACH ROW EXECUTE FUNCTION set_work_request_ref();

-- ============================================================================
-- STEP 11: RECREATE RLS POLICIES WITH NEW NAMES
-- ============================================================================
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_request_isolation ON work_requests
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE (
        visibility_scope = 'public'::publish_visibility
        OR owner_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR (visibility_scope = 'portal_only'::publish_visibility 
            AND portal_id = NULLIF(current_setting('app.portal_id', true), '')::uuid)
      )
    END
  );

-- ============================================================================
-- STEP 12: RE-ENABLE TRIGGERS
-- ============================================================================
ALTER TABLE work_requests ENABLE TRIGGER ALL;

-- ============================================================================
-- STEP 13: UPDATE event_type ENUM VALUES (rename opportunity events)
-- ============================================================================
-- Note: PostgreSQL doesn't allow renaming enum values directly.
-- The event_type enum still contains 'opportunity_created' and 'opportunity_published'
-- These will continue to work - they represent historical terminology.
-- New code should use the same values for backward compatibility.

-- ============================================================================
-- STEP 14: COMMENTS
-- ============================================================================
COMMENT ON TABLE work_requests IS 'Work requests posted by property owners seeking contractors (formerly opportunities)';
COMMENT ON TABLE work_request_media IS 'Media attachments for work requests (formerly opportunity_media)';
COMMENT ON TABLE work_request_measurements IS 'Site measurements for work requests (formerly opportunity_measurements)';
COMMENT ON TYPE work_request_status IS 'Status values for work requests (formerly opportunity_status)';
