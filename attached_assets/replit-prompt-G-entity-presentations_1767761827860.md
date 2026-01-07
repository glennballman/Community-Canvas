# PROMPT G — Entity Presentations + AI Draft Pipeline + Parts Unknown BC (MVP)

You are working in Community Canvas (multi-tenant SaaS).

**STOP building new portal systems.** We already have a sophisticated portals system (migration 023) with portal_domains, portal_theme, portal_copy, portal_pages, etc.

We are adding a new layer:

**Entity Presentations** = contextual renderings of canonical entities, owned by a portal/editorial team, not by the entity's tenant.

This must enable:
- Same entity (e.g., a restaurant, asset, place) to be presented differently across portals (different voice, emphasis, CTAs)
- Editorial content that references tenant inventory without copying it
- An AI-first workflow: evidence pack → outline → draft blocks → validation → publish (human approval optional)

We will implement a minimal MVP that proves the model using one new portal:
**"Parts Unknown BC"** (portal_type = `experience_editorial`).

---

## NON-NEGOTIABLE RULES

- Do NOT create a new `brands` table.
- Do NOT duplicate existing portal theming/copy infrastructure (use `portal_theme`, `portal_copy`).
- Do NOT change tenant model.
- Do NOT enforce portal isolation via RLS beyond existing tenant isolation patterns.
- Entity Presentations must be portal-owned but may reference canonical entities from any tenant.
- Provide evidence: migrations, files changed, and a smoke test checklist.

---

## STEP 0 — AUDIT EXISTING STRUCTURE (MANDATORY, PRINT RESULTS)

Before changes:

### Confirm existing tables and routes:
- `portals`, `portal_domains`, `portal_theme`, `portal_copy`, `portal_feature_flags`, `portal_pages`
- public route(s) like: `/public/portals/:slug/*` and server handler files

### Identify canonical "entities" we can reference:
- Places (communities), Organizations/Businesses, Assets, Offerings/Services, Events (whatever exists)

### Identify existing "public portal page rendering" pattern:
- `PublicPortalLayout.tsx` or equivalent
- How portal slug is resolved today

### Confirm whether you already have any AI/automation/edge-function scaffold
- If none, create minimal server endpoint stubs only (no external APIs required).

**Output a short report before implementing.**

---

## STEP 1 — SCHEMA: ENTITY PRESENTATIONS (Migration 0XX)

Create the following tables (names exactly). Use `gen_random_uuid()` and `timestamptz`.

### 1A) entity_presentations

```sql
CREATE TABLE entity_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  
  -- What is being presented (polymorphic reference)
  entity_type TEXT NOT NULL,           -- 'place'|'org'|'asset'|'experience'|'event'|'collection'|'route'
  entity_id UUID NULL,                 -- nullable for pure editorial / collections
  canonical_tenant_id UUID NULL,       -- tenant owning the canonical entity (attribution only)
  
  -- Presentation identity
  slug TEXT NOT NULL,                  -- unique within portal
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft|published|archived
  visibility TEXT NOT NULL DEFAULT 'public', -- public|unlisted|private
  
  -- What this presentation is "for"
  presentation_type TEXT NOT NULL,     -- 'story'|'guide'|'listing'|'itinerary'|'signal'|'profile'
  voice_profile_id UUID NULL,          -- links to how it should sound/look
  
  -- Structured metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  seasonality JSONB NULL,              -- e.g. {best_months:[9,10,11], offpeak:true}
  cta JSONB NULL,                      -- calls-to-action config
  layout JSONB NULL,                   -- layout template selection
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (portal_id, slug)
);

CREATE INDEX idx_presentations_portal_status ON entity_presentations(portal_id, status);
CREATE INDEX idx_presentations_entity ON entity_presentations(entity_type, entity_id);
```

### 1B) presentation_blocks

Composable content blocks (pages built like Lego; AI can generate blocks safely).

```sql
CREATE TABLE presentation_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  block_order INT NOT NULL,
  block_type TEXT NOT NULL,            -- 'hero'|'story'|'gallery'|'facts'|'map'|'cta'|'availability'|'faq'|'quote'|'list'
  block_data JSONB NOT NULL,           -- schema varies per block_type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (presentation_id, block_order)
);

CREATE INDEX idx_blocks_presentation ON presentation_blocks(presentation_id, block_type);
```

### 1C) presentation_versions

Hard versioning for audit + rollback (especially for AI).

```sql
CREATE TABLE presentation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  version_num INT NOT NULL,
  change_summary TEXT NULL,
  
  -- Snapshot of rendered structure
  snapshot JSONB NOT NULL,             -- {title, subtitle, blocks:[...], tags, cta, layout, ...}
  
  -- Provenance
  author_type TEXT NOT NULL,           -- 'human'|'ai'|'system'
  author_actor_id UUID NULL,
  ai_run_id UUID NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (presentation_id, version_num)
);

CREATE INDEX idx_versions_presentation ON presentation_versions(presentation_id, created_at DESC);
```

### 1D) presentation_sources

Citations/provenance: where the facts came from.

```sql
CREATE TABLE presentation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,           -- 'tenant_entity'|'feed'|'human_interview'|'web'|'upload'|'note'
  source_ref TEXT NULL,                -- URL or feed id or doc id
  source_payload JSONB NULL,           -- extracted evidence
  reliability_score INT NOT NULL DEFAULT 50,  -- 0-100
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1E) voice_profiles

How the portal "sounds." Bridge between brand and editorial identity.

```sql
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- 'Bourdain-style reflective', 'Emergency concise'
  guidance JSONB NOT NULL,             -- tone, taboo topics, reading level, structure preferences
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (portal_id, name)
);
```

### 1F) presentation_entity_links

For bundles/itineraries/collections: one presentation can reference many entities.

```sql
CREATE TABLE presentation_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  canonical_tenant_id UUID NULL,
  role TEXT NULL,                      -- 'featured'|'nearby'|'stop'|'supplier'|'alternate'
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_entity_links_presentation ON presentation_entity_links(presentation_id);
```

### RLS

Enable RLS on these tables using the same tenant/portal patterns as other portal-owned tables.

Note: `entity_presentations` are portal-owned. Access control should follow portal access patterns (public reads for published+public, internal writes for admins).

### Grants

Follow the migration 056 "grant parity" style.

---

## STEP 2 — API: PUBLIC READ ENDPOINTS (NO NEW PORTAL SYSTEM)

Add public routes that hang off the existing portal public API patterns:

### GET /public/portals/:portalSlug/presentations

Query params:
- `status=published` (default)
- `tags=comma,list` (optional)

Return:
```json
{
  "presentations": [
    {
      "id": "...",
      "slug": "last-light-in-bamfield",
      "title": "Last Light in Bamfield",
      "subtitle": "Storm season on the edge of the world",
      "presentation_type": "story",
      "tags": ["storm-watching", "off-peak", "bamfield"],
      "seasonality": {"best_months": [10, 11, 12], "offpeak": true},
      "cta": {"primary": {"type": "book", "label": "Book a Stay"}}
    }
  ]
}
```

### GET /public/portals/:portalSlug/presentations/:presentationSlug

Return:
- Portal metadata (theme/copy already returned by existing portal resolver, reuse)
- Presentation record
- Ordered blocks
- Latest published version snapshot (if exists)

**Important:**
- Use existing portal slug resolution (do not re-implement)
- Only return presentations where `status='published'` and `visibility IN ('public', 'unlisted')` unless authenticated admin

---

## STEP 3 — API: ADMIN CRUD (MINIMAL)

Add admin routes (reusing existing admin portal config auth patterns):

```
POST   /api/admin/portals/:portalId/presentations      (create draft)
PUT    /api/admin/presentations/:id                    (update metadata)
PUT    /api/admin/presentations/:id/blocks             (replace blocks)
POST   /api/admin/presentations/:id/publish            (creates new version + sets status=published)
POST   /api/admin/presentations/:id/archive            (status=archived)
```

Keep it simple:
- `publish` creates a snapshot in `presentation_versions` with `version_num` increment
- Do not build sophisticated editor UI yet; a basic JSON editor or minimal form is fine

---

## STEP 4 — AI DRAFT PIPELINE (STUBBED, AUDITABLE)

We are not calling external AI services here unless already configured. Implement the pipeline scaffolding and store outputs. If a local/edge "AI" utility exists, use it; otherwise create stub endpoints that return deterministic mock drafts.

### 4A) ai_runs table

```sql
CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL,
  presentation_id UUID NOT NULL,
  run_type TEXT NOT NULL,              -- 'evidence_pack'|'outline'|'draft_blocks'|'validation'
  input JSONB NOT NULL,
  output JSONB NULL,
  status TEXT NOT NULL DEFAULT 'completed',  -- 'queued'|'running'|'completed'|'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4B) Endpoints

```
POST /api/admin/presentations/:id/ai/evidence-pack
```
- Collects canonical entity fields (if entity_id present) + portal voice profile + any sources
- Stores in `presentation_sources` + `ai_runs`

```
POST /api/admin/presentations/:id/ai/outline
```
- Uses evidence pack → produces proposed blocks list

```
POST /api/admin/presentations/:id/ai/draft
```
- Produces draft blocks JSON

```
POST /api/admin/presentations/:id/ai/validate
```
Runs checks:
- Required fields present
- `block_order` uniqueness
- Unsafe/forbidden claim keywords (simple rule-based)
- Fact assertions must cite a source if labeled "hard fact"
- Returns validation report

### If no AI service available:
Generate deterministic placeholder drafts:
- hero block + story block + facts block + map block + CTA block
- Mark unknown facts as `needs_confirmation: true`

---

## STEP 5 — CREATE "PARTS UNKNOWN BC" PORTAL (SEED, DEV ONLY)

### Create portal instance

```sql
INSERT INTO portals (
  name, slug, primary_audience, status, settings
) VALUES (
  'Parts Unknown BC',
  'parts-unknown-bc',
  'traveler',
  'active',
  '{"portal_type": "experience_editorial"}'::jsonb
) ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  settings = EXCLUDED.settings;
```

Note: If `portals` doesn't have a `portal_type` column, store in `settings` JSONB as shown.

### Seed voice profile

```sql
INSERT INTO voice_profiles (portal_id, name, guidance)
SELECT 
  p.id,
  'Reflective Travel Editorial',
  '{
    "tone": "curious, respectful, story-driven",
    "avoids": ["defamatory claims", "unsafe directions", "explicit content"],
    "reading_level": "general adult",
    "structure": "narrative flow with practical anchors"
  }'::jsonb
FROM portals p WHERE p.slug = 'parts-unknown-bc'
ON CONFLICT (portal_id, name) DO NOTHING;
```

### Seed 2 sample presentations

**Presentation 1: Story - "Last Light in Bamfield"**

```sql
-- Create presentation
INSERT INTO entity_presentations (
  portal_id, entity_type, entity_id, slug, title, subtitle, 
  status, visibility, presentation_type, tags, seasonality, cta
)
SELECT 
  p.id,
  'place',
  NULL,  -- Pure editorial, no specific entity
  'last-light-in-bamfield',
  'Last Light in Bamfield',
  'Storm season on the edge of the world',
  'published',
  'public',
  'story',
  ARRAY['storm-watching', 'off-peak', 'bamfield', 'winter'],
  '{"best_months": [10, 11, 12], "offpeak": true}'::jsonb,
  '{"primary": {"type": "book", "label": "Book a Storm-Watching Stay"}}'::jsonb
FROM portals p WHERE p.slug = 'parts-unknown-bc';

-- Add blocks (minimum 5)
INSERT INTO presentation_blocks (presentation_id, block_order, block_type, block_data)
SELECT ep.id, block_order, block_type, block_data::jsonb
FROM entity_presentations ep, (VALUES
  (1, 'hero', '{"headline": "Last Light in Bamfield", "subhead": "When the storms come, so do the seekers", "image_placeholder": true}'),
  (2, 'story', '{"paragraphs": ["November in Bamfield is not for everyone. The ferries run when they can. The power flickers. The rain comes sideways.", "But for those who make the journey, there is something else: the light. That particular gold that breaks through storm clouds at 4pm, turning the inlet into molten glass."]}'),
  (3, 'facts', '{"items": [{"label": "Best months", "value": "October - December"}, {"label": "Getting there", "value": "Lady Rose ferry from Port Alberni, or gravel road (4WD recommended)"}, {"label": "What to bring", "value": "Rain gear, camera, patience"}]}'),
  (4, 'map', '{"center": {"lat": 48.8333, "lng": -125.1333}, "zoom": 12, "pins": [{"label": "Bamfield", "type": "destination"}]}'),
  (5, 'cta', '{"type": "book", "label": "Find Storm-Season Stays", "description": "Off-peak rates, maximum drama"}')
) AS blocks(block_order, block_type, block_data)
WHERE ep.slug = 'last-light-in-bamfield';
```

**Presentation 2: Guide - "48 Hours in Bamfield (Off-Peak)"**

```sql
INSERT INTO entity_presentations (
  portal_id, entity_type, entity_id, slug, title, subtitle,
  status, visibility, presentation_type, tags, seasonality, cta
)
SELECT 
  p.id,
  'place',
  NULL,
  '48-hours-bamfield-offpeak',
  '48 Hours in Bamfield (Off-Peak)',
  'A practical guide to the quiet season',
  'published',
  'public',
  'guide',
  ARRAY['guide', 'off-peak', 'bamfield', 'itinerary'],
  '{"best_months": [9, 10, 11, 3, 4], "offpeak": true}'::jsonb,
  '{"primary": {"type": "plan", "label": "Start Planning"}}'::jsonb
FROM portals p WHERE p.slug = 'parts-unknown-bc';

INSERT INTO presentation_blocks (presentation_id, block_order, block_type, block_data)
SELECT ep.id, block_order, block_type, block_data::jsonb
FROM entity_presentations ep, (VALUES
  (1, 'hero', '{"headline": "48 Hours in Bamfield", "subhead": "Off-peak edition: fewer crowds, more character", "image_placeholder": true}'),
  (2, 'list', '{"title": "Day 1", "items": ["Arrive via Lady Rose (book ahead - schedule is weather-dependent)", "Check in at Woods End Landing", "Walk the boardwalk to West Bamfield", "Dinner at Flora''s (call ahead in off-season)"]}'),
  (3, 'list', '{"title": "Day 2", "items": ["Kayak the inlet (rentals at Bamfield Adventure Center)", "Pack a lunch - options are limited", "Hike the Pachena Bay trail", "Watch the sunset from Brady''s Beach"]}'),
  (4, 'facts', '{"items": [{"label": "Budget", "value": "$300-500 for 2 nights"}, {"label": "Cell service", "value": "Spotty - embrace it"}, {"label": "Pro tip", "value": "Bring cash. Not everywhere takes cards."}]}'),
  (5, 'cta', '{"type": "book", "label": "Check Availability", "description": "Off-peak means flexibility"}')
) AS blocks(block_order, block_type, block_data)
WHERE ep.slug = '48-hours-bamfield-offpeak';
```

### Create version records for published presentations

```sql
INSERT INTO presentation_versions (presentation_id, version_num, change_summary, snapshot, author_type)
SELECT 
  ep.id,
  1,
  'Initial publish',
  jsonb_build_object(
    'title', ep.title,
    'subtitle', ep.subtitle,
    'tags', ep.tags,
    'cta', ep.cta,
    'blocks', (
      SELECT jsonb_agg(jsonb_build_object('block_type', pb.block_type, 'block_data', pb.block_data) ORDER BY pb.block_order)
      FROM presentation_blocks pb WHERE pb.presentation_id = ep.id
    )
  ),
  'human'
FROM entity_presentations ep
WHERE ep.status = 'published';
```

---

## STEP 6 — CLIENT: PUBLIC RENDERING (MINIMAL)

In the existing portal client pages (`client/src/pages/portal/*`):

### Add a new route

```
/portal/:portalSlug/p/:presentationSlug
```

(Or match existing routing patterns)

### Render

1. Fetch public portal context as usual
2. Fetch presentation detail endpoint
3. Render blocks in order

### Block renderer MVP

| Block Type | Render As |
|------------|-----------|
| hero | Title + subtitle + image placeholder |
| story | Paragraphs of text |
| facts | Key/value list |
| map | Location placeholder (no maps API required) |
| cta | Button with label |
| gallery | Image URLs if present |
| list | Ordered or unordered list |
| quote | Blockquote |
| faq | Accordion or simple Q&A |

**No redesign. Use existing styles.**

---

## STEP 7 — SMOKE TEST + EVIDENCE (REQUIRED OUTPUT)

Provide:

### SQL proof

```sql
-- Show created portal
SELECT id, slug, name, settings->>'portal_type' as portal_type 
FROM portals WHERE slug = 'parts-unknown-bc';

-- Show presentations
SELECT id, slug, title, presentation_type, status 
FROM entity_presentations 
WHERE portal_id = (SELECT id FROM portals WHERE slug = 'parts-unknown-bc');

-- Show blocks for each presentation
SELECT ep.slug, pb.block_order, pb.block_type 
FROM presentation_blocks pb
JOIN entity_presentations ep ON ep.id = pb.presentation_id
ORDER BY ep.slug, pb.block_order;

-- Show version records
SELECT ep.slug, pv.version_num, pv.author_type, pv.created_at
FROM presentation_versions pv
JOIN entity_presentations ep ON ep.id = pv.presentation_id;

-- Show ai_runs (if any created)
SELECT run_type, status, created_at FROM ai_runs LIMIT 5;
```

### API proof

```bash
# List presentations
curl http://localhost:3000/public/portals/parts-unknown-bc/presentations

# Get single presentation
curl http://localhost:3000/public/portals/parts-unknown-bc/presentations/last-light-in-bamfield
```

Show JSON output shape.

### UI proof

Screenshot or description of `/portal/parts-unknown-bc/p/last-light-in-bamfield` rendering blocks.

### Files changed

List all files + migration filename(s).

BEGIN.
