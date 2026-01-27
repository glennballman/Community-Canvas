/**
 * TENANT APP LAYOUT
 * 
 * Used for: /app/* routes (excluding /app/platform/* and /app/founder/*)
 * 
 * Uses V3_NAV from v3Nav.ts as the single source of truth for navigation.
 * Navigation is filtered based on user context (role, tenant, portal, platform admin).
 * 
 * NOTE: Impersonation redirect logic is CENTRALIZED in AppRouterSwitch.
 * This layout does NOT redirect to /app/platform automatically.
 * 
 * Phase 2C-15D INVARIANT: This layout MUST NOT render when impersonating without tenant.
 * - AppRouterSwitch intercepts impersonation+no-tenant and renders UserShellLayout
 * - If this layout is reached with impersonation.active && !currentTenant, it's a bug
 * - Tenant name is ONLY derived from currentTenant, never from memberships or cache
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Outlet, 
  NavLink, 
  Link, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { PortalSelector } from '../components/PortalSelector';
import { ContextIndicator } from '../components/context/ContextIndicator';
import { ViewModeToggle } from '../components/routing/ViewModeToggle';
import { getFilteredNavSections, NavSection, NavItem } from '../lib/routes/v3Nav';

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

// ============================================================================
// TENANT TYPE ICONS (using lucide-react icons, not emojis)
// ============================================================================

import { Mountain, Landmark, Briefcase as BriefcaseIcon, User as UserIcon, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dbg, shortUser, shortImp } from '@/lib/debugImpersonation';

const TYPE_ICONS: Record<string, LucideIcon> = {
  community: Mountain,
  government: Landmark,
  business: BriefcaseIcon,
  individual: UserIcon,
};

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export function TenantAppLayout(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user, 
    memberships, 
    currentTenant, 
    loading, 
    initialized,
    // FORENSIC: Destructure impersonation from useTenant for logging
    switchTenant,
    impersonation,
  } = useTenant();
  const { ready: authReady, navMode, token, refreshSession } = useAuth();
  
  // FORENSIC: Top-of-render dump
  dbg('[TenantAppLayout/render]', {
    pathname: location.pathname,
    authReady,
    currentTenantId: currentTenant?.tenant_id || null,
    impersonation: shortImp(impersonation),
    user: shortUser(user),
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [clearingTenant, setClearingTenant] = useState(false);
  
  // Latch to prevent multiple redirects
  const hasRedirectedRef = useRef(false);

  // Messages unread count query (global badge)
  const { data: unreadData } = useQuery<{ ok: boolean; count: number }>({
    queryKey: ['/api/p2/dashboard/messages/unread-count'],
    enabled: !!user && !!currentTenant,
    staleTime: 30 * 1000,
    retry: 1,
  });
  const messagesUnreadCount = unreadData?.count || 0;

  // --------------------------------------------------------------------------
  // Computed values (before any hooks to avoid conditional hook calls)
  // --------------------------------------------------------------------------
  
  const isAtRoot = location.pathname === '/app' || location.pathname === '/app/';
  
  // Routes that can be accessed without a tenant selected
  // Note: /app/founder/* and /app/platform/* now have their own layouts
  const noTenantRoutes = ['/app/places', '/app/onboarding'];
  const isNoTenantRoute = noTenantRoutes.some(r => location.pathname.startsWith(r));
  
  // CRITICAL: Wait for authReady before making redirect decisions
  // During impersonation, currentTenant should be provided by TenantContext
  const needsRedirectToPlaces = authReady && !isAtRoot && !isNoTenantRoute && !currentTenant && initialized && !loading;

  // Forensic logging (throttled)
  useEffect(() => {
    throttledLog(
      'TenantAppLayout-guard',
      '[TenantAppLayout] Guard eval:',
      { pathname: location.pathname, authReady, impersonationActive: impersonation.active, navMode, hasTenant: !!currentTenant }
    );
  }, [location.pathname, authReady, impersonation.active, navMode, currentTenant]);

  // --------------------------------------------------------------------------
  // Auth redirect
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (initialized && !user) {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [initialized, user, navigate, location.pathname]);

  // --------------------------------------------------------------------------
  // Tenant redirect (when not at root and no tenant selected)
  // Redirect to places picker instead of /app root for cleaner UX
  // CRITICAL: Uses latch to prevent multiple redirects
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (needsRedirectToPlaces && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      if (process.env.NODE_ENV === 'development') {
        console.debug('[TenantAppLayout] Redirect fired: no tenant, navigating to /app/places');
      }
      navigate('/app/places', { replace: true });
    }
  }, [needsRedirectToPlaces, navigate]);

  // --------------------------------------------------------------------------
  // Loading state - wait for both tenant context and auth to be ready
  // --------------------------------------------------------------------------
  
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

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return <></>;
  }

  // --------------------------------------------------------------------------
  // Phase 2C-15D INVARIANT: TenantAppLayout should NOT be reached when
  // impersonating without tenant. AppRouterSwitch should intercept this case.
  // If we reach here in that state, log a warning in dev mode.
  // --------------------------------------------------------------------------
  if (import.meta.env.DEV && impersonation.active && !currentTenant && !isNoTenantRoute && !isAtRoot) {
    console.warn(
      '[TenantAppLayout] INVARIANT VIOLATION: Reached TenantAppLayout while impersonating without tenant.',
      { pathname: location.pathname, impersonation: !!impersonation.active, currentTenant: !!currentTenant }
    );
  }

  // --------------------------------------------------------------------------
  // Route handling
  // --------------------------------------------------------------------------
  
  // If at /app root, render the redirect component (without sidebar)
  if (isAtRoot && !currentTenant) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#060b15',
        color: 'white',
      }}>
        <Outlet />
      </div>
    );
  }

  // Routes that don't require a tenant (places, founder, platform) render with sidebar
  // Other routes require a tenant; if none selected, show helpful fallback
  if (!isNoTenantRoute && !isAtRoot && !currentTenant) {
    // Instead of empty fragment, show a helpful "Select Tenant" screen
    const isDev = import.meta.env.DEV;
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#060b15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '1rem',
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <Building2 style={{ width: 48, height: 48, margin: '0 auto', opacity: 0.5 }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Select a Tenant
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            You need to select a tenant/organization to access this page.
          </p>
          <button
            onClick={() => navigate('/app/places')}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '1rem',
            }}
            data-testid="button-go-places"
          >
            Go to Your Places
          </button>
          {isDev && (
            <div style={{ 
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '1rem',
              fontSize: '0.75rem',
              color: '#9ca3af',
            }}>
              <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Dev Mode:</p>
              <p>Use Debug Panel (bug icon) → Load Tenants → Set Tenant</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Navigation using V3_NAV (filtered by user context)
  // --------------------------------------------------------------------------
  
  // Normalize role strings to match V3_NAV tenantRolesAny values
  // API returns: 'owner', 'admin', 'operator', 'staff', 'member'
  // V3_NAV expects: 'tenant_owner', 'tenant_admin', 'operator', 'staff', 'member'
  function normalizeRole(role: string | undefined): string | undefined {
    if (!role) return undefined;
    if (role === 'owner') return 'tenant_owner';
    if (role === 'admin') return 'tenant_admin';
    return role;
  }

  const navSections = getFilteredNavSections({
    isAuthenticated: !!user,
    hasTenant: !!currentTenant,
    hasPortal: false,
    isPlatformAdmin: user?.is_platform_admin || false,
    tenantRole: normalizeRole(currentTenant?.role),
    portalRole: undefined,
    founderNavEnabled: false, // Founder mode now has its own layout
  });

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  async function handleSwitchTenant(tenantId: string) {
    try {
      await switchTenant(tenantId);
      setTenantDropdownOpen(false);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  }

  // Phase 2C-15C: Clear tenant context to return to UserShell home
  async function handleBackToUserHome() {
    if (!impersonation.active) return;
    
    setClearingTenant(true);
    try {
      const res = await fetch('/api/admin/impersonation/set-tenant', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: null }),
      });
      
      const data = await res.json();
      if (data.ok) {
        await refreshSession();
        navigate('/app');
      } else {
        console.error('Failed to clear tenant:', data.error);
      }
    } catch (err) {
      console.error('Failed to clear tenant context:', err);
    } finally {
      setClearingTenant(false);
    }
  }

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  const sidebarWidth = sidebarCollapsed ? '64px' : '256px';

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#060b15',
      color: 'white',
      display: 'flex',
    } as React.CSSProperties,
    
    sidebar: {
      width: sidebarWidth,
      height: '100vh',
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      backgroundColor: '#060b15',
      position: 'sticky',
      top: 0,
    } as React.CSSProperties,
    
    logo: {
      height: '64px',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,
    
    tenantSwitcher: {
      padding: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,
    
    sidebarTop: {
      flexShrink: 0,
    } as React.CSSProperties,
    
    nav: {
      flex: 1,
      padding: '8px',
      overflowY: 'auto',
      minHeight: 0,
    } as React.CSSProperties,
    
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 12px',
      borderRadius: '8px',
      color: '#9ca3af',
      textDecoration: 'none',
      fontSize: '14px',
      transition: 'all 0.15s ease',
      marginBottom: '4px',
      position: 'relative',
    } as React.CSSProperties,
    
    navItemActive: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      color: '#60a5fa',
    } as React.CSSProperties,
    
    bottomSection: {
      flexShrink: 0,
      borderTop: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,
    
    main: {
      flex: 1,
      overflow: 'auto',
    } as React.CSSProperties,
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div style={styles.container}>
      {/* ====== LEFT SIDEBAR ====== */}
      <aside style={styles.sidebar}>
        
        {/* Top Section - Always Visible */}
        <div style={styles.sidebarTop}>
          {/* Logo */}
          <div style={styles.logo}>
            <Link 
              to="/app" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                textDecoration: 'none',
                color: 'white',
              }}
            >
              <span style={{ fontSize: '20px' }}>🌐</span>
              {!sidebarCollapsed && (
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  Community Canvas
                </span>
              )}
            </Link>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Tenant Switcher */}
          {currentTenant && (
            <div style={styles.tenantSwitcher}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      const IconComponent = TYPE_ICONS[currentTenant.tenant_type] || Building2;
                      return <IconComponent size={18} className="flex-shrink-0" />;
                    })()}
                    {!sidebarCollapsed && (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: 500, 
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {currentTenant.tenant_name}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            textTransform: 'capitalize',
                          }}>
                            {currentTenant.tenant_type}
                          </div>
                        </div>
                        <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                      </>
                    )}
                  </div>
                </button>

                {/* Dropdown */}
                {tenantDropdownOpen && !sidebarCollapsed && (
                  <>
                    {/* Backdrop */}
                    <div 
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 40,
                      }}
                      onClick={() => setTenantDropdownOpen(false)} 
                    />
                    {/* Menu */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      marginTop: '4px',
                      backgroundColor: '#1a2744',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                      zIndex: 50,
                      maxHeight: '320px',
                      overflowY: 'auto',
                    }}>
                      {memberships.map((m) => (
                        <button
                          key={m.tenant_id}
                          onClick={() => handleSwitchTenant(m.tenant_id)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: 'none',
                            backgroundColor: m.tenant_id === currentTenant.tenant_id 
                              ? 'rgba(59, 130, 246, 0.2)' 
                              : 'transparent',
                            color: 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          {(() => {
                            const IconComponent = TYPE_ICONS[m.tenant_type] || Building2;
                            return <IconComponent size={16} className="flex-shrink-0" />;
                          })()}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontWeight: 500, 
                              fontSize: '14px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {m.tenant_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {m.tenant_type} • {m.role}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Portal Selector - for multi-portal tenants */}
          {currentTenant && !sidebarCollapsed && (
            <PortalSelector />
          )}
        </div>

        {/* Navigation - V3_NAV with sections (Scrollable) */}
        <nav style={styles.nav}>
          {navSections.map((section, sectionIndex) => (
            <div key={section.title} style={{ marginBottom: sectionIndex < navSections.length - 1 ? '16px' : 0 }}>
              {!sidebarCollapsed && (
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '8px 12px 4px',
                }}>
                  {section.title}
                </div>
              )}
              {section.items.map((item: NavItem) => {
                const isMessagesItem = item.href === '/app/messages';
                const showBadge = isMessagesItem && messagesUnreadCount > 0;
                
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    style={({ isActive }) => ({
                      ...styles.navItem,
                      ...(isActive ? styles.navItemActive : {}),
                    })}
                    title={sidebarCollapsed ? item.label : undefined}
                    data-testid={item.testId}
                  >
                    <item.icon size={20} />
                    {!sidebarCollapsed && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        {item.label}
                        {showBadge && (
                          <span
                            style={{
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '9999px',
                              minWidth: '18px',
                              textAlign: 'center',
                            }}
                            data-testid="badge-messages-unread"
                          >
                            {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                          </span>
                        )}
                      </span>
                    )}
                    {sidebarCollapsed && showBadge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#3b82f6',
                          borderRadius: '50%',
                        }}
                        data-testid="indicator-messages-unread"
                      />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div style={styles.bottomSection}>
          {/* My Places Link */}
          <Link
            to="/app"
            onClick={() => {
              // Clear current tenant when going back to picker
              // This is handled by the context or route
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              color: '#9ca3af',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            <ArrowLeft size={18} />
            {!sidebarCollapsed && <span>My Places</span>}
          </Link>


          {/* Platform Admin Link (if admin) */}
          {user.is_platform_admin && !impersonation.active && (
            <Link
              to="/admin"
              data-testid="link-platform-admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                color: '#a855f7',
                textDecoration: 'none',
                fontSize: '14px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Shield size={18} />
              {!sidebarCollapsed && <span>Platform Admin</span>}
            </Link>
          )}

          {/* User Menu */}
          <div style={{ 
            padding: '12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                  {(user.full_name || user.email)[0].toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {user.full_name || 'User'}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {user.email}
                    </div>
                  </div>
                )}
              </button>

              {/* User Dropdown */}
              {userMenuOpen && !sidebarCollapsed && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    onClick={() => setUserMenuOpen(false)} 
                  />
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '100%',
                    marginBottom: '4px',
                    backgroundColor: '#1a2744',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}>
                    <Link
                      to="/app/settings"
                      onClick={() => setUserMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        color: 'white',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      <User size={16} />
                      My Profile
                    </Link>
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <a
                      href="/api/auth/logout"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        color: '#f87171',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Phase 2C-15C: Impersonation banner with "Back to User Home" */}
        {impersonation.active && currentTenant && (
          <div 
            style={{
              height: '36px',
              backgroundColor: '#b45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '0 16px',
              flexShrink: 0,
            }}
            data-testid="banner-impersonation"
          >
            <span style={{ fontSize: '13px', color: 'white' }}>
              <Shield size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Impersonating <strong>{impersonation.target_user?.display_name || impersonation.target_user?.email}</strong> 
              {' '} in <strong>{currentTenant.tenant_name}</strong>
            </span>
            <button
              onClick={handleBackToUserHome}
              disabled={clearingTenant}
              style={{
                fontSize: '12px',
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: clearingTenant ? 'wait' : 'pointer',
                opacity: clearingTenant ? 0.7 : 1,
              }}
              data-testid="button-back-to-user-home"
            >
              {clearingTenant ? 'Clearing...' : 'Back to User Home'}
            </button>
          </div>
        )}

        {/* Top Bar with Context Indicator and View Mode Toggle */}
        <header style={{
          height: '48px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          backgroundColor: '#0a1628',
          flexShrink: 0,
          gap: '16px',
        }}>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ViewModeToggle />
            <ContextIndicator />
          </div>
        </header>
        
        <main style={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
