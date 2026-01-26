# Phase 2C-15E: Impersonation Route Ownership Fix

**Date**: January 26, 2026  
**Author**: Platform Engineer  
**Status**: COMPLETE

---

## Problem Statement

When `impersonation.active === true` and `tenant_context === NULL`, the Platform Admin UI was rendering at `/app/platform/*`. This is a critical invariant violation.

**Screenshot Evidence**: Shows Platform Admin layout rendering while impersonation banner shows "IMPERSONATING: Mathew Vetten | Tenant: (none selected)"

## Goal

**HARD INVARIANT (P0)**: If `impersonation.active === true`:
- PlatformLayout MUST NEVER render
- `/app/platform/*` routes MUST redirect to `/app`
- "Platform Admin" nav must not be visible while impersonating

---

## Forensic Audit

### A) Where PlatformLayout Can Mount

| Location | How Mounted | Guarded? |
|----------|-------------|----------|
| `client/src/App.tsx:403` | `<Route path="platform" element={<PlatformLayout />}>` inside AppRouterSwitch's Outlet | NOW GUARDED |

### B) Router Branches for /app/platform/*

1. **App.tsx:397** - `<Route path="/app" element={<AppRouterSwitch />}>` is the parent
2. **App.tsx:403-422** - Platform routes are children of AppRouterSwitch
3. **AppRouterSwitch** renders `<Outlet />` which then renders PlatformLayout

### C) Route Match Order

1. `/app/*` matches `<Route path="/app" element={<AppRouterSwitch />}>`
2. AppRouterSwitch evaluates guards in useEffect
3. If guards pass, `<Outlet />` renders child routes
4. `/app/platform` matches `<Route path="platform" element={<PlatformLayout />}>`

### D) Root Cause

The bug was in **AppRouterSwitch.tsx line 85** (before fix):
```typescript
// OLD (BUGGY):
if (impersonation.active && hasTenant && isPlatformPath && !hasRedirectedRef.current)
```

This only redirected when `impersonation.active && hasTenant` - meaning impersonation WITHOUT tenant did not trigger the redirect!

Additionally, `shouldShowUserShell` (line 118-121) explicitly excluded `isPlatformPath`:
```typescript
const shouldShowUserShell = 
  impersonation.active && 
  !currentTenant &&
  !isPlatformPath &&  // <-- This allowed platform path to fall through!
  !isFounderPath &&
  !isSelectTenantPath;
```

---

## Fixes Applied

### Fix 1: AppRouterSwitch.tsx - Redirect ALL platform routes during impersonation

**File**: `client/src/components/routing/AppRouterSwitch.tsx`

```diff
- // Impersonating with tenant on platform path - redirect to tenant app
- if (impersonation.active && hasTenant && isPlatformPath && !hasRedirectedRef.current) {
+ // Phase 2C-15E: Impersonation BLOCKS all platform routes (regardless of tenant)
+ // PlatformLayout must NEVER render during impersonation
+ if (impersonation.active && isPlatformPath && !hasRedirectedRef.current) {
```

**Key Change**: Removed `hasTenant` condition - now redirects regardless of tenant state.

### Fix 2: PlatformLayout.tsx - Safety Net Guard

**File**: `client/src/layouts/PlatformLayout.tsx`

Added hard guard that:
1. Logs invariant violation in dev mode (with stack trace, once)
2. Redirects to `/app` using navigate (with latch to prevent loops)
3. Shows "Redirecting..." placeholder while redirect is in progress

```typescript
// Phase 2C-15E: HARD INVARIANT - PlatformLayout must NEVER render during impersonation
useEffect(() => {
  if (!authReady) return;
  
  if (impersonation.active) {
    // DEV ONLY: Log invariant violation once (with stack trace)
    if (import.meta.env.DEV && !hasLoggedInvariantViolation) {
      hasLoggedInvariantViolation = true;
      console.error(
        '[PlatformLayout] INVARIANT VIOLATION: PlatformLayout rendered during impersonation!',
        { pathname: location.pathname, impersonation: impersonation.active },
        new Error().stack
      );
    }
    
    // Safety-net redirect - navigate to /app
    if (!hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigate('/app', { replace: true });
    }
  }
}, [authReady, impersonation.active, location.pathname, navigate]);

// If impersonation is active, show redirecting placeholder
if (impersonation.active) {
  return <div>Redirecting...</div>;
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `client/src/components/routing/AppRouterSwitch.tsx` | Removed `hasTenant` condition from platform redirect - now blocks ALL platform routes during impersonation |
| `client/src/layouts/PlatformLayout.tsx` | Added safety-net guard with dev-mode invariant violation logging and redirect to /app |

---

## Acceptance Checks

### Test 1: Normal Platform Admin Access (not impersonating)
1. Glenn logs in as platform admin
2. Navigate to `/app/platform`
3. **Expected**: PlatformLayout renders normally

### Test 2: Start Impersonation → Land at /app
1. From Platform Admin, impersonate Mathew (no tenant selected)
2. **Expected**: Lands at `/app` (UserShellLayout), NOT at `/app/platform`

### Test 3: Manual Navigation to Platform During Impersonation
1. While impersonating, manually navigate to `/app/platform`
2. **Expected**: Forced redirect back to `/app` (UserShellLayout)
3. **Expected**: No Platform Admin UI visible

### Test 4: Stop Impersonation → Platform Accessible Again
1. Click "Exit Impersonation"
2. Navigate to `/app/platform`
3. **Expected**: PlatformLayout renders normally

---

## Invariant Checklist

| Invariant | Enforcement |
|-----------|-------------|
| PlatformLayout NEVER renders during impersonation | AppRouterSwitch redirect + PlatformLayout safety guard |
| /app/platform/* redirects to /app during impersonation | AppRouterSwitch useEffect redirect |
| Dev-mode logs invariant violation with stack trace | PlatformLayout console.error (once per impersonation session) |
| No redirect loops | Latch refs in both components |

---

## Proof Complete
