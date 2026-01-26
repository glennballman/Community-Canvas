/**
 * AppRouterSwitch - Centralized router ownership for /app/* routes
 * 
 * NON-NEGOTIABLE INVARIANT: At runtime, for any given pathname, 
 * only ONE layout/router branch may decide redirects.
 * 
 * This component is the SINGLE source of truth for:
 * - Impersonation redirect from /app/platform/* to /app
 * - Choosing between PlatformLayout vs TenantAppLayout vs UserShellLayout
 * 
 * RULE: TenantLayout must NEVER redirect to /app/platform automatically.
 * RULE: PlatformLayout must NOT contain impersonation redirect logic.
 * 
 * Phase 2C-15B: REMOVED forced redirect to /app/select-tenant
 * - Tenant selection is a USER ACTION, not a router mandate
 * - When impersonating with no tenant, UserShellLayout shows "Choose a Place" panel
 * 
 * Phase 2C-15D: INVARIANT - No tenant chrome without tenant context
 * - When impersonating with tenant_context=NULL, UserShellLayout mounts for ALL /app/* routes
 * - TenantAppLayout is UNREACHABLE when impersonating without tenant
 * - No tenant name appears in any header/banner when tenant_context=NULL
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { UserShellLayout } from '@/layouts/UserShellLayout';

// Throttle helper to prevent console spam
const throttleTimestamps: Record<string, number> = {};
function throttledLog(key: string, ...args: unknown[]) {
  if (process.env.NODE_ENV !== 'development') return;
  const now = Date.now();
  if (!throttleTimestamps[key] || now - throttleTimestamps[key] > 500) {
    throttleTimestamps[key] = now;
    console.debug(...args);
  }
}

export function AppRouterSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { impersonation, ready: authReady, navMode, hasTenantMemberships } = useAuth();
  const { currentTenant } = useTenant();
  
  // Latch to ensure one-shot redirect
  const hasRedirectedRef = useRef(false);
  
  // Reset latch when impersonation state changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [impersonation.active]);

  // Log guard evaluation (throttled)
  useEffect(() => {
    throttledLog(
      'AppRouterSwitch-guard',
      '[AppRouterSwitch] Guard eval:',
      { pathname: location.pathname, authReady, impersonationActive: impersonation.active, navMode, hasTenant: !!currentTenant }
    );
  }, [location.pathname, authReady, impersonation.active, navMode, currentTenant]);

  // --------------------------------------------------------------------------
  // CENTRALIZED IMPERSONATION REDIRECT (Phase 2C-15E)
  // 
  // INVARIANT: Impersonation has TWO independent dimensions:
  //   1) acting_user (impersonated user identity)
  //   2) tenant_context (selected tenant for operations)
  // 
  // HARD INVARIANT (P0):
  //   If impersonation.active === true, /app/platform/* is FORBIDDEN.
  //   PlatformLayout must NEVER render during impersonation.
  // 
  // REMOVED: Forced redirect to /app/select-tenant
  //   - UserShellLayout now handles tenant-less state gracefully
  //   - User sees "Choose a Place" panel, not a forced redirect
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!authReady) return;
    
    const isPlatformPath = location.pathname.startsWith('/app/platform');
    
    // Phase 2C-15E: Impersonation BLOCKS all platform routes (regardless of tenant)
    // PlatformLayout must NEVER render during impersonation
    if (impersonation.active && isPlatformPath && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      throttledLog(
        'AppRouterSwitch-redirect',
        '[AppRouterSwitch] Redirect fired:',
        { from: location.pathname, to: '/app', reason: 'impersonation active - platform routes blocked' }
      );
      navigate('/app', { replace: true });
    }
  }, [authReady, impersonation.active, location.pathname, navigate]);

  // Show loading until auth is ready
  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // Phase 2C-15D: Routes that keep their specialized layouts even during impersonation
  // Platform and Founder paths have their own dedicated layouts
  const isPlatformPath = location.pathname.startsWith('/app/platform');
  const isFounderPath = location.pathname.startsWith('/app/founder');
  const isSelectTenantPath = location.pathname.startsWith('/app/select-tenant');
  
  // Phase 2C-15D: INVARIANT - When impersonating without tenant:
  // - UserShellLayout renders for ALL /app/* routes (except platform/founder/select-tenant)
  // - TenantAppLayout must NOT render (no tenant nav/modules)
  // - /app/places now also uses UserShellLayout during impersonation without tenant
  const shouldShowUserShell = 
    impersonation.active && 
    !currentTenant &&
    !isPlatformPath &&
    !isFounderPath &&
    !isSelectTenantPath;
  
  if (shouldShowUserShell) {
    throttledLog(
      'AppRouterSwitch-usershell',
      '[AppRouterSwitch] Rendering UserShellLayout:',
      { pathname: location.pathname, reason: 'impersonation active without tenant' }
    );
    return <UserShellLayout />;
  }

  // Render children (Outlet will be used by parent Routes)
  return <Outlet />;
}

export default AppRouterSwitch;
