# QA DEMAND: Entity Presentations - Show Your Work

You claim the Entity Presentations system is complete. **Prove it.**

I cannot QA what I cannot access. This is a recurring problem - features get "built" but never appear in navigation or have any way to test them.

---

## REQUIRED: Add Navigation Links

### Platform Admin Navigation
Add to the left sidebar under an appropriate section:

```
DATA MANAGEMENT
├── Infrastructure
├── Chambers
├── NAICS
├── Accommodations
├── Inventory (Audit)
├── Import/Export
├── **Presentations** ← ADD THIS (links to /admin/presentations)
```

Or under a new section:

```
EDITORIAL
├── Presentations
├── Voice Profiles
```

### Tenant App Navigation (when impersonating a business with portals)
If the tenant owns portals, show:

```
├── Settings
├── **Portal Content** ← ADD THIS (links to /app/portal-content or similar)
```

---

## REQUIRED: Provide Clickable URLs

Give me the exact URLs I can visit RIGHT NOW to test:

### Public URLs (no auth required)
```
1. List presentations for Parts Unknown BC:
   GET /public/portals/parts-unknown-bc/presentations
   URL: _______________

2. View "Last Light in Bamfield" presentation:
   GET /public/portals/parts-unknown-bc/presentations/last-light-in-bamfield
   URL: _______________

3. View "48 Hours in Bamfield" guide:
   GET /public/portals/parts-unknown-bc/presentations/48-hours-bamfield-offpeak
   URL: _______________
```

### Admin URLs (requires platform admin)
```
4. Manage presentations for a portal:
   URL: _______________

5. Create new presentation:
   URL: _______________

6. View AI runs / audit log:
   URL: _______________
```

### Rendered Page URLs
```
7. Public presentation page (rendered with blocks):
   /portal/parts-unknown-bc/p/last-light-in-bamfield
   URL: _______________
```

---

## REQUIRED: SQL Evidence

Run these queries and show me the output:

```sql
-- 1. Show Parts Unknown BC portal exists
SELECT id, slug, name, status, settings->>'portal_type' as portal_type 
FROM portals WHERE slug = 'parts-unknown-bc';

-- 2. Show presentations exist
SELECT id, slug, title, presentation_type, status, visibility
FROM entity_presentations 
WHERE portal_id = (SELECT id FROM portals WHERE slug = 'parts-unknown-bc');

-- 3. Show blocks exist for each presentation
SELECT 
  ep.slug as presentation,
  COUNT(pb.id) as block_count,
  array_agg(pb.block_type ORDER BY pb.block_order) as block_types
FROM entity_presentations ep
LEFT JOIN presentation_blocks pb ON pb.presentation_id = ep.id
WHERE ep.portal_id = (SELECT id FROM portals WHERE slug = 'parts-unknown-bc')
GROUP BY ep.slug;

-- 4. Show voice profiles exist
SELECT id, name, portal_id FROM voice_profiles LIMIT 5;

-- 5. Show version records exist
SELECT 
  ep.slug,
  pv.version_num,
  pv.author_type,
  pv.created_at
FROM presentation_versions pv
JOIN entity_presentations ep ON ep.id = pv.presentation_id
ORDER BY pv.created_at DESC LIMIT 5;

-- 6. Show the new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'entity_presentations',
  'presentation_blocks', 
  'presentation_versions',
  'presentation_sources',
  'voice_profiles',
  'presentation_entity_links',
  'ai_runs'
);
```

---

## REQUIRED: Screenshot Evidence

Provide screenshots of:

1. **The new navigation link** in Platform Admin sidebar
2. **The presentations list page** (even if empty/minimal)
3. **A rendered presentation page** showing blocks (hero, story, facts, etc.)
4. **The API response** from `/public/portals/parts-unknown-bc/presentations`

---

## REQUIRED: curl Examples That Work

Give me curl commands I can run right now:

```bash
# List presentations
curl -s https://[YOUR-REPLIT-URL]/public/portals/parts-unknown-bc/presentations | head -50

# Get single presentation with blocks
curl -s https://[YOUR-REPLIT-URL]/public/portals/parts-unknown-bc/presentations/last-light-in-bamfield | head -100
```

---

## The Pattern I'm Trying to Break

Every time a feature is "complete":
- ❌ No navigation link added
- ❌ No URL provided to test
- ❌ No SQL evidence shown
- ❌ No screenshot of working UI
- ❌ I have to guess how to find it

This wastes hours of my time.

**From now on, "complete" means:**
- ✅ Navigation link exists and works
- ✅ URLs are provided
- ✅ SQL queries prove data exists
- ✅ Screenshots show it works
- ✅ I can click something within 30 seconds of you saying "done"

---

## DO THIS NOW

1. Add navigation link to Platform Admin
2. Provide all URLs listed above
3. Run the SQL queries and show output
4. Take screenshots
5. Give me working curl commands

BEGIN.
