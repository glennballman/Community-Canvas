# Phase 2C-15B: Impersonation Consistency + UserShell + Logout Fix

**Date**: January 25, 2026  
**Author**: Platform Engineer  
**Status**: COMPLETE (with architect review iterations)

---

## Summary of Changes

This phase implements minimal, deterministic fixes based on the Phase 2C-15A audit findings:

1. **ISSUE-1 Fixed**: `/api/me/context` is now impersonation-aware
2. **ISSUE-2 Fixed**: Created UserShellLayout for tenant-less state
3. **ISSUE-3 Fixed**: All logout routes use `AuthContext.logout()`
4. **ISSUE-4 Fixed**: Created canonical `ImpersonationState` type

---

## A) Fix ISSUE-1: /api/me/context Now Impersonation-Aware

### Before

```
GET /api/me/context (while impersonating Mathew as Glenn)

Response:
{
  user: { id: "glenn-id", email: "glenn@...", is_platform_admin: true },  // REAL user
  memberships: []  // Glenn's memberships (empty)
}
```

### After

```
GET /api/me/context (while impersonating Mathew as Glenn)

Response:
{
  ok: true,
  user: { id: "mathew-id", email: "mathew@...", is_platform_admin: false },  // IMPERSONATED user
  memberships: [
    { tenant_id: "...", tenant_name: "Woods End Landing", role: "tenant_admin" }
  ],  // Mathew's memberships
  impersonation: {
    active: true,
    target_user: { id: "mathew-id", email: "mathew@...", display_name: "Mathew Vetten" },
    tenant_id: null,
    tenant_name: null,
    tenant_slug: null,
    role: null,
    expires_at: "2026-01-25T..."
  }
}
```

### Implementation

File: `server/routes/user-context.ts`

Added helper logic:
```typescript
const isImpersonating = impersonation?.impersonated_user_id && 
  impersonation?.expires_at && 
  new Date(impersonation.expires_at) > new Date();

// Use effective user ID for memberships
const effectiveUserId = isImpersonating 
  ? impersonation.impersonated_user_id 
  : realUserId;
```

---

## B) Fix ISSUE-4: Canonical ImpersonationState Type

### File Created: `client/src/types/session.ts`

```typescript
export interface ImpersonationState {
  active: boolean;
  target_user: {
    id: string;
    email: string;
    display_name?: string;
  } | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  role: string | null;
  expires_at: string | null;
}

export const defaultImpersonation: ImpersonationState = {
  active: false,
  target_user: null,
  tenant_id: null,
  tenant_name: null,
  tenant_slug: null,
  role: null,
  expires_at: null,
};
```

### Usage

- AuthContext: Uses canonical shape from `/api/foundation/auth/whoami`
- TenantContext: Uses canonical shape from `/api/me/context`
- Both contexts now return consistent `impersonation` objects

---

## C) Fix ISSUE-2: UserShellLayout Created

### File Created: `client/src/layouts/UserShellLayout.tsx`

Features:
- Shows impersonation banner when active
- Displays "Choose a Place" panel with membership list
- Provides "Enter" buttons to set tenant context
- Does NOT force redirect to `/app/select-tenant`

### TenantContext Refactored (Phase 2C-15B Revision)

TenantContext now imports and uses the canonical type:
```typescript
import { 
  ImpersonationState, 
  defaultImpersonation, 
  parseImpersonationResponse 
} from '@/types/session';

// Uses impersonation.active (canonical) instead of is_impersonating
const endpoint = impersonation.active 
  ? '/api/admin/impersonation/set-tenant'
  : '/api/me/switch-tenant';
```

### AppRouterSwitch Now Branches to UserShellLayout

```typescript
const shouldShowUserShell = 
  impersonation.active && 
  !currentTenant &&
  !isPlatformPath &&
  !isFounderPath &&
  !isSelectTenantPath &&
  !isPlacesPath;

if (shouldShowUserShell) {
  return <UserShellLayout />;
}
```

---

## D) Routing Decision Tree

### Before (Phase 2C-13.5)

```
AppRouterSwitch:
├── If !authReady → Loading
├── If impersonation.active && !tenant && !isSelectTenantPath 
│   → REDIRECT to /app/select-tenant (FORCED)
├── If impersonation.active && hasTenant && isPlatformPath
│   → Redirect to /app
└── Else → Render Outlet
```

### After (Phase 2C-15B Revision)

```
AppRouterSwitch:
├── If !authReady → Loading
├── If impersonation.active && hasTenant && isPlatformPath
│   → Redirect to /app
├── If impersonation.active && !tenant && !platformPath && !founderPath && !selectTenantPath && !placesPath
│   → Render UserShellLayout (NEW)
└── Else → Render Outlet

UserShellLayout:
├── Shows impersonation banner if active
├── Displays "Choose a Place" panel with membership list
├── Uses impersonation.active (canonical) for endpoint selection
└── Does NOT force redirect to any path
```

**Key Change**: AppRouterSwitch now BRANCHES to UserShellLayout when impersonating without tenant,
instead of forcing redirect. This preserves the two-dimensional impersonation model.

---

## E) Fix ISSUE-3: Logout Uses AuthContext.logout()

### Files Updated

1. `client/src/layouts/PlatformLayout.tsx`
2. `client/src/layouts/FounderLayout.tsx`

### Before

```typescript
const handleLogout = () => {
  window.location.href = '/api/logout';  // BROKEN - endpoint doesn't exist
};
```

### After

```typescript
const handleLogout = async () => {
  await logout();  // Uses AuthContext.logout()
  navigate('/');
};
```

---

## F) Verification

### Server Log Evidence

```
GET /api/me/context 304 :: {
  "ok":true,
  "user":{"id":"bfe4be8c-...","email":"mathew@woodsendlanding.com","full_name":"Mathew Vetten","is_platform_admin":false},
  "memberships":[{"tenant_id":"d0000000-...","tenant_name":"Woods End Landing",...}],
  "impersonation":{"active":true,"target_user":{"id":"bfe4be8c-...","email":"mathew@woodsendlanding.com","display_name":"Mathew Vetten"},"tenant_id":null,...}
}
```

This confirms:
- `user` is impersonated user (Mathew), not real user (Glenn)
- `memberships` are impersonated user's memberships
- `impersonation.active = true` with proper target_user

---

## G) Non-Negotiables Verification

| Requirement | Status |
|-------------|--------|
| No auto tenant selection | ✅ `selectedTenant` remains NULL if no `tenant_id` in request |
| No forced redirect to /app/select-tenant | ✅ Removed from AppRouterSwitch |
| One canonical impersonation state shape | ✅ `client/src/types/session.ts` |
| Minimal/additive changes | ✅ No broad refactors |

---

## H) Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `server/routes/user-context.ts` | Modified | Added impersonation-aware membership lookup |
| `client/src/types/session.ts` | Created | Canonical ImpersonationState type with parseImpersonationResponse |
| `client/src/layouts/UserShellLayout.tsx` | Created | Tenant-less shell with place picker |
| `client/src/layouts/PlatformLayout.tsx` | Modified | Fixed logout to use AuthContext |
| `client/src/layouts/FounderLayout.tsx` | Modified | Fixed logout to use AuthContext |
| `client/src/components/routing/AppRouterSwitch.tsx` | Modified | Removed forced redirect, now branches to UserShellLayout |
| `client/src/contexts/TenantContext.tsx` | Modified | Uses canonical ImpersonationState, parseImpersonationResponse, and impersonation.active |

## I) Architect Review Issues Addressed

| Issue | Fix Applied |
|-------|-------------|
| UserShellLayout not actually used | AppRouterSwitch now branches to UserShellLayout when impersonating without tenant |
| Canonical type not consistently applied | TenantContext imports and uses ImpersonationState from @/types/session |
| switchTenant uses is_impersonating | Now uses impersonation.active (canonical property) |
