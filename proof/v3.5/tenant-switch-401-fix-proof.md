# Tenant Switch 401 Fix - Proof Document

**Date**: 2026-01-24  
**STEP**: Session Auth Bug Fix  
**Status**: COMPLETE

## Bug Description

### Before Fix
When using session-based authentication (dev-demo login without JWT):
1. User logs in via dev-demo → `session.userId` is set
2. User switches tenant via `POST /api/me/switch-tenant` → `session.current_tenant_id` is set
3. User calls `GET /api/provider/runs` → **401 Unauthorized**

### Root Cause
The `requireAuth` function in `server/routes/provider.ts` only checked:
1. `req.user?.id` (populated by JWT via optionalAuth middleware)
2. JWT Authorization header

Session-based auth populates `session.userId` but NOT `req.user`. The middleware rejected requests without JWT even when valid session auth existed.

### After Fix
The `requireAuth` function now checks session-based auth FIRST:
1. If `session.userId` exists → populate `req.user` from session
2. Derive `tenantId` from `session.current_tenant_id || session.tenant_id`
3. Allow request through without requiring JWT

## Code Change

**File**: `server/routes/provider.ts`  
**Function**: `requireAuth`

```typescript
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const session = (req as any).session;

  // Session-based auth support (dev-demo login, tenant switching)
  if (session?.userId) {
    // Ensure req.user is populated for downstream code that expects it
    req.user = req.user ?? { id: session.userId };
    req.user.id = req.user.id ?? session.userId;

    // Populate tenantId from session if available (supports tenant switching)
    const sessionTenantId = session.current_tenant_id || session.tenant_id;
    if (sessionTenantId && !req.user.tenantId) {
      req.user.tenantId = sessionTenantId;
    }

    return next();
  }

  // ... existing JWT-based auth logic preserved ...
}
```

## Evidence

### Test 1: Session Auth Without JWT
```
# Login via dev-demo (session-based, no JWT)
# Call GET /api/provider/runs

Expected: 200 OK (not 401)
Result: PASS - Request accepted with session auth
```

### Test 2: Tenant Switching Works
```
# Login as user with multiple tenant memberships
# POST /api/me/switch-tenant { tenant_id: "<new-tenant-id>" }
# GET /api/provider/runs

Expected: 200 OK with runs scoped to new tenant
Result: PASS - tenantId correctly resolved from session.current_tenant_id
```

### Test 3: JWT Auth Still Works
```
# Login via JWT-based auth
# GET /api/provider/runs with Authorization: Bearer <token>

Expected: 200 OK
Result: PASS - Existing JWT flow unaffected
```

## Verification

- No schema changes made
- No global middleware refactors
- Surgical patch to provider.ts only
- Existing JWT behavior preserved
- Route handlers still use: `const tenantId = req.ctx?.tenant_id || req.user?.tenantId;`

## Terminology Compliance

- ✅ "service provider" (not contractor)
- ✅ "reservation" (not booking)
- ✅ No forbidden terms in code changes
