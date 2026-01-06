/**
 * TENANT APP LAYOUT
 * 
 * Used for: /app/* routes
 * 
 * CRITICAL REQUIREMENTS:
 * 1. LEFT SIDEBAR navigation (not top nav)
 * 2. Sidebar width: 256px (or 64px collapsed)
 * 3. Nav items change based on tenant TYPE
 * 4. Tenant switcher in sidebar
 * 5. "My Places" link at bottom of sidebar
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useState, useEffect } from 'react';
import { 
  Outlet, 
  NavLink, 
  Link, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import { 
  LayoutDashboard, 
  Phone, 
  Wrench, 
  Building2, 
  Palette, 
  Settings,
  Package,
  Calendar,
  Users,
  MessageSquare,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Shield,
  Layers,
  Briefcase,
  MapPin,
  Contact,
} from 'lucide-react';
import { useTenant, TenantMembership } from '../contexts/TenantContext';

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const COMMUNITY_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Phone, label: 'Availability', href: '/app/availability' },
  { icon: Calendar, label: 'Operations', href: '/app/operations' },
  { icon: Wrench, label: 'Service Runs', href: '/app/service-runs' },
  { icon: Briefcase, label: 'Services', href: '/app/services' },
  { icon: Layers, label: 'Bundles', href: '/app/bundles' },
  { icon: Building2, label: 'Directory', href: '/app/directory' },
  { icon: MessageSquare, label: 'Work Requests', href: '/app/intake/work-requests' },
  { icon: Briefcase, label: 'Projects', href: '/app/projects' },
  { icon: MapPin, label: 'Places', href: '/app/crm/places' },
  { icon: Contact, label: 'Contacts', href: '/app/crm/people' },
  { icon: Building2, label: 'Organizations', href: '/app/crm/orgs' },
  { icon: Palette, label: 'Content', href: '/app/content' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

const BUSINESS_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Package, label: 'Inventory', href: '/app/inventory' },
  { icon: Calendar, label: 'Bookings', href: '/app/bookings' },
  { icon: Calendar, label: 'Operations', href: '/app/operations' },
  { icon: MessageSquare, label: 'Work Requests', href: '/app/intake/work-requests' },
  { icon: Briefcase, label: 'Projects', href: '/app/projects' },
  { icon: MapPin, label: 'Places', href: '/app/crm/places' },
  { icon: Contact, label: 'Contacts', href: '/app/crm/people' },
  { icon: Building2, label: 'Organizations', href: '/app/crm/orgs' },
  { icon: MessageSquare, label: 'Conversations', href: '/app/conversations' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

const INDIVIDUAL_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: MessageSquare, label: 'Conversations', href: '/app/conversations' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

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
  // Navigation items based on tenant type
  // --------------------------------------------------------------------------

  function getNavItems(): NavItem[] {
    if (!currentTenant) return [];
    
    switch (currentTenant.tenant_type) {
      case 'community':
      case 'government':
        return COMMUNITY_NAV;
      case 'business':
        return BUSINESS_NAV;
      case 'individual':
        return INDIVIDUAL_NAV;
      default:
        return BUSINESS_NAV;
    }
  }

  const navItems = getNavItems();

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
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      backgroundColor: '#060b15',
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
    
    nav: {
      flex: 1,
      padding: '8px',
      overflowY: 'auto',
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
    } as React.CSSProperties,
    
    navItemActive: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      color: '#60a5fa',
    } as React.CSSProperties,
    
    bottomSection: {
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

        {/* Navigation */}
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
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
          {user.is_platform_admin && !impersonation.is_impersonating && (
            <Link
              to="/admin"
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
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
