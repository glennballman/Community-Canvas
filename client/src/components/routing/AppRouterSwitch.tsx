/**
 * AppRouterSwitch - Centralized router ownership for /app/* routes
 * 
 * NON-NEGOTIABLE INVARIANT: At runtime, for any given pathname, 
 * only ONE layout/router branch may decide redirects.
 * 
 * This component is the SINGLE source of truth for:
 * - Impersonation redirect from /app/platform/* to /app
 * - Choosing between PlatformLayout vs TenantAppLayout
 * 
 * RULE: TenantLayout must NEVER redirect to /app/platform automatically.
 * RULE: PlatformLayout must NOT contain impersonation redirect logic.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
      { pathname: location.pathname, authReady, impersonationActive: impersonation.active, navMode }
    );
  }, [location.pathname, authReady, impersonation.active, navMode]);

  // --------------------------------------------------------------------------
  // CENTRALIZED IMPERSONATION REDIRECT (Phase 2C-13.5)
  // 
  // INVARIANT: Impersonation has TWO independent dimensions:
  //   1) acting_user (impersonated user identity)
  //   2) tenant_context (selected tenant for operations)
  // 
  // Cases:
  // A) If impersonation.active AND tenant is NULL AND NOT on /app/select-tenant:
  //    - Redirect to /app/select-tenant
  // B) If impersonation.active AND pathname starts with /app/platform:
  //    - Redirect to /app (or /app/select-tenant if no tenant)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!authReady) return;
    
    const isPlatformPath = location.pathname.startsWith('/app/platform');
    const isSelectTenantPath = location.pathname === '/app/select-tenant';
    const hasTenant = !!impersonation.tenant;
    
    // Case A: Impersonating with no tenant selected - need to pick one
    if (impersonation.active && !hasTenant && !isSelectTenantPath && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      throttledLog(
        'AppRouterSwitch-redirect',
        '[AppRouterSwitch] Redirect fired:',
        { from: location.pathname, to: '/app/select-tenant', reason: 'impersonation active but no tenant selected' }
      );
      navigate('/app/select-tenant', { replace: true });
      return;
    }
    
    // Case B: Impersonating with tenant on platform path - redirect to tenant app
    if (impersonation.active && hasTenant && isPlatformPath && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      throttledLog(
        'AppRouterSwitch-redirect',
        '[AppRouterSwitch] Redirect fired:',
        { from: location.pathname, to: '/app', reason: 'impersonation active on platform path' }
      );
      navigate('/app', { replace: true });
    }
  }, [authReady, impersonation.active, impersonation.tenant, location.pathname, navigate]);

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

  // Render children (Outlet will be used by parent Routes)
  return <Outlet />;
}

export default AppRouterSwitch;
