# PROMPT F2 (REVISED) — Domain/Slug Portal Resolution + Guardrails

**This prompt builds on E2. We're using the existing `portals` system with `portal_domains` and `v_portal_domain_resolution`.**

You are working in Community Canvas (multi-tenant SaaS).
We have extended `portals` with `portal_type` and `legal_dba_name` (Prompt E2). Now we must make customer-facing portal isolation **airtight**.

## THE REQUIREMENT

- Customer on `remoteserve.ca` → ONLY sees Remote Serve portal data
- Customer on `enviropaving.ca` → ONLY sees Enviropaving portal data  
- Customer on `envirobright.ca` → ONLY sees Enviro Bright portal data
- Assets remain tenant-wide, but customer flows must be **portal-scoped**
- Must NOT break existing tenancy/auth/impersonation

## NON-NEGOTIABLE RULES
- DO NOT add portal_id to unified_assets (assets stay tenant-level)
- DO NOT enforce portal isolation via RLS (RLS remains tenant-only)
- DO enforce portal isolation via server-side portal resolution + forced query filters
- DO NOT trust client-supplied portal_id in customer flows (derive from request)
- DO NOT invent new public CRUD endpoints unless they already exist
- USE existing `v_portal_domain_resolution` view where possible
- Provide evidence: files changed + smoke test checklist + sample outputs

---

## STEP 0 — EVIDENCE READ (Confirm Portal Infrastructure)

Before editing, verify the existing portal domain system:

```sql
-- Check portal_domains table and its constraints
\d portal_domains

-- What's the unique constraint on portal_domains?
SELECT constraint_name, column_name 
FROM information_schema.key_column_usage 
WHERE table_name = 'portal_domains';

-- Check resolution view
\d v_portal_domain_resolution
SELECT * FROM v_portal_domain_resolution LIMIT 5;

-- Check portal_theme table (theme lives here, not on portals)
\d portal_theme
SELECT portal_id, tokens FROM portal_theme LIMIT 3;
```

Find existing code:
```bash
# Search for existing tenant resolution
grep -r "tenant.*context\|tenantContext\|currentTenant" server/
grep -r "hostname\|host\|X-Forwarded-Host" server/

# Search for existing public portal routes
grep -r "/public/portal\|/portal/" server/routes/
```

Report:
- Current tenant resolution mechanism
- Whether public portal routes exist
- How portal_domains is structured
- What v_portal_domain_resolution returns

---

## STEP 1 — Add Portal Domains for Business Portals

Seed portal_domains for the 1252093 BC LTD portals.

**First, confirm the unique constraint:**
```sql
-- Likely unique on (domain) or (portal_id, domain)
-- Adjust ON CONFLICT accordingly
```

```sql
DO $$
DECLARE
  v_portal_id UUID;
BEGIN
  -- Enviropaving domains
  SELECT id INTO v_portal_id FROM portals WHERE slug = 'enviropaving';
  IF v_portal_id IS NOT NULL THEN
    INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
    VALUES 
      (v_portal_id, 'enviropaving.ca', true, 'verified'),
      (v_portal_id, 'enviropaving.communitycanvas.ca', false, 'verified')
    ON CONFLICT (domain) DO NOTHING;  -- Adjust constraint name if different
  END IF;
  
  -- Remote Serve domains
  SELECT id INTO v_portal_id FROM portals WHERE slug = 'remote-serve';
  IF v_portal_id IS NOT NULL THEN
    INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
    VALUES 
      (v_portal_id, 'remoteserve.ca', true, 'verified'),
      (v_portal_id, 'remote-serve.communitycanvas.ca', false, 'verified')
    ON CONFLICT (domain) DO NOTHING;
  END IF;
  
  -- Enviro Bright domains
  SELECT id INTO v_portal_id FROM portals WHERE slug = 'enviro-bright';
  IF v_portal_id IS NOT NULL THEN
    INSERT INTO portal_domains (portal_id, domain, is_primary, verification_status)
    VALUES 
      (v_portal_id, 'envirobright.ca', true, 'verified'),
      (v_portal_id, 'enviro-bright.communitycanvas.ca', false, 'verified')
    ON CONFLICT (domain) DO NOTHING;
  END IF;
END $$;
```

**Note:** In dev, mark as `verified`. In production, use existing DNS verification workflow.

---

## STEP 2 — Canonical Portal Resolution Function

Create ONE canonical function to resolve portal from request.

**Location:** `server/services/portalResolution.ts` (or equivalent location matching codebase patterns)

**IMPORTANT:** Use existing `v_portal_domain_resolution` view if it provides what we need.

```typescript
import { db } from '../db'; // Use your actual db import

export interface ResolvedPortalContext {
  tenant_id: string;
  portal_id: string;
  portal_slug: string;
  display_name: string;
  portal_domain?: string;
  legal_dba_name?: string;
  portal_type?: string;
  // Theme comes from portal_theme table, not portals
}

export async function resolvePortalFromRequest(req: Request): Promise<ResolvedPortalContext | null> {
  // Get hostname (handle proxies)
  const hostname = (
    req.headers['x-forwarded-host'] || 
    req.headers['host'] || 
    ''
  ).toString().toLowerCase().split(':')[0]; // Strip port
  
  // Priority 1: Domain match via existing resolution view
  if (hostname && hostname !== 'localhost') {
    const result = await db.query(`
      SELECT 
        p.id as portal_id,
        p.owning_tenant_id as tenant_id,
        p.slug as portal_slug,
        p.name as display_name,
        p.legal_dba_name,
        p.portal_type,
        pd.domain as portal_domain
      FROM portal_domains pd
      JOIN portals p ON p.id = pd.portal_id
      WHERE LOWER(pd.domain) = $1
        AND pd.verification_status = 'verified'
        AND p.status = 'active'
      LIMIT 1
    `, [hostname]);
    
    if (result.rows[0]) {
      return result.rows[0];
    }
  }
  
  // Priority 2: Path prefix fallback for dev: /b/:portalSlug/*
  const pathMatch = req.path.match(/^\/b\/([^\/]+)/);
  if (pathMatch) {
    const slug = pathMatch[1];
    const result = await db.query(`
      SELECT 
        id as portal_id,
        owning_tenant_id as tenant_id,
        slug as portal_slug,
        name as display_name,
        legal_dba_name,
        portal_type
      FROM portals 
      WHERE slug = $1 AND status = 'active'
      LIMIT 1
    `, [slug]);
    
    if (result.rows[0]) {
      return result.rows[0];
    }
  }
  
  // Priority 3: Existing /public/portals/:slug routes (handled elsewhere)
  
  // No match
  return null;
}

// Per-request memoization
const portalCache = new WeakMap<Request, ResolvedPortalContext | null>();

export async function getPortalContext(req: Request): Promise<ResolvedPortalContext | null> {
  if (portalCache.has(req)) {
    return portalCache.get(req)!;
  }
  const context = await resolvePortalFromRequest(req);
  portalCache.set(req, context);
  return context;
}
```

---

## STEP 3 — Attach Portal Context to Request (Middleware)

**CRITICAL: Middleware ordering matters.**

For PUBLIC flows, portal resolution should happen BEFORE or ALONGSIDE tenant resolution, because tenant is derived from portal (via `owning_tenant_id`).

```typescript
// server/middleware/portalContext.ts

import { getPortalContext, ResolvedPortalContext } from '../services/portalResolution';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      portalContext?: ResolvedPortalContext | null;
    }
  }
}

export async function portalContextMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only resolve for public/customer routes
  const isPublicRoute = 
    req.path.startsWith('/public') || 
    req.path.startsWith('/b/') || 
    req.path.startsWith('/api/public');
    
  if (!isPublicRoute) {
    return next();
  }
  
  const portalContext = await getPortalContext(req);
  req.portalContext = portalContext;
  
  // For public flows, portal's tenant becomes THE tenant context
  // This ensures tenant isolation derives from portal
  if (portalContext && !req.tenantId) {
    req.tenantId = portalContext.tenant_id;
  }
  
  // Dev logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PORTAL] host=${req.headers.host} path=${req.path} resolved=${portalContext?.portal_slug || 'none'} tenant=${portalContext?.tenant_id || 'none'}`);
  }
  
  next();
}

// Require portal context for specific routes
export function requirePortalContext(req: Request, res: Response, next: NextFunction) {
  if (!req.portalContext) {
    return res.status(404).json({ 
      error: 'PORTAL_NOT_FOUND',
      message: 'Unable to determine portal from request. Check domain or path.'
    });
  }
  next();
}
```

**Middleware Order (explicit):**
```typescript
// In your main app setup:
app.use(portalContextMiddleware);  // 1. Resolve portal (and derive tenant for public)
// ... existing tenant middleware (should respect req.tenantId if set)
// ... auth middleware
// ... route handlers
```

---

## STEP 4 — Dev Path Routing (/b/:slug/*)

**CRITICAL: Middleware order for /b/:slug rewrite**

The rewrite must happen AFTER portal resolution reads the path, but BEFORE route handlers try to match.

```typescript
// Option A: Don't rewrite, just let routes handle /b/:slug prefix
// This is safer - routes explicitly handle /b/:slug/api/public/...

// Option B: If rewrite is needed, do it carefully:
app.use('/b/:portalSlug', (req, res, next) => {
  // Portal already resolved by portalContextMiddleware
  // Now strip the /b/:slug prefix for downstream route matching
  const originalUrl = req.url;
  req.url = req.url.replace(/^\/[^\/]+/, '') || '/';  // Remove first path segment
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PORTAL-REWRITE] ${originalUrl} → ${req.url}`);
  }
  
  next();
});
```

Ensure this runs AFTER `portalContextMiddleware` and BEFORE route handlers.

---

## STEP 5 — Public Portal Context Endpoint (Dev + QA)

Create minimal endpoint to verify resolution:

```typescript
// GET /api/public/portal-context
// Also accessible via: /b/:slug/api/public/portal-context

router.get('/api/public/portal-context', portalContextMiddleware, (req, res) => {
  if (!req.portalContext) {
    return res.status(404).json({ 
      error: 'PORTAL_NOT_FOUND',
      host: req.headers.host,
      path: req.path
    });
  }
  
  res.json({
    portal_id: req.portalContext.portal_id,
    portal_slug: req.portalContext.portal_slug,
    display_name: req.portalContext.display_name,
    legal_dba_name: req.portalContext.legal_dba_name,
    portal_type: req.portalContext.portal_type,
    tenant_id: req.portalContext.tenant_id
    // Theme would require separate join to portal_theme
  });
});
```

---

## STEP 6 — Add Guardrails to EXISTING Public Endpoints

**DO NOT create new public CRUD endpoints.** Only add guardrails to endpoints that ALREADY exist.

### 6A) Audit existing public routes

```bash
# Find what public routes exist
grep -r "router\.\(get\|post\|put\|delete\).*public" server/routes/
grep -r "app\.\(get\|post\|put\|delete\).*public" server/
```

Report which of these exist:
- [ ] Public booking creation
- [ ] Public contact/customer creation
- [ ] Public work request intake
- [ ] Public "my bookings" list
- [ ] Public services/products list

### 6B) For each EXISTING endpoint, add portal guardrails

**Pattern for existing POST endpoints:**
```typescript
// Before (existing):
router.post('/api/public/some-endpoint', async (req, res) => {
  const { tenant_id, ...data } = req.body;
  // creates record with tenant_id from body
});

// After (with guardrails):
router.post('/api/public/some-endpoint', requirePortalContext, async (req, res) => {
  // CRITICAL: portal_id and tenant_id from context, NOT from client
  const portal_id = req.portalContext!.portal_id;
  const tenant_id = req.portalContext!.tenant_id;
  
  // Ignore any client-supplied portal_id or tenant_id
  const { ...data } = req.body;
  
  // Create with server-derived IDs
  await db.query(`
    INSERT INTO some_table (tenant_id, portal_id, ...)
    VALUES ($1, $2, ...)
  `, [tenant_id, portal_id, ...]);
});
```

**Pattern for existing GET endpoints:**
```typescript
// Before:
router.get('/api/public/some-list', async (req, res) => {
  const results = await db.query('SELECT * FROM table WHERE tenant_id = $1', [req.query.tenant_id]);
});

// After:
router.get('/api/public/some-list', requirePortalContext, async (req, res) => {
  // FORCE portal_id filter - never trust client
  const results = await db.query(`
    SELECT * FROM table 
    WHERE tenant_id = $1 AND portal_id = $2
  `, [req.portalContext!.tenant_id, req.portalContext!.portal_id]);
});
```

### 6C) If no public endpoints exist yet

Focus on:
1. Portal resolution middleware (done)
2. `/api/public/portal-context` endpoint (done)
3. Document which endpoints WILL need guardrails when created

---

## STEP 7 — Prevent Cross-Portal Data Leaks

For any public query endpoints:

```typescript
// WRONG - trusts client
const portal_id = req.query.portal_id;

// RIGHT - derives from context
const portal_id = req.portalContext!.portal_id;
```

Rules:
- Public routes MUST use `req.portalContext.portal_id`
- Never accept client-supplied portal_id in public routes
- Contact lookup in public flows: filter by portal_id (no cross-portal search)
- Booking queries: filter by portal_id
- Services/products: filter by portal_id

---

## STEP 8 — VERIFICATION (PRINT EVIDENCE)

### A) Portal Resolution Tests

```bash
# Test domain resolution (simulate with curl -H "Host: ...")
curl -H "Host: remoteserve.ca" http://localhost:3000/api/public/portal-context
# Expected: { "portal_slug": "remote-serve", "tenant_id": "...", ... }

curl -H "Host: enviropaving.ca" http://localhost:3000/api/public/portal-context
# Expected: { "portal_slug": "enviropaving", ... }

curl -H "Host: envirobright.ca" http://localhost:3000/api/public/portal-context
# Expected: { "portal_slug": "enviro-bright", ... }

# Test path fallback
curl http://localhost:3000/b/remote-serve/api/public/portal-context
# Expected: { "portal_slug": "remote-serve", ... }

# Test unknown domain
curl -H "Host: unknown.ca" http://localhost:3000/api/public/portal-context
# Expected: 404 { "error": "PORTAL_NOT_FOUND" }
```

### B) Middleware Order Verification

```bash
# Check console logs show correct order:
# [PORTAL] host=remoteserve.ca path=/api/public/portal-context resolved=remote-serve tenant=<uuid>
```

### C) SQL Verification

```sql
-- Verify portal_domains seeded
SELECT p.slug, pd.domain, pd.is_primary, pd.verification_status
FROM portal_domains pd
JOIN portals p ON p.id = pd.portal_id
WHERE p.slug IN ('enviropaving', 'remote-serve', 'enviro-bright');
```

### D) Code Evidence

- [ ] List files changed
- [ ] Show middleware registration order
- [ ] Show portal resolution service
- [ ] List which existing public endpoints got guardrails (if any)
- [ ] Confirm no new CRUD endpoints were created

---

## CRITICAL REMINDERS

1. **Use existing `v_portal_domain_resolution`** if it fits - don't reinvent.

2. **Middleware order matters** — Portal resolution before/alongside tenant resolution for public flows.

3. **Don't add theme_json to portals** — Theme is in `portal_theme` table.

4. **Don't invent new endpoints** — Focus on plumbing + guardrails on existing routes.

5. **Assets remain tenant-level** — Never add portal_id to unified_assets.

6. **Dev vs Prod domains** — Seed as `verified` for dev; production uses DNS verification.

BEGIN.
