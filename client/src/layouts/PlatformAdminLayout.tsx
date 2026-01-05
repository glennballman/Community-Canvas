/**
 * PLATFORM ADMIN LAYOUT
 * 
 * Used for: /admin/* routes
 * Requires: is_platform_admin = true
 * 
 * CRITICAL REQUIREMENTS:
 * 1. LEFT SIDEBAR navigation (not top nav)
 * 2. Only accessible to platform admins
 * 3. "Back to App" link at bottom
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useEffect } from 'react';
import { 
  Outlet, 
  NavLink, 
  Link, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Database,
  Landmark,
  FileText,
  Home,
  FileBox,
  Globe,
  Sprout,
  Settings as SettingsIcon,
  Bot,
  Flag,
  Settings,
  FileSearch,
  ArrowLeft,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

interface NavSection {
  title: string;
  items: Array<{
    icon: React.ElementType;
    label: string;
    href: string;
  }>;
}

const ADMIN_NAV: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
    ],
  },
  {
    title: 'TENANTS & USERS',
    items: [
      { icon: Building2, label: 'Tenants', href: '/admin/tenants' },
      { icon: Users, label: 'Users', href: '/admin/users' },
      { icon: UserCog, label: 'Impersonation', href: '/admin/impersonation' },
    ],
  },
  {
    title: 'DATA MANAGEMENT',
    items: [
      { icon: Database, label: 'Infrastructure', href: '/admin/data/infrastructure' },
      { icon: Landmark, label: 'Chambers', href: '/admin/data/chambers' },
      { icon: FileText, label: 'NAICS', href: '/admin/data/naics' },
      { icon: Home, label: 'Accommodations', href: '/admin/data/accommodations' },
      { icon: FileBox, label: 'Import/Export', href: '/admin/data/import-export' },
    ],
  },
  {
    title: 'COMMUNITIES',
    items: [
      { icon: Globe, label: 'All Communities', href: '/admin/communities' },
      { icon: Sprout, label: 'Seed Communities', href: '/admin/communities/seed' },
      { icon: SettingsIcon, label: 'Portal Config', href: '/admin/communities/portals' },
    ],
  },
  {
    title: 'MODERATION',
    items: [
      { icon: Bot, label: 'AI Queue', href: '/admin/moderation/ai-queue' },
      { icon: Flag, label: 'Flagged Content', href: '/admin/moderation/flagged' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { icon: Settings, label: 'Settings', href: '/admin/settings' },
      { icon: FileSearch, label: 'Logs', href: '/admin/logs' },
    ],
  },
];

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export function PlatformAdminLayout(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, initialized } = useTenant();

  // --------------------------------------------------------------------------
  // Auth & Admin check
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (initialized) {
      if (!user) {
        navigate('/login', { state: { from: location.pathname } });
      } else if (!user.is_platform_admin) {
        navigate('/app');
      }
    }
  }, [initialized, user, navigate, location.pathname]);

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
            border: '4px solid rgba(168, 85, 247, 0.3)',
            borderTopColor: '#a855f7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#9ca3af' }}>Loading admin panel...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Don't render if not admin (will redirect)
  if (!user?.is_platform_admin) {
    return <></>;
  }

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#060b15',
      color: 'white',
      display: 'flex',
    } as React.CSSProperties,
    
    sidebar: {
      width: '256px',
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#060b15',
    } as React.CSSProperties,
    
    logo: {
      height: '64px',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,
    
    nav: {
      flex: 1,
      padding: '8px',
      overflowY: 'auto',
    } as React.CSSProperties,
    
    sectionTitle: {
      padding: '12px 12px 8px',
      fontSize: '11px',
      fontWeight: 600,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
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
      marginBottom: '2px',
    } as React.CSSProperties,
    
    navItemActive: {
      backgroundColor: 'rgba(168, 85, 247, 0.2)',
      color: '#c084fc',
    } as React.CSSProperties,
    
    bottomSection: {
      padding: '12px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,
    
    mainContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    } as React.CSSProperties,
    
    header: {
      height: '64px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '16px',
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
          <span style={{ fontSize: '20px' }}>⚡</span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#c084fc' }}>
            Platform Admin
          </span>
        </div>

        {/* Navigation */}
        <nav style={styles.nav}>
          {ADMIN_NAV.map((section) => (
            <div key={section.title} style={{ marginBottom: '16px' }}>
              <div style={styles.sectionTitle}>{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/admin'}
                  style={({ isActive }) => ({
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  })}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom - Back to App */}
        <div style={styles.bottomSection}>
          <Link
            to="/app"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              color: '#9ca3af',
              textDecoration: 'none',
              fontSize: '14px',
              borderRadius: '8px',
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to App</span>
          </Link>
        </div>
      </aside>

      {/* ====== MAIN AREA ====== */}
      <div style={styles.mainContainer}>
        {/* Header */}
        <header style={styles.header}>
          <Link 
            to="/app" 
            style={{ fontSize: '14px', color: '#9ca3af', textDecoration: 'none' }}
          >
            Back to App
          </Link>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>{user.email}</span>
        </header>

        {/* Page Content */}
        <main style={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
