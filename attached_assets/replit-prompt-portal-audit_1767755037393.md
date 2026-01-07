# PROMPT: AUDIT EXISTING PORTAL SYSTEM (Before Building Brands)

**STOP. DO NOT BUILD ANYTHING YET.**

We discovered there is already a Portal Configuration system in place. Before implementing the multi-brand model (Prompts E & F), we need to fully understand what exists.

## TASK: Comprehensive Portal System Audit

Provide a complete report on the existing portal infrastructure.

---

## 1. DATABASE SCHEMA

Find and document ALL portal-related tables:

```sql
-- Look for tables containing: portal, community, theme, config
-- Report full schema for each
```

Questions to answer:
- What tables exist? (portal_config? community_portals? tenant_portals?)
- What columns do they have?
- How do they relate to cc_tenants?
- Is there a tenant_type distinction (community vs business)?
- Are there separate tables for theme, SEO, homepage content?

---

## 2. PORTAL CONFIG UI

Based on the screenshot, there's a Portal Configuration page at `/admin/communities/portals`

Document:
- What tabs exist? (Theme, Homepage, Area Switcher, SEO, Preview)
- What fields are configurable per tab?
- Is this UI only for "communities" or can businesses use it?
- Where is the community/tenant selector pulling from?

---

## 3. DOMAIN RESOLUTION

How does the system currently resolve domains to portals/tenants?

Look for:
- Middleware that reads hostname/Host header
- Any `portal_domain` or `custom_domain` fields
- How does a request to `bamfield.communitycanvas.ca` know to load Bamfield's portal?
- Is there subdomain-based routing? Path-based? Custom domain?

---

## 4. TENANT TYPES

The screenshot shows "Select a community" - implying portal config is community-specific.

Document:
- What tenant types exist? (business, government, individual, community?)
- Is portal_config limited to certain tenant types?
- How would a business tenant (like Woods End Landing) configure their portal today?

---

## 5. EXISTING PORTAL ROUTES

Find all routes related to portals:

```
/admin/communities/portals (config UI - found)
/portal/* (public portal routes?)
/p/* (portal shorthand?)
/{community-slug}/* (path-based?)
```

Document what public-facing portal pages exist today.

---

## 6. RELATIONSHIP TO BRANDS

Given what exists, answer:

**Option A: Brands ARE Portal Configs**
- Could we add a `brand_slug` or `dba_name` to the existing portal_config?
- Would a business tenant just have multiple portal_configs (one per brand)?
- Does the existing system already support "one tenant, multiple portals"?

**Option B: Brands EXTEND Portal Configs**
- Do we need a separate `brands` table that references portal_config?
- Or does brands table absorb portal_config fields?

**Option C: Brands are PARALLEL to Portal Configs**
- Communities use portal_config
- Businesses use brands
- Different systems, same goal

**Which option fits the existing architecture best?**

---

## 7. CODE LOCATIONS

List the key files:
- Portal config API routes
- Portal config UI components
- Portal resolution middleware
- Theme/branding application code
- Any portal-related services

---

## OUTPUT FORMAT

```
## AUDIT RESULTS

### 1. Database Schema
[Table definitions]

### 2. Portal Config UI
[Tabs and fields]

### 3. Domain Resolution
[How it works today]

### 4. Tenant Types
[What exists]

### 5. Portal Routes
[List of routes]

### 6. Recommended Approach for Brands
[Option A/B/C with reasoning]

### 7. Key Files
[File paths]
```

---

## DO NOT

- Do not create any new tables
- Do not modify any code
- Do not add brand_id anywhere
- This is READ-ONLY reconnaissance

BEGIN AUDIT.
