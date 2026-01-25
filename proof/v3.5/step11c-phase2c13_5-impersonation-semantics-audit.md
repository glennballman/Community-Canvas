# STEP 11C Phase 2C-13.5: Impersonation Semantics Audit

**Date**: 2026-01-25  
**Status**: AUDIT COMPLETE

## Problem Statement

Current implementation "Impersonate user" is auto-selecting a tenant (e.g., Woods End Landing) and redirecting into tenant context. This violates V3.5 semantics where impersonation has TWO independent dimensions:
1. `acting_user` (impersonated user identity)
2. `tenant_context` (selected tenant for operations)

## Audit Findings

### 1. SERVER: Tenant Auto-Selection Location

**File**: `server/routes/admin-impersonation.ts` (lines 148-171)

```typescript
// Determine which tenant to use
let selectedTenant = null;
if (tenant_id) {
  // User specified a tenant - verify membership
  selectedTenant = memberships.find(m => m.tenant_id === tenant_id);
  if (!selectedTenant) {
    return res.status(400).json({ ok: false, error: 'User is not a member of specified tenant' });
  }
} else if (memberships.length === 1) {
  // User has exactly one membership - AUTO-SELECT  <-- VIOLATION
  selectedTenant = memberships[0];
} else if (memberships.length > 1) {
  // Multiple memberships - require explicit selection
  return res.status(400).json({ 
    ok: false, 
    error: 'User has multiple tenant memberships. Please specify tenant_id.',
    memberships: memberships.map(m => ({...})),
  });
}
```

**Heuristic Used**: If user has exactly 1 membership, auto-select it (`memberships[0]`).

### 2. SERVER: Session Storage

**File**: `server/routes/admin-impersonation.ts` (lines 177-198)

```typescript
session.impersonation = {
  impersonated_user_id: targetUser.id,
  impersonated_user_email: targetUser.email,
  impersonated_user_name: targetUser.display_name || targetUser.email.split('@')[0],
  tenant_id: selectedTenant?.tenant_id || null,       // <-- Can be null, but auto-set
  tenant_name: selectedTenant?.tenant_name || null,
  tenant_role: selectedTenant?.role || null,
  admin_user_id: adminUserId,
  reason: reason || 'Platform admin access',
  started_at: new Date().toISOString(),
  expires_at: expiresAt,
};

// Set current tenant context
if (selectedTenant) {
  session.current_tenant_id = selectedTenant.tenant_id;  // <-- Auto-sets tenant context
  session.roles = [selectedTenant.role];
}
```

### 3. SERVER: /api/me/context Response Shaping

**File**: `server/routes/user-context.ts` (lines 56-84)

The `/api/me/context` endpoint checks for impersonation and derives `currentTenantId` from it:

```typescript
if (impersonation?.tenant_id && impersonation?.expires_at) {
  // Check if impersonation is still valid
  if (new Date(impersonation.expires_at) > new Date()) {
    // Get impersonated tenant info with portal slug
    const tenantResult = await serviceQuery(`...`, [impersonation.tenant_id]);
    if (tenantResult.rows.length > 0) {
      impersonatedTenant = tenantResult.rows[0];
      currentTenantId = impersonation.tenant_id;  // <-- Uses impersonation.tenant_id
    }
  }
}
```

**Note**: This correctly handles `tenant_id: null` - it just won't set `impersonatedTenant`.

### 4. SERVER: /api/foundation/auth/whoami Response Shaping

**File**: `server/routes/foundation.ts` (lines 189-231)

```typescript
impersonation: isImpersonating ? {
  active: true,
  target_user: {
    id: impersonation.impersonated_user_id,
    email: impersonation.impersonated_user_email,
    display_name: impersonation.impersonated_user_name
  },
  tenant: impersonation.tenant_id ? {    // <-- Correctly nullable
    id: impersonation.tenant_id,
    slug: impersonation.tenant_slug || null,
    name: impersonation.tenant_name
  } : null,
  role: impersonation.tenant_role || null,
  expires_at: impersonation.expires_at
} : { active: false, ... }
```

**Note**: Already supports `tenant: null` in response.

### 5. SERVER: tenantContext Middleware

**File**: `server/middleware/tenantContext.ts` (lines 209-246)

The middleware reads session impersonation and sets `req.ctx.tenant_id`:

```typescript
if (sessionImpersonation?.tenant_id && sessionImpersonation?.expires_at) {
  if (new Date(sessionImpersonation.expires_at) > new Date()) {
    // Override tenant context with impersonated tenant
    req.ctx.tenant_id = sessionImpersonation.tenant_id;
    req.ctx.is_impersonating = true;
    ...
  }
}
```

**Note**: This is gated by `sessionImpersonation?.tenant_id` - if tenant_id is null, it won't set tenant context.

### 6. CLIENT: AuthContext

**File**: `client/src/contexts/AuthContext.tsx` (lines 32-46)

```typescript
interface ImpersonationState {
    active: boolean;
    target_user: {
        id: string;
        email: string;
        display_name: string;
    } | null;
    tenant: {                 // <-- Already supports null
        id: string;
        slug: string | null;
        name: string;
    } | null;
    role: string | null;
    expires_at: string | null;
}
```

**Note**: Client already has proper types for `tenant: null`.

### 7. CLIENT: ImpersonationConsole

**File**: `client/src/pages/app/platform/ImpersonationConsole.tsx` (lines 161-205)

The console calls `/api/admin/impersonation/start` with optional `tenant_id`. If server returns `memberships` (multi-tenant case), it shows a tenant picker. After success, it navigates to `/app`.

**Issue**: After impersonation starts with auto-selected tenant, it navigates directly to `/app` which renders the tenant shell. If tenant were null, UI would break.

### 8. CLIENT: AppRouterSwitch

**File**: `client/src/components/routing/AppRouterSwitch.tsx`

Currently handles impersonation by redirecting from `/app/platform/*` to `/app`. Does NOT handle the case where tenant is null.

## Summary: Where Tenant Auto-Selection Happens

| Location | File | Line(s) | Heuristic |
|----------|------|---------|-----------|
| **PRIMARY** | admin-impersonation.ts | 156-158 | `memberships.length === 1` → auto-select first |
| Session storage | admin-impersonation.ts | 193-197 | Sets `session.current_tenant_id` if tenant selected |

## What UI Expects tenant_id to Exist

1. **TenantAppLayout** - Expects tenant context for nav rendering
2. **TenantContext** - Many components rely on `currentTenantId` being set
3. **AppRouterSwitch** - Does not currently handle impersonation + null tenant
4. **Navigation** - Tenant-scoped sections assume tenant exists

## Required Changes (Phase 2)

### Server
1. **Remove auto-selection**: Never set tenant when `memberships.length === 1`
2. **Add set-tenant endpoint**: `POST /api/admin/impersonation/set-tenant`
3. **Response shape**: Impersonation start always returns `tenant: null` initially

### Client
1. **Create /app/select-tenant page**: Show impersonated user's tenant memberships
2. **Update AppRouterSwitch**: Redirect to /app/select-tenant when impersonation.active && tenant is null
3. **Update ImpersonationBanner**: Show "Tenant: (none)" when null
4. **Update TenantContext**: Handle nullable tenant gracefully
