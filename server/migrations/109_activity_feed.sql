-- ============================================================
-- MIGRATION 109: ACTIVITY FEED & EVENT STREAM
-- Part of Prompt 29 - Engagement & Social Proof
-- ============================================================

BEGIN;

-- ============================================================
-- 1) ACTIVITY ENUMS
-- ============================================================

-- Verb-based only - entity specificity goes in entity_type/subtype columns
DO $$ BEGIN
  CREATE TYPE activity_verb AS ENUM (
    'created',
    'updated',
    'deleted',
    'scheduled',
    'confirmed',
    'cancelled',
    'completed',
    'claimed',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'joined',
    'left',
    'approved',
    'started',
    'filled',
    'received',
    'changed',
    'milestone',
    'announcement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_visibility AS ENUM (
    'private',        -- Only the actor sees it
    'tenant',         -- All users in the tenant see it
    'portal',         -- All portal members see it
    'community',      -- All community members see it
    'public'          -- Anyone can see it (rare)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_priority AS ENUM (
    'low',
    'normal',
    'high',
    'featured'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) ACTIVITY EVENTS TABLE
-- Core event stream - immutable log of all activities
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event classification (verb + entity + optional subtype)
  verb activity_verb NOT NULL,
  entity_type text NOT NULL, -- job, reservation, invitation, portal, work_request, service_run, onboarding, system
  entity_id uuid,
  subtype text, -- Optional refinement: application, status, member, content, step, etc.
  
  -- Actor (who performed the action) - XOR identity
  actor_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  actor_party_id uuid REFERENCES cc_parties(id) ON DELETE SET NULL,
  actor_individual_id uuid REFERENCES cc_individuals(id) ON DELETE SET NULL,
  actor_name text, -- Denormalized for display
  
  -- Context (where it happened)
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  community_id uuid REFERENCES cc_communities(id) ON DELETE SET NULL,
  
  -- Content
  title text NOT NULL,
  description text,
  entity_name text, -- Denormalized for display (e.g., job title, reservation name)
  metadata jsonb DEFAULT '{}',
  
  -- Visibility & Priority
  visibility activity_visibility NOT NULL DEFAULT 'tenant',
  priority activity_priority NOT NULL DEFAULT 'normal',
  
  -- Engagement tracking
  is_actionable boolean DEFAULT false,
  action_url text,
  action_label text,
  
  -- Aggregation support
  aggregation_key text, -- Events with same key can be grouped
  
  -- Timestamps
  occurred_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, -- Optional expiry for time-sensitive items
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_tenant ON cc_activity_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_portal ON cc_activity_events(portal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_community ON cc_activity_events(community_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_verb ON cc_activity_events(verb, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_entity ON cc_activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_aggregation ON cc_activity_events(aggregation_key, occurred_at DESC)
  WHERE aggregation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_activity_events_recent ON cc_activity_events(occurred_at DESC)
  WHERE expires_at IS NULL;

-- Enable RLS
ALTER TABLE cc_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_activity_events_service_bypass ON cc_activity_events;
CREATE POLICY cc_activity_events_service_bypass ON cc_activity_events
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can see their own activity + public/portal/community they belong to
DROP POLICY IF EXISTS cc_activity_events_tenant_read ON cc_activity_events;
CREATE POLICY cc_activity_events_tenant_read ON cc_activity_events
  FOR SELECT
  USING (
    -- Private: only if they're the actor
    (visibility = 'private' AND actor_tenant_id = current_tenant_id())
    -- Tenant: if they're in the tenant
    OR (visibility = 'tenant' AND tenant_id = current_tenant_id())
    -- Portal: if they're a portal member
    OR (visibility = 'portal' AND portal_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = cc_activity_events.portal_id
        AND pm.tenant_id = current_tenant_id()
    ))
    -- Community: if they're a community member (via portal membership)
    OR (visibility = 'community' AND community_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_communities c
      JOIN cc_portal_members pm ON pm.portal_id = c.portal_id
      WHERE c.id = cc_activity_events.community_id
        AND pm.tenant_id = current_tenant_id()
    ))
    -- Public: everyone
    OR visibility = 'public'
  );

-- ============================================================
-- 3) ACTIVITY FEED STATE (Per-recipient read state)
-- Tracks what each recipient has seen - XOR identity
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_activity_feed_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient identity (XOR - exactly one must be set)
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Last seen timestamps per context
  last_seen_at timestamptz DEFAULT now(),
  last_seen_tenant_at timestamptz,
  last_seen_portal_at timestamptz,
  last_seen_community_at timestamptz,
  
  -- Unread counts (cached, updated by triggers or periodic job)
  unread_count integer DEFAULT 0,
  
  -- Preferences
  collapsed_types text[] DEFAULT '{}', -- Entity types user has collapsed/muted
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One feed state per identity
  CONSTRAINT activity_feed_state_unique_tenant UNIQUE (tenant_id),
  CONSTRAINT activity_feed_state_unique_party UNIQUE (party_id),
  CONSTRAINT activity_feed_state_unique_individual UNIQUE (individual_id),
  
  -- Exactly one identity (XOR)
  CONSTRAINT activity_feed_state_exactly_one_identity CHECK (
    (CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN individual_id IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_activity_feed_state_tenant ON cc_activity_feed_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_feed_state_party ON cc_activity_feed_state(party_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_feed_state_individual ON cc_activity_feed_state(individual_id);

-- Enable RLS
ALTER TABLE cc_activity_feed_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_activity_feed_state_service_bypass ON cc_activity_feed_state;
CREATE POLICY cc_activity_feed_state_service_bypass ON cc_activity_feed_state
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can access their own feed state
DROP POLICY IF EXISTS cc_activity_feed_state_tenant_access ON cc_activity_feed_state;
CREATE POLICY cc_activity_feed_state_tenant_access ON cc_activity_feed_state
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Tenant can access party feed states if party belongs to tenant
DROP POLICY IF EXISTS cc_activity_feed_state_party_access ON cc_activity_feed_state;
CREATE POLICY cc_activity_feed_state_party_access ON cc_activity_feed_state
  FOR ALL
  USING (
    party_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_activity_feed_state.party_id
        AND p.tenant_id = current_tenant_id()
    )
  );

-- Tenant can access individual feed states if linked via cc_tenant_individuals
DROP POLICY IF EXISTS cc_activity_feed_state_individual_access ON cc_activity_feed_state;
CREATE POLICY cc_activity_feed_state_individual_access ON cc_activity_feed_state
  FOR ALL
  USING (
    individual_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_tenant_individuals ti
      WHERE ti.individual_id = cc_activity_feed_state.individual_id
        AND ti.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- 4) ACTIVITY BOOKMARKS
-- Users can bookmark important activities - XOR identity
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_activity_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient identity (XOR - exactly one must be set)
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  activity_id uuid NOT NULL REFERENCES cc_activity_events(id) ON DELETE CASCADE,
  
  note text, -- Optional user note
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Exactly one identity (XOR)
  CONSTRAINT activity_bookmarks_exactly_one_identity CHECK (
    (CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN individual_id IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  )
);

-- Unique bookmark per identity + activity (composite)
CREATE UNIQUE INDEX IF NOT EXISTS cc_activity_bookmarks_tenant_unique 
  ON cc_activity_bookmarks(tenant_id, activity_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cc_activity_bookmarks_party_unique 
  ON cc_activity_bookmarks(party_id, activity_id) WHERE party_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cc_activity_bookmarks_individual_unique 
  ON cc_activity_bookmarks(individual_id, activity_id) WHERE individual_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_activity_bookmarks_tenant ON cc_activity_bookmarks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_activity_bookmarks_party ON cc_activity_bookmarks(party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_activity_bookmarks_individual ON cc_activity_bookmarks(individual_id, created_at DESC);

-- Enable RLS
ALTER TABLE cc_activity_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_activity_bookmarks_service_bypass ON cc_activity_bookmarks;
CREATE POLICY cc_activity_bookmarks_service_bypass ON cc_activity_bookmarks
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can access their own bookmarks
DROP POLICY IF EXISTS cc_activity_bookmarks_tenant_access ON cc_activity_bookmarks;
CREATE POLICY cc_activity_bookmarks_tenant_access ON cc_activity_bookmarks
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Tenant can access party bookmarks if party belongs to tenant
DROP POLICY IF EXISTS cc_activity_bookmarks_party_access ON cc_activity_bookmarks;
CREATE POLICY cc_activity_bookmarks_party_access ON cc_activity_bookmarks
  FOR ALL
  USING (
    party_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_activity_bookmarks.party_id
        AND p.tenant_id = current_tenant_id()
    )
  );

-- Tenant can access individual bookmarks if linked via cc_tenant_individuals
DROP POLICY IF EXISTS cc_activity_bookmarks_individual_access ON cc_activity_bookmarks;
CREATE POLICY cc_activity_bookmarks_individual_access ON cc_activity_bookmarks
  FOR ALL
  USING (
    individual_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_tenant_individuals ti
      WHERE ti.individual_id = cc_activity_bookmarks.individual_id
        AND ti.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- 5) HELPER FUNCTION: Record Activity Event
-- SERVICE-ONLY: Only server can record activities
-- ============================================================

CREATE OR REPLACE FUNCTION cc_record_activity(
  p_verb activity_verb,
  p_entity_type text,
  p_title text,
  p_entity_id uuid DEFAULT NULL,
  p_subtype text DEFAULT NULL,
  p_actor_tenant_id uuid DEFAULT NULL,
  p_actor_party_id uuid DEFAULT NULL,
  p_actor_individual_id uuid DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL,
  p_portal_id uuid DEFAULT NULL,
  p_community_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_visibility activity_visibility DEFAULT 'tenant',
  p_priority activity_priority DEFAULT 'normal',
  p_is_actionable boolean DEFAULT false,
  p_action_url text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_aggregation_key text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_activity_id uuid;
  v_actor_name text;
BEGIN
  -- SECURITY: Only server can record activities
  IF NOT is_service_mode() THEN
    RAISE EXCEPTION 'SERVICE_ONLY: Activities can only be recorded by the server';
  END IF;

  -- Get actor name from whichever identity is provided
  IF p_actor_tenant_id IS NOT NULL THEN
    SELECT name INTO v_actor_name FROM cc_tenants WHERE id = p_actor_tenant_id;
  ELSIF p_actor_party_id IS NOT NULL THEN
    SELECT name INTO v_actor_name FROM cc_parties WHERE id = p_actor_party_id;
  ELSIF p_actor_individual_id IS NOT NULL THEN
    SELECT COALESCE(given_name || ' ' || family_name, email) INTO v_actor_name 
    FROM cc_individuals WHERE id = p_actor_individual_id;
  END IF;

  -- Insert activity
  INSERT INTO cc_activity_events (
    verb,
    entity_type,
    entity_id,
    subtype,
    actor_tenant_id,
    actor_party_id,
    actor_individual_id,
    actor_name,
    entity_name,
    tenant_id,
    portal_id,
    community_id,
    title,
    description,
    metadata,
    visibility,
    priority,
    is_actionable,
    action_url,
    action_label,
    aggregation_key,
    expires_at
  ) VALUES (
    p_verb,
    p_entity_type,
    p_entity_id,
    p_subtype,
    p_actor_tenant_id,
    p_actor_party_id,
    p_actor_individual_id,
    v_actor_name,
    p_entity_name,
    COALESCE(p_tenant_id, p_actor_tenant_id),
    p_portal_id,
    p_community_id,
    p_title,
    p_description,
    p_metadata,
    p_visibility,
    p_priority,
    p_is_actionable,
    p_action_url,
    p_action_label,
    p_aggregation_key,
    p_expires_at
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$;

-- ============================================================
-- 6) HELPER FUNCTION: Get Activity Feed
-- Returns paginated, filtered activity feed for a recipient
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_activity_feed(
  p_recipient_type text,  -- 'tenant', 'party', 'individual'
  p_recipient_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_entity_type text DEFAULT NULL,
  p_verb activity_verb DEFAULT NULL,
  p_portal_id uuid DEFAULT NULL,
  p_community_id uuid DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_include_expired boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_activities jsonb;
  v_total integer;
  v_unread integer;
  v_last_seen timestamptz;
  v_tenant_id uuid;
BEGIN
  -- SECURITY: Verify caller has scope
  IF p_recipient_type = 'tenant' THEN
    IF NOT is_service_mode() AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot view another tenant''s feed';
    END IF;
    v_tenant_id := p_recipient_id;
  ELSIF p_recipient_type = 'party' THEN
    IF NOT is_service_mode() THEN
      SELECT tenant_id INTO v_tenant_id FROM cc_parties WHERE id = p_recipient_id;
      IF v_tenant_id IS NULL OR v_tenant_id <> current_tenant_id() THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not in current tenant';
      END IF;
    END IF;
  ELSIF p_recipient_type = 'individual' THEN
    IF NOT is_service_mode() THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals 
        WHERE individual_id = p_recipient_id AND tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not linked to current tenant';
      END IF;
      v_tenant_id := current_tenant_id();
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_RECIPIENT_TYPE: Must be tenant, party, or individual';
  END IF;

  -- Get last seen timestamp based on recipient type
  SELECT last_seen_at INTO v_last_seen
  FROM cc_activity_feed_state
  WHERE (p_recipient_type = 'tenant' AND tenant_id = p_recipient_id)
     OR (p_recipient_type = 'party' AND party_id = p_recipient_id)
     OR (p_recipient_type = 'individual' AND individual_id = p_recipient_id);

  -- Get activities (visibility check mirrors RLS)
  SELECT jsonb_agg(activity ORDER BY occurred_at DESC)
  INTO v_activities
  FROM (
    SELECT jsonb_build_object(
      'id', ae.id,
      'verb', ae.verb,
      'entity_type', ae.entity_type,
      'entity_id', ae.entity_id,
      'subtype', ae.subtype,
      'actor_name', ae.actor_name,
      'actor_tenant_id', ae.actor_tenant_id,
      'entity_name', ae.entity_name,
      'title', ae.title,
      'description', ae.description,
      'metadata', ae.metadata,
      'visibility', ae.visibility,
      'priority', ae.priority,
      'is_actionable', ae.is_actionable,
      'action_url', ae.action_url,
      'action_label', ae.action_label,
      'occurred_at', ae.occurred_at,
      'is_new', ae.occurred_at > COALESCE(v_last_seen, '1970-01-01'::timestamptz),
      'is_bookmarked', EXISTS (
        SELECT 1 FROM cc_activity_bookmarks ab
        WHERE ab.activity_id = ae.id 
          AND ((p_recipient_type = 'tenant' AND ab.tenant_id = p_recipient_id)
            OR (p_recipient_type = 'party' AND ab.party_id = p_recipient_id)
            OR (p_recipient_type = 'individual' AND ab.individual_id = p_recipient_id))
      )
    ) as activity,
    ae.occurred_at
    FROM cc_activity_events ae
    WHERE (
      -- Visibility check
      (ae.visibility = 'private' AND (
        ae.actor_tenant_id = v_tenant_id 
        OR (p_recipient_type = 'party' AND ae.actor_party_id = p_recipient_id)
        OR (p_recipient_type = 'individual' AND ae.actor_individual_id = p_recipient_id)
      ))
      OR (ae.visibility = 'tenant' AND ae.tenant_id = v_tenant_id)
      OR (ae.visibility = 'portal' AND ae.portal_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM cc_portal_members pm
        WHERE pm.portal_id = ae.portal_id AND pm.tenant_id = v_tenant_id
      ))
      OR (ae.visibility = 'community' AND ae.community_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM cc_communities c
        JOIN cc_portal_members pm ON pm.portal_id = c.portal_id
        WHERE c.id = ae.community_id AND pm.tenant_id = v_tenant_id
      ))
      OR ae.visibility = 'public'
    )
    -- Filters
    AND (p_entity_type IS NULL OR ae.entity_type = p_entity_type)
    AND (p_verb IS NULL OR ae.verb = p_verb)
    AND (p_portal_id IS NULL OR ae.portal_id = p_portal_id)
    AND (p_community_id IS NULL OR ae.community_id = p_community_id)
    AND (p_since IS NULL OR ae.occurred_at > p_since)
    AND (p_include_expired OR ae.expires_at IS NULL OR ae.expires_at > now())
    ORDER BY ae.occurred_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM cc_activity_events ae
  WHERE (
    (ae.visibility = 'private' AND (
      ae.actor_tenant_id = v_tenant_id 
      OR (p_recipient_type = 'party' AND ae.actor_party_id = p_recipient_id)
      OR (p_recipient_type = 'individual' AND ae.actor_individual_id = p_recipient_id)
    ))
    OR (ae.visibility = 'tenant' AND ae.tenant_id = v_tenant_id)
    OR (ae.visibility = 'portal' AND EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = ae.portal_id AND pm.tenant_id = v_tenant_id
    ))
    OR (ae.visibility = 'community' AND EXISTS (
      SELECT 1 FROM cc_communities c
      JOIN cc_portal_members pm ON pm.portal_id = c.portal_id
      WHERE c.id = ae.community_id AND pm.tenant_id = v_tenant_id
    ))
    OR ae.visibility = 'public'
  )
  AND (p_entity_type IS NULL OR ae.entity_type = p_entity_type)
  AND (p_verb IS NULL OR ae.verb = p_verb)
  AND (p_portal_id IS NULL OR ae.portal_id = p_portal_id)
  AND (p_community_id IS NULL OR ae.community_id = p_community_id)
  AND (p_include_expired OR ae.expires_at IS NULL OR ae.expires_at > now());

  -- Get unread count
  SELECT COUNT(*) INTO v_unread
  FROM cc_activity_events ae
  WHERE ae.occurred_at > COALESCE(v_last_seen, '1970-01-01'::timestamptz)
  AND (
    (ae.visibility = 'private' AND (
      ae.actor_tenant_id = v_tenant_id 
      OR (p_recipient_type = 'party' AND ae.actor_party_id = p_recipient_id)
      OR (p_recipient_type = 'individual' AND ae.actor_individual_id = p_recipient_id)
    ))
    OR (ae.visibility = 'tenant' AND ae.tenant_id = v_tenant_id)
    OR (ae.visibility = 'portal' AND EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = ae.portal_id AND pm.tenant_id = v_tenant_id
    ))
    OR (ae.visibility = 'community' AND EXISTS (
      SELECT 1 FROM cc_communities c
      JOIN cc_portal_members pm ON pm.portal_id = c.portal_id
      WHERE c.id = ae.community_id AND pm.tenant_id = v_tenant_id
    ))
    OR ae.visibility = 'public'
  )
  AND (ae.expires_at IS NULL OR ae.expires_at > now());

  RETURN jsonb_build_object(
    'activities', COALESCE(v_activities, '[]'),
    'total', v_total,
    'unread', v_unread,
    'limit', p_limit,
    'offset', p_offset,
    'last_seen_at', v_last_seen
  );
END;
$$;

-- ============================================================
-- 7) HELPER FUNCTION: Mark Feed as Seen
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_mark_feed_seen(
  p_recipient_type text,  -- 'tenant', 'party', 'individual'
  p_recipient_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SECURITY: Verify caller has scope
  IF p_recipient_type = 'tenant' THEN
    IF NOT is_service_mode() AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s feed state';
    END IF;
  ELSIF p_recipient_type = 'party' THEN
    IF NOT is_service_mode() THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties WHERE id = p_recipient_id AND tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not in current tenant';
      END IF;
    END IF;
  ELSIF p_recipient_type = 'individual' THEN
    IF NOT is_service_mode() THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals 
        WHERE individual_id = p_recipient_id AND tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not linked to current tenant';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_RECIPIENT_TYPE: Must be tenant, party, or individual';
  END IF;

  -- Upsert feed state
  IF p_recipient_type = 'tenant' THEN
    INSERT INTO cc_activity_feed_state (tenant_id, last_seen_at, unread_count)
    VALUES (p_recipient_id, now(), 0)
    ON CONFLICT (tenant_id) DO UPDATE SET
      last_seen_at = now(),
      unread_count = 0,
      updated_at = now();
  ELSIF p_recipient_type = 'party' THEN
    INSERT INTO cc_activity_feed_state (party_id, last_seen_at, unread_count)
    VALUES (p_recipient_id, now(), 0)
    ON CONFLICT (party_id) DO UPDATE SET
      last_seen_at = now(),
      unread_count = 0,
      updated_at = now();
  ELSIF p_recipient_type = 'individual' THEN
    INSERT INTO cc_activity_feed_state (individual_id, last_seen_at, unread_count)
    VALUES (p_recipient_id, now(), 0)
    ON CONFLICT (individual_id) DO UPDATE SET
      last_seen_at = now(),
      unread_count = 0,
      updated_at = now();
  END IF;

  RETURN true;
END;
$$;

-- ============================================================
-- 8) HELPER FUNCTION: Toggle Activity Bookmark
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_toggle_activity_bookmark(
  p_recipient_type text,  -- 'tenant', 'party', 'individual'
  p_recipient_id uuid,
  p_activity_id uuid,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- SECURITY: Verify caller has scope
  IF p_recipient_type = 'tenant' THEN
    IF NOT is_service_mode() AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s bookmarks';
    END IF;
  ELSIF p_recipient_type = 'party' THEN
    IF NOT is_service_mode() THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties WHERE id = p_recipient_id AND tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not in current tenant';
      END IF;
    END IF;
  ELSIF p_recipient_type = 'individual' THEN
    IF NOT is_service_mode() THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals 
        WHERE individual_id = p_recipient_id AND tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not linked to current tenant';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_RECIPIENT_TYPE: Must be tenant, party, or individual';
  END IF;

  -- Check if bookmark exists based on recipient type
  SELECT EXISTS (
    SELECT 1 FROM cc_activity_bookmarks
    WHERE activity_id = p_activity_id
      AND ((p_recipient_type = 'tenant' AND tenant_id = p_recipient_id)
        OR (p_recipient_type = 'party' AND party_id = p_recipient_id)
        OR (p_recipient_type = 'individual' AND individual_id = p_recipient_id))
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove bookmark
    DELETE FROM cc_activity_bookmarks
    WHERE activity_id = p_activity_id
      AND ((p_recipient_type = 'tenant' AND tenant_id = p_recipient_id)
        OR (p_recipient_type = 'party' AND party_id = p_recipient_id)
        OR (p_recipient_type = 'individual' AND individual_id = p_recipient_id));
    
    RETURN jsonb_build_object('bookmarked', false);
  ELSE
    -- Add bookmark based on recipient type
    IF p_recipient_type = 'tenant' THEN
      INSERT INTO cc_activity_bookmarks (tenant_id, activity_id, note)
      VALUES (p_recipient_id, p_activity_id, p_note);
    ELSIF p_recipient_type = 'party' THEN
      INSERT INTO cc_activity_bookmarks (party_id, activity_id, note)
      VALUES (p_recipient_id, p_activity_id, p_note);
    ELSIF p_recipient_type = 'individual' THEN
      INSERT INTO cc_activity_bookmarks (individual_id, activity_id, note)
      VALUES (p_recipient_id, p_activity_id, p_note);
    END IF;
    
    RETURN jsonb_build_object('bookmarked', true);
  END IF;
END;
$$;

-- ============================================================
-- 9) HELPER FUNCTION: Get Aggregated Activity Summary
-- Returns counts grouped by entity_type for dashboard widgets
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_activity_summary(
  p_recipient_type text,  -- 'tenant', 'party', 'individual'
  p_recipient_id uuid,
  p_since timestamptz DEFAULT now() - interval '7 days'
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_summary jsonb;
  v_tenant_id uuid;
BEGIN
  -- SECURITY: Verify caller has scope
  IF p_recipient_type = 'tenant' THEN
    IF NOT is_service_mode() AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot view another tenant''s activity summary';
    END IF;
    v_tenant_id := p_recipient_id;
  ELSIF p_recipient_type = 'party' THEN
    IF NOT is_service_mode() THEN
      SELECT tenant_id INTO v_tenant_id FROM cc_parties WHERE id = p_recipient_id;
      IF v_tenant_id IS NULL OR v_tenant_id <> current_tenant_id() THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not in current tenant';
      END IF;
    END IF;
  ELSIF p_recipient_type = 'individual' THEN
    IF NOT is_service_mode() THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals 
        WHERE individual_id = p_recipient_id AND tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not linked to current tenant';
      END IF;
      v_tenant_id := current_tenant_id();
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_RECIPIENT_TYPE: Must be tenant, party, or individual';
  END IF;

  SELECT jsonb_object_agg(entity_type, count)
  INTO v_summary
  FROM (
    SELECT ae.entity_type, COUNT(*) as count
    FROM cc_activity_events ae
    WHERE ae.occurred_at > p_since
    AND (
      (ae.visibility = 'private' AND (
        ae.actor_tenant_id = v_tenant_id 
        OR (p_recipient_type = 'party' AND ae.actor_party_id = p_recipient_id)
        OR (p_recipient_type = 'individual' AND ae.actor_individual_id = p_recipient_id)
      ))
      OR (ae.visibility = 'tenant' AND ae.tenant_id = v_tenant_id)
      OR (ae.visibility = 'portal' AND EXISTS (
        SELECT 1 FROM cc_portal_members pm
        WHERE pm.portal_id = ae.portal_id AND pm.tenant_id = v_tenant_id
      ))
      OR (ae.visibility = 'community' AND EXISTS (
        SELECT 1 FROM cc_tenants t
        JOIN cc_portal_members pm ON pm.portal_id = c.portal_id
        WHERE c.id = ae.community_id AND pm.tenant_id = v_tenant_id
      ))
      OR ae.visibility = 'public'
    )
    AND (ae.expires_at IS NULL OR ae.expires_at > now())
    GROUP BY ae.entity_type
  ) sub;

  RETURN jsonb_build_object(
    'summary', COALESCE(v_summary, '{}'),
    'since', p_since,
    'generated_at', now()
  );
END;
$$;

COMMIT;
