# PROMPT — UI SCHEMA.ORG TERMINOLOGY ALIGNMENT

**Context:** We renamed database tables to schema.org standards but the UI still uses old terminology. This defeats the purpose - schema.org is for SEO/AI discoverability.

---

## ISSUE 1: INFRASTRUCTURE DATABASE PAGE

**Location:** `/admin/data/infrastructure` (Infrastructure page)

**Current (WRONG):**
- Tab: "AIRPORTS" → should be "Airport"
- Tab: "FIRE" → should be "FireStation" or "Fire Station"
- Tab: "PHARMACIES" → should be "Pharmacy"
- Tab: "WEATHER STATIONS" → should be "WeatherStation" or leave as-is
- Tab: "HEALTHCARE" → should be "Hospital" or "MedicalClinic"
- Tab: "POLICE" → should be "PoliceStation"
- Tab: "SAR" → should be "EmergencyService" (or "Search and Rescue")
- Tab: "SCHOOLS" → should be "School"
- Tab: "POSTAL" → should be "PostOffice"
- etc.

**Fix:** Use the `display_name` from `ref_infrastructure_types` table, OR use proper schema.org type names.

```sql
-- Reference: What the tabs should show
SELECT code, display_name, schema_type 
FROM ref_infrastructure_types 
ORDER BY display_name;
```

**The tabs should use `display_name` values:**
- Airport (not AIRPORTS)
- Fire Station (not FIRE)
- Pharmacy (not PHARMACIES)
- Hospital (not HEALTHCARE)
- Police Station (not POLICE)
- Post Office (not POSTAL)
- School (not SCHOOLS)
- Weather Station (not WEATHER STATIONS)

**Implementation:**

1. Find the Infrastructure page component
2. Replace hardcoded tab labels with values from `ref_infrastructure_types`
3. Or at minimum, use proper singular schema.org names

```typescript
// BEFORE (hardcoded, wrong)
const tabs = [
  { key: 'airports', label: 'AIRPORTS' },
  { key: 'fire', label: 'FIRE' },
  { key: 'pharmacies', label: 'PHARMACIES' },
];

// AFTER (schema.org aligned)
const tabs = [
  { key: 'airport', label: 'Airport', schemaType: 'Airport' },
  { key: 'fire_hall', label: 'Fire Station', schemaType: 'FireStation' },
  { key: 'pharmacy', label: 'Pharmacy', schemaType: 'Pharmacy' },
];

// OR fetch from ref_infrastructure_types
const { data: infraTypes } = useQuery('infrastructure-types', () =>
  fetch('/api/admin/ref/infrastructure-types').then(r => r.json())
);
```

---

## ISSUE 2: PRESENTATIONS → ARTICLES

**Location:** 
- Nav item: "Presentations" → should be "Articles"
- Page: `/admin/data/presentations` → should be `/admin/articles`
- Page title: "Entity Presentations" → should be "Articles"
- Description: mentions "presentations" → should say "articles"

**Why this matters:** 
- The table is `articles` (schema.org Article)
- Search engines look for schema.org/Article markup
- "Presentations" is meaningless to Google/AI
- "Articles" is a recognized schema.org type

**Current (WRONG):**
```
Nav: Presentations
URL: /admin/data/presentations
Title: "Entity Presentations"
Subtitle: "Portal-owned editorial content presenting entities..."
```

**Should be:**
```
Nav: Articles
URL: /admin/articles
Title: "Articles"
Subtitle: "Portal-owned editorial content with schema.org Article markup for SEO"
```

**Implementation:**

### Step 1: Update Navigation

Find nav configuration (likely in a layout or sidebar component):

```typescript
// BEFORE
{ path: '/admin/data/presentations', label: 'Presentations', icon: ... }

// AFTER
{ path: '/admin/articles', label: 'Articles', icon: ... }
```

### Step 2: Update Route

```typescript
// BEFORE
<Route path="/admin/data/presentations" component={PresentationsPage} />

// AFTER
<Route path="/admin/articles" component={ArticlesPage} />
// Add redirect for old URL
<Redirect from="/admin/data/presentations" to="/admin/articles" />
```

### Step 3: Update Page Component

Rename file: `PresentationsPage.tsx` → `ArticlesPage.tsx`

Update content:
```typescript
// BEFORE
<h1>Entity Presentations</h1>
<p>Portal-owned editorial content presenting entities with unique voice and CTAs.</p>

// AFTER
<h1>Articles</h1>
<p>Editorial content with schema.org Article markup for search engine discovery.</p>
```

### Step 4: Update Evidence Ledger

```sql
UPDATE system_evidence 
SET route = '/admin/articles'
WHERE artifact_name = 'articles' AND artifact_type = 'nav_item';
```

### Step 5: Update Public API Documentation on Page

```
// BEFORE
Public API Endpoints
List: GET /api/public/portals/:slug/presentations
Detail: GET /api/public/portals/:slug/presentations/:presentationSlug

// AFTER  
Public API Endpoints
List: GET /api/public/portals/:slug/articles
Detail: GET /api/public/portals/:slug/articles/:articleSlug
```

**Note:** If the API routes are already using "presentations", they should also be updated to "articles" for consistency. Add redirects for backward compatibility.

---

## VERIFICATION

### SQL Check
```sql
-- Verify ref_infrastructure_types has display_name
SELECT code, display_name, schema_type 
FROM ref_infrastructure_types 
LIMIT 10;

-- Verify articles table exists (not entity_presentations)
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('articles', 'entity_presentations');

-- Check Evidence Ledger for nav items
SELECT * FROM system_evidence 
WHERE artifact_type = 'nav_item' 
AND artifact_name IN ('articles', 'presentations', 'infrastructure');
```

### UI Check
- [ ] Infrastructure tabs show schema.org names (Airport, Fire Station, Pharmacy, etc.)
- [ ] Nav shows "Articles" not "Presentations"
- [ ] URL is `/admin/articles` not `/admin/data/presentations`
- [ ] Page title is "Articles" not "Entity Presentations"
- [ ] API endpoints documentation shows `/articles/` not `/presentations/`

### Files to Update
- [ ] Infrastructure page component (tab labels)
- [ ] Navigation/sidebar configuration
- [ ] Route definitions
- [ ] Articles page component (rename + update text)
- [ ] Evidence Ledger entries
- [ ] Any API route files using "presentations" path

---

## WHY THIS MATTERS

| Old Term | schema.org Term | SEO Impact |
|----------|-----------------|------------|
| AIRPORTS | Airport | Google understands Airport |
| FIRE | FireStation | Google understands FireStation |
| Presentations | Article | Google understands Article |
| PHARMACIES | Pharmacy | Google understands Pharmacy |

**The entire point of schema.org alignment is that search engines and AI systems recognize these terms.** Using "Presentations" or "AIRPORTS" (plural, caps) breaks that recognition.

BEGIN.
