# Multi-Brand System Forensic Audit

**Audit Date:** January 15, 2026  
**Scope:** Existing implementation only - no proposals

---

## Executive Summary

The Community Canvas platform has **comprehensive multi-brand/portal infrastructure** already built. The system supports:

1. **Domain-based routing** via `cc_portal_domains` table and `v_portal_domain_resolution` view
2. **Portal theming** via `cc_portal_theme` and `cc_portal_settings` tables
3. **Portal context** propagated through middleware and React context
4. **Multiple portal types** (community, business_service, experience_editorial)
5. **Onboarding flows** with portal-scoped configuration

**Active brands in database:** Bamfield, Remote Serve, AdrenalineCanada, OffpeakAirBNB, EnviroPaving, and others with verified custom domains.

---

## 1) DATA MODEL

### 1.1 Portal Tables

#### `cc_portals` — Portal/Brand Entity
**Purpose:** Primary entity for brands/surfaces

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| owning_tenant_id | uuid | FK to cc_tenants |
| name | text | Display name |
| slug | text | URL identifier |
| status | enum | active/inactive |
| primary_audience | enum | public/community/tenant |
| portal_type | text | community/business_service/experience_editorial |
| tagline | text | Brand tagline |
| description | text | Full description |
| default_locale | text | Language (e.g., 'en') |
| default_currency | text | Currency (e.g., 'CAD') |
| supported_locales | text[] | Supported languages |
| default_route | text | Landing route |
| onboarding_flow_key | text | Links to onboarding |
| terms_url | text | Terms page URL |
| privacy_url | text | Privacy page URL |
| legal_dba_name | text | Legal "doing business as" |
| base_url | text | Primary URL |
| site_config | jsonb | Site configuration |
| settings | jsonb | General settings |

**Active Portals (from DB query):**
- `bamfield` - community - "Bamfield Community Portal"
- `remote-serve` - business_service - "Remote Serve"
- `adrenalinecanada` - community - "AdrenalineCanada"
- `offpeakairbnb` - community - "OffpeakAirBNB"
- `enviropaving` - business_service - "Enviropaving BC"
- `woods-end-landing` - business_service - "Woods End Landing Cottages"

---

#### `cc_portal_domains` — Custom Domain Mapping
**Purpose:** Maps custom domains to portals

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| portal_id | uuid | FK to cc_portals |
| domain | text | Domain name |
| is_primary | boolean | Primary domain flag |
| status | enum | pending/verified/active |
| verification_method | text | DNS/HTTP verification |
| verification_token | text | Token for verification |
| verified_at | timestamp | When verified |
| ssl_status | text | SSL certificate status |
| ssl_issued_at | timestamp | SSL issue date |

**Verified Domains (from DB):**
- `bamfield.communitycanvas.ca` → bamfield portal
- `remoteserve.ca` → remote-serve portal (primary)
- `remote-serve.communitycanvas.ca` → remote-serve portal (secondary)
- `enviropaving.ca` → enviropaving portal
- `woodsendlanding.com` → woods-end-landing portal
- `saveparadiseparking.com` → save-paradise-parking portal

---

#### `cc_portal_theme` — Portal Theming
**Purpose:** Design tokens per portal

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| portal_id | uuid | FK to cc_portals |
| tokens | jsonb | Design tokens (colors, fonts) |
| theme_version | integer | Version number |
| is_live | boolean | Published status |
| updated_by | uuid | Who updated |

**Token Structure (from PublicPortalLayout):**
```typescript
{
  primary_color: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  logo_url?: string;
  tagline?: string;
}
```

---

#### `cc_portal_settings` — Portal Configuration
**Purpose:** Feature flags and settings per portal

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| portal_id | uuid | FK to cc_portals |
| logo_url | text | Logo URL |
| favicon_url | text | Favicon URL |
| primary_color | text | Primary color |
| secondary_color | text | Secondary color |
| custom_css | text | Custom CSS overrides |
| auto_approve_jobs | boolean | Auto-approve flag |
| jobs_enabled | boolean | Jobs feature |
| listings_enabled | boolean | Listings feature |
| events_enabled | boolean | Events feature |
| messaging_enabled | boolean | Messaging feature |
| reviews_enabled | boolean | Reviews feature |
| meta_title | text | SEO title |
| meta_description | text | SEO description |
| og_image_url | text | Open Graph image |
| support_email | text | Support email |
| terms_url | text | Terms URL |
| privacy_url | text | Privacy URL |

---

#### `cc_portal_copy` — Localized Copy
**Purpose:** Portal-specific text strings

| Column | Type | Purpose |
|--------|------|---------|
| portal_id | uuid | FK to cc_portals |
| namespace | text | Copy namespace |
| key | text | String key |
| locale | text | Language code |
| value | text | Localized value |
| metadata | jsonb | Extra metadata |

---

#### `cc_portal_feature_flags` — Feature Toggles
**Purpose:** Per-portal feature flags

| Column | Type | Purpose |
|--------|------|---------|
| portal_id | uuid | FK to cc_portals |
| flag_key | text | Flag identifier |
| is_enabled | boolean | Enabled status |
| config | jsonb | Flag configuration |

---

### 1.2 Onboarding Tables

#### `cc_onboarding_flows` — Flow Templates
**Purpose:** Onboarding workflow definitions

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| code | text | Unique code |
| name | text | Display name |
| description | text | Description |
| flow_type | enum | generic/individual/tenant/operator |
| actor_type_id | uuid | FK to cc_actor_types |
| steps | jsonb | Flow steps definition |
| estimated_minutes | integer | Time estimate |
| allow_skip | boolean | Skippable flag |
| is_active | boolean | Active status |

**Linking:** Portal's `onboarding_flow_key` column links to flow's `code`.

---

#### `cc_onboarding_sessions` — Active Sessions
**Purpose:** Tracks user progress in onboarding

#### `cc_onboarding_step_progress` — Step Completion
**Purpose:** Per-step completion tracking

#### `cc_onboarding_checklist_items` — Checklist Items
**Purpose:** Checklist items within steps

---

### 1.3 View: `v_portal_domain_resolution`

**Purpose:** Efficiently resolves domain → portal

| Column | Type | Purpose |
|--------|------|---------|
| domain | text | Domain name |
| domain_status | enum | Domain status |
| is_primary | boolean | Primary flag |
| portal_id | uuid | Portal ID |
| portal_slug | text | Portal slug |
| portal_name | text | Portal name |
| portal_status | enum | Portal status |
| primary_audience | enum | Audience type |
| default_locale | text | Default language |
| default_currency | text | Default currency |

**File:** `server/migrations/023_portal_private_label.sql:179`

---

## 2) ROUTING / ENTRYPOINT RESOLUTION

### 2.1 Domain-Based Resolution (Priority 1)

**File:** `server/middleware/tenantContext.ts:50-98`

```typescript
// Priority 1: Domain-based portal resolution
const portalResult = await serviceQuery(`
  SELECT d.portal_id, p.owning_tenant_id, p.slug, p.name, p.legal_dba_name, p.portal_type
  FROM cc_portal_domains d 
  JOIN cc_portals p ON p.id = d.portal_id
  WHERE d.domain = $1 
    AND d.status IN ('verified', 'active') 
    AND p.status = 'active'
  LIMIT 1
`, [domain]);

if (portalResult.rows.length > 0) {
  req.ctx.portal_id = row.portal_id;
  req.ctx.tenant_id = row.owning_tenant_id;
  req.ctx.portal_slug = row.slug;
  req.ctx.portal_name = row.name;
  req.ctx.portal_legal_dba_name = row.legal_dba_name;
  req.ctx.portal_type = row.portal_type;
}
```

### 2.2 Path-Based Resolution (Priority 2 - Dev Fallback)

**File:** `server/middleware/tenantContext.ts:99-124`

```typescript
// Priority 2: /b/:slug path prefix for dev
const pathMatch = req.path.match(/^\/b\/([^\/]+)/);
if (pathMatch) {
  const slug = pathMatch[1];
  const slugResult = await serviceQuery(`
    SELECT id as portal_id, owning_tenant_id, slug, name, legal_dba_name, portal_type
    FROM cc_portals 
    WHERE slug = $1 AND status = 'active'
    LIMIT 1
  `, [slug]);
  // ... sets context from slug
}
```

### 2.3 Route Patterns

**File:** `client/src/App.tsx`

| Pattern | Layout | Purpose |
|---------|--------|---------|
| `/c/:slug/*` | PublicPortalLayout | Community portal (no auth) |
| `/p/:portalSlug` | PortalHomePage | Business portal home |
| `/p/:portalSlug/reserve` | PortalReservePage | Portal reservation |
| `/portal/:portalSlug/p/:presentationSlug` | PresentationViewer | Presentation view |
| `/b/:slug/*` | (Dev fallback) | Path-based portal access |

### 2.4 Context Set by Resolution

**File:** `server/middleware/tenantContext.ts:14-26`

```typescript
export interface TenantContext {
  domain: string | null;
  portal_id: string | null;
  portal_slug?: string | null;
  portal_name?: string | null;
  portal_legal_dba_name?: string | null;
  portal_type?: string | null;
  tenant_id: string | null;
  individual_id: string | null;
  roles: string[];
  scopes: string[];
  is_impersonating: boolean;
}
```

---

## 3) UI SHELL / THEME APPLICATION

### 3.1 Layout Components

| Layout | File | Purpose |
|--------|------|---------|
| `PublicPortalLayout` | `client/src/layouts/PublicPortalLayout.tsx` | Community portal shell |
| `TenantAppLayout` | `client/src/layouts/TenantAppLayout.tsx` | Authenticated tenant app |
| `PlatformAdminLayout` | `client/src/layouts/PlatformAdminLayout.tsx` | Admin shell |

### 3.2 Theme Application (PublicPortalLayout)

**File:** `client/src/layouts/PublicPortalLayout.tsx:180-190`

```typescript
const theme: PortalTheme = portal.theme || { primary_color: '#3b82f6' };
const config = portal.settings || {};

const backgroundColor = theme.background_color || '#0c1829';
const textColor = theme.text_color || '#f8fafc';
const primaryColor = theme.primary_color || '#3b82f6';
const accentColor = theme.accent_color || '#f59e0b';
```

Applied to:
- Background color on root container
- Header border color
- Logo/tagline display
- Sign-in button accent color
- Footer border color

### 3.3 Navigation Tabs (Config-Driven)

**File:** `client/src/layouts/PublicPortalLayout.tsx:269-287`

```typescript
<nav>
  <TabLink to={`/c/${slug}`} end>Overview</TabLink>
  {config.show_businesses && (
    <TabLink to={`/c/${slug}/businesses`}>Businesses</TabLink>
  )}
  {config.show_service_runs && (
    <TabLink to={`/c/${slug}/services`}>Services</TabLink>
  )}
  {config.show_accommodations && (
    <TabLink to={`/c/${slug}/stay`}>Stay</TabLink>
  )}
  <TabLink to={`/c/${slug}/events`}>Events</TabLink>
  <TabLink to={`/c/${slug}/about`}>About</TabLink>
</nav>
```

### 3.4 Logo & Branding

**File:** `client/src/layouts/PublicPortalLayout.tsx:218-246`

```typescript
{theme.logo_url ? (
  <img src={theme.logo_url} alt={portal.name} style={{ height: '40px' }} />
) : (
  <span style={{ fontSize: '32px' }}>🏔️</span>
)}
<div>
  <h1>{portal.name}</h1>
  {(theme.tagline || portal.tagline) && (
    <p>{theme.tagline || portal.tagline}</p>
  )}
</div>
```

---

## 4) AUTH + CONTEXT

### 4.1 Portal Context in Request

**File:** `server/middleware/tenantContext.ts:38-48`

```typescript
export interface TenantRequest extends Request {
  ctx: TenantContext;  // Includes portal_id, portal_slug, portal_type
  impersonation?: ImpersonationSession;
  actorContext?: ActorContext;
  user?: {
    id: string;
    email: string;
    userType?: string;
    isPlatformAdmin?: boolean;
  };
}
```

### 4.2 Client-Side Portal Context

**File:** `client/src/contexts/PortalContext.tsx`

```typescript
interface PortalContextValue {
  portals: Portal[];
  currentPortal: Portal | null;
  loading: boolean;
  switchPortal: (portalId: string) => Promise<void>;
  clearPortal: () => void;
}
```

Features:
- Lists portals owned by current tenant
- Allows switching between portals
- Persists preference via `/api/me/portal-preference`

### 4.3 Portal Selector Component

**File:** `client/src/components/PortalSelector.tsx`

- Dropdown for multi-portal tenants
- Shows current portal name
- "View My Public Site" link to `/p/:slug`

### 4.4 Brand Separation Enforcement

**Constraint:** Portal context is set at middleware level and propagates to:
- Request context (`req.ctx.portal_id`)
- RLS via PostgreSQL GUC (`app.portal_id`)
- Client context via fetch from `/api/public/cc_portals/:slug`

---

## 5) PORTAL SURFACES

### 5.1 Community Portal (`/c/:slug/*`)

**Layout:** `PublicPortalLayout`

**Routes:**
| Route | Component | File |
|-------|-----------|------|
| `/c/:slug` | Overview | `CommunityPortalOverview.tsx` |
| `/c/:slug/businesses` | Businesses | `CommunityPortalBusinesses.tsx` |
| `/c/:slug/services` | Services | `CommunityPortalServices.tsx` |
| `/c/:slug/stay` | Stay | `CommunityPortalStay.tsx` |

**Brand-Specific Behavior:**
- Theme colors from `cc_portal_theme`
- Logo from theme or settings
- Tabs controlled by `settings.show_*` flags

---

### 5.2 Business Portal (`/p/:portalSlug`)

**Pages:**
| Route | Component | File |
|-------|-----------|------|
| `/p/:portalSlug` | PortalHomePage | `public/PortalHomePage.tsx` |
| `/p/:portalSlug/reserve` | PortalReservePage | `public/PortalReservePage.tsx` |
| `/p/:portalSlug/reserve/:assetId` | PortalReservePage | (with asset preselect) |

**Features:**
- Hero section with site config
- Asset listings with availability
- Direct reservation flow
- Theme colors from portal

---

### 5.3 Presentation Viewer

**Route:** `/portal/:portalSlug/p/:presentationSlug`

**File:** `client/src/pages/public/PresentationViewer.tsx`

---

### 5.4 Trip Portal

**Route:** Trip planning surface

**File:** `client/src/pages/public/TripPortalPage.tsx`

---

## 6) EMBEDS / WIDGETS

### 6.1 Dashboard Widgets

**Location:** `client/src/components/widgets/`

| Widget | File | Purpose |
|--------|------|---------|
| WeatherWidget | `WeatherWidget.tsx` | Weather display |
| WaterWidget | `WaterWidget.tsx` | Water status |
| RoadWidget | `RoadWidget.tsx` | Road conditions |
| FerryWidget | `FerryWidget.tsx` | Ferry schedule |
| HydroWidget | `HydroWidget.tsx` | Hydro status |
| AlertWidget | `AlertWidget.tsx` | Alerts display |

**Status:** ⚠️ These are internal dashboard widgets, NOT embeddable external widgets.

### 6.2 External Embeddable Widgets

| Widget Type | Status | Notes |
|-------------|--------|-------|
| Embeddable calendars | ❌ Not built | No standalone embed endpoint |
| Inquiry forms | ❌ Not built | No widget export |
| Branded iframes | ❌ Not built | No embed generation |

---

## 7) COMPLETE vs PARTIAL

### ✅ IMPLEMENTED AND USABLE

| Feature | Location | Notes |
|---------|----------|-------|
| Portal entity | `cc_portals` | Full table with all fields |
| Custom domains | `cc_portal_domains` | Verified domains in production |
| Domain resolution | `tenantContext.ts:50-98` | Priority 1 in middleware |
| Path-based fallback | `tenantContext.ts:99-124` | `/b/:slug` for dev |
| Portal theming | `cc_portal_theme` | JSONB tokens |
| Portal settings | `cc_portal_settings` | Full settings table |
| Portal copy | `cc_portal_copy` | Localized strings |
| Feature flags | `cc_portal_feature_flags` | Per-portal flags |
| Community portal layout | `PublicPortalLayout.tsx` | Theme application |
| Business portal pages | `PortalHomePage.tsx` | Hero + assets |
| Portal context (server) | `TenantContext` interface | Full propagation |
| Portal context (client) | `PortalContext.tsx` | Switch + persist |
| Portal selector | `PortalSelector.tsx` | Multi-portal dropdown |
| Onboarding flows | `cc_onboarding_flows` | Templates defined |
| Onboarding sessions | `cc_onboarding_sessions` | Progress tracking |
| Domain resolution view | `v_portal_domain_resolution` | Optimized lookup |
| Active portals | 10+ portals in DB | Verified domains active |

### ⚠️ PARTIAL

| Feature | Status | Missing |
|---------|--------|---------|
| Theme token granularity | Basic colors only | Typography, spacing, shadow tokens |
| Onboarding flow linking | Schema exists | Portal → flow connection UI |
| Portal type specialization | 3 types defined | Type-specific layouts |
| SSL management | Column exists | Auto-provisioning |
| Portal analytics | Schema gap | No cc_portal_analytics table |

### ❌ MISSING

| Feature | Notes |
|---------|-------|
| Embeddable calendar widget | No standalone embed endpoint |
| Embeddable inquiry form | No widget export |
| iFrame generator | No embed code generation |
| White-label email domain | No email domain config |
| Portal-scoped mobile app | No native app support |
| Portal admin UI | No dedicated portal management page |

---

## 8) FILE REFERENCES

### Server

| File | Purpose |
|------|---------|
| `server/middleware/tenantContext.ts` | Domain/path resolution |
| `server/routes/public-portal.ts` | Public portal API routes |
| `server/migrations/023_portal_private_label.sql` | Domain resolution view |

### Client

| File | Purpose |
|------|---------|
| `client/src/layouts/PublicPortalLayout.tsx` | Community portal shell |
| `client/src/pages/public/PortalHomePage.tsx` | Business portal home |
| `client/src/pages/public/PortalReservePage.tsx` | Reservation flow |
| `client/src/contexts/PortalContext.tsx` | Client portal context |
| `client/src/components/PortalSelector.tsx` | Portal switcher |
| `client/src/pages/portal/CommunityPortalOverview.tsx` | Community overview |

### Schema

| File | Purpose |
|------|---------|
| `shared/schema.ts:1380+` | Portal table definitions |

---

## 9) ACTIVE BRANDS SUMMARY

| Brand | Type | Primary Domain | Status |
|-------|------|----------------|--------|
| Bamfield | community | bamfield.communitycanvas.ca | ✅ Active |
| Remote Serve | business_service | remoteserve.ca | ✅ Active |
| AdrenalineCanada | community | adrenalinecanada.com | Pending |
| OffpeakAirBNB | community | offpeakairbnb.ca | Pending |
| EnviroPaving | business_service | enviropaving.ca | ✅ Active |
| Woods End Landing | business_service | woodsendlanding.com | ✅ Active |
| Enviro Bright | business_service | envirobright.ca | ✅ Active |
| Save Paradise Parking | business_service | saveparadiseparking.com | ✅ Active |
| Parts Unknown BC | experience_editorial | (none) | Active |

---

*End of Audit*
