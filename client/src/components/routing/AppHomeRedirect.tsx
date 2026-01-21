/**
 * APP HOME REDIRECT
 * 
 * Determines where to route users when they hit /app
 * Based on role and view mode preference.
 * 
 * Priority:
 * 1. Platform Admin → /app/platform (or /app/founder if Founder mode)
 * 2. Has tenant memberships → /app/places (tenant picker)
 * 3. No access → /app/onboarding or access denied
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

// ============================================================================
// VIEW MODE PERSISTENCE
// ============================================================================

const VIEW_MODE_KEY = 'cc_view_mode';

export type ViewMode = 'admin' | 'founder';

export function getViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'admin' || stored === 'founder') {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'admin'; // Default for platform admins
}

export function setViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// REDIRECT COMPONENT
// ============================================================================

export function AppHomeRedirect(): React.ReactElement | null {
  const navigate = useNavigate();
  const { user, memberships, loading, initialized } = useTenant();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once
    if (hasRedirected.current) return;
    if (!initialized || loading) return;

    // Not logged in - redirect to login
    if (!user) {
      hasRedirected.current = true;
      navigate('/login', { replace: true });
      return;
    }

    // Platform admin - check view mode preference
    if (user.is_platform_admin) {
      hasRedirected.current = true;
      const viewMode = getViewMode();
      if (viewMode === 'founder') {
        navigate('/app/founder', { replace: true });
      } else {
        navigate('/app/platform', { replace: true });
      }
      return;
    }

    // Has tenant memberships - go to places
    hasRedirected.current = true;
    navigate('/app/places', { replace: true });
  }, [initialized, loading, user, navigate]);

  // Show loading state while determining redirect
  return (
    <div 
      style={{
        minHeight: '100vh',
        backgroundColor: '#060b15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}
      data-testid="app-home-redirect"
    >
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

export default AppHomeRedirect;
