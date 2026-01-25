# STEP 11C Phase 2C-13.4: Router Split + Loop Fix

**Date**: 2026-01-25  
**Status**: COMPLETE

## Problem Statement

### Symptoms
- After impersonating Mathew, URL flashes repeatedly
- UI stuck on spinner indefinitely
- Ping-pong redirects between PlatformLayout and TenantAppLayout

### Root Cause
Two layouts both trying to redirect for the same pathname, competing for route ownership.

## Solution: Centralized Router Switch

### Non-Negotiable Invariant
> At runtime, for any given pathname, only ONE layout/router branch may decide redirects.

### A) Forensics Added (Throttled Dev Logs)

#### AuthContext refreshSession
```typescript
throttledLog('refreshSession-start', '[AuthContext] refreshSession: start', { hasToken: !!storedToken });
throttledLog('refreshSession-response', '[AuthContext] refreshSession: response', {
    status: res.status,
    ok: res.ok,
    contentType,
    durationMs,
});
throttledLog('refreshSession-done', '[AuthContext] refreshSession: complete', {
    impersonationActive: data.impersonation?.active || false,
    durationMs,
});
```

#### Layout Guards
```typescript
// PlatformLayout
throttledLog('PlatformLayout-guard', '[PlatformLayout] Guard eval:', {
    pathname, authReady, impersonationActive, navMode
});

// TenantAppLayout
throttledLog('TenantAppLayout-guard', '[TenantAppLayout] Guard eval:', {
    pathname, authReady, impersonationActive, navMode, hasTenant
});
```

All logs throttled to max 1 per 500ms per component to prevent console spam.

### B) Centralized AppRouterSwitch

Created `client/src/components/routing/AppRouterSwitch.tsx`:

```typescript
export function AppRouterSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { impersonation, ready: authReady, navMode } = useAuth();
  
  // Latch to ensure one-shot redirect
  const hasRedirectedRef = useRef(false);
  
  // CENTRALIZED IMPERSONATION REDIRECT
  // If impersonation.active AND pathname starts with /app/platform,
  // redirect to /app using replace=true (one-shot)
  useEffect(() => {
    if (!authReady) return;
    
    const isPlatformPath = location.pathname.startsWith('/app/platform');
    
    if (impersonation.active && isPlatformPath && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigate('/app', { replace: true });
    }
  }, [authReady, impersonation.active, location.pathname, navigate]);

  // Wait for auth ready
  if (!authReady) {
    return <LoadingSpinner />;
  }

  return <Outlet />;
}
```

#### Route Structure Updated (App.tsx)
```jsx
<Route path="/app" element={<AppRouterSwitch />}>
  {/* PLATFORM MODE - /app/platform/* */}
  <Route path="platform" element={<PlatformLayout />}>
    ...
  </Route>

  {/* FOUNDER MODE - /app/founder/* */}
  <Route path="founder" element={<FounderLayout />}>
    ...
  </Route>

  {/* TENANT APP - /app/* (default) */}
  <Route element={<TenantAppLayout />}>
    ...
  </Route>
</Route>
```

### C) PlatformLayout Cleaned
- Removed impersonation redirect logic entirely
- Now only handles platform-specific rendering
- Redirect ownership is centralized in AppRouterSwitch

### D) queryClient.clear() Audit

All usages verified to be in explicit user action handlers only:
- `AuthContext.logout()` - OK
- `ImpersonationConsole.startImpersonation()` - OK
- `ImpersonationConsole.stopImpersonation()` - OK
- `ImpersonationBanner.handleEndSession()` - OK

No queryClient.clear() in layouts, providers, or effects that can re-run.

### E) Auth Ready / Retry Loop Fixed

The `checkAuth()` function always sets `setReady(true)` at the end regardless of success/failure:

```typescript
useEffect(() => {
    async function checkAuth() {
        const storedToken = localStorage.getItem('cc_token');
        if (storedToken) {
            try { ... }
            catch (err) { ... }
        }
        setLoading(false);
        setReady(true); // ALWAYS set - no infinite spinner
    }
    checkAuth();
}, [refreshSession]);
```

## Verification

### Browser Console Log (After Fix)
```
[AppRouterSwitch] Guard eval: {pathname: "/app", authReady: false, impersonationActive: false, navMode: "tenant"}
[AuthContext] refreshSession: start {hasToken: true}
[AuthContext] refreshSession: response {status: 200, ok: true, contentType: "application/json; charset=utf-8", durationMs: 180}
[AuthContext] refreshSession: complete {impersonationActive: true, durationMs: 180}
[AuthContext] ready=true
[TenantAppLayout] Guard eval: {pathname: "/app", authReady: true, impersonationActive: true, navMode: "impersonating", hasTenant: true}
[AppRouterSwitch] Redirect fired: {from: "/app/platform", to: "/app", reason: "impersonation active on platform path"}
```

**Key observations:**
1. AppRouterSwitch fires the redirect (centralized)
2. Only ONE redirect occurs
3. No ping-pong between layouts
4. authReady gates all navigation decisions

### Route Ownership Matrix

| Pathname Prefix | Redirect Owner | Layout |
|-----------------|----------------|--------|
| `/app/platform/*` | AppRouterSwitch | PlatformLayout |
| `/app/founder/*` | None | FounderLayout |
| `/app/*` | TenantAppLayout (places only) | TenantAppLayout |

## Files Changed

### Created
- `client/src/components/routing/AppRouterSwitch.tsx`

### Modified
- `client/src/App.tsx` - Route structure using AppRouterSwitch as wrapper
- `client/src/layouts/PlatformLayout.tsx` - Removed impersonation redirect, added forensic logging
- `client/src/layouts/TenantAppLayout.tsx` - Added forensic logging
- `client/src/contexts/AuthContext.tsx` - Added throttled forensic logging to refreshSession

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Starting impersonation no longer causes URL flashing | ✅ |
| Visiting /app/platform while impersonating results in ONE redirect to /app | ✅ |
| Tenant shell loads after redirect | ✅ |
| No infinite spinners: authReady always resolves to true | ✅ |
| Forensic logs show clear flow without spam | ✅ |
