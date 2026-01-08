# PROMPT — ARTICLES SEO ENHANCEMENT (NOT A REBUILD)

**Context:** The Articles system is already well-built with blocks, versions, sources, voice profiles, and entity links. We need to ADD missing SEO elements, not rebuild.

**DO NOT tear out or rebuild the existing system. It's better than the proposed alternative.**

---

## PHASE 1: ADD MISSING COLUMNS TO ARTICLES

```sql
-- Content type for schema.org flexibility
DO $$ BEGIN
  CREATE TYPE article_content_type AS ENUM (
    'article',        -- default editorial
    'guide',          -- step-by-step guide
    'howto',          -- instructional HowTo
    'faq',            -- FAQ collection
    'list',           -- top-10, best-of lists
    'news',           -- timely news/updates
    'report',         -- reports/summaries
    'story',          -- narrative storytelling
    'profile'         -- entity profile/spotlight
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Schema.org type mapping
DO $$ BEGIN
  CREATE TYPE article_schema_type AS ENUM (
    'Article',        -- default
    'BlogPosting',    -- blog-style
    'NewsArticle',    -- timely news
    'HowTo',          -- step-by-step instructions
    'FAQPage',        -- FAQ format
    'Report',         -- reports
    'ItemList',       -- curated lists
    'Guide'           -- travel/how-to guides
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to articles table
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS content_type article_content_type DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS author_id UUID,
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

-- Update schema_type to use the new enum if it's currently text
-- (Only if needed - check current type first)
-- ALTER TABLE articles ALTER COLUMN schema_type TYPE article_schema_type USING schema_type::article_schema_type;

-- Add index for content_type filtering
CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);
CREATE INDEX IF NOT EXISTS idx_articles_schema_type ON articles(schema_type);
```

---

## PHASE 2: ADD BASE_URL TO PORTALS (if missing)

```sql
-- Portals need base_url for sitemap generation
ALTER TABLE portals 
  ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Backfill based on slug pattern
UPDATE portals 
SET base_url = 'https://' || slug || '.communitycanvas.ca'
WHERE base_url IS NULL;
```

---

## PHASE 3: CREATE JSON-LD GENERATION FUNCTION

Create file: `lib/schema-org.ts` (or equivalent location)

```typescript
// lib/schema-org.ts
// JSON-LD generation for schema.org compliance

interface ArticleForJsonLd {
  id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  meta_description?: string;
  slug: string;
  schema_type: string;
  content_type: string;
  published_at?: Date;
  updated_at?: Date;
  featured_image_url?: string;
  canonical_url?: string;
  author_name?: string;
  portal_name?: string;
  portal_base_url?: string;
  entity_links?: Array<{
    entity_kind: string;
    entity_id: string;
    entity_name?: string;
    relation: string;
  }>;
}

export function generateArticleJsonLd(article: ArticleForJsonLd): object {
  const baseUrl = article.portal_base_url || 'https://communitycanvas.ca';
  const articleUrl = article.canonical_url || `${baseUrl}/articles/${article.slug}`;
  
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': article.schema_type || 'Article',
    '@id': articleUrl,
    headline: article.title,
    description: article.meta_description || article.summary || article.subtitle || article.title,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
  };

  // Dates
  if (article.published_at) {
    jsonLd.datePublished = article.published_at.toISOString();
  }
  if (article.updated_at) {
    jsonLd.dateModified = article.updated_at.toISOString();
  }

  // Image
  if (article.featured_image_url) {
    jsonLd.image = {
      '@type': 'ImageObject',
      url: article.featured_image_url,
    };
  }

  // Author
  if (article.author_name) {
    jsonLd.author = {
      '@type': 'Person',
      name: article.author_name,
    };
  }

  // Publisher (the portal)
  jsonLd.publisher = {
    '@type': 'Organization',
    name: article.portal_name || 'Community Canvas',
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo.png`,
    },
  };

  // Entity links as "about" references
  if (article.entity_links && article.entity_links.length > 0) {
    jsonLd.about = article.entity_links
      .filter(link => link.relation === 'about' || link.relation === 'featured')
      .map(link => ({
        '@type': mapEntityKindToSchemaType(link.entity_kind),
        name: link.entity_name || link.entity_kind,
        '@id': `${baseUrl}/${link.entity_kind}/${link.entity_id}`,
      }));
    
    jsonLd.mentions = article.entity_links
      .filter(link => link.relation === 'mentions')
      .map(link => ({
        '@type': mapEntityKindToSchemaType(link.entity_kind),
        name: link.entity_name || link.entity_kind,
        '@id': `${baseUrl}/${link.entity_kind}/${link.entity_id}`,
      }));
  }

  return jsonLd;
}

// Map your entity kinds to schema.org types
function mapEntityKindToSchemaType(entityKind: string): string {
  const mapping: Record<string, string> = {
    'place': 'Place',
    'community': 'Place',
    'organization': 'Organization',
    'contractor': 'LocalBusiness',
    'dock': 'CivicStructure',
    'moorage': 'BoatTerminal',
    'parking': 'ParkingFacility',
    'asset': 'Product',
    'project': 'Project',
    'event': 'Event',
    'person': 'Person',
    'infrastructure': 'CivicStructure',
  };
  return mapping[entityKind] || 'Thing';
}

// Generate JSON-LD for infrastructure entities
export function generateInfrastructureJsonLd(entity: {
  id: string;
  name: string;
  schema_type: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  telephone?: string;
  website?: string;
  description?: string;
}): object {
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': entity.schema_type || 'CivicStructure',
    name: entity.name,
  };

  if (entity.description) jsonLd.description = entity.description;
  if (entity.telephone) jsonLd.telephone = entity.telephone;
  if (entity.website) jsonLd.url = entity.website;
  
  if (entity.latitude && entity.longitude) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: entity.latitude,
      longitude: entity.longitude,
    };
  }

  if (entity.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: entity.address,
    };
  }

  return jsonLd;
}

// Generate JSON-LD for organizations
export function generateOrganizationJsonLd(org: {
  id: string;
  name: string;
  schema_type: string;
  website?: string;
  telephone?: string;
  address?: string;
  naics_code?: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': org.schema_type || 'Organization',
    name: org.name,
    url: org.website,
    telephone: org.telephone,
    naics: org.naics_code,
  };
}
```

---

## PHASE 4: SITEMAP GENERATOR

Create file: `lib/sitemap.ts`

```typescript
// lib/sitemap.ts
// Multi-portal sitemap generation with entity support

import { db } from '@/db';
import { articles, portals, organizations, places } from '@/shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';

// Entity types configuration
const entityTypes = [
  { 
    name: 'articles', 
    table: 'articles', 
    path: '/articles',
    slugField: 'slug',
    updatedField: 'updated_at',
    statusField: 'status',
    publishedValue: 'published'
  },
  { 
    name: 'organizations', 
    table: 'organizations', 
    path: '/organizations',
    slugField: 'slug',
    updatedField: 'updated_at',
    statusField: null, // no status field
    publishedValue: null
  },
  { 
    name: 'places', 
    table: 'places', 
    path: '/places',
    slugField: 'slug',
    updatedField: 'updated_at',
    statusField: null,
    publishedValue: null
  },
];

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

// Generate XML for a single sitemap
export function generateSitemapXml(urls: SitemapEntry[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const entries = urls.map(entry => {
    let xml = '  <url>\n';
    xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
    if (entry.lastmod) xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    if (entry.changefreq) xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    if (entry.priority) xml += `    <priority>${entry.priority}</priority>\n`;
    xml += '  </url>';
    return xml;
  }).join('\n');

  return `${header}\n${entries}\n</urlset>`;
}

// Generate sitemap index (points to sub-sitemaps)
export function generateSitemapIndexXml(sitemaps: { loc: string; lastmod?: string }[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const entries = sitemaps.map(smap => {
    let xml = '  <sitemap>\n';
    xml += `    <loc>${escapeXml(smap.loc)}</loc>\n`;
    if (smap.lastmod) xml += `    <lastmod>${smap.lastmod}</lastmod>\n`;
    xml += '  </sitemap>';
    return xml;
  }).join('\n');

  return `${header}\n${entries}\n</sitemapindex>`;
}

// Fetch all portals
export async function getPortalsForSitemap() {
  return await db.select({
    id: portals.id,
    slug: portals.slug,
    base_url: portals.base_url,
    name: portals.name,
  }).from(portals)
  .where(eq(portals.status, 'active'));
}

// Fetch published articles for sitemap
export async function getArticlesForSitemap(portalId?: string) {
  let query = db.select({
    slug: articles.slug,
    updated_at: articles.updated_at,
    portal_id: articles.portal_id,
  }).from(articles)
  .where(
    and(
      eq(articles.status, 'published'),
      isNotNull(articles.published_at)
    )
  )
  .orderBy(sql`${articles.updated_at} DESC`)
  .limit(5000);

  if (portalId) {
    query = query.where(eq(articles.portal_id, portalId));
  }

  return await query;
}

// Fetch organizations for sitemap
export async function getOrganizationsForSitemap(limit = 5000) {
  return await db.select({
    id: organizations.id,
    slug: sql`COALESCE(${organizations.slug}, ${organizations.id}::text)`.as('slug'),
    updated_at: organizations.updated_at,
  }).from(organizations)
  .limit(limit);
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

---

## PHASE 5: SITEMAP API ROUTES

### Main sitemap index: `GET /api/sitemap.xml`

```typescript
// app/api/sitemap.xml/route.ts (or equivalent for your framework)

import { NextResponse } from 'next/server';
import { getPortalsForSitemap, generateSitemapIndexXml } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export async function GET() {
  const portals = await getPortalsForSitemap();
  const now = new Date().toISOString().split('T')[0];
  const baseUrl = 'https://communitycanvas.ca';

  const sitemaps = [];

  // Global sitemaps
  sitemaps.push({ loc: `${baseUrl}/sitemap-articles.xml`, lastmod: now });
  sitemaps.push({ loc: `${baseUrl}/sitemap-organizations.xml`, lastmod: now });
  sitemaps.push({ loc: `${baseUrl}/sitemap-infrastructure.xml`, lastmod: now });

  // Per-portal sitemaps
  for (const portal of portals) {
    const portalUrl = portal.base_url || `https://${portal.slug}.communitycanvas.ca`;
    sitemaps.push({ loc: `${portalUrl}/sitemap.xml`, lastmod: now });
  }

  const xml = generateSitemapIndexXml(sitemaps);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
```

### Articles sitemap: `GET /api/sitemap-articles.xml`

```typescript
import { NextResponse } from 'next/server';
import { getArticlesForSitemap, generateSitemapXml } from '@/lib/sitemap';

export async function GET() {
  const articles = await getArticlesForSitemap();
  const baseUrl = 'https://communitycanvas.ca';

  const entries = articles.map(article => ({
    loc: `${baseUrl}/articles/${article.slug}`,
    lastmod: article.updated_at?.toISOString().split('T')[0],
    changefreq: 'weekly' as const,
    priority: '0.7',
  }));

  const xml = generateSitemapXml(entries);

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

---

## PHASE 6: ROBOTS.TXT

Create/update `public/robots.txt`:

```
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://communitycanvas.ca/sitemap.xml

# Block admin areas
Disallow: /admin/
Disallow: /api/admin/
```

---

## PHASE 7: UPDATE EVIDENCE LEDGER

```sql
INSERT INTO system_evidence (artifact_type, artifact_name, description, evidence_type, tenant_id)
VALUES 
  ('column', 'articles.content_type', 'Article content type enum for schema.org flexibility', 'required', NULL),
  ('column', 'articles.meta_title', 'SEO meta title override', 'required', NULL),
  ('column', 'articles.meta_description', 'SEO meta description override', 'required', NULL),
  ('column', 'articles.canonical_url', 'Canonical URL for SEO', 'required', NULL),
  ('file', 'lib/schema-org.ts', 'JSON-LD generation functions', 'required', NULL),
  ('file', 'lib/sitemap.ts', 'Sitemap generation functions', 'required', NULL),
  ('route', '/api/sitemap.xml', 'Main sitemap index', 'required', NULL),
  ('route', '/api/sitemap-articles.xml', 'Articles sitemap', 'required', NULL)
ON CONFLICT DO NOTHING;
```

---

## VERIFICATION

```sql
-- Verify new columns on articles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND column_name IN ('content_type', 'meta_title', 'meta_description', 'canonical_url', 'featured_image_url');

-- Verify portals have base_url
SELECT slug, base_url FROM portals LIMIT 5;

-- Count articles by content_type
SELECT content_type, COUNT(*) FROM articles GROUP BY content_type;
```

### API Tests

```bash
# Test sitemap index
curl https://communitycanvas.ca/api/sitemap.xml

# Test articles sitemap
curl https://communitycanvas.ca/api/sitemap-articles.xml

# Validate with Google
# https://search.google.com/test/rich-results
```

---

## SUMMARY

| What | Action |
|------|--------|
| Existing articles system | **KEEP** - it's well designed |
| presentation_blocks | **KEEP** - better than single content field |
| presentation_versions | **KEEP** - audit trail is valuable |
| voice_profiles | **KEEP** - editorial voice is valuable |
| content_type column | **ADD** - for schema.org flexibility |
| meta_title, meta_description | **ADD** - SEO overrides |
| canonical_url | **ADD** - prevent duplicate penalties |
| JSON-LD generator | **ADD** - emit schema.org markup |
| Sitemap generator | **ADD** - get indexed |

This is **enhancement**, not rebuild. Your existing system is architecturally superior.

BEGIN.
