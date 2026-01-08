# PROMPT — PUBLIC SITES GO LIVE (v2 with Media Integration)

**Context:** Media storage system is LIVE with R2. Now we build public-facing portal sites with real images, availability, and reservations.

**Goal:** Ship public-facing portal sites TODAY for ALL businesses. Point real domains tonight and start taking parking reservations.

**Media System Available:**
- `POST /api/media/upload` - Direct file upload with auto-optimization
- `POST /api/media/presign` - Presigned URLs for browser uploads
- `GET /api/media/entity/:type/:entityId` - Get all media for an entity
- Tables: `media`, `entity_media` (polymorphic linking)

---

## SITES TO GO LIVE (ALL OF THEM)

| Portal | Domain | Type | Features |
|--------|--------|------|----------|
| Save Paradise Parking | saveparadiseparking.com | Parking | Homepage, availability, reservation |
| Woods End Landing | woodsendlanding.com | Accommodations | Homepage, cottages, kayaks, availability |
| Bamfield Adventure Center | bamfieldadventure.com | Tours/Rentals | Homepage, services, booking |
| Enviropaving BC | enviropaving.ca | Contractor | Homepage, services, quote request |
| Enviro Bright Lights | envirobright.ca | Contractor | Homepage, services, quote request |
| Bamfield Community | bamfield.communitycanvas.ca | Community | Community portal with all feeds |

**NO LIMITATIONS. ALL SITES. TODAY.**

---

## PHASE 1: AVAILABILITY READ API

**Problem:** Availability only exists as "409 conflict on create". We need READ endpoints.

### 1A. Create GET /api/public/portals/:slug/availability

```typescript
// server/routes/public/availability.ts

import { db } from '@/db';
import { unifiedAssets, resourceScheduleEvents, portals } from '@/shared/schema';
import { eq, and, or, gte, lte, sql } from 'drizzle-orm';

interface AvailabilityQuery {
  asset_id?: string;
  asset_type?: string;  // 'parking', 'accommodation', 'equipment'
  start: string;        // ISO datetime
  end: string;          // ISO datetime
}

// GET /api/public/portals/:slug/availability
export async function getPortalAvailability(portalSlug: string, query: AvailabilityQuery) {
  // 1. Get portal and its tenant
  const portal = await db.query.portals.findFirst({
    where: eq(portals.slug, portalSlug),
  });
  
  if (!portal) {
    return { error: 'Portal not found', status: 404 };
  }
  
  const start = new Date(query.start);
  const end = new Date(query.end);
  
  // 2. Get assets for this tenant
  let assetsQuery = db.select({
    id: unifiedAssets.id,
    name: unifiedAssets.name,
    asset_type: unifiedAssets.type,
    schema_type: unifiedAssets.schema_type,
    description: unifiedAssets.description,
    metadata: unifiedAssets.metadata,
  })
  .from(unifiedAssets)
  .where(and(
    eq(unifiedAssets.tenant_id, portal.owning_tenant_id),
    eq(unifiedAssets.status, 'active')
  ));
  
  if (query.asset_type) {
    assetsQuery = assetsQuery.where(eq(unifiedAssets.type, query.asset_type));
  }
  
  if (query.asset_id) {
    assetsQuery = assetsQuery.where(eq(unifiedAssets.id, query.asset_id));
  }
  
  const assets = await assetsQuery;
  
  // 3. Get busy periods for each asset
  const results = await Promise.all(assets.map(async (asset) => {
    // Get scheduled events that overlap with requested range
    const busyPeriods = await db.select({
      id: resourceScheduleEvents.id,
      starts_at: resourceScheduleEvents.starts_at,
      ends_at: resourceScheduleEvents.ends_at,
      status: resourceScheduleEvents.status,
    })
    .from(resourceScheduleEvents)
    .where(and(
      eq(resourceScheduleEvents.asset_id, asset.id),
      or(
        // Event starts within range
        and(gte(resourceScheduleEvents.starts_at, start), lte(resourceScheduleEvents.starts_at, end)),
        // Event ends within range
        and(gte(resourceScheduleEvents.ends_at, start), lte(resourceScheduleEvents.ends_at, end)),
        // Event spans entire range
        and(lte(resourceScheduleEvents.starts_at, start), gte(resourceScheduleEvents.ends_at, end))
      )
    ));
    
    // Check if requested range is available
    const isAvailable = !busyPeriods.some(p => 
      p.starts_at <= start && p.ends_at >= end
    );
    
    // Get media for this asset
    const media = await db.query.entityMedia.findMany({
      where: and(
        eq(entityMedia.entity_type, 'asset'),
        eq(entityMedia.entity_id, asset.id)
      ),
      with: { media: true },
      orderBy: [entityMedia.sort_order],
    });
    
    const heroImage = media.find(m => m.role === 'hero')?.media;
    const galleryImages = media.filter(m => m.role === 'gallery').map(m => m.media);
    
    return {
      asset_id: asset.id,
      name: asset.name,
      asset_type: asset.asset_type,
      schema_type: asset.schema_type,
      description: asset.description,
      metadata: asset.metadata,
      busy_periods: busyPeriods.map(p => ({
        start: p.starts_at,
        end: p.ends_at,
        status: p.status
      })),
      available: isAvailable,
      media: {
        hero: heroImage ? {
          url: heroImage.public_url,
          thumbnail: heroImage.variants?.thumbnail,
          alt: heroImage.alt_text
        } : null,
        gallery: galleryImages.map(img => ({
          url: img.public_url,
          thumbnail: img.variants?.thumbnail,
          alt: img.alt_text
        }))
      }
    };
  }));
  
  return {
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name
    },
    query: { start: query.start, end: query.end },
    assets: results,
    summary: {
      total: results.length,
      available: results.filter(r => r.available).length,
      booked: results.filter(r => !r.available).length
    }
  };
}
```

### 1B. Create GET /api/public/portals/:slug/availability/calendar

For calendar widget display:

```typescript
// GET /api/public/portals/:slug/availability/calendar?asset_id=xxx&month=2026-01
export async function getAvailabilityCalendar(portalSlug: string, assetId: string, month: string) {
  const [year, monthNum] = month.split('-').map(Number);
  const startOfMonth = new Date(year, monthNum - 1, 1);
  const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Get all events for this asset in the month
  const events = await db.select()
    .from(resourceScheduleEvents)
    .where(and(
      eq(resourceScheduleEvents.asset_id, assetId),
      gte(resourceScheduleEvents.starts_at, startOfMonth),
      lte(resourceScheduleEvents.ends_at, endOfMonth)
    ));
  
  // Build day-by-day status
  const days = [];
  const daysInMonth = endOfMonth.getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStart = new Date(year, monthNum - 1, day);
    const dayEnd = new Date(year, monthNum - 1, day, 23, 59, 59);
    
    const dayEvents = events.filter(e => 
      (e.starts_at <= dayEnd && e.ends_at >= dayStart)
    );
    
    days.push({
      date: `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      status: dayEvents.length > 0 ? 'booked' : 'available',
      events_count: dayEvents.length
    });
  }
  
  return {
    asset_id: assetId,
    month,
    days
  };
}
```

---

## PHASE 2: RESERVATION CREATION API

### 2A. Create POST /api/public/portals/:slug/reservations

```typescript
// server/routes/public/reservations.ts

import { db } from '@/db';
import { unifiedBookings, resourceScheduleEvents, people, portals, unifiedAssets } from '@/shared/schema';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

interface ReservationRequest {
  asset_id: string;
  start: string;      // ISO datetime
  end: string;        // ISO datetime
  customer: {
    name: string;
    email: string;
    telephone?: string;
  };
  notes?: string;
  consents?: {
    terms: boolean;
    waiver: boolean;
  };
}

// POST /api/public/portals/:slug/reservations
export async function createPublicReservation(portalSlug: string, data: ReservationRequest) {
  // 1. Get portal
  const portal = await db.query.portals.findFirst({
    where: eq(portals.slug, portalSlug),
  });
  
  if (!portal) {
    return { error: 'Portal not found', status: 404 };
  }
  
  const tenantId = portal.owning_tenant_id;
  const start = new Date(data.start);
  const end = new Date(data.end);
  
  // 2. Verify asset belongs to this tenant
  const asset = await db.query.unifiedAssets.findFirst({
    where: and(
      eq(unifiedAssets.id, data.asset_id),
      eq(unifiedAssets.tenant_id, tenantId)
    )
  });
  
  if (!asset) {
    return { error: 'Asset not found', status: 404 };
  }
  
  // 3. Check for conflicts
  const conflicts = await db.select()
    .from(resourceScheduleEvents)
    .where(and(
      eq(resourceScheduleEvents.asset_id, data.asset_id),
      or(
        and(gte(resourceScheduleEvents.starts_at, start), lte(resourceScheduleEvents.starts_at, end)),
        and(gte(resourceScheduleEvents.ends_at, start), lte(resourceScheduleEvents.ends_at, end)),
        and(lte(resourceScheduleEvents.starts_at, start), gte(resourceScheduleEvents.ends_at, end))
      )
    ));
  
  if (conflicts.length > 0) {
    return {
      error: 'RESOURCE_TIME_CONFLICT',
      message: 'This time slot is no longer available',
      conflicts: conflicts.map(c => ({ start: c.starts_at, end: c.ends_at })),
      status: 409
    };
  }
  
  // 4. Find or create customer (person)
  let person = await db.query.people.findFirst({
    where: and(
      eq(people.email, data.customer.email),
      eq(people.tenant_id, tenantId)
    )
  });
  
  if (!person) {
    const nameParts = data.customer.name.split(' ');
    const [personRecord] = await db.insert(people).values({
      tenant_id: tenantId,
      portal_id: portal.id,
      given_name: nameParts[0],
      family_name: nameParts.slice(1).join(' ') || null,
      email: data.customer.email,
      telephone: data.customer.telephone,
      schema_type: 'Person'
    }).returning();
    person = personRecord;
  }
  
  // 5. Generate confirmation number
  const prefix = portal.slug.substring(0, 3).toUpperCase().replace(/-/g, '');
  const year = new Date().getFullYear();
  const seq = nanoid(6).toUpperCase();
  const confirmationNumber = `${prefix}-${year}-${seq}`;
  
  // 6. Create booking
  const [booking] = await db.insert(unifiedBookings).values({
    tenant_id: tenantId,
    asset_id: data.asset_id,
    booker_id: person.id,
    starts_at: start,
    ends_at: end,
    status: 'pending',
    booking_ref: confirmationNumber,
    notes: data.notes,
    metadata: {
      portal_id: portal.id,
      portal_slug: portal.slug,
      consents: data.consents,
      payment_status: 'unpaid',
      source: 'public_website'
    }
  }).returning();
  
  // 7. Create schedule event to block time
  await db.insert(resourceScheduleEvents).values({
    tenant_id: tenantId,
    asset_id: data.asset_id,
    booking_id: booking.id,
    starts_at: start,
    ends_at: end,
    status: 'confirmed',
    event_type: 'reservation',
    title: `${data.customer.name} - ${asset.name}`
  });
  
  // 8. TODO: Queue confirmation email
  // await queueEmail({ to: data.customer.email, template: 'reservation_confirmation', ... });
  
  return {
    success: true,
    reservation_id: booking.id,
    confirmation_number: confirmationNumber,
    status: 'pending',
    payment_status: 'unpaid',
    asset: {
      id: asset.id,
      name: asset.name,
      type: asset.type
    },
    dates: {
      start: data.start,
      end: data.end
    },
    customer: {
      name: data.customer.name,
      email: data.customer.email
    },
    next_steps: 'A confirmation email will be sent shortly. Payment can be completed upon arrival or via link.'
  };
}
```

---

## PHASE 3: PUBLIC SITE CONFIGURATION

### 3A. Add site_config to portals.settings

```sql
-- Update portals to have site configuration
ALTER TABLE portals ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}';

-- Create index for querying
CREATE INDEX IF NOT EXISTS idx_portals_site_config ON portals USING gin(site_config);
```

### 3B. Site Config TypeScript Interface

```typescript
interface PortalSiteConfig {
  brand_name: string;
  tagline: string;
  logo_url?: string;
  hero: {
    image_url?: string;
    media_id?: string;  // Reference to media table
    title: string;
    subtitle: string;
  };
  primary_cta: {
    label: string;
    action: 'reserve' | 'contact' | 'explore' | 'quote';
    target_url?: string;
  };
  sections: Array<{
    type: 'hero' | 'availability' | 'assets' | 'services' | 'articles' | 'map' | 'contact' | 'weather' | 'travel_info' | 'gallery';
    enabled: boolean;
    order: number;
    title?: string;
    config?: Record<string, any>;
  }>;
  theme: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    font_family?: string;
  };
  contact: {
    email?: string;
    telephone?: string;
    address?: string;
    hours?: string;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}
```

---

## PHASE 4: PUBLIC SITE ENDPOINTS

### 4A. GET /api/public/portals/:slug/site

Returns complete site configuration + initial data for rendering:

```typescript
// server/routes/public/site.ts

export async function getPortalSite(portalSlug: string) {
  const portal = await db.query.portals.findFirst({
    where: eq(portals.slug, portalSlug),
    with: {
      portalTheme: true,
      portalCopy: true,
    }
  });
  
  if (!portal || portal.status !== 'active') {
    return { error: 'Portal not found', status: 404 };
  }
  
  const siteConfig = portal.site_config || {};
  
  // Get assets for this portal's tenant
  const assets = await db.select()
    .from(unifiedAssets)
    .where(and(
      eq(unifiedAssets.tenant_id, portal.owning_tenant_id),
      eq(unifiedAssets.status, 'active')
    ))
    .limit(20);
  
  // Get media for assets
  const assetsWithMedia = await Promise.all(assets.map(async (asset) => {
    const media = await db.query.entityMedia.findMany({
      where: and(
        eq(entityMedia.entity_type, 'asset'),
        eq(entityMedia.entity_id, asset.id)
      ),
      with: { media: true },
      orderBy: [entityMedia.sort_order],
      limit: 5
    });
    
    return {
      ...asset,
      media: {
        hero: media.find(m => m.role === 'hero')?.media || null,
        gallery: media.filter(m => m.role === 'gallery').map(m => m.media)
      }
    };
  }));
  
  // Get latest articles for this portal
  const articles = await db.select()
    .from(articlesTable)
    .where(and(
      eq(articlesTable.portal_id, portal.id),
      eq(articlesTable.status, 'published')
    ))
    .orderBy(desc(articlesTable.published_at))
    .limit(3);
  
  // Generate JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': siteConfig.schema_type || 'LocalBusiness',
    'name': siteConfig.brand_name || portal.name,
    'description': siteConfig.seo?.description || siteConfig.tagline,
    'url': portal.base_url || `https://${portalSlug}.communitycanvas.ca`,
    'telephone': siteConfig.contact?.telephone,
    'email': siteConfig.contact?.email,
  };
  
  return {
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
      legal_dba_name: portal.legal_dba_name,
      base_url: portal.base_url
    },
    site: siteConfig,
    theme: portal.portalTheme?.tokens || {},
    initial_data: {
      assets: assetsWithMedia,
      articles: articles
    },
    json_ld: jsonLd
  };
}
```

### 4B. GET /api/public/portals/:slug/assets

```typescript
export async function getPortalAssets(portalSlug: string, assetType?: string) {
  const portal = await db.query.portals.findFirst({
    where: eq(portals.slug, portalSlug)
  });
  
  if (!portal) return { error: 'Portal not found', status: 404 };
  
  let query = db.select()
    .from(unifiedAssets)
    .where(and(
      eq(unifiedAssets.tenant_id, portal.owning_tenant_id),
      eq(unifiedAssets.status, 'active')
    ));
  
  if (assetType) {
    query = query.where(eq(unifiedAssets.type, assetType));
  }
  
  const assets = await query;
  
  // Add media to each asset
  const assetsWithMedia = await Promise.all(assets.map(async (asset) => {
    const media = await db.query.entityMedia.findMany({
      where: and(
        eq(entityMedia.entity_type, 'asset'),
        eq(entityMedia.entity_id, asset.id)
      ),
      with: { media: true },
      orderBy: [entityMedia.sort_order]
    });
    
    return {
      ...asset,
      media: {
        hero: media.find(m => m.role === 'hero')?.media,
        gallery: media.filter(m => m.role === 'gallery').map(m => m.media)
      }
    };
  }));
  
  return { assets: assetsWithMedia };
}
```

---

## PHASE 5: SEED ALL PORTALS

### 5A. Save Paradise Parking

```sql
-- Create or update portal
INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, site_config)
SELECT 
  t.id,
  'Save Paradise Parking',
  'save-paradise-parking',
  'business_service',
  'Save Paradise Parking',
  'active',
  '{
    "brand_name": "Save Paradise Parking",
    "tagline": "Secure parking at the gateway to Bamfield",
    "hero": {
      "title": "Park Safe. Explore More.",
      "subtitle": "Secure vehicle storage while you adventure on the water"
    },
    "primary_cta": {"label": "Reserve Your Spot", "action": "reserve"},
    "sections": [
      {"type": "hero", "enabled": true, "order": 1},
      {"type": "availability", "enabled": true, "order": 2},
      {"type": "assets", "enabled": true, "order": 3},
      {"type": "map", "enabled": true, "order": 4},
      {"type": "contact", "enabled": true, "order": 5}
    ],
    "theme": {"primary_color": "#2563eb", "secondary_color": "#1e40af", "accent_color": "#fbbf24"},
    "contact": {"email": "info@saveparadiseparking.com"},
    "seo": {"description": "Secure parking in Bamfield BC. Reserve your spot online."}
  }'::jsonb
FROM cc_tenants t WHERE t.slug = 'bamfield-operations' OR t.name ILIKE '%bamfield%'
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET site_config = EXCLUDED.site_config, status = 'active';

-- Add domain
INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
SELECT id, 'saveparadiseparking.com', true, 'verified'
FROM portals WHERE slug = 'save-paradise-parking'
ON CONFLICT (domain) DO NOTHING;

-- Seed parking spots
INSERT INTO unified_assets (tenant_id, name, type, schema_type, description, status, metadata)
SELECT 
  p.owning_tenant_id,
  'Parking Spot ' || spot_num,
  'parking',
  'ParkingFacility',
  'Secure parking spot with 24/7 access',
  'active',
  jsonb_build_object(
    'spot_number', spot_num,
    'covered', false,
    'size', 'standard',
    'daily_rate', 15.00
  )
FROM portals p, generate_series(1, 25) AS spot_num
WHERE p.slug = 'save-paradise-parking'
ON CONFLICT DO NOTHING;
```

### 5B. Woods End Landing

```sql
INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, site_config)
SELECT 
  t.id,
  'Woods End Landing Cottages',
  'woods-end-landing',
  'business_service',
  'Woods End Landing',
  'active',
  '{
    "brand_name": "Woods End Landing",
    "tagline": "Waterfront cottages in the heart of Bamfield",
    "hero": {
      "title": "Your Bamfield Basecamp",
      "subtitle": "Cozy waterfront cottages with kayaks, hot tub, and adventure at your doorstep"
    },
    "primary_cta": {"label": "Check Availability", "action": "reserve"},
    "sections": [
      {"type": "hero", "enabled": true, "order": 1},
      {"type": "assets", "enabled": true, "order": 2, "title": "Our Cottages"},
      {"type": "availability", "enabled": true, "order": 3},
      {"type": "gallery", "enabled": true, "order": 4},
      {"type": "articles", "enabled": true, "order": 5, "title": "Bamfield Stories"},
      {"type": "weather", "enabled": true, "order": 6},
      {"type": "travel_info", "enabled": true, "order": 7},
      {"type": "contact", "enabled": true, "order": 8}
    ],
    "theme": {"primary_color": "#065f46", "secondary_color": "#047857", "accent_color": "#fcd34d"},
    "contact": {
      "email": "stay@woodsendlanding.com",
      "telephone": "250-728-3383"
    },
    "seo": {"description": "Waterfront vacation cottages in Bamfield BC. Kayaks, hot tub, stunning views."}
  }'::jsonb
FROM cc_tenants t WHERE t.slug = 'bamfield-operations' OR t.name ILIKE '%bamfield%'
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET site_config = EXCLUDED.site_config, status = 'active';

INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
SELECT id, 'woodsendlanding.com', true, 'verified'
FROM portals WHERE slug = 'woods-end-landing'
ON CONFLICT (domain) DO NOTHING;

-- Seed cottages
INSERT INTO unified_assets (tenant_id, name, type, schema_type, description, status, metadata)
SELECT p.owning_tenant_id, name, 'accommodation', 'Accommodation', description, 'active', metadata
FROM portals p, (VALUES
  ('The Perch', 'Ocean-view cottage perched above the inlet. Wake up to eagles and otters.', 
   '{"sleeps": 4, "bedrooms": 2, "bathrooms": 1, "amenities": ["wifi", "kitchen", "hot_tub_access", "deck"], "nightly_rate": 225}'::jsonb),
  ('The Nest', 'Cozy waterfront suite perfect for couples. Steps from the dock.', 
   '{"sleeps": 2, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "kitchenette", "water_view"], "nightly_rate": 175}'::jsonb),
  ('The Den', 'Spacious family cabin with private dock access. Kayaks included.', 
   '{"sleeps": 6, "bedrooms": 3, "bathrooms": 2, "amenities": ["wifi", "full_kitchen", "bbq", "kayaks", "dock_access"], "nightly_rate": 325}'::jsonb)
) AS cottages(name, description, metadata)
WHERE p.slug = 'woods-end-landing'
ON CONFLICT DO NOTHING;

-- Seed kayaks
INSERT INTO unified_assets (tenant_id, name, type, schema_type, description, status, metadata)
SELECT p.owning_tenant_id, 'Single Kayak ' || num, 'equipment', 'Product', 'Single sea kayak for exploring the inlet', 'active',
  '{"type": "single", "hourly_rate": 25, "half_day_rate": 50, "daily_rate": 75}'::jsonb
FROM portals p, generate_series(1, 6) AS num
WHERE p.slug = 'woods-end-landing'
ON CONFLICT DO NOTHING;

INSERT INTO unified_assets (tenant_id, name, type, schema_type, description, status, metadata)
SELECT p.owning_tenant_id, 'Double Kayak ' || num, 'equipment', 'Product', 'Tandem kayak - paddle together', 'active',
  '{"type": "double", "hourly_rate": 35, "half_day_rate": 65, "daily_rate": 95}'::jsonb
FROM portals p, generate_series(1, 3) AS num
WHERE p.slug = 'woods-end-landing'
ON CONFLICT DO NOTHING;
```

### 5C. Bamfield Adventure Center

```sql
INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, site_config)
SELECT 
  t.id,
  'Bamfield Adventure Center',
  'bamfield-adventure',
  'business_service',
  'Bamfield Adventure Center',
  'active',
  '{
    "brand_name": "Bamfield Adventure Center",
    "tagline": "Your gateway to West Coast wilderness",
    "hero": {
      "title": "Adventure Awaits",
      "subtitle": "Kayaking, fishing charters, whale watching, and more"
    },
    "primary_cta": {"label": "Book Your Adventure", "action": "reserve"},
    "sections": [
      {"type": "hero", "enabled": true, "order": 1},
      {"type": "services", "enabled": true, "order": 2, "title": "Our Adventures"},
      {"type": "assets", "enabled": true, "order": 3, "title": "Equipment Rentals"},
      {"type": "availability", "enabled": true, "order": 4},
      {"type": "weather", "enabled": true, "order": 5},
      {"type": "articles", "enabled": true, "order": 6},
      {"type": "contact", "enabled": true, "order": 7}
    ],
    "theme": {"primary_color": "#0369a1", "secondary_color": "#0284c7", "accent_color": "#f97316"},
    "contact": {"email": "adventures@bamfieldadventure.com"},
    "seo": {"description": "Kayaking, fishing, whale watching in Bamfield BC. Book your adventure today."}
  }'::jsonb
FROM cc_tenants t WHERE t.slug = 'bamfield-operations' OR t.name ILIKE '%bamfield%'
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET site_config = EXCLUDED.site_config, status = 'active';

INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
SELECT id, 'bamfieldadventure.com', true, 'verified'
FROM portals WHERE slug = 'bamfield-adventure'
ON CONFLICT (domain) DO NOTHING;
```

### 5D. Enviropaving BC

```sql
UPDATE portals SET 
  site_config = '{
    "brand_name": "Enviropaving BC",
    "tagline": "Professional paving services for remote BC communities",
    "hero": {
      "title": "Quality Paving, Anywhere in BC",
      "subtitle": "We go where others wont. Remote communities are our specialty."
    },
    "primary_cta": {"label": "Request a Quote", "action": "quote"},
    "sections": [
      {"type": "hero", "enabled": true, "order": 1},
      {"type": "services", "enabled": true, "order": 2, "title": "Our Services"},
      {"type": "gallery", "enabled": true, "order": 3, "title": "Recent Projects"},
      {"type": "articles", "enabled": true, "order": 4},
      {"type": "contact", "enabled": true, "order": 5}
    ],
    "theme": {"primary_color": "#16a34a", "secondary_color": "#15803d", "accent_color": "#eab308"},
    "contact": {
      "email": "quotes@enviropaving.ca",
      "telephone": "604-555-PAVE"
    },
    "seo": {"description": "Commercial and residential paving services across BC. Specializing in remote communities."}
  }'::jsonb,
  status = 'active'
WHERE slug = 'enviropaving';

INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
SELECT id, 'enviropaving.ca', true, 'verified'
FROM portals WHERE slug = 'enviropaving'
ON CONFLICT (domain) DO NOTHING;
```

### 5E. Enviro Bright Lights

```sql
UPDATE portals SET 
  site_config = '{
    "brand_name": "Enviro Bright Lights",
    "tagline": "Professional Christmas light installation",
    "hero": {
      "title": "Light Up Your Holidays",
      "subtitle": "Professional Christmas light installation and outdoor lighting design"
    },
    "primary_cta": {"label": "Get a Free Quote", "action": "quote"},
    "sections": [
      {"type": "hero", "enabled": true, "order": 1},
      {"type": "services", "enabled": true, "order": 2},
      {"type": "gallery", "enabled": true, "order": 3, "title": "Our Work"},
      {"type": "contact", "enabled": true, "order": 4}
    ],
    "theme": {"primary_color": "#dc2626", "secondary_color": "#b91c1c", "accent_color": "#22c55e"},
    "contact": {"email": "lights@envirobright.ca"},
    "seo": {"description": "Professional Christmas light installation in the Lower Mainland and BC."}
  }'::jsonb,
  status = 'active'
WHERE slug = 'enviro-bright';

INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
SELECT id, 'envirobright.ca', true, 'verified'
FROM portals WHERE slug = 'enviro-bright'
ON CONFLICT (domain) DO NOTHING;
```

---

## PHASE 6: PUBLIC SITE ROUTES (React)

### 6A. Route Configuration

```typescript
// client/src/routes/public.tsx

export const publicRoutes = [
  // Portal homepage
  { path: '/p/:portalSlug', element: <PortalHomePage /> },
  
  // Reserve flow
  { path: '/p/:portalSlug/reserve', element: <PortalReservePage /> },
  { path: '/p/:portalSlug/reserve/:assetId', element: <AssetReservationPage /> },
  
  // Confirmation
  { path: '/p/:portalSlug/confirmation/:confirmationNumber', element: <ReservationConfirmationPage /> },
  
  // Content
  { path: '/p/:portalSlug/articles', element: <PortalArticlesPage /> },
  { path: '/p/:portalSlug/articles/:articleSlug', element: <PortalArticlePage /> },
  
  // Contact/Quote
  { path: '/p/:portalSlug/contact', element: <PortalContactPage /> },
  { path: '/p/:portalSlug/quote', element: <PortalQuotePage /> },
];
```

### 6B. Portal Homepage Component

```tsx
// client/src/pages/public/PortalHomePage.tsx

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

export function PortalHomePage() {
  const { portalSlug } = useParams();
  
  const { data: site, isLoading } = useQuery({
    queryKey: ['portal-site', portalSlug],
    queryFn: () => fetch(`/api/public/portals/${portalSlug}/site`).then(r => r.json())
  });
  
  if (isLoading) return <PublicLoadingScreen />;
  if (!site || site.error) return <PortalNotFound />;
  
  const { portal, site: config, theme, initial_data, json_ld } = site;
  
  return (
    <PublicLayout portal={portal} theme={theme}>
      {/* SEO */}
      <Helmet>
        <title>{config.seo?.title || config.brand_name}</title>
        <meta name="description" content={config.seo?.description || config.tagline} />
        <script type="application/ld+json">{JSON.stringify(json_ld)}</script>
      </Helmet>
      
      {/* Render sections in order */}
      {config.sections
        ?.filter(s => s.enabled)
        .sort((a, b) => a.order - b.order)
        .map(section => (
          <SectionRenderer
            key={section.type}
            section={section}
            config={config}
            assets={initial_data.assets}
            articles={initial_data.articles}
            portalSlug={portalSlug}
          />
        ))
      }
    </PublicLayout>
  );
}

function SectionRenderer({ section, config, assets, articles, portalSlug }) {
  switch (section.type) {
    case 'hero':
      return (
        <HeroSection
          title={config.hero?.title}
          subtitle={config.hero?.subtitle}
          imageUrl={config.hero?.image_url}
          cta={config.primary_cta}
          portalSlug={portalSlug}
        />
      );
    
    case 'assets':
      return (
        <AssetsSection
          title={section.title || 'Available'}
          assets={assets}
          portalSlug={portalSlug}
        />
      );
    
    case 'availability':
      return (
        <AvailabilitySection
          portalSlug={portalSlug}
          assets={assets}
        />
      );
    
    case 'articles':
      return (
        <ArticlesSection
          title={section.title || 'Latest News'}
          articles={articles}
          portalSlug={portalSlug}
        />
      );
    
    case 'contact':
      return (
        <ContactSection
          contact={config.contact}
          portalSlug={portalSlug}
        />
      );
    
    case 'gallery':
      return <GallerySection title={section.title} assets={assets} />;
    
    case 'weather':
      return <WeatherSection />;
    
    case 'travel_info':
      return <TravelInfoSection />;
    
    case 'services':
      return <ServicesSection title={section.title} />;
    
    case 'map':
      return <MapSection />;
    
    default:
      return null;
  }
}
```

---

## PHASE 7: REGISTER API ROUTES

```typescript
// server/routes/public/index.ts

import { Router } from 'express';
import { getPortalSite, getPortalAssets } from './site';
import { getPortalAvailability, getAvailabilityCalendar } from './availability';
import { createPublicReservation } from './reservations';

const router = Router();

// Site
router.get('/portals/:slug/site', async (req, res) => {
  const result = await getPortalSite(req.params.slug);
  res.status(result.status || 200).json(result);
});

router.get('/portals/:slug/assets', async (req, res) => {
  const result = await getPortalAssets(req.params.slug, req.query.type as string);
  res.status(result.status || 200).json(result);
});

// Availability
router.get('/portals/:slug/availability', async (req, res) => {
  const result = await getPortalAvailability(req.params.slug, {
    asset_id: req.query.asset_id as string,
    asset_type: req.query.asset_type as string,
    start: req.query.start as string,
    end: req.query.end as string,
  });
  res.status(result.status || 200).json(result);
});

router.get('/portals/:slug/availability/calendar', async (req, res) => {
  const result = await getAvailabilityCalendar(
    req.params.slug,
    req.query.asset_id as string,
    req.query.month as string
  );
  res.status(result.status || 200).json(result);
});

// Reservations
router.post('/portals/:slug/reservations', async (req, res) => {
  const result = await createPublicReservation(req.params.slug, req.body);
  res.status(result.status || 200).json(result);
});

export default router;

// In main server file:
// app.use('/api/public', publicRouter);
```

---

## PHASE 8: VERIFICATION

### SQL Verification

```sql
-- Verify portals with site_config
SELECT slug, name, status, 
  site_config->>'brand_name' as brand,
  site_config->'primary_cta'->>'action' as cta_action
FROM portals 
WHERE slug IN ('save-paradise-parking', 'woods-end-landing', 'bamfield-adventure', 'enviropaving', 'enviro-bright');

-- Verify portal domains
SELECT p.slug, pd.domain, pd.is_primary, pd.verification_status
FROM portal_domains pd
JOIN portals p ON p.id = pd.portal_id
ORDER BY p.slug;

-- Count assets per portal tenant
SELECT p.slug, COUNT(a.id) as asset_count, 
  array_agg(DISTINCT a.type) as asset_types
FROM portals p
JOIN unified_assets a ON a.tenant_id = p.owning_tenant_id
WHERE p.slug IN ('save-paradise-parking', 'woods-end-landing', 'bamfield-adventure')
GROUP BY p.slug;

-- Verify media system ready
SELECT COUNT(*) as media_count FROM media;
SELECT COUNT(*) as entity_links FROM entity_media;
```

### API Tests

```bash
# Test site endpoint
curl "https://your-app.replit.app/api/public/portals/save-paradise-parking/site"

# Test availability
curl "https://your-app.replit.app/api/public/portals/save-paradise-parking/availability?start=2026-01-10&end=2026-01-11"

# Test reservation (POST)
curl -X POST "https://your-app.replit.app/api/public/portals/save-paradise-parking/reservations" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "ASSET_UUID_HERE",
    "start": "2026-01-10T14:00:00Z",
    "end": "2026-01-10T22:00:00Z",
    "customer": {"name": "Test User", "email": "test@example.com"}
  }'
```

### UI Tests

- [ ] Visit /p/save-paradise-parking → Homepage loads
- [ ] Visit /p/woods-end-landing → Homepage loads
- [ ] Visit /p/enviropaving → Homepage loads
- [ ] Click "Reserve" → Goes to availability page
- [ ] Select dates → Shows available/busy status
- [ ] Complete reservation → Gets confirmation number
- [ ] Reservation appears in Operations Board

---

## SUMMARY

| Deliverable | Status |
|-------------|--------|
| Availability READ API | New endpoint |
| Availability Calendar API | New endpoint |
| Reservation POST API | New endpoint |
| Portal site_config column | Schema update |
| Public site renderer | React components |
| Save Paradise Parking | Seeded with 25 spots |
| Woods End Landing | Seeded with cottages + kayaks |
| Bamfield Adventure | Seeded |
| Enviropaving BC | Updated config |
| Enviro Bright Lights | Updated config |
| Media integration | Uses existing /api/media/* |
| Domain mapping | portal_domains seeded |

**Tonight's Goal:**
1. Point saveparadiseparking.com → app
2. Create a parking reservation via the public site
3. See it appear in the Operations Board
4. **You're taking reservations.**

**Tomorrow:** Add Stripe checkout links to payment_status: "unpaid" reservations.

BEGIN.
