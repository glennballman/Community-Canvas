# PROMPT-12 Implementation Evidence: Platform Dashboards + Tenants List Truth Source

## Summary

PROMPT-12 ensures platform admin endpoints use capability-based authorization (`platform.configure`) instead of legacy boolean checks, with comprehensive tests and documentation.

## File/Line Evidence Index

| Description | File | Line |
|-------------|------|------|
| Stats endpoint handler | `server/routes/foundation.ts` | 700 |
| requireCapability import | `server/routes/foundation.ts` | 5 |
| Route mount /api/platform | `server/routes.ts` | 228 |
| Client stats query | `client/src/pages/app/PlatformHomePage.tsx` | 36 |
| P2 tenants requireCapability | `server/routes/p2-platform.ts` | 30 |
| Stats HTTP guard test | `tests/platform/platform-stats.test.ts` | 26-54 |
| Stats DB capability test | `tests/platform/platform-stats.test.ts` | 56-87 |
| Stats response shape test | `tests/platform/platform-stats.test.ts` | 130-183 |

## Changes Made

### 1. Platform Stats Endpoint (`/api/platform/stats`)

**File: `server/routes/foundation.ts`**

Before:
```typescript
router.get('/stats', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
```

After:
```typescript
/**
 * PROMPT-12: Platform stats endpoint
 * Uses requireCapability('platform.configure') for capability-based authorization
 * Queries canonical tables: cc_users, cc_tenants, cc_tenant_users, cc_portals
 */
router.get('/stats', authenticateToken, requireCapability('platform.configure'), async (req: AuthRequest, res: Response) => {
```

**Import Added:**
```typescript
import { requireCapability } from '../auth/authorize';
```

### 2. Route Mount for Client Compatibility

**File: `server/routes.ts`**

Added dual mount for foundation router to support existing client paths:
```typescript
// Register multi-tenant foundation routes
app.use('/api/foundation', foundationRouter);

// PROMPT-12: Also mount at /api/platform for PlatformHomePage client compatibility
// The stats endpoint uses requireCapability('platform.configure')
app.use('/api/platform', foundationRouter);
```

### 3. Platform Tenants Endpoint

**Status:** Already compliant

The `/api/p2/platform/tenants` endpoint in `server/routes/p2-platform.ts` already uses:
```typescript
router.use(requireCapability('platform.configure'));
```

The foundation `/api/foundation/tenants` endpoint serves dual behavior (platform admins see all, regular users see their memberships) and is not a platform-admin-only endpoint.

## Response Shape Verification

The `/api/platform/stats` endpoint returns:
```json
{
  "success": true,
  "stats": {
    "total_users": "16",
    "active_users": "16",
    "platform_admins": "2",
    "total_tenants": "30",
    "government_tenants": "5",
    "business_tenants": "23",
    "property_tenants": "0",
    "individual_tenants": "1",
    "total_memberships": "18",
    "total_portals": "12"
  },
  "totalTenants": 30,
  "totalUsers": 16,
  "totalPortals": 12
}
```

This matches the client expectation in `client/src/pages/app/PlatformHomePage.tsx`:
```typescript
const { data: stats } = useQuery<{
  totalTenants: number;
  totalUsers: number;
  totalPortals: number;
}>({
  queryKey: ['/api/platform/stats'],
```

## Canonical Tables Used

Both endpoints query only canonical tables (per Authorization Constitution):

| Endpoint | Tables Queried |
|----------|---------------|
| `/api/platform/stats` | `cc_users`, `cc_tenants`, `cc_tenant_users`, `cc_portals` |
| `/api/p2/platform/tenants` | `cc_tenants`, `cc_users`, `cc_portals`, `cc_tenant_users` |

## Test Coverage

### New Test Files Created

1. **`tests/platform/platform-stats.test.ts`** - 11 tests
   - HTTP Authorization Guards: 401 without auth, requireCapability function verification
   - Authorization via cc_has_capability: platform admins allowed, non-admins denied
   - Canonical table queries: cc_users, cc_tenants, cc_tenant_users, cc_portals
   - Response shape validation: camelCase properties for client

2. **`tests/platform/platform-tenants.test.ts`** - 9 tests
   - Authorization: `platform.configure` capability checks
   - Canonical table joins
   - Filter support (type, status, search)

### Test Results

```
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - HTTP Authorization Guards > should return 401 when not authenticated (no token)
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - HTTP Authorization Guards > should verify requireCapability function is defined and callable
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - HTTP Authorization Guards > should confirm stats endpoint uses requireCapability not requirePlatformAdmin
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Authorization via cc_has_capability > should require platform.configure capability via cc_has_capability
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Authorization via cc_has_capability > should deny platform.configure for non-platform-admin users
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Canonical Tables > should query cc_users table for user counts
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Canonical Tables > should query cc_tenants table for tenant counts
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Canonical Tables > should query cc_tenant_users table for membership counts
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Canonical Tables > should query cc_portals table for portal counts
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Response Shape > should return expected stats fields matching endpoint response
 ✓ tests/platform/platform-stats.test.ts > Platform Stats Endpoint - Response Shape > should provide camelCase properties for PlatformHomePage client
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Authorization > should require platform.configure capability for platform tenants list
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Authorization > should deny platform.configure for non-platform-admin users
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Canonical Tables > should query cc_tenants with proper tenant data structure
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Canonical Tables > should join cc_tenant_users for member counts
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Canonical Tables > should join cc_users for owner information
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Canonical Tables > should join cc_portals for portal slugs
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Filter Support > should support filtering by tenant_type
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Filter Support > should support filtering by status
 ✓ tests/platform/platform-tenants.test.ts > Platform Tenants Endpoint - Filter Support > should support search by name or slug

Test Files  2 passed (2)
     Tests  20 passed (20)
```

## Authorization Flow

```
Request → authenticateToken → requireCapability('platform.configure')
                                    ↓
                              authorize(req, 'platform.configure')
                                    ↓
                              cc_has_capability(principal_id, 'platform.configure', platform_scope)
                                    ↓
                              Check cc_grants for platform_admin role
                                    ↓
                              Allow/Deny + Audit Log
```

## Compliance with Authorization Constitution

| Requirement | Status |
|-------------|--------|
| Capability-based authorization | ✅ Uses `requireCapability('platform.configure')` |
| Single identity authority | ✅ Uses `req.user.userId` from authenticated session |
| Fail-closed behavior | ✅ `requireCapability` denies by default |
| Audit logging | ✅ All decisions logged to `cc_auth_audit_log` |
| Canonical tables only | ✅ Queries `cc_users`, `cc_tenants`, `cc_tenant_users`, `cc_portals` |

## Date

Implemented: January 28, 2026
