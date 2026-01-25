# Platform Guards Fix: entities.ts and apify.ts

**Date**: 2026-01-25  
**Author**: Replit Agent  
**Security Audit**: V3.5 Auth Correction

---

## Summary

Fixed 14 route guard chains that were using invalid `requireRole('admin')` (undefined role) and replaced with proper `requirePlatformAdmin` guard. Also hardened `requireRole()` to fail fast on invalid role strings.

---

## Problem

The audit found routes using `requireRole('admin')` which is **NOT** a valid tenant role:
- Valid tenant roles: `tenant_owner`, `tenant_admin`, `operator`, `staff`, `member`
- `'admin'` alone resolves to undefined and provides no protection

---

## Files Fixed

### 1. server/routes/entities.ts (13 routes)

**Before:**
```typescript
import { requireAuth, requireRole } from "../middleware/guards";
router.get("/datasets", requireAuth, requireRole('admin'), ...);
```

**After:**
```typescript
import { requireAuth, requirePlatformAdmin } from "../middleware/guards";
router.get("/datasets", requireAuth, requirePlatformAdmin, ...);
```

**Routes Fixed:**
| Line | Method | Path | Description |
|------|--------|------|-------------|
| 23 | GET | /datasets | List all datasets |
| 42 | POST | /datasets | Create/update dataset |
| 79 | GET | /records | List external records |
| 186 | POST | /entities | Create entity |
| 235 | POST | /cc_entities/from-record/:recordId | Create entity from record |
| 254 | GET | /links/queue | Get link queue |
| 267 | POST | /links/:linkId/accept | Accept link |
| 285 | POST | /links/:linkId/reject | Reject link |
| 303 | POST | /resolution/run-batch | Run resolution batch |
| 314 | POST | /records/:recordId/propose-links | Propose links for record |
| 391 | GET | /claims/pending | Get pending claims |
| 411 | POST | /claims/:claimId/approve | Approve claim |
| 455 | POST | /claims/:claimId/reject | Reject claim |

### 2. server/routes/apify.ts (1 guard definition → 15 routes)

**Before:**
```typescript
import { requireAuth, requireRole } from '../middleware/guards';
const adminGuard = [requireAuth, requireRole('admin')];
```

**After:**
```typescript
import { requireAuth, requirePlatformAdmin } from '../middleware/guards';
const adminGuard = [requireAuth, requirePlatformAdmin];
```

**Routes using adminGuard:**
- GET /datasets
- POST /datasets
- POST /sync/:slug
- GET /stats
- GET /records
- GET /records/:id
- GET /unresolved
- GET /rentals
- POST /records/:id/create-entity
- GET /sync-history/:slug
- PATCH /datasets/:id
- DELETE /datasets/:id
- DELETE /records/:id
- POST /records/:id/resolve
- DELETE /records/stale

---

## Hardening: requireRole() Validation

**File:** `server/middleware/guards.ts`

Added fail-fast validation to prevent this regression:

```typescript
const VALID_TENANT_ROLES = new Set([
  'tenant_owner',
  'tenant_admin', 
  'operator',
  'staff',
  'member',
  'owner'  // DB storage value for tenant_owner
]);

export function requireRole(...requiredRoles: string[]): RequestHandler {
  // FAIL FAST: Validate roles at registration time, not request time
  const invalidRoles = requiredRoles.filter(role => !VALID_TENANT_ROLES.has(role));
  if (invalidRoles.length > 0) {
    throw new Error(
      `INVALID_ROLE_GUARD: Invalid role(s) passed to requireRole(): ${invalidRoles.join(', ')}. ` +
      `Valid roles are: ${Array.from(VALID_TENANT_ROLES).join(', ')}. ` +
      `For platform admin access, use requirePlatformAdmin instead.`
    );
  }
  // ... rest of guard
}
```

**Key behavior:**
- Throws immediately at route registration time (server boot)
- Error message suggests `requirePlatformAdmin` for platform admin access
- Prevents silent failures where invalid roles slip through

---

## Tests

### 1. tests/invalid-role-guard.test.ts (7 tests)

| Test | Status |
|------|--------|
| should throw immediately when "admin" (invalid) is passed | ✅ PASS |
| should throw for other invalid roles | ✅ PASS |
| should throw with helpful message mentioning requirePlatformAdmin | ✅ PASS |
| should NOT throw for valid tenant roles | ✅ PASS |
| should NOT throw for "owner" (DB storage value) | ✅ PASS |
| should include invalid role in error message | ✅ PASS |
| should validate VALID_TENANT_ROLES contains expected values | ✅ PASS |

### 2. tests/platform-only-entities-guards.test.ts (3 tests)

| Test | Status |
|------|--------|
| should return 401 when not authenticated | ✅ PASS |
| should verify guard chain uses requirePlatformAdmin | ✅ PASS |
| should verify requireAuth is applied before requirePlatformAdmin | ✅ PASS |

### 3. tests/platform-only-apify-guards.test.ts (3 tests)

| Test | Status |
|------|--------|
| should return 401 when not authenticated | ✅ PASS |
| should verify guard chain uses requirePlatformAdmin | ✅ PASS |
| should verify requireAuth is applied before requirePlatformAdmin | ✅ PASS |

---

## Test Output

```
 RUN  v4.0.16 /home/runner/workspace

 ✓ tests/invalid-role-guard.test.ts (7 tests) 41ms
 ✓ tests/platform-only-apify-guards.test.ts (3 tests) 184ms
 ✓ tests/platform-only-entities-guards.test.ts (3 tests) 80ms

 Test Files  3 passed (3)
      Tests  13 passed (13)
   Duration  5.54s
```

---

## Security Model Clarification

| Guard | Use Case |
|-------|----------|
| `requirePlatformAdmin` | Platform infrastructure routes (no tenant scope) |
| `requireRole('tenant_admin')` | Tenant-scoped admin actions |
| `requireRole('tenant_owner')` | Tenant ownership actions |

**Note:** `requireTenant` is NOT added to these routes because they are platform infrastructure endpoints that operate outside tenant boundaries.

---

## Related Files

| File | Purpose |
|------|---------|
| server/routes/entities.ts | Entity management routes (fixed) |
| server/routes/apify.ts | Apify sync routes (fixed) |
| server/middleware/guards.ts | Guard definitions (hardened) |
| tests/invalid-role-guard.test.ts | Role validation tests |
| tests/platform-only-entities-guards.test.ts | Entities guard tests |
| tests/platform-only-apify-guards.test.ts | Apify guard tests |
