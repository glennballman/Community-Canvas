/**
 * PLATFORM LAYOUT
 * 
 * Layout for Platform Admin mode: /app/platform/*
 * Uses PLATFORM_NAV as the single source of truth.
 * Does NOT show tenant-requiring sections.
 * 
 * Phase 2C-15E HARD INVARIANT:
 * If impersonation.active === true, this layout must NEVER render.
 * AppRouterSwitch should redirect away before we get here, but this
 * layout includes a safety-net guard that redirects to /app.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { ViewModeToggle } from '../components/routing/ViewModeToggle';
import { getPlatformNavSections } from '../lib/routes/platformNav';
import { dbg, shortUser, shortImp } from '@/lib/debugImpersonation';

// Throttle helper for forensic logs
const throttleTimestamps: Record<string, number> = {};
function throttledLog(key: string, ...args: unknown[]) {
  if (process.env.NODE_ENV !== 'development') return;
  const now = Date.now();
  if (!throttleTimestamps[key] || now - throttleTimestamps[key] > 500) {
    throttleTimestamps[key] = now;
    console.debug(...args);
  }
}

// DEV ONLY: Track if we've already logged the invariant violation
let hasLoggedInvariantViolation = false;

export function PlatformLayout(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, initialized } = useTenant();
  const { impersonation, hasTenantMemberships, ready: authReady, navMode, logout } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Latch to prevent redirect loops
  const hasRedirectedRef = useRef(false);

  const sections = getPlatformNavSections({ hasTenantMemberships });
  
  // FORENSIC: Top-of-render dump
  dbg('[PlatformLayout/render]', {
    pathname: location.pathname,
    authReady,
    loading,
    initialized,
    impersonation: shortImp(impersonation),
    user: shortUser(user),
  });
  
  // --------------------------------------------------------------------------
  // Phase 2C-15E: HARD INVARIANT - PlatformLayout must NEVER render during impersonation
  // 
  // This is a SAFETY NET. AppRouterSwitch should redirect away before we get here.
  // If we DO get here during impersonation, log an error and redirect immediately.
  // --------------------------------------------------------------------------
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
        throttledLog(
          'PlatformLayout-impersonation-redirect',
          '[PlatformLayout] Safety redirect to /app (impersonation active)'
        );
        navigate('/app', { replace: true });
      }
    }
  }, [authReady, impersonation.active, location.pathname, navigate]);
  
  // Reset redirect latch when impersonation ends
  useEffect(() => {
    if (!impersonation.active) {
      hasRedirectedRef.current = false;
      hasLoggedInvariantViolation = false;
    }
  }, [impersonation.active]);
  
  // Forensic logging (throttled) - MUST be before any conditional returns
  useEffect(() => {
    throttledLog(
      'PlatformLayout-guard',
      '[PlatformLayout] Guard eval:',
      { pathname: location.pathname, authReady, impersonationActive: impersonation.active, navMode }
    );
  }, [location.pathname, authReady, impersonation.active, navMode]);

  // Phase 2C-15E: If impersonation is active, show redirecting placeholder
  // (The useEffect above handles the actual navigation)
  if (impersonation.active) {
    // FORENSIC: Log early return
    dbg('[PlatformLayout/early:impersonating]', {
      pathname: location.pathname,
      impersonation: shortImp(impersonation),
      authReady,
    });
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Wait for both tenant context and auth to be ready
  if (loading || !initialized || !authReady) {
    // FORENSIC: Log early return
    dbg('[PlatformLayout/early:notReadyOrLoading]', {
      pathname: location.pathname,
      loading,
      initialized,
      authReady,
      impersonation: shortImp(impersonation),
    });
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // FORENSIC: Log early return
    dbg('[PlatformLayout/early:noUser]', { pathname: location.pathname });
    navigate('/login', { state: { from: location.pathname } });
    return <></>;
  }

  if (!user.is_platform_admin) {
    // FORENSIC: Log early return
    dbg('[PlatformLayout/early:notAdmin]', { pathname: location.pathname, user: shortUser(user) });
    navigate('/app');
    return <></>;
  }

  const handleLogout = async () => {
    // Phase 2C-15B: Use AuthContext.logout() for reliable logout
    await logout();
    navigate('/');
  };

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';

  // FORENSIC: Log successful render
  dbg('[PlatformLayout/render:success]', { rendering: 'main layout', pathname: location.pathname });

  return (
    <div className="flex h-screen bg-background" data-testid="platform-layout">
      {/* Sidebar */}
      <aside
        className={`${sidebarWidth} flex-shrink-0 border-r border-border bg-sidebar flex flex-col transition-all duration-200`}
        data-testid="platform-sidebar"
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          {!sidebarCollapsed && (
            <Link to="/app/platform" className="flex items-center gap-2" data-testid="link-platform-home">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Platform</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              {!sidebarCollapsed && (
                <h3 className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href || 
                    (item.href !== '/app/platform' && location.pathname.startsWith(item.href));
                  
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      data-testid={item.testId}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Menu */}
        <div className="border-t border-border p-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              data-testid="button-user-menu"
            >
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              {!sidebarCollapsed && (
                <span className="truncate">{user?.full_name || user?.email || 'User'}</span>
              )}
            </button>
            
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                <Link
                  to="/app/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setUserMenuOpen(false)}
                  data-testid="link-settings"
                >
                  <User className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background flex-shrink-0">
          <div className="flex items-center gap-4">
            <ViewModeToggle />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 rounded">
              Platform Admin
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default PlatformLayout;
