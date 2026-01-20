/**
 * TENANT APP LAYOUT
 * 
 * Used for: /app/* routes
 * 
 * Uses V3_NAV from v3Nav.ts as the single source of truth for navigation.
 * Navigation is filtered based on user context (role, tenant, portal, platform admin).
 */

import React, { useState, useEffect } from 'react';
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
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { PortalSelector } from '../components/PortalSelector';
import { ContextIndicator } from '../components/context/ContextIndicator';
import { getFilteredNavSections, NavSection, NavItem } from '../lib/routes/v3Nav';

// ============================================================================
// FOUNDER NAV TOGGLE (localStorage persistence)
// ============================================================================

const FOUNDER_NAV_KEY = 'cc_founder_nav_enabled';

function getFounderNavEnabled(): boolean {
  try {
    return localStorage.getItem(FOUNDER_NAV_KEY) === 'true';
  } catch {
    return false;
  }
}

function setFounderNavEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FOUNDER_NAV_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore localStorage errors
  }
}

const TYPE_ICONS: Record<string, string> = {
  community: '🏔️',
  government: '🏛️',
  business: '🏢',
  individual: '👤',
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
    switchTenant,
    impersonation,
  } = useTenant();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [founderNavEnabled, setFounderNavState] = useState(getFounderNavEnabled);

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
  const needsRedirectToRoot = !isAtRoot && !currentTenant && initialized && !loading;

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
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (needsRedirectToRoot) {
      navigate('/app');
    }
  }, [needsRedirectToRoot, navigate]);

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------
  
  if (loading || !initialized) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#060b15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(59, 130, 246, 0.3)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#9ca3af' }}>Loading...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return <></>;
  }

  // --------------------------------------------------------------------------
  // Route handling
  // --------------------------------------------------------------------------
  
  // If at /app and no tenant selected, render Outlet WITHOUT sidebar
  // The Outlet will render TenantPicker
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

  // If not at root and no tenant, show loading while redirect happens via useEffect
  if (!isAtRoot && !currentTenant) {
    return <></>;
  }

  // --------------------------------------------------------------------------
  // Navigation using V3_NAV (filtered by user context)
  // --------------------------------------------------------------------------
  
  function toggleFounderNav() {
    const newValue = !founderNavEnabled;
    setFounderNavEnabled(newValue);
    setFounderNavState(newValue);
  }

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
    founderNavEnabled: founderNavEnabled && (user?.is_platform_admin || false),
  });
  
  const canToggleFounderNav = user?.is_platform_admin || false;

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
                    <span style={{ fontSize: '18px' }}>
                      {TYPE_ICONS[currentTenant.tenant_type] || '📁'}
                    </span>
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
                          <span>{TYPE_ICONS[m.tenant_type] || '📁'}</span>
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

          {/* Founder Nav Toggle (platform admin only) */}
          {canToggleFounderNav && !sidebarCollapsed && (
            <button
              onClick={toggleFounderNav}
              data-testid="button-founder-nav-toggle"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                width: '100%',
                backgroundColor: founderNavEnabled ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                border: 'none',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                color: founderNavEnabled ? '#a855f7' : '#6b7280',
                textDecoration: 'none',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {founderNavEnabled ? <Eye size={18} /> : <EyeOff size={18} />}
              <span>{founderNavEnabled ? 'Founder Nav: ON' : 'Founder Nav: OFF'}</span>
            </button>
          )}

          {/* Platform Admin Link (if admin) */}
          {user.is_platform_admin && !impersonation.is_impersonating && (
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
        {/* Top Bar with Context Indicator */}
        <header style={{
          height: '48px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 16px',
          backgroundColor: '#0a1628',
          flexShrink: 0,
        }}>
          <ContextIndicator />
        </header>
        
        <main style={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
