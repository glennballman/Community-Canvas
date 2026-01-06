/**
 * PUBLIC PORTAL LAYOUT
 * 
 * Used for: /c/:slug/* routes
 * 
 * CRITICAL REQUIREMENTS:
 * 1. NO left sidebar
 * 2. NO authentication required
 * 3. Horizontal tabs for navigation
 * 4. Community branding from theme
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useParams, NavLink, Link, useOutletContext } from 'react-router-dom';

// ============================================================================
// TYPES
// ============================================================================

interface PortalTheme {
  primary_color: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  logo_url?: string;
  tagline?: string;
}

interface PortalConfig {
  show_businesses?: boolean;
  show_service_runs?: boolean;
  show_accommodations?: boolean;
  show_good_news?: boolean;
}

interface AreaGroup {
  tenant_id: string;
  name: string;
  portal_slug: string;
}

interface PortalData {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  theme: PortalTheme | null;
  settings?: any;
  tenant_id: string;
  tenant_name: string;
}

// Export context type for child routes
export function usePortalContext() {
  return useOutletContext<{ portal: PortalData }>();
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export function PublicPortalLayout(): React.ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Fetch portal data
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (slug) {
      fetchPortal(slug);
    }
  }, [slug]);

  async function fetchPortal(portalSlug: string) {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/public/portals/${portalSlug}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Community not found');
        } else {
          setError('Failed to load community');
        }
        return;
      }
      
      const data = await response.json();
      setPortal(data.portal);
      
      // Update page title
      if (data.portal?.name) {
        document.title = `${data.portal.name} | Community Canvas`;
      }
    } catch (err) {
      console.error('Failed to fetch portal:', err);
      setError('Failed to load community');
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------
  
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0c1829',
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
          <p style={{ color: '#9ca3af' }}>Loading community...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Error state
  // --------------------------------------------------------------------------
  
  if (error || !portal) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0c1829',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏔️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Community Not Found
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>{error}</p>
          <Link 
            to="/" 
            style={{ color: '#60a5fa', textDecoration: 'underline' }}
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Extract theme
  // --------------------------------------------------------------------------

  const theme: PortalTheme = portal.theme || { primary_color: '#3b82f6' };
  const config = portal.settings || {};
  
  const backgroundColor = theme.background_color || '#0c1829';
  const textColor = theme.text_color || '#f8fafc';
  const primaryColor = theme.primary_color || '#3b82f6';
  const accentColor = theme.accent_color || '#f59e0b';

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ====== HEADER ====== */}
      <header style={{
        borderBottom: `1px solid ${primaryColor}40`,
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 16px',
        }}>
          {/* Top bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 0',
          }}>
            {/* Logo & Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {theme.logo_url ? (
                <img 
                  src={theme.logo_url} 
                  alt={portal.name} 
                  style={{ height: '40px' }}
                />
              ) : (
                <span style={{ fontSize: '32px' }}>🏔️</span>
              )}
              <div>
                <h1 style={{ 
                  fontSize: '20px', 
                  fontWeight: 700,
                  margin: 0,
                }}>
                  {portal.name}
                </h1>
                {(theme.tagline || portal.tagline) && (
                  <p style={{ 
                    fontSize: '14px', 
                    opacity: 0.75,
                    margin: 0,
                  }}>
                    {theme.tagline || portal.tagline}
                  </p>
                )}
              </div>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Sign In */}
              <Link
                to="/app"
                style={{
                  backgroundColor: accentColor,
                  color: '#000',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '-1px',
          }}>
            <TabLink to={`/c/${slug}`} end>Overview</TabLink>
            {config.show_businesses && (
              <TabLink to={`/c/${slug}/businesses`}>Businesses</TabLink>
            )}
            {config.show_service_runs && (
              <TabLink to={`/c/${slug}/services`}>Services</TabLink>
            )}
            {config.show_accommodations && (
              <TabLink to={`/c/${slug}/stay`}>Stay</TabLink>
            )}
            <TabLink to={`/c/${slug}/events`}>Events</TabLink>
            <TabLink to={`/c/${slug}/about`}>About</TabLink>
          </nav>
        </div>
      </header>

      {/* ====== MAIN CONTENT ====== */}
      <main>
        <Outlet context={{ portal }} />
      </main>

      {/* ====== FOOTER ====== */}
      <footer style={{
        borderTop: `1px solid ${primaryColor}40`,
        marginTop: '48px',
        padding: '32px 16px',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
          fontSize: '14px',
          opacity: 0.75,
        }}>
          <p>
            Powered by{' '}
            <a 
              href="/" 
              style={{ textDecoration: 'underline', color: 'inherit' }}
            >
              Community Canvas
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// TAB LINK COMPONENT
// ============================================================================

function TabLink({ 
  to, 
  children, 
  end 
}: { 
  to: string; 
  children: React.ReactNode; 
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: 500,
        textDecoration: 'none',
        borderBottom: '2px solid',
        borderColor: isActive ? 'currentColor' : 'transparent',
        opacity: isActive ? 1 : 0.75,
        color: 'inherit',
        transition: 'all 0.15s ease',
      })}
    >
      {children}
    </NavLink>
  );
}
