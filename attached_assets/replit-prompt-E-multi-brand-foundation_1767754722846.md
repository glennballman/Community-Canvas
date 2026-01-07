# PROMPT E — Multi-Brand Tenant Model (Option A) Foundation

You are working in Community Canvas (multi-tenant SaaS).
We are implementing: **One Tenant, Multiple Brands** with Brand as a first-class execution context.

## NON-NEGOTIABLE RULES
- DO NOT create separate tenants for each brand.
- Assets remain tenant-level (shared pool). Do NOT add brand_id to unified_assets.
- Customer-facing data MUST be brand-scoped and isolated (brand_id required).
- Staff (Ellen) works in a **brand context**.
- Ops (Pavel) sees tenant-wide Operations Board; brand is informational only.
- NO NEW FEATURES beyond schema + minimal wiring to prevent breakage.
- Do not rename routes unless explicitly told below.
- Provide evidence: files changed, migration(s), and a quick smoke test checklist.

---

## STEP 0 — EVIDENCE READ
Before editing, confirm these exist and are the canonical sources:
- unified_assets (assets/resources registry)
- unified_bookings (time-based bookings; TIMESTAMPTZ)
- Work Requests and Projects already exist
- Inventory page exists at /app/inventory
- Bookings page exists at /app/bookings
- Operations Board exists at /app/operations

Report:
- Which tables currently exist for: contacts, orgs, projects, invoices (if any), quotes (if any)
- Which routes exist for quoting/invoicing (if any)
If quotes/invoices don't exist yet, that's fine—just build the foundation.

---

## STEP 1 — SCHEMA: CREATE brands (Migration 057)
Create table brands:

```sql
brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references cc_tenants(id) on delete cascade,
  slug text not null,
  display_name text not null,
  portal_domain text,
  logo_url text,
  theme_json jsonb not null default '{}'::jsonb,
  legal_dba_name text, -- e.g. "Remote Serve"
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
```

Indexes:
- (tenant_id)
- (tenant_id, slug)

RLS:
- Enable RLS
- Policy: tenant_id = current tenant context
- Admin impersonation must continue to work (use same pattern as other tables)

Grants:
- Apply the standard grants + policies pattern used in migration 056 parity hardening.

---

## STEP 2 — BRAND CONTEXT FOR STAFF
We need a sticky "brand context" for staff users (Ellen) without affecting Pavel's ops view.

Add:
`actor_profiles.brand_id` (nullable) OR `user_preferences.brand_id` (nullable)
Pick the approach that matches the codebase patterns (actor_profiles likely exists already).

Requirements:
- Staff can have a default brand context per tenant
- Brand context is used to default forms (customers/projects/quotes/invoices) but can be changed
- If no brand context exists, default to the tenant's first active brand

Add RLS as needed (tenant-level).

---

## STEP 3 — ADD brand_id TO BRAND-SCOPED TABLES (ONLY WHERE IT MATTERS)
We are NOT doing "brand everywhere." We are doing "brand where the customer experience and business rules must stay separate."

### 3A) Contacts/Customers
Identify the canonical table for people/contacts (likely crm_contacts).
Add:
- `brand_id uuid NOT NULL references brands(id)`

Backfill strategy:
- Create one default brand per tenant if none exist yet (TEMP)
- For existing rows, set brand_id to tenant's first active brand

Add index: (tenant_id, brand_id)

Update any API routes that list contacts to filter by:
- tenant_id always
- brand_id when in brand context (for staff screens)
- For ops/admin screens, allow brand_id filter optional

Important:
- Keep "global identity" ambitions out of this prompt—do not create global_contacts now.
- This is strictly within one tenant for multi-brand isolation.

### 3B) Projects
Projects table exists. Add:
- `brand_id uuid NOT NULL references brands(id)`

Backfill existing projects similarly.

Projects list screen:
- If user has a brand context: default filter to that brand
- Allow switching brand filter
- Ops board remains tenant-wide; show a small brand badge on booked blocks (if booking has brand_id)

### 3C) Work Requests
Work Requests must be brand-scoped too (intake often tied to a phone line / brand).
Add:
- `brand_id uuid NOT NULL references brands(id)`

Backfill existing records to tenant's first active brand.
In UI:
- When creating a Work Request, default brand to current brand context
- For the absolute minimum intake flow (phone + one line), brand can still default silently.

### 3D) Bookings
unified_bookings: add brand_id (nullable or required?)
Rule:
- Customer-facing bookings SHOULD have brand_id.
- Internal holds/maintenance may not.
So:
- brand_id nullable
- But when booking is created via customer-facing flows (/app/bookings), require brand_id.

Add:
- `brand_id uuid references brands(id)`

Index:
- (tenant_id, brand_id, starts_at)
- (tenant_id, asset_id, starts_at)

Operations Board:
- Continue to show all bookings tenant-wide
- Display brand badge if brand_id not null

---

## STEP 4 — BRAND-SCOPED COMMERCIAL DATA (FOUNDATION ONLY)
We are laying groundwork for later: different pricing/materials/catalogs per brand.
Do NOT build the whole quoting system now—just create the tables with RLS and basic CRUD endpoints if needed.

Create tables (only if they do not already exist):
- brand_products (services/products offered)
- brand_materials
- brand_pricing_rules
- brand_line_item_templates

All MUST include:
- tenant_id
- brand_id (NOT NULL)
- name/description/unit fields
- jsonb config where needed

RLS: tenant_id isolation; brand_id filter is app-level, not RLS-level (RLS remains tenant-only).
(We are not doing cross-brand hiding via RLS because staff within the tenant may need to switch brands; isolation is enforced by app filters + brand context.)

---

## STEP 5 — SEED: 1252093 BC LTD + Brands + Users + Assets (dev only)
Seed data (idempotent):

### Tenant:
- "1252093 BC LTD" (if already exists, reuse)

### Brands (create if missing):
1) `enviropaving` — display: "Enviropaving BC" — legal_dba_name "Enviropaving BC" — portal enviropaving.ca
2) `remote-serve` — display: "Remote Serve" — legal_dba_name "Remote Serve" — portal remoteserve.ca
3) `enviro-bright` — display: "Enviro Bright Lights" — legal_dba_name "Enviro Bright Lights" — portal envirobright.ca

### Users:
- Ellen White (admin) with default brand context = remote-serve (or first brand if Ellen not found)
- Pavel (crew) no required brand context

### Assets:
Do NOT duplicate assets per brand. Ensure they are unified_assets rows owned by tenant.
Insert (if missing):
- 2015 Ford F350 Silver (gas, longbox, roof rack, 4WD, seats 6, bumper hitch)
- 2015 Ford F350 Grey (gas, longbox, 4WD, seats 6, bumper hitch)
- 2012 Ford F350 White (diesel, shortbox, 5th wheel hitch, bumper hitch, 4WD, seats 6)
- 2006 Isuzu 3500 Cube Van (diesel, hydraulic lift 2000 lbs, Crown mortar mixer, 6000 lbs cargo)
- Green Forklift (propane, outdoor rated)
- Pallet Jack
- 24ft Royal Cargo cube trailer
- 18ft Cargo Trailer
- 22ft Flatbed tandem axle trailer (10,000 lbs capacity)

Also ensure F550 + Lucky Lander (if present from other tenants) remain as their respective tenant assets.

---

## STEP 6 — UI MINIMUM WIRING (NO NEW PAGES)
We are not building full brand management UI yet.
But we MUST prevent confusion and allow testing.

Add:
- Brand selector control in the header for staff users (Ellen) (minimal dropdown)
- It sets brand context (saved) and affects:
  - Work Requests list/create
  - Projects list/create
  - Contacts list/create
  - Bookings create flow (must attach brand_id)

Ops Board:
- no filtering by brand; show badge only

If header brand selector is too risky, implement it as:
- a simple "Brand" dropdown at the top of those pages instead

---

## STEP 7 — ACCEPTANCE TESTS (PRINT EVIDENCE)
Provide:

### 1) SQL evidence:
- show brands rows created
- show brand_id non-null counts for contacts/projects/work_requests
- show unified_bookings brand_id nullable but set for customer bookings

### 2) UI evidence:
- Ellen can switch brand and create a Work Request that is scoped to that brand
- Projects list shows only that brand by default (switchable)
- Bookings creation attaches brand_id and shows correct labels (check-in/out, pickup/return, arrive/depart)
- Ops board still shows all bookings, with brand badge

### 3) Code evidence:
- List files changed
- Migration filename(s)
- Any seed script(s) added

BEGIN.

---

## CRITICAL REMINDERS

1. **Do NOT enforce brand isolation with RLS.**
   RLS stays tenant-only. Brand isolation is app-level filtering + brand context. Otherwise Ellen will get random "permission denied" the moment she switches brand.

2. **Assets remain tenant-level forever.**
   No brand_id on unified_assets. If you add it "for convenience," it will break scheduling truth.
