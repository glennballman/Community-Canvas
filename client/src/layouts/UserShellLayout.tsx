/**
 * USER SHELL LAYOUT (Phase 2C-15H)
 * 
 * PURE layout shell for users without tenant context.
 * This layout is a route element in App.tsx, NOT an intercept.
 * 
 * Contains ONLY:
 * - Header with branding
 * - Impersonation banner (if active)
 * - Outlet for child routes
 * 
 * Child routes (like /app/places) render TenantPicker via Outlet.
 */

import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useNavigate } from 'react-router-dom';
import { dbg, shortUser, shortImp } from '@/lib/debugImpersonation';

export function UserShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { impersonation, token, refreshSession, logout, user, ready: authReady } = useAuth();
  const { currentTenant } = useTenant();
  const isImpersonating = impersonation?.active === true;
  const targetUser = impersonation?.target_user;
  
  // FORENSIC: Top-of-render dump
  dbg('[UserShellLayout/render]', {
    pathname: location.pathname,
    authReady,
    currentTenantId: currentTenant?.tenant_id || null,
    impersonation: shortImp(impersonation),
    user: shortUser(user),
  });

  async function handleEndImpersonation() {
    try {
      await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      queryClient.clear();
      await refreshSession();
      localStorage.removeItem('cc_view_mode');
      navigate('/app/platform', { replace: true });
    } catch (err) {
      console.error('Failed to stop impersonation:', err);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-background" data-testid="user-shell-layout">
      <header className="h-14 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Community Canvas</span>
        </div>
        <div className="flex items-center gap-4">
          {isImpersonating && (
            <>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                Viewing as: {targetUser?.display_name || targetUser?.email}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEndImpersonation}
                data-testid="button-end-impersonation"
              >
                End Session
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
}

export default UserShellLayout;
