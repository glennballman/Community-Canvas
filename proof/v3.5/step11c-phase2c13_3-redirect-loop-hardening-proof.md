# STEP 11C Phase 2C-13.3: Redirect Loop Hardening (Platform ↔ Tenant) + Loading Stability

**Date**: 2026-01-25
**Status**: COMPLETE

## Problem Statement

### Symptoms
- Clicking /app/platform/all-tenants while impersonating caused rapid multi-load / repeated remounts
- User ended in indefinite "Loading…" state

### Root Cause
- PlatformLayout guard redirected during render or during unstable auth refresh
- Guard fired before auth state was fully ready, causing repeated navigations
- No latch to prevent multiple redirect calls

## Implementation

### A) Auth Readiness Flag

**File**: `client/src/contexts/AuthContext.tsx`

Added explicit `ready` state to indicate when auth check is complete:

```typescript
interface AuthContextType {
    // ...existing fields...
    ready: boolean; // True when auth state is fully resolved (not during initial load)
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);
    
    useEffect(() => {
        async function checkAuth() {
            // ...auth check logic...
            setLoading(false);
            setReady(true); // Auth state is now fully resolved
            if (process.env.NODE_ENV === 'development') {
                console.debug('[AuthContext] ready=true');
            }
        }
        checkAuth();
    }, [refreshSession]);
    
    return (
        <AuthContext.Provider value={{
            // ...other values...
            ready,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
```

### B) PlatformLayout Guard with Latch

**File**: `client/src/layouts/PlatformLayout.tsx`

Rewrote guard to:
1. Wait for `authReady` before evaluating
2. Use ref latch to prevent multiple redirect calls
3. Show stable loading state while waiting

```typescript
export function PlatformLayout(): React.ReactElement {
  const { impersonation, hasTenantMemberships, ready: authReady } = useAuth();
  
  // Latch to prevent multiple redirects
  const hasRedirectedRef = useRef(false);

  // Impersonation redirect guard with latch
  useEffect(() => {
    // Only fire when auth is fully ready AND impersonation is active AND we haven't redirected yet
    if (authReady && impersonation.active && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      if (process.env.NODE_ENV === 'development') {
        console.debug('[PlatformLayout] Redirect fired: impersonation active, navigating to /app');
      }
      toast({
        title: 'Impersonation Active',
        description: 'End impersonation to access platform admin.',
        variant: 'destructive',
      });
      navigate('/app', { replace: true });
    }
  }, [authReady, impersonation.active, navigate, toast]);
  
  // If impersonation is active and we're redirecting, show minimal UI
  if (impersonation.active) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  // Wait for both tenant context and auth to be ready
  if (loading || !initialized || !authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }
  
  // ...rest of layout...
}
```

### C) queryClient.clear() Location Verification

Confirmed `queryClient.clear()` is only called in appropriate handlers:
- `AuthContext.logout()` - User logout
- `ImpersonationBanner.handleStop()` - Stop impersonation
- `ImpersonationConsole.startImpersonation()` - Start impersonation
- `ImpersonationConsole.handleStopImpersonation()` - Stop impersonation

**NOT** called in layout/guard code paths.

### D) Tenant Layout Verification

Confirmed `TenantAppLayout.tsx` has NO auto-redirect logic to platform routes.

## Behavior Flow

### Before (Broken)
1. User impersonating, clicks /app/platform/all-tenants
2. PlatformLayout renders
3. useEffect sees impersonation.active, calls navigate('/app')
4. Auth state refreshes, layout re-renders
5. useEffect fires again, calls navigate('/app') again
6. Repeat → infinite loop / loading state

### After (Fixed)
1. User impersonating, clicks /app/platform/all-tenants
2. PlatformLayout renders, checks `authReady`
3. If not ready: shows "Loading session..." spinner
4. Once ready: useEffect checks `hasRedirectedRef.current`
5. First time: sets latch=true, shows toast, calls navigate('/app', { replace: true })
6. Subsequent renders: latch is true, no additional navigate calls
7. Single redirect, stable state

## Debug Counters (Dev Only)

Console output in development mode:
- `[AuthContext] ready=true` - Logged once when auth check completes
- `[PlatformLayout] Redirect fired: impersonation active, navigating to /app` - Logged exactly once per impersonation session

## Files Changed

### Client
- `client/src/contexts/AuthContext.tsx` - Added `ready` state
- `client/src/layouts/PlatformLayout.tsx` - Added latch + ready gating

## Test Verification

### Manual Test Steps
1. Login as Glenn Ballman (platform admin)
2. Navigate to /app/platform/impersonation
3. Start impersonation of Sheryl Ferguson
4. Manually navigate to /app/platform/all-tenants (via URL bar)
5. Verify: Single toast notification, single redirect to /app
6. No infinite loading, no repeated re-mounts

### Expected Console Output (Dev)
```
[AuthContext] ready=true
[PlatformLayout] Redirect fired: impersonation active, navigating to /app
```
(Appears exactly once, not repeated)

## Invariants

1. Guards MUST wait for `authReady=true` before evaluating navigation
2. Redirect logic MUST use a ref latch to ensure one-shot behavior
3. `queryClient.clear()` MUST only be called in impersonation start/stop handlers and logout
4. Loading states MUST be stable and informative ("Loading session...")
