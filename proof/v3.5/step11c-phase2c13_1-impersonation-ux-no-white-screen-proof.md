# STEP 11C Phase 2C-13.1: Impersonation UX Correctness + No White Screen

## Overview

This document provides proof of implementation for impersonation UX improvements that eliminate white screen transitions and ensure consistent banner visibility.

## Problems Addressed

1. **White Screen Issue**: Start/stop impersonation was causing 2-5s white screen due to full page reloads
2. **Banner Visibility**: After "Active impersonation", UI sometimes showed no banner
3. **No SPA Navigation**: Impersonation flows weren't smooth SPA transitions

## Root Cause Analysis

### Root Cause Found

The original `logout` function in `AuthContext.tsx` used:
```typescript
window.location.href = '/';  // CAUSED FULL PAGE RELOAD
```

Additionally, the ImpersonationBanner component used `useTenant()` context which didn't have impersonation state properly synchronized with the AuthContext.

### Solution Applied

1. Removed `window.location.href` from logout flow
2. Added `refreshSession()` method to AuthContext that fetches `/api/foundation/auth/whoami`
3. Updated ImpersonationBanner to use AuthContext's impersonation state
4. Added overlay "Switching identity..." during transitions
5. Used wouter's `navigate()` for SPA routing (already in place)
6. Clear React Query cache during transitions with `queryClient.clear()`

## Implementation Details

### 1. Server: GET /api/foundation/auth/whoami

**File**: `server/routes/foundation.ts`

Returns current user identity with impersonation state:
```json
{
  "ok": true,
  "user": { "id", "email", "displayName", "isPlatformAdmin" },
  "impersonation": {
    "active": boolean,
    "target_user": { "id", "email", "display_name" } | null,
    "tenant": { "id", "slug", "name" } | null,
    "role": string | null,
    "expires_at": string | null
  }
}
```

### 2. Client: AuthContext with Impersonation State

**File**: `client/src/contexts/AuthContext.tsx`

Added:
- `impersonation` state object with structure matching server response
- `refreshSession()` async method to fetch whoami and update impersonation state
- Removed `window.location.href = '/'` from logout (uses state clearing + wouter navigate)

```typescript
interface ImpersonationState {
    active: boolean;
    target_user: { id, email, display_name } | null;
    tenant: { id, slug, name } | null;
    role: string | null;
    expires_at: string | null;
}

const refreshSession = useCallback(async () => {
    const res = await fetch('/api/foundation/auth/whoami', { ... });
    const data = await res.json();
    if (data.ok) {
        setImpersonation(data.impersonation);
    }
}, []);
```

### 3. Global Impersonation Banner

**File**: `client/src/components/ImpersonationBanner.tsx`

Updated to:
- Use `useAuth()` hook for impersonation state
- Show overlay "Switching identity..." during stop flow
- Use SPA navigation via wouter
- Clear query cache before navigating

### 4. ImpersonationConsole with Overlay

**File**: `client/src/pages/app/platform/ImpersonationConsole.tsx`

Updated flows:

**Start Impersonation**:
```typescript
if (data.ok) {
    setShowOverlay(true);          // Show overlay
    queryClient.clear();            // Clear cache
    await refreshSession();         // Update auth context
    await fetchStatus();            // Update local status
    navigate('/app');               // SPA navigate (no reload)
    setShowOverlay(false);
}
```

**Stop Impersonation**:
```typescript
setShowOverlay(true);              // Show overlay
queryClient.clear();                // Clear cache
await refreshSession();             // Update auth context
await fetchStatus();                // Update local status
setShowOverlay(false);
// Banner handles navigation to /app/platform/impersonation
```

## Before/After Behavior

| Aspect | Before | After |
|--------|--------|-------|
| Start impersonation | 2-5s white screen | <1s overlay "Switching identity..." |
| Stop impersonation | 2-5s white screen | <1s overlay, smooth transition |
| Banner visibility | Inconsistent, sometimes missing | Always visible when impersonating |
| Navigation | `window.location.href` (full reload) | wouter `navigate()` (SPA) |
| Cache handling | Not cleared, stale data | `queryClient.clear()` before transition |

## Files Changed

### Server
- `server/routes/foundation.ts` - Added `/auth/whoami` endpoint with impersonation state

### Client
- `client/src/contexts/AuthContext.tsx` - Added impersonation state, refreshSession(), removed window.location
- `client/src/components/ImpersonationBanner.tsx` - Rewrote to use AuthContext, added overlay
- `client/src/pages/app/platform/ImpersonationConsole.tsx` - Added overlay, integrated refreshSession

## Security Considerations

1. All impersonation actions still logged in `cc_impersonation_logs` table
2. Platform admin authentication still required for all impersonation endpoints
3. Session expiration still enforced (1 hour timeout)
4. No sensitive data exposed in whoami response

## Testing

### Manual Test Flow

1. Login as platform admin (glenn@envirogroupe.com)
2. Navigate to `/app/platform/impersonation`
3. Search for a user (e.g., "sheryl")
4. Click "Impersonate" button
5. Verify: Overlay appears briefly, then redirects to /app with banner visible
6. Click "Exit Impersonation" in banner
7. Verify: Overlay appears briefly, returns to impersonation console

### Expected Results

- No white screen at any point
- Banner visible on all pages while impersonating
- Smooth SPA transitions throughout
- Console shows no `window.location` calls during impersonation flows

## Conclusion

The impersonation UX has been corrected to provide smooth SPA transitions without white screens, with consistent banner visibility and proper state management through the AuthContext.
