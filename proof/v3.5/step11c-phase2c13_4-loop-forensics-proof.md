# STEP 11C Phase 2C-13.4: Loop Forensics + Deterministic Router Split

**Date**: 2026-01-25
**Status**: COMPLETE

## Problem Statement

### Symptoms
- URL "flashing" repeatedly when navigating to platform routes during impersonation
- Stuck on spinner indefinitely

### Root Causes Identified

**A) Two layouts both trying to redirect (ping-pong)**
1. PlatformLayout saw `/app/platform/*` + impersonating → redirected to `/app`
2. TenantAppLayout saw `/app` but no `currentTenant` (briefly) → redirected to `/app/places`

**B) Guards firing before auth/session was stable**
- Both layouts evaluated redirect conditions before `authReady=true`
- This caused redirects based on incomplete state

## Solution

### 1. Unified Auth Readiness Gate

Both layouts now wait for `authReady` before making ANY redirect decisions:

```typescript
// PlatformLayout
const { impersonation, hasTenantMemberships, ready: authReady } = useAuth();

if (loading || !initialized || !authReady) {
  return <LoadingSpinner message="Loading session..." />;
}

// TenantAppLayout  
const { ready: authReady } = useAuth();

if (loading || !initialized || !authReady) {
  return <LoadingSpinner message="Loading session..." />;
}
```

### 2. Latch Pattern for Both Layouts

Both layouts use ref-based latches to ensure one-shot redirects:

```typescript
// PlatformLayout
const hasRedirectedRef = useRef(false);

useEffect(() => {
  if (authReady && impersonation.active && !hasRedirectedRef.current) {
    hasRedirectedRef.current = true;
    navigate('/app', { replace: true });
  }
}, [authReady, impersonation.active, navigate, toast]);

// TenantAppLayout
const hasRedirectedRef = useRef(false);

useEffect(() => {
  if (needsRedirectToPlaces && !hasRedirectedRef.current) {
    hasRedirectedRef.current = true;
    navigate('/app/places', { replace: true });
  }
}, [needsRedirectToPlaces, navigate]);
```

### 3. Debug Logging (Dev Mode)

```typescript
// PlatformLayout
console.debug('[PlatformLayout] Redirect fired: impersonation active, navigating to /app');

// TenantAppLayout
console.debug('[TenantAppLayout] Redirect fired: no tenant, navigating to /app/places');
```

## Route Ownership

| Route Pattern | Owning Layout | Redirect Rule |
|---------------|---------------|---------------|
| `/app/platform/*` | PlatformLayout | If impersonating → `/app` |
| `/app/founder/*` | FounderLayout | Login only |
| `/app/*` | TenantAppLayout | If no tenant & not special route → `/app/places` |

## Verification

### Browser Console (Dev Mode)
After fix, console shows:
```
[PlatformLayout] Redirect fired: impersonation active, navigating to /app
```
**Appears exactly once**, not repeated.

No `[TenantAppLayout] Redirect fired` messages when impersonating (because currentTenant is provided by impersonation).

### Network Tab
API calls are stable:
- `/api/foundation/auth/me` - 304 (cached)
- `/api/me/context` - 304 (cached)
- `/api/foundation/auth/whoami` - 304 (cached)

No rapid repetition of any endpoint.

## Key Invariants

1. **Route ownership is exclusive**: Only ONE layout handles routes for a given pathname prefix
2. **Auth readiness gate**: Guards don't evaluate until `authReady=true`
3. **One-shot redirects**: Ref latches ensure each redirect fires exactly once per mount
4. **Impersonation provides tenant**: When impersonating, `currentTenant` is synthesized from impersonation data immediately
5. **No queryClient.clear() in guards**: Cache clearing only in impersonation start/stop handlers

## Files Changed

### Client
- `client/src/contexts/AuthContext.tsx` - Added `ready` state
- `client/src/layouts/PlatformLayout.tsx` - Added latch + authReady gate
- `client/src/layouts/TenantAppLayout.tsx` - Added latch + authReady gate + debug logging

## Remaining Notes

There's a separate DB schema issue with `cc_impersonation_logs` table - the `impersonated_user_id` column doesn't exist. This is logged in server console but doesn't affect redirect behavior. Should be addressed separately.
