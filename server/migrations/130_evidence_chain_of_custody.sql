-- ============================================================
-- MIGRATION 130: EVIDENCE CHAIN-OF-CUSTODY ENGINE
-- P2.5 - Tamper-evident evidence bundles with immutable manifests
-- ============================================================
-- Purpose: Produce tamper-evident evidence bundles with immutable manifests
-- Supports sealed records + verification (hash chain + signatures-ready)
-- Preserves dual timestamps: occurred_at vs created_at
-- Enforces strict tenant/circle scoping using existing GUC context + RLS
-- Offline/low-signal compatible by allowing late uploads while keeping an auditable chain
-- ============================================================

BEGIN;

-- ============================================================
-- 1) ENUMS (IDEMPOTENT)
-- ============================================================

-- 1.1 Evidence Source Type
DO $$ BEGIN
  CREATE TYPE cc_evidence_source_type_enum AS ENUM (
    'file_r2',
    'url_snapshot',
    'json_snapshot',
    'manual_note',
    'external_feed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 Evidence Chain Status
DO $$ BEGIN
  CREATE TYPE cc_evidence_chain_status_enum AS ENUM (
    'open',
    'sealed',
    'superseded',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.3 Evidence Event Type
DO $$ BEGIN
  CREATE TYPE cc_evidence_event_type_enum AS ENUM (
    'created',
    'uploaded',
    'fetched',
    'sealed',
    'transferred',
    'accessed',
    'exported',
    'superseded',
    'revoked',
    'annotated'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.4 Evidence Bundle Type
DO $$ BEGIN
  CREATE TYPE cc_evidence_bundle_type_enum AS ENUM (
    'emergency_pack',
    'insurance_claim',
    'dispute_defense',
    'class_action',
    'generic'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.5 Evidence Bundle Status
DO $$ BEGIN
  CREATE TYPE cc_evidence_bundle_status_enum AS ENUM (
    'open',
    'sealed',
    'exported'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) TABLE: cc_evidence_objects
-- Purpose: Single canonical evidence item primitive
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_evidence_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  portal_id uuid NULL REFERENCES cc_portals(id) ON DELETE SET NULL,
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  -- Source type (file, URL snapshot, JSON snapshot, manual note, external feed)
  source_type cc_evidence_source_type_enum NOT NULL,
  
  -- Descriptive metadata
  title text NULL,
  description text NULL,
  
  -- Dual timestamps: when event happened vs when recorded
  occurred_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz NULL,
  
  -- Content metadata
  content_mime text NULL,
  content_bytes bigint NULL,
  content_sha256 text NOT NULL,
  content_canonical_json jsonb NULL,
  
  -- R2 storage (for file_r2 and url_snapshot storage)
  r2_bucket text NULL,
  r2_key text NULL,
  
  -- URL snapshot specific fields
  url text NULL,
  url_fetched_at timestamptz NULL,
  url_http_status int NULL,
  url_response_headers jsonb NULL,
  url_extracted_text text NULL,
  
  -- Chain status
  chain_status cc_evidence_chain_status_enum NOT NULL DEFAULT 'open',
  sealed_at timestamptz NULL,
  sealed_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  seal_reason text NULL,
  
  -- Idempotency key
  client_request_id text NULL,
  
  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Updated at for tracking modifications before seal
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for cc_evidence_objects
CREATE INDEX IF NOT EXISTS idx_evidence_objects_tenant_created 
  ON cc_evidence_objects(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_objects_tenant_circle_created 
  ON cc_evidence_objects(tenant_id, circle_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_objects_client_request_id 
  ON cc_evidence_objects(tenant_id, client_request_id) 
  WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 3) TABLE: cc_evidence_events
-- Purpose: Append-only chain events for custody tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  evidence_object_id uuid NOT NULL REFERENCES cc_evidence_objects(id) ON DELETE CASCADE,
  
  -- Event type
  event_type cc_evidence_event_type_enum NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  
  -- Actor who triggered the event
  actor_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  actor_role text NULL,
  
  -- Event payload (original data)
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Hash chain fields
  prev_event_id uuid NULL REFERENCES cc_evidence_events(id) ON DELETE RESTRICT,
  event_canonical_json jsonb NOT NULL,
  event_sha256 text NOT NULL,
  prev_event_sha256 text NULL,
  
  -- Idempotency key
  client_request_id text NULL
);

-- Indexes for cc_evidence_events
CREATE INDEX IF NOT EXISTS idx_evidence_events_object_time 
  ON cc_evidence_events(tenant_id, evidence_object_id, event_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_events_client_request_id 
  ON cc_evidence_events(tenant_id, client_request_id) 
  WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 4) TABLE: cc_evidence_bundles
-- Purpose: Pack/bundle container (defense pack, insurance pack, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_evidence_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  portal_id uuid NULL REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Bundle classification
  bundle_type cc_evidence_bundle_type_enum NOT NULL,
  title text NOT NULL,
  description text NULL,
  
  -- Creator tracking
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Bundle status
  bundle_status cc_evidence_bundle_status_enum NOT NULL DEFAULT 'open',
  
  -- Manifest (frozen at seal time)
  manifest_json jsonb NULL,
  manifest_sha256 text NULL,
  
  -- Seal tracking
  sealed_at timestamptz NULL,
  sealed_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  -- Export tracking
  exported_at timestamptz NULL,
  exported_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  -- Idempotency key
  client_request_id text NULL,
  
  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Updated at
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for cc_evidence_bundles
CREATE INDEX IF NOT EXISTS idx_evidence_bundles_tenant_created 
  ON cc_evidence_bundles(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_bundles_client_request_id 
  ON cc_evidence_bundles(tenant_id, client_request_id) 
  WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 5) TABLE: cc_evidence_bundle_items
-- Purpose: Join table linking evidence objects to bundles
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_evidence_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES cc_evidence_bundles(id) ON DELETE CASCADE,
  evidence_object_id uuid NOT NULL REFERENCES cc_evidence_objects(id) ON DELETE RESTRICT,
  
  -- When added
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  -- Ordering and labeling
  sort_order int NOT NULL DEFAULT 0,
  label text NULL,
  notes text NULL
);

-- Indexes for cc_evidence_bundle_items
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_bundle_items_unique 
  ON cc_evidence_bundle_items(tenant_id, bundle_id, evidence_object_id);
CREATE INDEX IF NOT EXISTS idx_evidence_bundle_items_order 
  ON cc_evidence_bundle_items(tenant_id, bundle_id, sort_order);

-- ============================================================
-- 6) RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE cc_evidence_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_evidence_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_evidence_bundle_items ENABLE ROW LEVEL SECURITY;

-- Force RLS for evidence events (append-only immutable chain)
ALTER TABLE cc_evidence_events FORCE ROW LEVEL SECURITY;

-- 6.1 Evidence Objects Policies
DROP POLICY IF EXISTS evidence_objects_tenant_access ON cc_evidence_objects;
CREATE POLICY evidence_objects_tenant_access ON cc_evidence_objects
  FOR ALL
  USING (
    is_service_mode()
    OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL
        OR EXISTS (
          SELECT 1 FROM cc_circle_members cm
          WHERE cm.circle_id = cc_evidence_objects.circle_id
            AND cm.individual_id = current_setting('app.individual_id', true)::uuid
            AND cm.is_active = true
        )
      )
    )
  );

-- 6.2 Evidence Events Policies (append-only: no UPDATE/DELETE)
DROP POLICY IF EXISTS evidence_events_select ON cc_evidence_events;
CREATE POLICY evidence_events_select ON cc_evidence_events
  FOR SELECT
  USING (
    is_service_mode()
    OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL
        OR EXISTS (
          SELECT 1 FROM cc_circle_members cm
          WHERE cm.circle_id = cc_evidence_events.circle_id
            AND cm.individual_id = current_setting('app.individual_id', true)::uuid
            AND cm.is_active = true
        )
      )
    )
  );

DROP POLICY IF EXISTS evidence_events_insert ON cc_evidence_events;
CREATE POLICY evidence_events_insert ON cc_evidence_events
  FOR INSERT
  WITH CHECK (
    is_service_mode()
    OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL
        OR EXISTS (
          SELECT 1 FROM cc_circle_members cm
          WHERE cm.circle_id = cc_evidence_events.circle_id
            AND cm.individual_id = current_setting('app.individual_id', true)::uuid
            AND cm.is_active = true
        )
      )
    )
  );

-- No UPDATE/DELETE policies for events = append-only

-- 6.3 Evidence Bundles Policies
DROP POLICY IF EXISTS evidence_bundles_tenant_access ON cc_evidence_bundles;
CREATE POLICY evidence_bundles_tenant_access ON cc_evidence_bundles
  FOR ALL
  USING (
    is_service_mode()
    OR (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      AND (
        circle_id IS NULL
        OR EXISTS (
          SELECT 1 FROM cc_circle_members cm
          WHERE cm.circle_id = cc_evidence_bundles.circle_id
            AND cm.individual_id = current_setting('app.individual_id', true)::uuid
            AND cm.is_active = true
        )
      )
    )
  );

-- 6.4 Evidence Bundle Items Policies
DROP POLICY IF EXISTS evidence_bundle_items_tenant_access ON cc_evidence_bundle_items;
CREATE POLICY evidence_bundle_items_tenant_access ON cc_evidence_bundle_items
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- ============================================================
-- 7) HELPER FUNCTIONS
-- ============================================================

-- 7.1 Get tip (latest) event for an evidence object
CREATE OR REPLACE FUNCTION cc_get_evidence_tip_event(p_evidence_object_id uuid)
RETURNS TABLE(
  id uuid,
  event_sha256 text,
  event_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.event_sha256, e.event_at
  FROM cc_evidence_events e
  WHERE e.evidence_object_id = p_evidence_object_id
  ORDER BY e.event_at DESC, e.id DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Get full event chain for verification
CREATE OR REPLACE FUNCTION cc_get_evidence_event_chain(p_evidence_object_id uuid)
RETURNS TABLE(
  id uuid,
  event_type cc_evidence_event_type_enum,
  event_at timestamptz,
  event_canonical_json jsonb,
  event_sha256 text,
  prev_event_sha256 text,
  actor_individual_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id, 
    e.event_type, 
    e.event_at, 
    e.event_canonical_json, 
    e.event_sha256, 
    e.prev_event_sha256,
    e.actor_individual_id
  FROM cc_evidence_events e
  WHERE e.evidence_object_id = p_evidence_object_id
  ORDER BY e.event_at ASC, e.id ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 Check if evidence object can be modified (not sealed)
CREATE OR REPLACE FUNCTION cc_evidence_is_mutable(p_evidence_object_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status cc_evidence_chain_status_enum;
BEGIN
  SELECT chain_status INTO v_status
  FROM cc_evidence_objects
  WHERE id = p_evidence_object_id;
  
  RETURN v_status = 'open';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.4 Check if bundle can be modified (not sealed)
CREATE OR REPLACE FUNCTION cc_evidence_bundle_is_mutable(p_bundle_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status cc_evidence_bundle_status_enum;
BEGIN
  SELECT bundle_status INTO v_status
  FROM cc_evidence_bundles
  WHERE id = p_bundle_id;
  
  RETURN v_status = 'open';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8) TRIGGERS FOR IMMUTABILITY
-- ============================================================

-- 8.1 Prevent updates to sealed evidence objects
CREATE OR REPLACE FUNCTION cc_prevent_sealed_evidence_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.chain_status != 'open' AND NEW.chain_status = OLD.chain_status THEN
    RAISE EXCEPTION 'Cannot modify sealed evidence object %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_sealed_evidence_update ON cc_evidence_objects;
CREATE TRIGGER trg_prevent_sealed_evidence_update
  BEFORE UPDATE ON cc_evidence_objects
  FOR EACH ROW
  WHEN (OLD.chain_status != 'open')
  EXECUTE FUNCTION cc_prevent_sealed_evidence_update();

-- 8.2 Prevent updates to sealed bundles
CREATE OR REPLACE FUNCTION cc_prevent_sealed_bundle_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.bundle_status != 'open' AND NEW.bundle_status = OLD.bundle_status THEN
    RAISE EXCEPTION 'Cannot modify sealed bundle %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_sealed_bundle_update ON cc_evidence_bundles;
CREATE TRIGGER trg_prevent_sealed_bundle_update
  BEFORE UPDATE ON cc_evidence_bundles
  FOR EACH ROW
  WHEN (OLD.bundle_status != 'open')
  EXECUTE FUNCTION cc_prevent_sealed_bundle_update();

-- 8.3 Prevent adding items to sealed bundles
CREATE OR REPLACE FUNCTION cc_prevent_sealed_bundle_item_change()
RETURNS TRIGGER AS $$
DECLARE
  v_status cc_evidence_bundle_status_enum;
BEGIN
  SELECT bundle_status INTO v_status
  FROM cc_evidence_bundles
  WHERE id = COALESCE(NEW.bundle_id, OLD.bundle_id);
  
  IF v_status != 'open' THEN
    RAISE EXCEPTION 'Cannot modify items of sealed bundle';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_sealed_bundle_item_insert ON cc_evidence_bundle_items;
CREATE TRIGGER trg_prevent_sealed_bundle_item_insert
  BEFORE INSERT ON cc_evidence_bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION cc_prevent_sealed_bundle_item_change();

DROP TRIGGER IF EXISTS trg_prevent_sealed_bundle_item_update ON cc_evidence_bundle_items;
CREATE TRIGGER trg_prevent_sealed_bundle_item_update
  BEFORE UPDATE ON cc_evidence_bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION cc_prevent_sealed_bundle_item_change();

DROP TRIGGER IF EXISTS trg_prevent_sealed_bundle_item_delete ON cc_evidence_bundle_items;
CREATE TRIGGER trg_prevent_sealed_bundle_item_delete
  BEFORE DELETE ON cc_evidence_bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION cc_prevent_sealed_bundle_item_change();

-- ============================================================
-- 9) ACCESS LOG RATE LIMITING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_evidence_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  evidence_object_id uuid NOT NULL REFERENCES cc_evidence_objects(id) ON DELETE CASCADE,
  actor_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  action text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_access_log_dedupe
  ON cc_evidence_access_log(tenant_id, evidence_object_id, actor_individual_id, action, accessed_at);

ALTER TABLE cc_evidence_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_access_log_tenant_access ON cc_evidence_access_log;
CREATE POLICY evidence_access_log_tenant_access ON cc_evidence_access_log
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- ============================================================
-- 10) COMMENTS
-- ============================================================

COMMENT ON TABLE cc_evidence_objects IS 'P2.5: Single canonical evidence item primitive - supports files, URL snapshots, JSON snapshots, manual notes';
COMMENT ON TABLE cc_evidence_events IS 'P2.5: Append-only hash chain for evidence custody tracking';
COMMENT ON TABLE cc_evidence_bundles IS 'P2.5: Evidence pack/bundle container with manifest hashing';
COMMENT ON TABLE cc_evidence_bundle_items IS 'P2.5: Join table linking evidence objects to bundles';
COMMENT ON TABLE cc_evidence_access_log IS 'P2.5: Rate-limited access log for evidence reads';

COMMIT;
