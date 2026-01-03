# Multi-Tenant Isolation QA Checklist

## Overview
This document provides verification steps to ensure tenant isolation is properly enforced across the Community Canvas platform.

## Components Implemented

### 1. Tenant Context Middleware
**File:** `server/middleware/tenantContext.ts`
- Resolves portal from domain via `portal_domains` lookup
- Sets `req.ctx` with tenant_id, portal_id, individual_id, roles, scopes
- Integrates with existing JWT auth and session

### 2. DB Request Context Wrapper
**File:** `server/db/withRequestContext.ts`
- Sets Postgres session variables before queries:
  - `app.tenant_id`
  - `app.portal_id`
  - `app.individual_id`
- Enables RLS policy enforcement

### 3. Route Guards
**File:** `server/middleware/guards.ts`
- `requireAuth` - 401 if no individual_id
- `requireTenant` - 401 if no tenant_id
- `requirePortal` - 401 if no portal_id
- `requireRole('admin')` - 403 if role missing
- `requireSelfOrAdmin(paramName)` - Self-access or admin only

### 4. Row-Level Security Policies
**Migration:** `server/migrations/024_rls_policies.sql`

Tables with RLS enabled:
- cc_tenants
- cc_individuals
- portals
- portal_memberships
- portal_domains
- portal_feature_flags
- opportunities
- assets
- work_orders
- contracts
- bids
- parties

---

## QA Verification Curl Commands

### Setup
```bash
# Get base URL
BASE_URL="https://YOUR_REPL_URL"

# For authenticated requests, get a JWT token first
# (Replace with actual auth flow)
TOKEN="your-jwt-token"
AUTH_HEADER="Authorization: Bearer $TOKEN"
```

### Test 1: Unauthenticated PII Access (Should Fail)
```bash
curl -X GET "$BASE_URL/api/individuals/me" \
  -H "Content-Type: application/json"
# Expected: 401 Unauthorized
```

### Test 2: Entities Endpoint Without Auth (Should Require Auth)
```bash
curl -X GET "$BASE_URL/api/entities/entities" \
  -H "Content-Type: application/json"
# Expected: 401 Unauthorized (if guards applied)
```

### Test 3: Portal Domain Resolution
```bash
curl -X GET "$BASE_URL/api/entities/entities" \
  -H "Content-Type: application/json" \
  -H "Host: offpeakairbnb.ca"
# Expected: Response scoped to OffpeakAirBNB portal
```

### Test 4: Cross-Tenant Portal Access Attempt
```bash
# Try accessing portal A's data while authenticated as portal B user
curl -X GET "$BASE_URL/api/portals/feature-flags" \
  -H "$AUTH_HEADER" \
  -H "Host: adrenalinecanada.com"
# Expected: Only AdrenalineCanada flags visible
```

### Test 5: Opportunity Visibility (Public)
```bash
curl -X GET "$BASE_URL/api/service-runs/opportunities?visibility_scope=public" \
  -H "Content-Type: application/json"
# Expected: Only public opportunities returned
```

### Test 6: Self-Only Individual Access
```bash
# Authenticated user can only access their own profile
curl -X GET "$BASE_URL/api/individuals/me" \
  -H "$AUTH_HEADER"
# Expected: 200 with user's own data only
```

### Test 7: Admin Feature Flags (Should Require Admin)
```bash
curl -X POST "$BASE_URL/api/portals/feature-flags" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"flag_key": "test_flag", "is_enabled": true}'
# Expected: 403 Forbidden if not admin
```

### Test 8: RLS Enforcement via Session Variables
```sql
-- Test in psql - SECURITY MODEL:
-- Empty string = no access (regular user without tenant)
-- '__SERVICE__' = bypass RLS (service/admin mode)
-- Valid UUID = scoped access

-- Test 1: Empty string = no access
SELECT set_config('app.tenant_id', '', true);
SELECT * FROM cc_tenants;
-- Expected: Empty result (no tenant context = no access)

-- Test 2: Service mode = full access
SELECT set_config('app.tenant_id', '__SERVICE__', true);
SELECT * FROM cc_tenants;
-- Expected: All tenants visible (service mode bypass)

-- Test 3: Specific tenant = scoped access
SELECT set_config('app.tenant_id', 'your-tenant-uuid-here', true);
SELECT * FROM cc_tenants;
-- Expected: Only that tenant visible
```

### Test 9: Portal-Scoped Assets
```bash
curl -X GET "$BASE_URL/api/assets?portal_id=<portal_uuid>" \
  -H "$AUTH_HEADER"
# Expected: Only assets with matching portal_id or visibility_scope='public'
```

### Test 10: Bid Isolation
```bash
# User from Tenant A tries to view bids for Tenant B's opportunity
curl -X GET "$BASE_URL/api/bids?opportunity_id=<tenant_b_opp_id>" \
  -H "$AUTH_HEADER"
# Expected: Only bids visible if user owns the opportunity or is the bidder
```

---

## RLS Policy Test Queries

Run these in a database session to verify RLS enforcement:

```sql
-- Test 1: Tenant isolation
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);
SELECT COUNT(*) FROM cc_tenants; -- Should be 1 or 0

-- Test 2: Individual self-access
SELECT set_config('app.individual_id', '<your_individual_uuid>', true);
SELECT set_config('app.tenant_id', '', true);
SELECT * FROM cc_individuals; -- Should only show matching individual

-- Test 3: Portal visibility
SELECT set_config('app.portal_id', '<portal_uuid>', true);
SELECT set_config('app.tenant_id', '', true);
SELECT * FROM portals; -- Should show matching portal

-- Test 4: Opportunity public visibility
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('app.portal_id', '', true);
SELECT * FROM opportunities WHERE visibility_scope = 'public';
-- Should show all public opportunities regardless of tenant
```

---

## Attack Scenarios Checklist

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Cross-tenant data read via /api/entities | 401 or filtered data | |
| 2 | Modify other tenant service runs | 403 or filtered | |
| 3 | Access PII from /api/individuals without auth | 401 | |
| 4 | Elevate to admin via feature flags | 403 | |
| 5 | Replay Jobber OAuth to different tenant | Blocked (token validation) | |
| 6 | Access assets without portal filter | Only public/owned visible | |
| 7 | Bypass CASL consent by direct POST | Blocked (consent check) | |
| 8 | Hijack portal via verification token | Blocked (hashed tokens) | |
| 9 | SQL injection through location params | Blocked (parameterized) | |
| 10 | Lateral movement via host dashboard | Tenant-scoped | |

---

## Files Changed

| File | Purpose |
|------|---------|
| `server/middleware/tenantContext.ts` | Tenant/portal context resolution |
| `server/middleware/guards.ts` | Route guards (requireAuth, requireTenant, requireRole) |
| `server/db/withRequestContext.ts` | Postgres session variable wrapper |
| `server/db/tenantDb.ts` | Tenant-aware query helpers attached to req |
| `server/lib/portalTokens.ts` | Hashed portal verification tokens |
| `server/index.ts` | Global middleware registration |
| `server/migrations/024_rls_policies.sql` | RLS policy definitions |

---

## Using Tenant-Aware Database Queries

### For Route Handlers (User Requests)
```typescript
import { Request, Response } from 'express';

// Option 1: Use req.tenantQuery for simple queries
app.get('/api/my-data', async (req: Request, res: Response) => {
  const result = await req.tenantQuery('SELECT * FROM my_table WHERE id = $1', [id]);
  res.json(result.rows);
});

// Option 2: Use req.tenantTransaction for transactions
app.post('/api/my-data', async (req: Request, res: Response) => {
  const result = await req.tenantTransaction(async (client) => {
    await client.query('INSERT INTO table1 ...');
    await client.query('INSERT INTO table2 ...');
    return { success: true };
  });
  res.json(result);
});
```

### For Background Jobs / Service Operations
```typescript
import { serviceQuery, withServiceTransaction } from './db/tenantDb';

// Simple query with service mode (bypasses RLS)
const result = await serviceQuery('SELECT * FROM all_tenants_data');

// Transaction with service mode
await withServiceTransaction(async (client) => {
  await client.query('UPDATE ...');
  await client.query('INSERT ...');
});
```

### Security Model
- `req.tenantQuery` / `req.tenantTransaction`: Sets session vars from request context
  - Empty context = no access (RLS blocks all rows)
  - Valid context = scoped access
- `serviceQuery` / `withServiceTransaction`: Sets `__SERVICE__` sentinel
  - Bypasses RLS for admin/migration/background operations

---

## Critical Next Steps (P0)

1. **Migrate all routes to use tenant-aware queries** - Replace `pool.query`/`db.query` with `req.tenantQuery`
   - Files using pool.query directly need to be updated
   - This is required for RLS to actually be enforced at the application level
   
2. **Update background jobs to use serviceQuery** - Pipelines, schedulers need `serviceQuery`
   - server/pipelines/*.ts
   - server/services/*.ts

3. **Remove redundant context helpers** - Consolidate withRequestContext with tenantDb helpers

## P1 Next Steps

4. **Apply guards to remaining routes** - entities, service-runs, host dashboard
5. **Update OAuth flows** - Bind tokens to tenant_id
6. **Add audit logging** - Log all admin mutations
7. **Implement CASL consent workflows** - Block communications without consent
8. **Add automated integration tests** - Tenant isolation verification

---

## Migration Guide: Updating Routes to Use Tenant Queries

### Before (Vulnerable - bypasses RLS)
```typescript
import { pool } from '../db';

app.get('/api/items', async (req, res) => {
  const result = await pool.query('SELECT * FROM items WHERE tenant_id = $1', [tenantId]);
  res.json(result.rows);
});
```

### After (Secure - RLS enforced)
```typescript
app.get('/api/items', async (req, res) => {
  // req.tenantQuery sets session vars before executing
  const result = await req.tenantQuery('SELECT * FROM items');
  res.json(result.rows);
});
```

Note: With RLS enforced, you no longer need `WHERE tenant_id = $1` clauses - the database automatically filters based on session context.
