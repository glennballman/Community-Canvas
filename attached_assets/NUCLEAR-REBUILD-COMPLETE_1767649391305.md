# COMMUNITY CANVAS - NUCLEAR REBUILD PACKAGE

## ⚠️ MANDATORY INSTRUCTIONS - READ BEFORE PROCEEDING

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   THIS IS A COMPLETE REBUILD. NOT A PATCH. NOT AN INTEGRATION.                ║
║                                                                               ║
║   RULES:                                                                      ║
║   1. DELETE files as instructed before creating new ones                      ║
║   2. COPY code exactly - do not modify, improve, or "fix" anything            ║
║   3. VERIFY each phase before proceeding to the next                          ║
║   4. ASK before any deviation, no matter how small                            ║
║   5. DO NOT skip steps                                                        ║
║   6. DO NOT combine steps                                                     ║
║   7. DO NOT add features not in this document                                 ║
║                                                                               ║
║   If something doesn't work, STOP and report - do not improvise.              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

# TABLE OF CONTENTS

1. [PHASE 0: Pre-Flight Checks](#phase-0-pre-flight-checks)
2. [PHASE 1: Demolition](#phase-1-demolition)
3. [PHASE 2: Foundation - Types & Context](#phase-2-foundation)
4. [PHASE 3: Global Components](#phase-3-global-components)
5. [PHASE 4: Layouts](#phase-4-layouts)
6. [PHASE 5: Core Pages](#phase-5-core-pages)
7. [PHASE 6: Route Configuration](#phase-6-route-configuration)
8. [PHASE 7: Final Verification](#phase-7-final-verification)

---

# PHASE 0: PRE-FLIGHT CHECKS

Before starting, verify these exist and work:

## 0.1 Required API Endpoints

Test each endpoint. If any fail, fix the backend FIRST.

```bash
# Test 1: User context (should return user + memberships)
curl -X GET http://localhost:5000/api/me/context \
  -H "Cookie: <session_cookie>" \
  | jq .

# Expected response structure:
{
  "user": {
    "id": "uuid",
    "email": "string",
    "full_name": "string",
    "is_platform_admin": true/false
  },
  "memberships": [...],
  "current_tenant_id": "uuid" or null,
  "is_impersonating": false
}

# Test 2: Switch tenant
curl -X POST http://localhost:5000/api/me/switch-tenant \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"tenant_id": "<valid_tenant_id>"}'

# Expected: {"success": true}

# Test 3: Impersonation start (admin only)
curl -X POST http://localhost:5000/api/admin/impersonation/start \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin_session_cookie>" \
  -d '{"tenant_id": "<valid_tenant_id>", "reason": "testing"}'

# Expected: {"success": true, "tenant": {...}, "expires_at": "..."}

# Test 4: Impersonation stop
curl -X POST http://localhost:5000/api/admin/impersonation/stop \
  -H "Cookie: <admin_session_cookie>"

# Expected: {"success": true}

# Test 5: Admin tenants list
curl -X GET http://localhost:5000/api/admin/tenants \
  -H "Cookie: <admin_session_cookie>" \
  | jq .

# Expected: {"tenants": [...]}
```

## 0.2 Required Dependencies

Verify these packages are installed:

```bash
# In client directory
npm list react-router-dom lucide-react
```

If missing:
```bash
npm install react-router-dom@6 lucide-react
```

## 0.3 Checkpoint

□ All 5 API endpoints return expected responses
□ react-router-dom v6 is installed
□ lucide-react is installed

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

# PHASE 1: DEMOLITION

## 1.1 Files to DELETE

Delete ALL of these files. Do not preserve any code from them.

```bash
# Delete from client/src/layouts/
rm -f client/src/layouts/TenantAppLayout.tsx
rm -f client/src/layouts/PlatformAdminLayout.tsx
rm -f client/src/layouts/PublicPortalLayout.tsx
rm -f client/src/layouts/AppLayout.tsx
rm -f client/src/layouts/AdminLayout.tsx
rm -f client/src/layouts/MainLayout.tsx

# Delete from client/src/components/
rm -f client/src/components/ImpersonationBanner.tsx
rm -f client/src/components/TenantSwitcher.tsx
rm -f client/src/components/Sidebar.tsx
rm -f client/src/components/TopNav.tsx
rm -f client/src/components/Navigation.tsx
rm -f client/src/components/Header.tsx

# Delete from client/src/contexts/
rm -f client/src/contexts/TenantContext.tsx
rm -f client/src/contexts/ImpersonationContext.tsx
rm -f client/src/contexts/AppContext.tsx

# Delete from client/src/pages/app/
rm -f client/src/pages/app/TenantPicker.tsx
rm -f client/src/pages/app/Dashboard.tsx
rm -f client/src/pages/app/Home.tsx
```

## 1.2 Directories to Ensure Exist

```bash
mkdir -p client/src/layouts
mkdir -p client/src/components
mkdir -p client/src/contexts
mkdir -p client/src/pages/app
mkdir -p client/src/pages/admin
mkdir -p client/src/pages/portal
mkdir -p client/src/lib
```

## 1.3 Checkpoint

□ All listed files are deleted
□ All directories exist
□ App will have errors (expected - we deleted the files)

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

# PHASE 2: FOUNDATION

## 2.1 Create: client/src/lib/api.ts

This file handles API calls with proper error handling.

```typescript
/**
 * API UTILITIES
 * 
 * Centralized API calls with error handling.
 * DO NOT MODIFY THIS FILE.
 */

const API_BASE = '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export const apiGet = <T>(endpoint: string) => api<T>(endpoint, { method: 'GET' });
export const apiPost = <T>(endpoint: string, body?: any) => api<T>(endpoint, { method: 'POST', body });
export const apiPut = <T>(endpoint: string, body?: any) => api<T>(endpoint, { method: 'PUT', body });
export const apiDelete = <T>(endpoint: string) => api<T>(endpoint, { method: 'DELETE' });
```

## 2.2 Create: client/src/contexts/TenantContext.tsx

This is the SINGLE source of truth for user, tenant, and impersonation state.

```typescript
/**
 * TENANT CONTEXT
 * 
 * Manages:
 * - Current user
 * - User's tenant memberships  
 * - Currently selected tenant
 * - Impersonation state
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_platform_admin: boolean;
}

export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_type: 'community' | 'business' | 'government' | 'individual';
  portal_slug?: string;
  role: string;
  is_primary: boolean;
}

export interface ImpersonationState {
  is_impersonating: boolean;
  tenant_id?: string;
  tenant_name?: string;
  tenant_type?: string;
  expires_at?: string;
}

interface TenantContextValue {
  // User
  user: User | null;
  
  // Tenants
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  
  // Impersonation
  impersonation: ImpersonationState;
  
  // State
  loading: boolean;
  initialized: boolean;
  
  // Actions
  switchTenant: (tenantId: string) => Promise<void>;
  clearTenant: () => void;
  refreshContext: () => Promise<void>;
  startImpersonation: (tenantId: string, reason?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ 
    is_impersonating: false 
  });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // --------------------------------------------------------------------------
  // Fetch context on mount
  // --------------------------------------------------------------------------
  
  const fetchContext = useCallback(async () => {
    try {
      const response = await fetch('/api/me/context', { 
        credentials: 'include' 
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated
          setUser(null);
          setMemberships([]);
          setCurrentTenantId(null);
          setImpersonation({ is_impersonating: false });
        }
        return;
      }
      
      const data = await response.json();
      
      setUser(data.user || null);
      setMemberships(data.memberships || []);
      setCurrentTenantId(data.current_tenant_id || null);
      
      // Handle impersonation state
      if (data.is_impersonating && data.impersonated_tenant) {
        setImpersonation({
          is_impersonating: true,
          tenant_id: data.impersonated_tenant.id,
          tenant_name: data.impersonated_tenant.name,
          tenant_type: data.impersonated_tenant.type,
          expires_at: data.impersonation_expires_at,
        });
        // When impersonating, current tenant is the impersonated tenant
        setCurrentTenantId(data.impersonated_tenant.id);
      } else {
        setImpersonation({ is_impersonating: false });
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      const response = await fetch('/api/me/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch tenant');
      }
      
      setCurrentTenantId(tenantId);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      throw error;
    }
  }, []);

  const clearTenant = useCallback(() => {
    setCurrentTenantId(null);
  }, []);

  const refreshContext = useCallback(async () => {
    setLoading(true);
    await fetchContext();
  }, [fetchContext]);

  const startImpersonation = useCallback(async (tenantId: string, reason?: string) => {
    try {
      const response = await fetch('/api/admin/impersonation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId, reason: reason || 'Admin access' }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to start impersonation');
      }
      
      // CRITICAL: Full page redirect to /app/dashboard
      // This ensures all state is fresh and correct
      window.location.href = '/app/dashboard';
      
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      throw error;
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    try {
      await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        credentials: 'include',
      });
      
      // CRITICAL: Full page redirect to /admin/impersonation
      // This ensures all state is fresh and correct
      window.location.href = '/admin/impersonation';
      
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const currentTenant = currentTenantId
    ? memberships.find(m => m.tenant_id === currentTenantId) || null
    : null;

  // --------------------------------------------------------------------------
  // Value
  // --------------------------------------------------------------------------

  const value: TenantContextValue = {
    user,
    memberships,
    currentTenant,
    impersonation,
    loading,
    initialized,
    switchTenant,
    clearTenant,
    refreshContext,
    startImpersonation,
    stopImpersonation,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}
```

## 2.3 Checkpoint - Phase 2

□ client/src/lib/api.ts exists with exact content above
□ client/src/contexts/TenantContext.tsx exists with exact content above
□ No TypeScript errors in these files

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

# PHASE 3: GLOBAL COMPONENTS

## 3.1 Create: client/src/components/ImpersonationBanner.tsx

This banner appears at the TOP of the ENTIRE app when impersonating.

```typescript
/**
 * IMPERSONATION BANNER
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Position: fixed at top of viewport
 * 2. Z-index: 9999 (above everything)
 * 3. Visible on ALL pages when impersonating
 * 4. Pushes all content down via body padding
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useEffect, useState } from 'react';
import { useTenant } from '../contexts/TenantContext';

export function ImpersonationBanner(): React.ReactElement | null {
  const { impersonation, stopImpersonation } = useTenant();
  const [stopping, setStopping] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate and update time remaining
  useEffect(() => {
    if (!impersonation.is_impersonating || !impersonation.expires_at) {
      return;
    }

    function updateTime() {
      if (!impersonation.expires_at) return;
      
      const expires = new Date(impersonation.expires_at).getTime();
      const now = Date.now();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 60) {
        const hours = Math.floor(minutes / 60);
        setTimeLeft(`${hours}h ${minutes % 60}m remaining`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      }
    }

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [impersonation.expires_at, impersonation.is_impersonating]);

  // Add/remove body padding when banner visibility changes
  useEffect(() => {
    if (impersonation.is_impersonating) {
      document.body.style.paddingTop = '48px';
    } else {
      document.body.style.paddingTop = '0';
    }
    
    return () => {
      document.body.style.paddingTop = '0';
    };
  }, [impersonation.is_impersonating]);

  // Handle stop click
  async function handleStop() {
    if (stopping) return;
    
    setStopping(true);
    try {
      await stopImpersonation();
      // stopImpersonation handles the redirect
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      setStopping(false);
    }
  }

  // Don't render if not impersonating
  if (!impersonation.is_impersonating) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        backgroundColor: '#f59e0b',
        color: '#451a03',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {/* Left side - Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Pulsing dot */}
        <span 
          style={{
            width: '10px',
            height: '10px',
            backgroundColor: '#78350f',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
          }}
        />
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Impersonating:
        </span>
        <span style={{ fontWeight: 600 }}>
          {impersonation.tenant_name}
        </span>
        <span style={{ 
          backgroundColor: '#fcd34d', 
          padding: '2px 8px', 
          borderRadius: '4px',
          fontSize: '12px',
          textTransform: 'capitalize',
        }}>
          {impersonation.tenant_type}
        </span>
      </div>

      {/* Right side - Timer and Stop button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {timeLeft && (
          <span style={{ opacity: 0.8, fontSize: '13px' }}>
            ⏱ {timeLeft}
          </span>
        )}
        <button
          onClick={handleStop}
          disabled={stopping}
          style={{
            backgroundColor: '#78350f',
            color: '#fef3c7',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: stopping ? 'not-allowed' : 'pointer',
            opacity: stopping ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            if (!stopping) {
              e.currentTarget.style.backgroundColor = '#451a03';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#78350f';
          }}
        >
          {stopping ? 'Stopping...' : '✕ Exit Impersonation'}
        </button>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
```

## 3.2 Checkpoint - Phase 3

□ client/src/components/ImpersonationBanner.tsx exists with exact content above
□ No TypeScript errors
□ Component uses inline styles (intentional - avoids CSS conflicts)

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

# PHASE 4: LAYOUTS

## 4.1 Create: client/src/layouts/TenantAppLayout.tsx

This is the main layout for /app/* routes. It has a LEFT SIDEBAR.

```typescript
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
  { icon: Wrench, label: 'Service Runs', href: '/app/service-runs' },
  { icon: Building2, label: 'Directory', href: '/app/directory' },
  { icon: Palette, label: 'Content', href: '/app/content' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

const BUSINESS_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Package, label: 'Catalog', href: '/app/catalog' },
  { icon: Calendar, label: 'Bookings', href: '/app/bookings' },
  { icon: Users, label: 'Customers', href: '/app/customers' },
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
  // Auth redirect
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (initialized && !user) {
      navigate('/login', { state: { from: location.pathname } });
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

  const isAtRoot = location.pathname === '/app' || location.pathname === '/app/';
  
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

  // If not at root and no tenant, redirect to root
  if (!isAtRoot && !currentTenant) {
    navigate('/app');
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
```

## 4.2 Create: client/src/layouts/PlatformAdminLayout.tsx

```typescript
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
```

## 4.3 Create: client/src/layouts/PublicPortalLayout.tsx

```typescript
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
  tenant: {
    id: string;
    name: string;
    portal_slug: string;
    theme: PortalTheme;
    portal_config: PortalConfig;
  };
  area_groups: AreaGroup[];
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
      setPortal(data);
      
      // Update page title
      if (data.tenant?.name) {
        document.title = `${data.tenant.name} | Community Canvas`;
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

  const theme = portal.tenant.theme || {};
  const config = portal.tenant.portal_config || {};
  
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
                  alt={portal.tenant.name} 
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
                  {portal.tenant.name}
                </h1>
                {theme.tagline && (
                  <p style={{ 
                    fontSize: '14px', 
                    opacity: 0.75,
                    margin: 0,
                  }}>
                    {theme.tagline}
                  </p>
                )}
              </div>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Area switcher */}
              {portal.area_groups && portal.area_groups.length > 0 && (
                <select 
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: textColor,
                    fontSize: '14px',
                  }}
                  onChange={(e) => {
                    if (e.target.value) {
                      window.location.href = `/c/${e.target.value}`;
                    }
                  }}
                >
                  <option value="">Switch area...</option>
                  {portal.area_groups.map((area) => (
                    <option key={area.tenant_id} value={area.portal_slug}>
                      {area.name}
                    </option>
                  ))}
                </select>
              )}

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
```

## 4.4 Checkpoint - Phase 4

□ client/src/layouts/TenantAppLayout.tsx exists with exact content above
□ client/src/layouts/PlatformAdminLayout.tsx exists with exact content above
□ client/src/layouts/PublicPortalLayout.tsx exists with exact content above
□ No TypeScript errors in any layout file
□ All three layouts use LEFT SIDEBAR (except PublicPortalLayout which has NO sidebar)

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

**CONTINUED IN PART 2...**
# NUCLEAR REBUILD PACKAGE - PART 2

---

# PHASE 5: CORE PAGES

## 5.1 Create: client/src/pages/app/TenantPicker.tsx

This page shows when user is at /app with NO tenant selected.
It has NO header of its own - the layout handles that.

```typescript
/**
 * TENANT PICKER
 * 
 * The home screen at /app when no tenant is selected.
 * Shows all tenants the user has access to, grouped by type.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. NO duplicate header - this renders inside TenantAppLayout
 * 2. NO sidebar - the layout shows no sidebar when this is displayed
 * 3. Grouped by tenant type
 * 4. Click "Manage" → switch tenant and go to dashboard
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant, TenantMembership } from '../../contexts/TenantContext';
import { ExternalLink, Plus, Search } from 'lucide-react';

// ============================================================================
// TYPE ICONS
// ============================================================================

const TYPE_ICONS: Record<string, string> = {
  community: '🏔️',
  government: '🏛️',
  business: '🏢',
  individual: '👤',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TenantPicker(): React.ReactElement {
  const navigate = useNavigate();
  const { user, memberships, switchTenant, impersonation } = useTenant();

  // --------------------------------------------------------------------------
  // Handle manage click
  // --------------------------------------------------------------------------
  
  async function handleManage(tenantId: string) {
    try {
      await switchTenant(tenantId);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Group memberships by type
  // --------------------------------------------------------------------------
  
  const communities = memberships.filter(
    m => m.tenant_type === 'community' || m.tenant_type === 'government'
  );
  const businesses = memberships.filter(m => m.tenant_type === 'business');
  const personal = memberships.filter(m => m.tenant_type === 'individual');

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#060b15',
      color: 'white',
    } as React.CSSProperties,

    header: {
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as React.CSSProperties,

    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,

    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    } as React.CSSProperties,

    main: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '32px 24px',
    } as React.CSSProperties,

    title: {
      fontSize: '32px',
      fontWeight: 700,
      marginBottom: '8px',
    } as React.CSSProperties,

    subtitle: {
      color: '#9ca3af',
      fontSize: '16px',
      marginBottom: '32px',
    } as React.CSSProperties,

    section: {
      marginBottom: '40px',
    } as React.CSSProperties,

    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
    } as React.CSSProperties,

    sectionIcon: {
      fontSize: '24px',
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '20px',
      fontWeight: 600,
    } as React.CSSProperties,

    sectionDesc: {
      color: '#9ca3af',
      fontSize: '14px',
      marginBottom: '16px',
      marginLeft: '36px',
    } as React.CSSProperties,

    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '16px',
      marginLeft: '36px',
    } as React.CSSProperties,

    card: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '16px',
      transition: 'all 0.15s ease',
    } as React.CSSProperties,

    cardTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12px',
    } as React.CSSProperties,

    cardName: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,

    tenantName: {
      fontWeight: 500,
      fontSize: '16px',
    } as React.CSSProperties,

    primaryBadge: {
      fontSize: '12px',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      color: '#60a5fa',
      padding: '2px 8px',
      borderRadius: '4px',
    } as React.CSSProperties,

    roleBadge: {
      fontSize: '14px',
      color: '#6b7280',
      textTransform: 'capitalize',
      marginBottom: '16px',
    } as React.CSSProperties,

    cardButtons: {
      display: 'flex',
      gap: '8px',
    } as React.CSSProperties,

    manageButton: {
      flex: 1,
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } as React.CSSProperties,

    viewButton: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: 'none',
      padding: '10px 12px',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,

    quickActions: {
      marginTop: '48px',
      paddingTop: '32px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,

    quickActionsTitle: {
      fontSize: '12px',
      fontWeight: 600,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '16px',
    } as React.CSSProperties,

    quickActionsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
    } as React.CSSProperties,

    quickActionButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      textDecoration: 'none',
    } as React.CSSProperties,

    emptyState: {
      textAlign: 'center',
      padding: '64px 16px',
    } as React.CSSProperties,

    emptyIcon: {
      fontSize: '64px',
      marginBottom: '16px',
    } as React.CSSProperties,

    emptyTitle: {
      fontSize: '24px',
      fontWeight: 700,
      marginBottom: '8px',
    } as React.CSSProperties,

    emptyDesc: {
      color: '#9ca3af',
      marginBottom: '32px',
    } as React.CSSProperties,

    adminLink: {
      fontSize: '14px',
      color: '#a855f7',
      textDecoration: 'none',
    } as React.CSSProperties,

    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,

    avatar: {
      width: '32px',
      height: '32px',
      backgroundColor: '#3b82f6',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 500,
    } as React.CSSProperties,
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={{ fontSize: '24px' }}>🌐</span>
          <span style={{ fontWeight: 600 }}>Community Canvas</span>
        </div>
        <div style={styles.headerRight}>
          {user?.is_platform_admin && !impersonation.is_impersonating && (
            <Link to="/admin" style={styles.adminLink}>
              Platform Admin
            </Link>
          )}
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
              {user?.email}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <h1 style={styles.title}>Your Places</h1>
        <p style={styles.subtitle}>Choose what you want to manage</p>

        {/* Empty State */}
        {memberships.length === 0 && (
          <div style={styles.emptyState as React.CSSProperties}>
            <div style={styles.emptyIcon}>🏔️</div>
            <h2 style={styles.emptyTitle}>No places yet</h2>
            <p style={styles.emptyDesc}>
              You don't have access to any communities or businesses yet.
            </p>
            <Link
              to="/explore"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Explore Communities
            </Link>
          </div>
        )}

        {/* Communities Section */}
        {communities.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🏔️</span>
              <h2 style={styles.sectionTitle}>Communities you manage</h2>
            </div>
            <p style={styles.sectionDesc}>
              Answer the phone, coordinate services, and view opted-in availability
            </p>
            <div style={styles.grid}>
              {communities.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Businesses Section */}
        {businesses.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🏢</span>
              <h2 style={styles.sectionTitle}>Businesses you manage</h2>
            </div>
            <p style={styles.sectionDesc}>
              Publish your catalog, manage availability, and handle bookings
            </p>
            <div style={styles.grid}>
              {businesses.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Personal Section */}
        {personal.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>👤</span>
              <h2 style={styles.sectionTitle}>Personal</h2>
            </div>
            <p style={styles.sectionDesc}>
              Your personal profile and activity
            </p>
            <div style={styles.grid}>
              {personal.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Quick Actions */}
        {memberships.length > 0 && (
          <div style={styles.quickActions}>
            <h3 style={styles.quickActionsTitle as React.CSSProperties}>Quick Actions</h3>
            <div style={styles.quickActionsRow as React.CSSProperties}>
              <Link to="/app/create-business" style={styles.quickActionButton}>
                <Plus size={16} />
                Add a Business
              </Link>
              <Link to="/explore" style={styles.quickActionButton}>
                <Search size={16} />
                Join a Community
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// TENANT CARD COMPONENT
// ============================================================================

interface TenantCardProps {
  tenant: TenantMembership;
  onManage: () => void;
}

function TenantCard({ tenant, onManage }: TenantCardProps): React.ReactElement {
  const typeIcon = TYPE_ICONS[tenant.tenant_type] || '📁';

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '16px',
        transition: 'all 0.15s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      {/* Top row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{typeIcon}</span>
          <span style={{ fontWeight: 500, fontSize: '16px' }}>
            {tenant.tenant_name}
          </span>
        </div>
        {tenant.is_primary && (
          <span style={{
            fontSize: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            padding: '2px 8px',
            borderRadius: '4px',
          }}>
            Primary
          </span>
        )}
      </div>

      {/* Role */}
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        textTransform: 'capitalize',
        marginBottom: '16px',
      } as React.CSSProperties}>
        {tenant.role}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onManage}
          style={{
            flex: 1,
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          Manage
        </button>
        {tenant.portal_slug && (
          <Link
            to={`/c/${tenant.portal_slug}`}
            target="_blank"
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'white',
              padding: '10px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
            title="View public page"
          >
            <ExternalLink size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}
```

## 5.2 Create: client/src/pages/app/Dashboard.tsx

```typescript
/**
 * DASHBOARD
 * 
 * Shows different content based on tenant type:
 * - Community/Government: Service runs, opted-in businesses, activity
 * - Business: Revenue, bookings, customers
 * - Individual: Personal activity
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Check tenant TYPE to determine which dashboard to show
 * 2. Community dashboard does NOT show revenue
 * 3. Business dashboard does NOT show service runs
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { 
  ExternalLink,
  Phone,
  Wrench,
  Palette,
  Package,
  Calendar,
  MessageSquare,
} from 'lucide-react';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Dashboard(): React.ReactElement {
  const { currentTenant } = useTenant();

  if (!currentTenant) {
    return (
      <div style={{ padding: '32px', color: '#9ca3af' }}>
        <p>No tenant selected. Please select a place to manage.</p>
        <Link to="/app" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
          Go to My Places
        </Link>
      </div>
    );
  }

  // Determine which dashboard to show based on tenant type
  const isCommunity = 
    currentTenant.tenant_type === 'community' || 
    currentTenant.tenant_type === 'government';

  if (isCommunity) {
    return <CommunityDashboard tenant={currentTenant} />;
  }

  return <BusinessDashboard tenant={currentTenant} />;
}

// ============================================================================
// COMMUNITY DASHBOARD
// ============================================================================

interface DashboardProps {
  tenant: {
    tenant_id: string;
    tenant_name: string;
    tenant_type: string;
    portal_slug?: string;
    role: string;
  };
}

function CommunityDashboard({ tenant }: DashboardProps): React.ReactElement {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
              {tenant.tenant_name}
            </h1>
            <p style={{ color: '#9ca3af' }}>Community Dashboard</p>
          </div>
          {tenant.portal_slug && (
            <Link
              to={`/c/${tenant.portal_slug}`}
              target="_blank"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              <ExternalLink size={16} />
              View Public Portal
            </Link>
          )}
        </div>

        {/* Stats Grid - COMMUNITY SPECIFIC (no revenue!) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <StatCard
            icon="⏳"
            label="Pending Service Runs"
            value="2"
            sublabel="awaiting review"
            color="#f59e0b"
          />
          <StatCard
            icon="🔧"
            label="Active Service Runs"
            value="3"
            sublabel="in progress"
            color="#10b981"
          />
          <StatCard
            icon="🏪"
            label="Opted-in Businesses"
            value="5"
            sublabel="sharing availability"
            color="#3b82f6"
          />
          <StatCard
            icon="💛"
            label="Good News Posts"
            value="12"
            sublabel="this month"
            color="#ec4899"
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <QuickAction
            icon={<Phone size={24} />}
            title="Availability Console"
            description="Answer calls with real-time availability"
            to="/app/availability"
          />
          <QuickAction
            icon={<Wrench size={24} />}
            title="Review Service Runs"
            description="2 runs awaiting approval"
            to="/app/service-runs"
            badge={2}
          />
          <QuickAction
            icon={<Palette size={24} />}
            title="Edit Public Portal"
            description="Update branding and content"
            to="/app/content"
          />
        </div>

        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ActivityItem
              icon="🔧"
              text="New service run created: Chimney Sweep"
              time="2 hours ago"
            />
            <ActivityItem
              icon="👤"
              text="Joe Smith joined the Septic Pump run"
              time="5 hours ago"
            />
            <ActivityItem
              icon="💛"
              text="New Good News post submitted"
              time="Yesterday"
            />
            <ActivityItem
              icon="🏪"
              text="Bamfield Kayaks updated their availability"
              time="Yesterday"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BUSINESS DASHBOARD
// ============================================================================

function BusinessDashboard({ tenant }: DashboardProps): React.ReactElement {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
            {tenant.tenant_name}
          </h1>
          <p style={{ color: '#9ca3af' }}>Business Dashboard</p>
        </div>

        {/* Stats Grid - BUSINESS SPECIFIC (has revenue!) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <StatCard
            icon="💰"
            label="Total Revenue"
            value="$12,450"
            sublabel="+12% from last month"
            color="#10b981"
          />
          <StatCard
            icon="📅"
            label="Active Bookings"
            value="24"
            sublabel="+3 from last month"
            color="#3b82f6"
          />
          <StatCard
            icon="👥"
            label="Customers"
            value="156"
            sublabel="+8 from last month"
            color="#8b5cf6"
          />
          <StatCard
            icon="📈"
            label="Conversion Rate"
            value="3.2%"
            sublabel="+0.4% from last month"
            color="#f59e0b"
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <QuickAction
            icon={<Package size={24} />}
            title="Manage Catalog"
            description="Add or update your offerings"
            to="/app/catalog"
          />
          <QuickAction
            icon={<Calendar size={24} />}
            title="View Bookings"
            description="5 bookings this week"
            to="/app/bookings"
          />
          <QuickAction
            icon={<MessageSquare size={24} />}
            title="Conversations"
            description="2 unread messages"
            to="/app/conversations"
            badge={2}
          />
        </div>

        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ActivityItem
              icon="📅"
              text="New booking: John Smith - Single Kayak"
              time="1 hour ago"
            />
            <ActivityItem
              icon="💬"
              text="New message from Jane Doe"
              time="3 hours ago"
            />
            <ActivityItem
              icon="✅"
              text="Booking completed: Bob Wilson"
              time="Yesterday"
            />
            <ActivityItem
              icon="⭐"
              text="New review: 5 stars from Sarah"
              time="2 days ago"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}

function StatCard({ icon, label, value, sublabel, color }: StatCardProps): React.ReactElement {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
      </div>
      <div style={{ 
        fontSize: '28px', 
        fontWeight: 700, 
        marginBottom: '4px',
        color,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280' }}>
        {sublabel}
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  badge?: number;
}

function QuickAction({ icon, title, description, to, badge }: QuickActionProps): React.ReactElement {
  return (
    <Link
      to={to}
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '20px',
        textDecoration: 'none',
        color: 'white',
        display: 'block',
        transition: 'all 0.15s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ color: '#60a5fa' }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 500 }}>{title}</span>
            {badge && (
              <span style={{
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '12px',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 500,
              }}>
                {badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

interface ActivityItemProps {
  icon: string;
  text: string;
  time: string;
}

function ActivityItem({ icon, text, time }: ActivityItemProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '14px', marginBottom: '2px' }}>{text}</p>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{time}</span>
      </div>
    </div>
  );
}
```

## 5.3 Create: client/src/pages/admin/ImpersonationConsole.tsx

```typescript
/**
 * IMPERSONATION CONSOLE
 * 
 * Platform admin page to start/stop impersonation sessions.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Starting impersonation MUST redirect to /app/dashboard
 * 2. Stopping impersonation MUST redirect to /admin/impersonation
 * 3. Show security notice
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { Search, AlertTriangle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
}

// ============================================================================
// TYPE ICONS
// ============================================================================

const TYPE_ICONS: Record<string, string> = {
  community: '🏔️',
  government: '🏛️',
  business: '🏢',
  individual: '👤',
  platform: '⚡',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ImpersonationConsole(): React.ReactElement {
  const { impersonation, startImpersonation, stopImpersonation } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  // --------------------------------------------------------------------------
  // Fetch tenants
  // --------------------------------------------------------------------------

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      const response = await fetch('/api/admin/tenants', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  async function handleImpersonate(tenantId: string) {
    if (starting) return;
    
    setStarting(tenantId);
    try {
      // This will redirect to /app/dashboard
      await startImpersonation(tenantId, 'Admin support');
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      setStarting(null);
    }
  }

  async function handleStop() {
    if (stopping) return;
    
    setStopping(true);
    try {
      // This will redirect to /admin/impersonation
      await stopImpersonation();
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      setStopping(false);
    }
  }

  // --------------------------------------------------------------------------
  // Filter tenants
  // --------------------------------------------------------------------------

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header */}
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          Impersonation Console
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
          Temporarily access tenant accounts for support and debugging
        </p>

        {/* Active Impersonation Warning */}
        {impersonation.is_impersonating && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
                <div>
                  <h3 style={{ fontWeight: 600, color: '#fcd34d', marginBottom: '4px' }}>
                    Active Impersonation Session
                  </h3>
                  <p style={{ fontSize: '14px', color: '#fcd34d', opacity: 0.8 }}>
                    Currently impersonating: <strong>{impersonation.tenant_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={handleStop}
                disabled={stopping}
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#451a03',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: stopping ? 'not-allowed' : 'pointer',
                  opacity: stopping ? 0.7 : 1,
                }}
              >
                {stopping ? 'Stopping...' : 'Stop Impersonation'}
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>
            Security Notice
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>
            All impersonation sessions are logged with full audit trail including:
          </p>
          <ul style={{ 
            fontSize: '14px', 
            color: '#9ca3af',
            marginLeft: '20px',
            listStyleType: 'disc',
          }}>
            <li style={{ marginBottom: '4px' }}>Admin identity and IP address</li>
            <li style={{ marginBottom: '4px' }}>Target tenant and individual</li>
            <li style={{ marginBottom: '4px' }}>Session start/stop times</li>
            <li>All actions performed during impersonation</li>
          </ul>
        </div>

        {/* Search */}
        <div style={{
          position: 'relative',
          marginBottom: '24px',
        }}>
          <Search 
            size={18} 
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
            }}
          />
          <input
            type="text"
            placeholder="Search tenants by name, slug, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px 16px 12px 44px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Tenant List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(168, 85, 247, 0.3)',
              borderTopColor: '#a855f7',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {TYPE_ICONS[tenant.type] || '📁'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tenant.name}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {tenant.slug} • {tenant.type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleImpersonate(tenant.id)}
                  disabled={starting === tenant.id || impersonation.is_impersonating}
                  style={{
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: starting === tenant.id || impersonation.is_impersonating 
                      ? 'not-allowed' 
                      : 'pointer',
                    opacity: starting === tenant.id || impersonation.is_impersonating ? 0.5 : 1,
                  }}
                >
                  {starting === tenant.id ? 'Starting...' : 'Impersonate'}
                </button>
              </div>
            ))}

            {filteredTenants.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '48px 0',
                color: '#9ca3af',
              }}>
                No tenants found matching "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

## 5.4 Checkpoint - Phase 5

□ client/src/pages/app/TenantPicker.tsx exists with exact content above
□ client/src/pages/app/Dashboard.tsx exists with exact content above
□ client/src/pages/admin/ImpersonationConsole.tsx exists with exact content above
□ No TypeScript errors
□ TenantPicker has its own header (it renders WITHOUT the sidebar)
□ Dashboard shows DIFFERENT content based on tenant type

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

# PHASE 6: ROUTE CONFIGURATION

## 6.1 Update: client/src/App.tsx (or main.tsx)

This is your main routing file. Replace the routing configuration entirely.

```typescript
/**
 * APP ROUTES
 * 
 * Three route trees:
 * 1. /c/:slug/* - Public portal (no auth)
 * 2. /app/* - Tenant app (auth required)
 * 3. /admin/* - Platform admin (admin only)
 * 
 * DO NOT MODIFY THIS STRUCTURE.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context
import { TenantProvider } from './contexts/TenantContext';

// Global Components
import { ImpersonationBanner } from './components/ImpersonationBanner';

// Layouts
import { TenantAppLayout } from './layouts/TenantAppLayout';
import { PlatformAdminLayout } from './layouts/PlatformAdminLayout';
import { PublicPortalLayout } from './layouts/PublicPortalLayout';

// Pages - App
import { TenantPicker } from './pages/app/TenantPicker';
import { Dashboard } from './pages/app/Dashboard';

// Pages - Admin
import { ImpersonationConsole } from './pages/admin/ImpersonationConsole';

// Placeholder pages - replace with real implementations later
function AvailabilityConsole() {
  return <div style={{ padding: '32px' }}><h1>Availability Console</h1><p>Coming soon...</p></div>;
}
function ServiceRunsPage() {
  return <div style={{ padding: '32px' }}><h1>Service Runs</h1><p>Coming soon...</p></div>;
}
function DirectoryPage() {
  return <div style={{ padding: '32px' }}><h1>Directory</h1><p>Coming soon...</p></div>;
}
function ContentPage() {
  return <div style={{ padding: '32px' }}><h1>Content</h1><p>Coming soon...</p></div>;
}
function CatalogPage() {
  return <div style={{ padding: '32px' }}><h1>Catalog</h1><p>Coming soon...</p></div>;
}
function BookingsPage() {
  return <div style={{ padding: '32px' }}><h1>Bookings</h1><p>Coming soon...</p></div>;
}
function CustomersPage() {
  return <div style={{ padding: '32px' }}><h1>Customers</h1><p>Coming soon...</p></div>;
}
function ConversationsPage() {
  return <div style={{ padding: '32px' }}><h1>Conversations</h1><p>Coming soon...</p></div>;
}
function SettingsPage() {
  return <div style={{ padding: '32px' }}><h1>Settings</h1><p>Coming soon...</p></div>;
}
function AdminDashboard() {
  return <div style={{ padding: '32px' }}><h1>Admin Dashboard</h1><p>Coming soon...</p></div>;
}
function TenantsPage() {
  return <div style={{ padding: '32px' }}><h1>Tenants</h1><p>Coming soon...</p></div>;
}
function UsersPage() {
  return <div style={{ padding: '32px' }}><h1>Users</h1><p>Coming soon...</p></div>;
}
function PortalOverview() {
  return <div style={{ padding: '32px' }}><h1>Welcome to this community!</h1></div>;
}
function LoginPage() {
  // This should redirect to your actual auth flow
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#060b15', 
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Sign In</h1>
        <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
          Authentication page placeholder
        </p>
        <a 
          href="/api/auth/login" 
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          Sign In with Google
        </a>
      </div>
    </div>
  );
}
function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#060b15',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '64px', fontWeight: 700, marginBottom: '16px' }}>404</h1>
        <p style={{ color: '#9ca3af', marginBottom: '24px' }}>Page not found</p>
        <a href="/app" style={{ color: '#60a5fa' }}>Go to My Places</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        {/* GLOBAL: Impersonation banner - appears on all pages when active */}
        <ImpersonationBanner />

        <Routes>
          {/* ========================================== */}
          {/* PUBLIC PORTAL - /c/:slug/*                */}
          {/* ========================================== */}
          <Route path="/c/:slug" element={<PublicPortalLayout />}>
            <Route index element={<PortalOverview />} />
            {/* Add more portal routes as needed */}
          </Route>

          {/* ========================================== */}
          {/* TENANT APP - /app/*                       */}
          {/* ========================================== */}
          <Route path="/app" element={<TenantAppLayout />}>
            {/* Index = Tenant Picker (shows when no tenant selected) */}
            <Route index element={<TenantPicker />} />
            
            {/* Dashboard (content varies by tenant type) */}
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Community tenant routes */}
            <Route path="availability" element={<AvailabilityConsole />} />
            <Route path="service-runs" element={<ServiceRunsPage />} />
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="content" element={<ContentPage />} />
            
            {/* Business tenant routes */}
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            
            {/* Shared routes */}
            <Route path="conversations" element={<ConversationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ========================================== */}
          {/* PLATFORM ADMIN - /admin/*                 */}
          {/* ========================================== */}
          <Route path="/admin" element={<PlatformAdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="impersonation" element={<ImpersonationConsole />} />
            {/* Add more admin routes as needed */}
          </Route>

          {/* ========================================== */}
          {/* AUTH & REDIRECTS                          */}
          {/* ========================================== */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </TenantProvider>
    </BrowserRouter>
  );
}
```

## 6.2 Checkpoint - Phase 6

□ App.tsx (or main routing file) has exact structure above
□ TenantProvider wraps all routes
□ ImpersonationBanner is rendered OUTSIDE the Routes (global)
□ No TypeScript errors

**DO NOT PROCEED UNTIL ALL BOXES ARE CHECKED.**

---

# PHASE 7: FINAL VERIFICATION

Run through this EXACT sequence. Report PASS/FAIL for each step.

## 7.1 Layout Verification

**Step 1:** Navigate to /app (authenticated)
- □ PASS: TenantPicker page shows
- □ PASS: NO left sidebar visible
- □ PASS: Header shows logo, user info

**Step 2:** Click "Manage" on Bamfield Community (or any community tenant)
- □ PASS: Redirects to /app/dashboard
- □ PASS: LEFT SIDEBAR appears
- □ PASS: Sidebar shows: Dashboard, Availability, Service Runs, Directory, Content, Settings
- □ PASS: Sidebar does NOT show: Catalog, Bookings, Customers

**Step 3:** Verify Dashboard content
- □ PASS: Shows "Community Dashboard" subtitle
- □ PASS: Stats show: Pending Service Runs, Active Service Runs, Opted-in Businesses, Good News
- □ PASS: Stats do NOT show: Revenue, Conversion Rate

**Step 4:** Click logo/"My Places" in sidebar
- □ PASS: Returns to /app
- □ PASS: TenantPicker shows
- □ PASS: Sidebar disappears

**Step 5:** Click "Manage" on Bamfield Kayaks (or any business tenant)
- □ PASS: Redirects to /app/dashboard
- □ PASS: LEFT SIDEBAR appears
- □ PASS: Sidebar shows: Dashboard, Catalog, Bookings, Customers, Conversations, Settings
- □ PASS: Sidebar does NOT show: Availability, Service Runs, Directory, Content

**Step 6:** Verify Dashboard content
- □ PASS: Shows "Business Dashboard" subtitle
- □ PASS: Stats show: Revenue, Bookings, Customers, Conversion Rate
- □ PASS: Stats do NOT show: Service Runs, Opted-in Businesses

## 7.2 Impersonation Verification

**Step 7:** Navigate to /admin/impersonation (as platform admin)
- □ PASS: Platform Admin layout with LEFT SIDEBAR
- □ PASS: Impersonation Console page shows
- □ PASS: List of tenants visible

**Step 8:** Click "Impersonate" on Bamfield Community
- □ PASS: Redirects to /app/dashboard (NOT stays on admin page)
- □ PASS: AMBER BANNER appears at top of screen
- □ PASS: Banner shows "Impersonating: Bamfield Community"
- □ PASS: Banner has "Exit Impersonation" button
- □ PASS: LEFT SIDEBAR shows community nav

**Step 9:** Navigate to /app/availability while impersonating
- □ PASS: Availability page loads
- □ PASS: Amber banner still visible

**Step 10:** Click "Exit Impersonation" in banner
- □ PASS: Redirects to /admin/impersonation
- □ PASS: Banner disappears
- □ PASS: Admin layout restored

## 7.3 Visual Verification

**Step 11:** Check for visual issues
- □ PASS: No duplicate headers
- □ PASS: No nested layouts
- □ PASS: Borders and lines align properly
- □ PASS: No visual "hacked together" appearance

## 7.4 Final Checklist

□ TenantPicker shows WITHOUT sidebar
□ After selecting tenant, sidebar APPEARS
□ Community tenants show community nav (Availability, Service Runs, etc.)
□ Business tenants show business nav (Catalog, Bookings, etc.)
□ Impersonation REDIRECTS to /app/dashboard
□ Impersonation banner shows on ALL pages while impersonating
□ Stop impersonation REDIRECTS to /admin/impersonation
□ No duplicate headers or nested layouts
□ All elements align properly

---

# TROUBLESHOOTING

## Issue: Sidebar doesn't change when switching tenants

**Cause:** switchTenant isn't updating state properly
**Fix:** Ensure TenantContext.switchTenant sets currentTenantId AND the component re-renders

## Issue: Impersonation doesn't redirect

**Cause:** startImpersonation isn't using window.location.href
**Fix:** Must use `window.location.href = '/app/dashboard'` for full page reload

## Issue: Duplicate headers

**Cause:** TenantPicker has its own header AND it's inside a layout with a header
**Fix:** TenantPicker should only render when TenantAppLayout shows NO sidebar

## Issue: Banner doesn't push content down

**Cause:** Missing body padding
**Fix:** ImpersonationBanner must set `document.body.style.paddingTop = '48px'`

---

# END OF NUCLEAR REBUILD PACKAGE

If any verification step fails, STOP and report the failure.
Do not attempt to fix without authorization.
Do not "improve" or "optimize" the code.
Follow the instructions exactly.
