# WIRE UP REAL DATA — Database & API Spec

## Overview

This spec converts three admin pages from mock data to real database-backed endpoints:

1. **Portal Config** → `cc_portal_configs` table
2. **AI Queue (Good News)** → `good_news.submissions` + related tables
3. **Flagged Content** → `cc_flagged_content` table

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   EXECUTION ORDER:                                                            ║
║   1. Create database tables (migrations)                                      ║
║   2. Create/update API endpoints                                              ║
║   3. Wire frontend to real endpoints                                          ║
║   4. Seed test data for verification                                          ║
║   5. Verify end-to-end                                                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

# PART 1: PORTAL CONFIG

## Database Table

```sql
-- Migration: Create portal config table
CREATE TABLE IF NOT EXISTS cc_portal_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Theme settings
  theme JSONB NOT NULL DEFAULT '{
    "primary_color": "#3b82f6",
    "accent_color": "#f59e0b",
    "background_color": "#0c1829",
    "logo_url": "",
    "tagline": ""
  }'::jsonb,
  
  -- Homepage sections (ordered array)
  sections JSONB NOT NULL DEFAULT '[
    {"key": "hero", "label": "Hero", "visible": true, "order": 0},
    {"key": "businesses", "label": "Businesses", "visible": true, "order": 1},
    {"key": "services", "label": "Services", "visible": true, "order": 2},
    {"key": "events", "label": "Events", "visible": true, "order": 3},
    {"key": "good_news", "label": "Good News", "visible": true, "order": 4},
    {"key": "about", "label": "About", "visible": true, "order": 5}
  ]'::jsonb,
  
  -- Area switcher (related communities)
  area_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- SEO settings
  seo JSONB NOT NULL DEFAULT '{
    "meta_title": "",
    "meta_description": "",
    "social_image_url": ""
  }'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

-- Index for fast lookups
CREATE INDEX idx_portal_configs_tenant ON cc_portal_configs(tenant_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_portal_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portal_config_updated
  BEFORE UPDATE ON cc_portal_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_portal_config_timestamp();
```

## API Endpoints

```typescript
// server/routes/admin-portal-config.ts

import { Router } from 'express';
import { db } from '../db';
import { requirePlatformAdmin } from '../middleware/auth';

const router = Router();

// GET /api/admin/communities/:id/portal-config
router.get('/:id/portal-config', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get or create config for this tenant
    let config = await db.query(`
      SELECT * FROM cc_portal_configs WHERE tenant_id = $1
    `, [id]);
    
    if (config.rows.length === 0) {
      // Create default config
      const result = await db.query(`
        INSERT INTO cc_portal_configs (tenant_id)
        VALUES ($1)
        RETURNING *
      `, [id]);
      config = result;
    }
    
    res.json({ config: config.rows[0] });
  } catch (error) {
    console.error('Error fetching portal config:', error);
    res.status(500).json({ error: 'Failed to fetch portal config' });
  }
});

// PUT /api/admin/communities/:id/portal-config
router.put('/:id/portal-config', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { theme, sections, area_groups, seo } = req.body;
    
    const result = await db.query(`
      INSERT INTO cc_portal_configs (tenant_id, theme, sections, area_groups, seo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        theme = COALESCE($2, cc_portal_configs.theme),
        sections = COALESCE($3, cc_portal_configs.sections),
        area_groups = COALESCE($4, cc_portal_configs.area_groups),
        seo = COALESCE($5, cc_portal_configs.seo),
        updated_at = NOW()
      RETURNING *
    `, [id, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(area_groups), JSON.stringify(seo)]);
    
    res.json({ success: true, config: result.rows[0] });
  } catch (error) {
    console.error('Error saving portal config:', error);
    res.status(500).json({ error: 'Failed to save portal config' });
  }
});

export default router;
```

## Frontend Updates

Update `PortalConfigPage.tsx` to use real API:

```typescript
// In PortalConfigPage.tsx - Update the query

const { data: configData, isLoading: loadingConfig } = useQuery<{ config: PortalConfig }>({
  queryKey: ['portal-config', selectedCommunityId],
  queryFn: async () => {
    const res = await fetch(`/api/admin/communities/${selectedCommunityId}/portal-config`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch config');
    const data = await res.json();
    // Transform DB format to component format
    return {
      config: {
        theme: data.config.theme,
        sections: data.config.sections,
        area_groups: data.config.area_groups,
        seo: data.config.seo,
      }
    };
  },
  enabled: !!selectedCommunityId,
});

// Update save mutation to use real API
const saveMutation = useMutation({
  mutationFn: async () => {
    const res = await fetch(`/api/admin/communities/${selectedCommunityId}/portal-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to save');
    return res.json();
  },
  onSuccess: () => {
    setSaveMessage('Changes saved successfully');
    setTimeout(() => setSaveMessage(null), 3000);
    queryClient.invalidateQueries({ queryKey: ['portal-config', selectedCommunityId] });
  },
});
```

---

# PART 2: GOOD NEWS SUBMISSIONS (AI Queue)

## Database Tables

```sql
-- Migration: Create Good News schema and tables

-- Create schema
CREATE SCHEMA IF NOT EXISTS good_news;

-- Enum for submission status
CREATE TYPE good_news.submission_status AS ENUM (
  'pending',
  'approved', 
  'declined',
  'hidden'
);

-- Enum for public attribution preference
CREATE TYPE good_news.public_attribution AS ENUM (
  'anonymous',
  'named_with_consent',
  'organization_named'
);

-- Enum for AI flag severity
CREATE TYPE good_news.flag_severity AS ENUM (
  'low',
  'medium', 
  'high'
);

-- Main submissions table
CREATE TABLE good_news.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Which community this belongs to
  community_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Who submitted (null if visitor)
  submitter_user_id UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  is_visitor BOOLEAN NOT NULL DEFAULT false,
  visitor_identifier TEXT, -- optional: email or session hash for spam prevention
  
  -- The content
  story_raw TEXT NOT NULL,
  story_public TEXT, -- edited/approved version shown publicly
  
  -- Public signature (what appears on the public note)
  signature_public TEXT DEFAULT 'A grateful neighbor',
  
  -- Attribution preference
  attribution_preference good_news.public_attribution NOT NULL DEFAULT 'anonymous',
  
  -- AI flagging
  ai_flagged BOOLEAN NOT NULL DEFAULT false,
  ai_severity good_news.flag_severity DEFAULT 'low',
  ai_reasons JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"type": "identity", "description": "Contains specific address"}]
  
  -- Moderation
  status good_news.submission_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES cc_users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT, -- internal notes from moderator
  
  -- Visibility window
  visible_from TIMESTAMPTZ,
  visible_until TIMESTAMPTZ,
  
  -- Suggested recipient (for private attribution later)
  suggested_recipient_text TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_submissions_community ON good_news.submissions(community_tenant_id);
CREATE INDEX idx_submissions_status ON good_news.submissions(status);
CREATE INDEX idx_submissions_created ON good_news.submissions(created_at DESC);
CREATE INDEX idx_submissions_ai_flagged ON good_news.submissions(ai_flagged) WHERE ai_flagged = true;

-- Private attributions (links anonymous notes to real recipients)
CREATE TABLE good_news.private_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES good_news.submissions(id) ON DELETE CASCADE,
  
  -- Recipient (either a user OR a tenant/business, not both)
  recipient_user_id UUID REFERENCES cc_users(id) ON DELETE CASCADE,
  recipient_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Who made the attribution
  attributed_by_user_id UUID REFERENCES cc_users(id),
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Exactly one recipient type
  CONSTRAINT exactly_one_recipient CHECK (
    (recipient_user_id IS NOT NULL AND recipient_tenant_id IS NULL) OR
    (recipient_user_id IS NULL AND recipient_tenant_id IS NOT NULL)
  )
);

-- Badge definitions per community
CREATE TABLE good_news.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  key TEXT NOT NULL, -- e.g., 'road_angel', 'good_neighbor'
  name TEXT NOT NULL, -- e.g., 'Road Angel'
  emoji TEXT, -- e.g., '🚗'
  description TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(community_tenant_id, key)
);

-- Badge awards (private drawer)
CREATE TABLE good_news.badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES good_news.badges(id) ON DELETE CASCADE,
  
  -- Recipient
  recipient_user_id UUID REFERENCES cc_users(id) ON DELETE CASCADE,
  recipient_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Linked submission (optional)
  submission_id UUID REFERENCES good_news.submissions(id) ON DELETE SET NULL,
  
  -- Who awarded
  awarded_by_user_id UUID REFERENCES cc_users(id),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  note TEXT, -- optional note from awarder
  
  CONSTRAINT exactly_one_badge_recipient CHECK (
    (recipient_user_id IS NOT NULL AND recipient_tenant_id IS NULL) OR
    (recipient_user_id IS NULL AND recipient_tenant_id IS NOT NULL)
  )
);

-- Auto-update timestamp trigger for submissions
CREATE TRIGGER submissions_updated
  BEFORE UPDATE ON good_news.submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## API Endpoints

```typescript
// server/routes/admin-moderation.ts - ENHANCED

import { Router } from 'express';
import { db } from '../db';
import { requirePlatformAdmin } from '../middleware/auth';

const router = Router();

// GET /api/admin/moderation/submissions
router.get('/submissions', requirePlatformAdmin, async (req, res) => {
  try {
    const { search, status = 'pending', visitor_only } = req.query;
    
    let query = `
      SELECT 
        s.*,
        t.name as community_name,
        u.email as submitter_email
      FROM good_news.submissions s
      JOIN cc_tenants t ON s.community_tenant_id = t.id
      LEFT JOIN cc_users u ON s.submitter_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status && status !== 'all') {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (visitor_only === 'true') {
      query += ` AND s.is_visitor = true`;
    }
    
    if (search) {
      query += ` AND (s.story_raw ILIKE $${paramIndex} OR s.suggested_recipient_text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY s.created_at DESC LIMIT 100`;
    
    const result = await db.query(query, params);
    
    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as waiting,
        COUNT(*) FILTER (WHERE status != 'pending' AND reviewed_at > NOW() - INTERVAL '24 hours') as reviewed_today,
        COUNT(*) FILTER (WHERE status = 'pending' AND ai_severity = 'high') as high_priority,
        COUNT(*) FILTER (WHERE status = 'pending' AND ai_severity = 'high' AND review_notes LIKE '%escalate%') as escalated
      FROM good_news.submissions
    `);
    
    res.json({
      submissions: result.rows,
      stats: statsResult.rows[0] || { waiting: 0, reviewed_today: 0, high_priority: 0, escalated: 0 }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// POST /api/admin/moderation/submissions/:id/approve
router.post('/submissions/:id/approve', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { story_public } = req.body;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE good_news.submissions
      SET 
        status = 'approved',
        story_public = COALESCE($2, story_raw),
        reviewed_by = $3,
        reviewed_at = NOW(),
        visible_from = NOW()
      WHERE id = $1
    `, [id, story_public, userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// POST /api/admin/moderation/submissions/:id/approve-hide
router.post('/submissions/:id/approve-hide', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE good_news.submissions
      SET 
        status = 'hidden',
        reviewed_by = $2,
        reviewed_at = NOW()
      WHERE id = $1
    `, [id, userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error hiding submission:', error);
    res.status(500).json({ error: 'Failed to hide' });
  }
});

// POST /api/admin/moderation/submissions/:id/decline
router.post('/submissions/:id/decline', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE good_news.submissions
      SET 
        status = 'declined',
        reviewed_by = $2,
        reviewed_at = NOW(),
        review_notes = $3
      WHERE id = $1
    `, [id, userId, reason]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error declining submission:', error);
    res.status(500).json({ error: 'Failed to decline' });
  }
});

// POST /api/admin/moderation/submissions/:id/request-edit
router.post('/submissions/:id/request-edit', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE good_news.submissions
      SET 
        status = 'pending',
        review_notes = $2,
        reviewed_by = $3
      WHERE id = $1
    `, [id, `Edit requested: ${note}`, userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error requesting edit:', error);
    res.status(500).json({ error: 'Failed to request edit' });
  }
});

// POST /api/admin/moderation/submissions/:id/escalate
router.post('/submissions/:id/escalate', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE good_news.submissions
      SET 
        ai_severity = 'high',
        review_notes = CONCAT(COALESCE(review_notes, ''), ' [ESCALATED: ', $2, ']'),
        reviewed_by = $3
      WHERE id = $1
    `, [id, reason, userId]);
    
    // TODO: Send notification to platform admins
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error escalating submission:', error);
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

export default router;
```

## Frontend Updates

Update `AIQueuePage.tsx`:

```typescript
// Update the query to use real endpoint
const { data, isLoading } = useQuery<{ 
  submissions: Submission[]; 
  stats: { waiting: number; reviewed_today: number; high_priority: number; escalated: number } 
}>({
  queryKey: ['ai-queue', search, statusFilter, showVisitorOnly],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('status', statusFilter);
    if (showVisitorOnly) params.set('visitor_only', 'true');
    const res = await fetch(`/api/admin/moderation/submissions?${params}`, { 
      credentials: 'include' 
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  },
});

const submissions = data?.submissions || [];
const stats = data?.stats || { waiting: 0, reviewed_today: 0, high_priority: 0, escalated: 0 };

// Update StatsStrip to use real stats
<StatsStrip
  isLoading={isLoading}
  stats={[
    { label: 'Waiting', value: stats.waiting, color: 'yellow' },
    { label: 'Reviewed today', value: stats.reviewed_today, color: 'green' },
    { label: 'High priority', value: stats.high_priority, color: 'red' },
    { label: 'Escalated', value: stats.escalated, color: 'purple' },
  ]}
/>
```

---

# PART 3: FLAGGED CONTENT

## Database Table

```sql
-- Migration: Create flagged content table

CREATE TYPE cc_flag_reason AS ENUM (
  'spam',
  'personal_info',
  'unkind',
  'inappropriate',
  'other'
);

CREATE TYPE cc_flag_status AS ENUM (
  'pending',
  'resolved',
  'dismissed'
);

CREATE TYPE cc_flagged_content_type AS ENUM (
  'good_news',
  'service_run',
  'business_listing',
  'profile',
  'portal_content'
);

CREATE TABLE cc_flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was flagged
  content_type cc_flagged_content_type NOT NULL,
  content_id UUID NOT NULL, -- references the actual content
  content_preview TEXT, -- cached preview for display
  
  -- Which community
  community_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Who reported
  reporter_user_id UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  reporter_email TEXT, -- for anonymous reports
  
  -- Report details
  reason cc_flag_reason NOT NULL,
  reason_text TEXT, -- optional elaboration
  
  -- Resolution
  status cc_flag_status NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES cc_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT, -- 'hidden', 'edited', 'dismissed', 'escalated'
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flagged_status ON cc_flagged_content(status);
CREATE INDEX idx_flagged_community ON cc_flagged_content(community_tenant_id);
CREATE INDEX idx_flagged_content_ref ON cc_flagged_content(content_type, content_id);
CREATE INDEX idx_flagged_created ON cc_flagged_content(created_at DESC);

-- Prevent duplicate flags on same content by same reporter
CREATE UNIQUE INDEX idx_flagged_unique_report 
  ON cc_flagged_content(content_type, content_id, reporter_user_id) 
  WHERE reporter_user_id IS NOT NULL;
```

## API Endpoints

```typescript
// Add to server/routes/admin-moderation.ts

// GET /api/admin/moderation/flagged
router.get('/flagged', requirePlatformAdmin, async (req, res) => {
  try {
    const { search, type, reason, status = 'pending' } = req.query;
    
    let query = `
      SELECT 
        f.*,
        t.name as community_name,
        u.email as reporter_email_user
      FROM cc_flagged_content f
      LEFT JOIN cc_tenants t ON f.community_tenant_id = t.id
      LEFT JOIN cc_users u ON f.reporter_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status && status !== 'all') {
      query += ` AND f.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (type && type !== 'all') {
      query += ` AND f.content_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (reason && reason !== 'all') {
      query += ` AND f.reason = $${paramIndex}`;
      params.push(reason);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (f.content_preview ILIKE $${paramIndex} OR f.reason_text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY f.created_at DESC LIMIT 100`;
    
    const result = await db.query(query, params);
    
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching flagged content:', error);
    res.status(500).json({ error: 'Failed to fetch flagged content' });
  }
});

// POST /api/admin/moderation/flagged/:id/hide
router.post('/flagged/:id/hide', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Update flag status
    await db.query(`
      UPDATE cc_flagged_content
      SET 
        status = 'resolved',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = 'hidden'
      WHERE id = $1
    `, [id, userId]);
    
    // TODO: Actually hide the referenced content
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error hiding content:', error);
    res.status(500).json({ error: 'Failed to hide' });
  }
});

// POST /api/admin/moderation/flagged/:id/edit-privacy
router.post('/flagged/:id/edit-privacy', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE cc_flagged_content
      SET 
        status = 'resolved',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = 'edited',
        resolution_notes = $3
      WHERE id = $1
    `, [id, userId, notes]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error editing content:', error);
    res.status(500).json({ error: 'Failed to edit' });
  }
});

// POST /api/admin/moderation/flagged/:id/dismiss
router.post('/flagged/:id/dismiss', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE cc_flagged_content
      SET 
        status = 'dismissed',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = 'dismissed'
      WHERE id = $1
    `, [id, userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing report:', error);
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

// POST /api/admin/moderation/flagged/:id/escalate
router.post('/flagged/:id/escalate', requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    
    await db.query(`
      UPDATE cc_flagged_content
      SET 
        resolution_notes = CONCAT(COALESCE(resolution_notes, ''), ' [ESCALATED: ', $2, ']'),
        resolved_by = $3
      WHERE id = $1
    `, [id, reason, userId]);
    
    // TODO: Send notification to safety team
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error escalating:', error);
    res.status(500).json({ error: 'Failed to escalate' });
  }
});
```

---

# PART 4: SEED TEST DATA

```sql
-- Seed test data for verification

-- Insert test Good News submissions for AI Queue
INSERT INTO good_news.submissions (
  community_tenant_id,
  is_visitor,
  story_raw,
  attribution_preference,
  ai_flagged,
  ai_severity,
  ai_reasons,
  suggested_recipient_text,
  status
) VALUES
-- Get Bamfield's tenant ID
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  true,
  'A kind stranger helped us change our tire on the road to Bamfield. Wouldn''t accept anything for their help. We were so grateful!',
  'anonymous',
  true,
  'low',
  '[{"type": "identity", "description": "Mentions specific location (road to Bamfield)"}]'::jsonb,
  'Road Angel',
  'pending'
),
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  false,
  'The fire hall checked on my mom during the power outage last Tuesday at 123 West Road. So grateful for John and the volunteer crew!',
  'anonymous',
  true,
  'medium',
  '[{"type": "identity", "description": "Contains specific address (123 West Road)"}, {"type": "identity", "description": "Names specific person (John)"}]'::jsonb,
  'Fire Hall Crew',
  'pending'
),
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  true,
  'The general store let us use their phone when ours died. Small thing but meant everything when we were lost.',
  'anonymous',
  false,
  'low',
  '[]'::jsonb,
  'General Store',
  'pending'
),
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  false,
  'Someone at the pub was saying really negative things about the new development. I think they should be more careful about spreading rumors.',
  'anonymous',
  true,
  'high',
  '[{"type": "tone", "description": "May read as negative or accusatory"}, {"type": "claim", "description": "Contains claim about another person''s behavior"}]'::jsonb,
  NULL,
  'pending'
);

-- Insert test flagged content
INSERT INTO cc_flagged_content (
  content_type,
  content_id,
  content_preview,
  community_tenant_id,
  reporter_email,
  reason,
  reason_text,
  status
) VALUES
(
  'good_news',
  (SELECT id FROM good_news.submissions LIMIT 1),
  'A kind stranger helped us change our tire...',
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  'concerned@example.com',
  'personal_info',
  'This describes a specific incident that might identify someone',
  'pending'
),
(
  'business_listing',
  gen_random_uuid(),
  'Joe''s Bait Shop - BEST PRICES GUARANTEED!!!',
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  'local@example.com',
  'spam',
  'This listing seems like spam with all caps',
  'pending'
);

-- Insert default badges for Bamfield
INSERT INTO good_news.badges (community_tenant_id, key, name, emoji, description) VALUES
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  'road_angel',
  'Road Angel',
  '🚗',
  'Helped a stranded traveler on the road'
),
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  'good_neighbor',
  'Good Neighbor',
  '🏠',
  'Went above and beyond for a neighbor'
),
(
  (SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1),
  'community_hero',
  'Community Hero',
  '🦸',
  'Made a significant positive impact on the community'
);
```

---

# PART 5: VERIFICATION CHECKLIST

After implementing:

## Portal Config
- [ ] Visit /admin/communities/portals
- [ ] Select Bamfield Community
- [ ] Change primary color and save
- [ ] Refresh page — color persists
- [ ] Check database: `SELECT * FROM cc_portal_configs`

## AI Queue (Good News)
- [ ] Visit /admin/moderation/ai-queue
- [ ] Stats strip shows real counts (4 waiting from seed data)
- [ ] Click a submission — drawer opens with AI reasoning
- [ ] Click "Approve" — submission status changes
- [ ] Refresh — approved item no longer in pending view
- [ ] Check database: `SELECT status FROM good_news.submissions`

## Flagged Content
- [ ] Visit /admin/moderation/flagged
- [ ] See 2 flagged items from seed data
- [ ] Click one — drawer opens with details
- [ ] Click "Dismiss report" — status changes
- [ ] Check database: `SELECT status FROM cc_flagged_content`

## Regression
- [ ] All previously working routes still work
- [ ] No console errors

---

# EXECUTION ORDER FOR REPLIT

```
1. Run portal config migration (cc_portal_configs table)
2. Run good news migrations (schema + 4 tables)
3. Run flagged content migration (cc_flagged_content table)
4. Update/create API routes
5. Update frontend components to use real APIs
6. Run seed data SQL
7. Verify end-to-end
8. Report results
```

**BEGIN. Report when complete with verification results.**
