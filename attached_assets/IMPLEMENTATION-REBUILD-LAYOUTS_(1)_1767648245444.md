# COMMUNITY CANVAS - COMPLETE LAYOUT IMPLEMENTATION

## MANDATORY REQUIREMENTS

This document contains the EXACT implementation for the three-mode navigation architecture.
Follow this LINE BY LINE. Do not deviate. Do not "improve" or "simplify".

**THE THREE RULES:**
1. Navigation is ALWAYS in a LEFT SIDEBAR (except public portal which has no sidebar)
2. Navigation items are determined by tenant TYPE (community vs business)
3. Impersonation REDIRECTS to /app and shows a GLOBAL BANNER

---

## FILE STRUCTURE

```
client/src/
├── App.tsx                          # Route configuration
├── layouts/
│   ├── TenantAppLayout.tsx          # /app/* - LEFT SIDEBAR, role-based nav
│   ├── PlatformAdminLayout.tsx      # /admin/* - LEFT SIDEBAR, admin nav
│   └── PublicPortalLayout.tsx       # /c/:slug/* - NO sidebar, tabs only
├── components/
│   ├── ImpersonationBanner.tsx      # Global banner when impersonating
│   ├── TenantSwitcher.tsx           # Dropdown in sidebar
│   ├── SidebarNav.tsx               # Reusable sidebar nav component
│   └── UserMenu.tsx                 # User dropdown at bottom of sidebar
├── contexts/
│   └── TenantContext.tsx            # Tenant state management
├── pages/
│   └── app/
│       ├── TenantPicker.tsx         # /app - home screen
│       ├── Dashboard.tsx            # /app/dashboard - role-aware
│       └── community/
│           └── AvailabilityConsole.tsx
└── lib/
    └── api.ts                       # API utilities
```

---

## FILE 1: client/src/App.tsx

```tsx
/**
 * MAIN APPLICATION - ROUTE CONFIGURATION
 * 
 * Three route trees:
 * 1. /c/:slug/* - Public portal (no auth)
 * 2. /app/* - Tenant app (auth required)  
 * 3. /admin/* - Platform admin (admin only)
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Global components
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { TenantProvider } from './contexts/TenantContext';

// Layouts
import { TenantAppLayout } from './layouts/TenantAppLayout';
import { PlatformAdminLayout } from './layouts/PlatformAdminLayout';
import { PublicPortalLayout } from './layouts/PublicPortalLayout';

// Pages - Tenant App
import { TenantPicker } from './pages/app/TenantPicker';
import { Dashboard } from './pages/app/Dashboard';
import { AvailabilityConsole } from './pages/app/community/AvailabilityConsole';
import { ServiceRunsPage } from './pages/app/community/ServiceRunsPage';
import { DirectoryPage } from './pages/app/community/DirectoryPage';
import { ContentPage } from './pages/app/community/ContentPage';
import { CatalogPage } from './pages/app/business/CatalogPage';
import { BookingsPage } from './pages/app/business/BookingsPage';
import { CustomersPage } from './pages/app/business/CustomersPage';
import { ConversationsPage } from './pages/app/ConversationsPage';
import { SettingsPage } from './pages/app/SettingsPage';

// Pages - Platform Admin
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { TenantsPage } from './pages/admin/TenantsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { ImpersonationConsolePage } from './pages/admin/ImpersonationConsolePage';
import { InfrastructurePage } from './pages/admin/InfrastructurePage';
import { ChambersPage } from './pages/admin/ChambersPage';

// Pages - Public Portal
import { PortalOverview } from './pages/portal/PortalOverview';
import { PortalBusinesses } from './pages/portal/PortalBusinesses';
import { PortalServices } from './pages/portal/PortalServices';

// Auth
import { LoginPage } from './pages/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        {/* GLOBAL IMPERSONATION BANNER - Always rendered, shows only when active */}
        <ImpersonationBanner />
        
        <Routes>
          {/* ========================================== */}
          {/* PUBLIC PORTAL - /c/:slug/*                 */}
          {/* No authentication required                 */}
          {/* NO left sidebar - horizontal tabs only     */}
          {/* ========================================== */}
          <Route path="/c/:slug" element={<PublicPortalLayout />}>
            <Route index element={<PortalOverview />} />
            <Route path="businesses" element={<PortalBusinesses />} />
            <Route path="services" element={<PortalServices />} />
            <Route path="stay" element={<PortalStay />} />
            <Route path="events" element={<PortalEvents />} />
            <Route path="about" element={<PortalAbout />} />
          </Route>

          {/* ========================================== */}
          {/* TENANT APP - /app/*                        */}
          {/* Authentication required                    */}
          {/* LEFT SIDEBAR with role-based navigation    */}
          {/* ========================================== */}
          <Route path="/app" element={<TenantAppLayout />}>
            {/* Tenant Picker - shown when no tenant selected */}
            <Route index element={<TenantPicker />} />
            
            {/* Dashboard - content varies by tenant type */}
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Community tenant routes */}
            <Route path="availability" element={<AvailabilityConsole />} />
            <Route path="service-runs" element={<ServiceRunsPage />} />
            <Route path="service-runs/:id" element={<ServiceRunDetailPage />} />
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="content" element={<ContentPage />} />
            
            {/* Business tenant routes */}
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="catalog/import" element={<CatalogImportPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            
            {/* Shared routes */}
            <Route path="conversations" element={<ConversationsPage />} />
            <Route path="conversations/:id" element={<ConversationDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ========================================== */}
          {/* PLATFORM ADMIN - /admin/*                  */}
          {/* Platform admin required                    */}
          {/* LEFT SIDEBAR with admin navigation         */}
          {/* ========================================== */}
          <Route path="/admin" element={<PlatformAdminLayout />}>
            <Route index element={<AdminDashboard />} />
            
            {/* Tenants & Users */}
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="tenants/:id" element={<TenantDetailPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="impersonation" element={<ImpersonationConsolePage />} />
            
            {/* Data Management */}
            <Route path="data/infrastructure" element={<InfrastructurePage />} />
            <Route path="data/chambers" element={<ChambersPage />} />
            <Route path="data/naics" element={<NAICSPage />} />
            <Route path="data/accommodations" element={<AccommodationsPage />} />
            <Route path="data/import-export" element={<ImportExportPage />} />
            
            {/* Communities */}
            <Route path="communities" element={<CommunitiesPage />} />
            <Route path="communities/seed" element={<SeedCommunitiesPage />} />
            <Route path="communities/portals" element={<PortalConfigPage />} />
            
            {/* Moderation */}
            <Route path="moderation/ai-queue" element={<AIQueuePage />} />
            <Route path="moderation/flagged" element={<FlaggedContentPage />} />
            
            {/* System */}
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="logs" element={<LogsPage />} />
          </Route>

          {/* ========================================== */}
          {/* AUTH & REDIRECTS                           */}
          {/* ========================================== */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </TenantProvider>
    </BrowserRouter>
  );
}

// Placeholder components - implement as needed
function PortalStay() { return <div>Stay</div>; }
function PortalEvents() { return <div>Events</div>; }
function PortalAbout() { return <div>About</div>; }
function ServiceRunDetailPage() { return <div>Service Run Detail</div>; }
function CatalogImportPage() { return <div>Catalog Import</div>; }
function ConversationDetailPage() { return <div>Conversation Detail</div>; }
function TenantDetailPage() { return <div>Tenant Detail</div>; }
function NAICSPage() { return <div>NAICS</div>; }
function AccommodationsPage() { return <div>Accommodations</div>; }
function ImportExportPage() { return <div>Import/Export</div>; }
function CommunitiesPage() { return <div>Communities</div>; }
function SeedCommunitiesPage() { return <div>Seed Communities</div>; }
function PortalConfigPage() { return <div>Portal Config</div>; }
function AIQueuePage() { return <div>AI Queue</div>; }
function FlaggedContentPage() { return <div>Flagged Content</div>; }
function AdminSettingsPage() { return <div>Admin Settings</div>; }
function LogsPage() { return <div>Logs</div>; }
function NotFoundPage() { 
  return (
    <div className="min-h-screen bg-[#060b15] text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-gray-400 mb-4">Page not found</p>
        <a href="/app" className="text-blue-400 hover:underline">Go to My Places</a>
      </div>
    </div>
  );
}
```

---

## FILE 2: client/src/contexts/TenantContext.tsx

```tsx
/**
 * TENANT CONTEXT
 * 
 * Manages:
 * - Current user
 * - User's tenant memberships
 * - Currently selected tenant
 * - Impersonation state
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Types
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
  refreshContext: () => Promise<void>;
  startImpersonation: (tenantId: string, reason?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ is_impersonating: false });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch user context on mount
  useEffect(() => {
    fetchContext();
  }, []);

  async function fetchContext() {
    try {
      const res = await fetch('/api/me/context', { credentials: 'include' });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Not authenticated - that's okay, will redirect in layout
          setUser(null);
          setMemberships([]);
          setCurrentTenantId(null);
        }
        return;
      }
      
      const data = await res.json();
      
      setUser(data.user);
      setMemberships(data.memberships || []);
      setCurrentTenantId(data.current_tenant_id || null);
      setImpersonation({
        is_impersonating: data.is_impersonating || false,
        tenant_id: data.impersonated_tenant?.id,
        tenant_name: data.impersonated_tenant?.name,
        expires_at: data.impersonation_expires_at,
      });
    } catch (error) {
      console.error('Failed to fetch context:', error);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }

  const refreshContext = useCallback(async () => {
    await fetchContext();
  }, []);

  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch('/api/me/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to switch tenant');
      }
      
      setCurrentTenantId(tenantId);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      throw error;
    }
  }, []);

  const startImpersonation = useCallback(async (tenantId: string, reason?: string) => {
    try {
      const res = await fetch('/api/admin/impersonation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId, reason }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to start impersonation');
      }
      
      const data = await res.json();
      
      setImpersonation({
        is_impersonating: true,
        tenant_id: data.tenant.id,
        tenant_name: data.tenant.name,
        expires_at: data.expires_at,
      });
      
      // CRITICAL: Redirect to tenant app
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
      
      setImpersonation({ is_impersonating: false });
      
      // CRITICAL: Redirect back to admin
      window.location.href = '/admin/impersonation';
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      throw error;
    }
  }, []);

  // Derive current tenant from memberships
  const currentTenant = currentTenantId
    ? memberships.find(m => m.tenant_id === currentTenantId) || null
    : null;

  const value: TenantContextValue = {
    user,
    memberships,
    currentTenant,
    impersonation,
    loading,
    initialized,
    switchTenant,
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

---

## FILE 3: client/src/components/ImpersonationBanner.tsx

```tsx
/**
 * IMPERSONATION BANNER
 * 
 * CRITICAL: This component appears at the TOP of the ENTIRE app when impersonating.
 * It is position: fixed and pushes content down.
 */

import React, { useEffect, useState } from 'react';
import { useTenant } from '../contexts/TenantContext';

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useTenant();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [stopping, setStopping] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (!impersonation.is_impersonating || !impersonation.expires_at) {
      return;
    }

    function updateTime() {
      const expires = new Date(impersonation.expires_at!).getTime();
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

  // Add body padding when banner is visible
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

  async function handleStop() {
    setStopping(true);
    try {
      await stopImpersonation();
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
    } finally {
      setStopping(false);
    }
  }

  // Don't render if not impersonating
  if (!impersonation.is_impersonating) {
    return null;
  }

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950"
      style={{ height: '48px' }}
    >
      <div className="h-full max-w-screen-2xl mx-auto px-4 flex items-center justify-between">
        {/* Left side - Status */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-900 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-900"></span>
          </span>
          <span className="font-bold text-sm uppercase tracking-wide">Impersonating:</span>
          <span className="font-semibold">{impersonation.tenant_name}</span>
        </div>

        {/* Right side - Timer and Stop button */}
        <div className="flex items-center gap-4">
          {timeLeft && (
            <span className="text-sm opacity-80">{timeLeft}</span>
          )}
          <button
            onClick={handleStop}
            disabled={stopping}
            className="px-4 py-1.5 bg-amber-900 text-amber-50 rounded-md text-sm font-medium hover:bg-amber-950 disabled:opacity-50 transition-colors"
          >
            {stopping ? 'Stopping...' : 'Stop Impersonation'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## FILE 4: client/src/layouts/TenantAppLayout.tsx

```tsx
/**
 * TENANT APP LAYOUT
 * 
 * Used for all /app/* routes.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. LEFT SIDEBAR navigation (NOT top nav)
 * 2. Nav items determined by tenant TYPE
 * 3. Tenant switcher in sidebar
 * 4. "My Places" link at bottom
 */

import React, { useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
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
  User
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

// Navigation configuration
const COMMUNITY_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Phone, label: 'Availability', href: '/app/availability' },
  { icon: Wrench, label: 'Service Runs', href: '/app/service-runs' },
  { icon: Building2, label: 'Directory', href: '/app/directory' },
  { icon: Palette, label: 'Content', href: '/app/content' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

const BUSINESS_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Package, label: 'Catalog', href: '/app/catalog' },
  { icon: Calendar, label: 'Bookings', href: '/app/bookings' },
  { icon: Users, label: 'Customers', href: '/app/customers' },
  { icon: MessageSquare, label: 'Conversations', href: '/app/conversations' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

const INDIVIDUAL_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: MessageSquare, label: 'Conversations', href: '/app/conversations' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

export function TenantAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, memberships, currentTenant, loading, initialized, switchTenant } = useTenant();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (initialized && !user) {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [initialized, user, navigate, location.pathname]);

  // Show loading state
  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-[#060b15] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, don't render (will redirect)
  if (!user) {
    return null;
  }

  // If at /app exactly and no tenant selected, show TenantPicker (via Outlet)
  const isAtTenantPicker = location.pathname === '/app';
  
  // If we have a tenant selected, show full layout with sidebar
  // If no tenant and not at picker, redirect to picker
  if (!currentTenant && !isAtTenantPicker) {
    navigate('/app');
    return null;
  }

  // Determine nav items based on tenant type
  const getNavItems = () => {
    if (!currentTenant) return [];
    
    switch (currentTenant.tenant_type) {
      case 'community':
      case 'government':
        return COMMUNITY_NAV;
      case 'business':
        return BUSINESS_NAV;
      case 'individual':
      default:
        return INDIVIDUAL_NAV;
    }
  };

  const navItems = getNavItems();

  // Type icons for tenant display
  const typeIcons: Record<string, string> = {
    community: '🏔️',
    government: '🏛️',
    business: '🏢',
    individual: '👤',
  };

  // Handle tenant switch
  async function handleSwitchTenant(tenantId: string) {
    try {
      await switchTenant(tenantId);
      setTenantDropdownOpen(false);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  }

  // If at tenant picker (no tenant selected), render without sidebar
  if (isAtTenantPicker && !currentTenant) {
    return (
      <div className="min-h-screen bg-[#060b15] text-white">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b15] text-white flex">
      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside 
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-white/10 flex flex-col transition-all duration-200`}
      >
        {/* Logo */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <Link to="/app" className="flex items-center gap-2 min-w-0">
            <span className="text-xl">🌐</span>
            {!sidebarCollapsed && (
              <span className="font-semibold text-sm truncate">Community Canvas</span>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Tenant Switcher */}
        {currentTenant && (
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <button
                onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                className="w-full p-2 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{typeIcons[currentTenant.tenant_type] || '📁'}</span>
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{currentTenant.tenant_name}</div>
                        <div className="text-xs text-gray-500 capitalize">{currentTenant.tenant_type}</div>
                      </div>
                      <ChevronDown size={16} className="text-gray-400" />
                    </>
                  )}
                </div>
              </button>

              {/* Dropdown */}
              {tenantDropdownOpen && !sidebarCollapsed && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setTenantDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a2744] border border-white/10 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                    {memberships.map((m) => (
                      <button
                        key={m.tenant_id}
                        onClick={() => handleSwitchTenant(m.tenant_id)}
                        className={`w-full p-3 text-left hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          m.tenant_id === currentTenant.tenant_id ? 'bg-blue-600/20' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{typeIcons[m.tenant_type] || '📁'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{m.tenant_name}</div>
                            <div className="text-xs text-gray-500 capitalize">{m.tenant_type} • {m.role}</div>
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
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10">
          {/* My Places link */}
          <Link
            to="/app"
            className="flex items-center gap-3 px-5 py-3 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? 'My Places' : undefined}
          >
            <ArrowLeft size={18} />
            {!sidebarCollapsed && <span className="text-sm">My Places</span>}
          </Link>

          {/* User menu */}
          <div className="p-3 border-t border-white/10">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {(user.full_name || user.email)[0].toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate">{user.full_name || user.email}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                )}
              </button>

              {/* User dropdown */}
              {userMenuOpen && !sidebarCollapsed && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setUserMenuOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 bottom-full mb-1 bg-[#1a2744] border border-white/10 rounded-lg shadow-xl z-50">
                    <Link
                      to="/app/settings"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/10 rounded-t-lg"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User size={16} />
                      My Profile
                    </Link>
                    {user.is_platform_admin && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-purple-400 hover:bg-white/10"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={16} />
                        Platform Admin
                      </Link>
                    )}
                    <hr className="border-white/10" />
                    <a
                      href="/api/auth/logout"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 rounded-b-lg"
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

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

---

## FILE 5: client/src/layouts/PlatformAdminLayout.tsx

```tsx
/**
 * PLATFORM ADMIN LAYOUT
 * 
 * Used for all /admin/* routes.
 * Requires is_platform_admin = true.
 * 
 * CRITICAL: LEFT SIDEBAR navigation (NOT top nav)
 */

import React, { useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Database,
  Landmark,
  Map,
  Home,
  FileBox,
  Globe,
  Sprout,
  Settings2,
  Bot,
  Flag,
  Settings,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

// Admin navigation sections
const ADMIN_NAV = [
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
      { icon: Map, label: 'NAICS', href: '/admin/data/naics' },
      { icon: Home, label: 'Accommodations', href: '/admin/data/accommodations' },
      { icon: FileBox, label: 'Import/Export', href: '/admin/data/import-export' },
    ],
  },
  {
    title: 'COMMUNITIES',
    items: [
      { icon: Globe, label: 'All Communities', href: '/admin/communities' },
      { icon: Sprout, label: 'Seed Communities', href: '/admin/communities/seed' },
      { icon: Settings2, label: 'Portal Config', href: '/admin/communities/portals' },
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
      { icon: FileText, label: 'Logs', href: '/admin/logs' },
    ],
  },
];

export function PlatformAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, initialized } = useTenant();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (initialized) {
      if (!user) {
        navigate('/login', { state: { from: location.pathname } });
      } else if (!user.is_platform_admin) {
        navigate('/app');
      }
    }
  }, [initialized, user, navigate, location.pathname]);

  // Show loading state
  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-[#060b15] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (!user?.is_platform_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#060b15] text-white flex">
      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside 
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-white/10 flex flex-col transition-all duration-200`}
      >
        {/* Logo */}
        <div className="h-16 px-4 flex items-center gap-2 border-b border-white/10">
          <span className="text-xl">⚡</span>
          {!sidebarCollapsed && (
            <span className="font-semibold text-sm text-purple-300">Platform Admin</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {ADMIN_NAV.map((section) => (
            <div key={section.title} className="mb-4">
              {!sidebarCollapsed && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === '/admin'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-purple-600/20 text-purple-400'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`
                    }
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon size={20} />
                    {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom - Back to App */}
        <div className="p-3 border-t border-white/10">
          <Link
            to="/app"
            className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
            {!sidebarCollapsed && <span className="text-sm">Back to App</span>}
          </Link>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between">
          <div></div>
          <div className="flex items-center gap-4">
            <Link to="/app" className="text-sm text-gray-400 hover:text-white">
              Back to App
            </Link>
            <span className="text-sm text-gray-500">{user.email}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

---

## FILE 6: client/src/layouts/PublicPortalLayout.tsx

```tsx
/**
 * PUBLIC PORTAL LAYOUT
 * 
 * Used for all /c/:slug/* routes.
 * NO authentication required.
 * NO left sidebar - uses horizontal tabs.
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useParams, NavLink, Link } from 'react-router-dom';

interface PortalTheme {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  logo_url?: string;
  tagline?: string;
}

interface PortalData {
  tenant: {
    id: string;
    name: string;
    portal_slug: string;
    theme: PortalTheme;
    portal_config: any;
  };
  area_groups: Array<{
    tenant_id: string;
    name: string;
    portal_slug: string;
  }>;
}

export function PublicPortalLayout() {
  const { slug } = useParams<{ slug: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchPortal(slug);
    }
  }, [slug]);

  async function fetchPortal(portalSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/portals/${portalSlug}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Community not found' : 'Failed to load');
        return;
      }
      const data = await res.json();
      setPortal(data);
      
      // Update page title
      if (data.tenant?.name) {
        document.title = data.tenant.name;
      }
    } catch (err) {
      setError('Failed to load community');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1829] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading community...</p>
        </div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-[#0c1829] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏔️</div>
          <h1 className="text-2xl font-bold mb-2">Community Not Found</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link to="/" className="text-blue-400 hover:underline">Go Home</Link>
        </div>
      </div>
    );
  }

  const theme = portal.tenant.theme;
  const config = portal.tenant.portal_config;

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: theme.background_color || '#0c1829',
        color: theme.text_color || '#f8fafc'
      }}
    >
      {/* Header */}
      <header className="border-b" style={{ borderColor: `${theme.primary_color}40` }}>
        <div className="max-w-7xl mx-auto px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {theme.logo_url ? (
                <img src={theme.logo_url} alt={portal.tenant.name} className="h-10" />
              ) : (
                <span className="text-3xl">🏔️</span>
              )}
              <div>
                <h1 className="text-xl font-bold">{portal.tenant.name}</h1>
                {theme.tagline && (
                  <p className="text-sm opacity-75">{theme.tagline}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Area switcher */}
              {portal.area_groups.length > 0 && (
                <select className="bg-white/10 border border-white/20 rounded px-3 py-1.5 text-sm">
                  <option value="">Switch area...</option>
                  {portal.area_groups.map((area) => (
                    <option key={area.tenant_id} value={area.portal_slug}>
                      {area.name}
                    </option>
                  ))}
                </select>
              )}
              
              <Link 
                to="/app"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: theme.accent_color || '#f59e0b' }}
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Navigation tabs - HORIZONTAL, NOT SIDEBAR */}
          <nav className="flex gap-1 -mb-px">
            <TabLink to={`/c/${slug}`} end>Overview</TabLink>
            {config?.show_businesses && <TabLink to={`/c/${slug}/businesses`}>Businesses</TabLink>}
            {config?.show_service_runs && <TabLink to={`/c/${slug}/services`}>Services</TabLink>}
            {config?.show_accommodations && <TabLink to={`/c/${slug}/stay`}>Stay</TabLink>}
            <TabLink to={`/c/${slug}/events`}>Events</TabLink>
            <TabLink to={`/c/${slug}/about`}>About</TabLink>
          </nav>
        </div>
      </header>

      {/* Main content - FULL WIDTH, NO SIDEBAR */}
      <main>
        <Outlet context={{ portal }} />
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-8" style={{ borderColor: `${theme.primary_color}40` }}>
        <div className="max-w-7xl mx-auto px-4 text-center text-sm opacity-75">
          <p>Powered by <a href="/" className="underline">Community Canvas</a></p>
        </div>
      </footer>
    </div>
  );
}

function TabLink({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-4 py-3 text-sm font-medium border-b-2 transition ${
          isActive
            ? 'border-current opacity-100'
            : 'border-transparent opacity-75 hover:opacity-100'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
```

---

## FILE 7: client/src/pages/app/TenantPicker.tsx

```tsx
/**
 * TENANT PICKER
 * 
 * The home screen at /app when no tenant is selected.
 * Shows all tenants the user has access to, grouped by type.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export function TenantPicker() {
  const navigate = useNavigate();
  const { user, memberships, switchTenant } = useTenant();

  async function handleManage(tenantId: string) {
    try {
      await switchTenant(tenantId);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  }

  // Group memberships by type
  const communities = memberships.filter(m => 
    m.tenant_type === 'community' || m.tenant_type === 'government'
  );
  const businesses = memberships.filter(m => m.tenant_type === 'business');
  const personal = memberships.filter(m => m.tenant_type === 'individual');

  const typeIcons: Record<string, string> = {
    community: '🏔️',
    government: '🏛️',
    business: '🏢',
    individual: '👤',
  };

  return (
    <div className="min-h-screen bg-[#060b15] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌐</span>
            <span className="font-semibold">Community Canvas</span>
          </div>
          <div className="flex items-center gap-4">
            {user?.is_platform_admin && (
              <Link to="/admin" className="text-sm text-purple-400 hover:text-purple-300">
                Platform Admin
              </Link>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
              </div>
              <span className="text-sm text-gray-400">{user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Places</h1>
          <p className="text-gray-400">Choose what you want to manage</p>
        </div>

        {/* Empty state */}
        {memberships.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏔️</div>
            <h2 className="text-2xl font-bold mb-2">No places yet</h2>
            <p className="text-gray-400 mb-8">
              You don't have access to any communities or businesses yet.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                to="/explore"
                className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Explore Communities
              </Link>
            </div>
          </div>
        )}

        {/* Communities */}
        {communities.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏔️</span>
              <h2 className="text-xl font-semibold">Communities you manage</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4 ml-10">
              Answer the phone, coordinate services, and view opted-in availability
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 ml-10">
              {communities.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  typeIcon={typeIcons[tenant.tenant_type]}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Businesses */}
        {businesses.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏢</span>
              <h2 className="text-xl font-semibold">Businesses you manage</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4 ml-10">
              Publish your catalog, manage availability, and handle bookings
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 ml-10">
              {businesses.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  typeIcon={typeIcons[tenant.tenant_type]}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Personal */}
        {personal.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">👤</span>
              <h2 className="text-xl font-semibold">Personal</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4 ml-10">
              Your personal profile and activity
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 ml-10">
              {personal.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  typeIcon={typeIcons[tenant.tenant_type]}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Quick actions */}
        {memberships.length > 0 && (
          <div className="mt-12 pt-8 border-t border-white/10">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/app/create-business"
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10"
              >
                + Add a Business
              </Link>
              <Link
                to="/explore"
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10"
              >
                Join a Community
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

interface TenantCardProps {
  tenant: {
    tenant_id: string;
    tenant_name: string;
    tenant_type: string;
    portal_slug?: string;
    role: string;
    is_primary: boolean;
  };
  typeIcon: string;
  onManage: () => void;
}

function TenantCard({ tenant, typeIcon, onManage }: TenantCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcon}</span>
          <h3 className="font-medium">{tenant.tenant_name}</h3>
        </div>
        {tenant.is_primary && (
          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
            Primary
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-500 capitalize mb-4">{tenant.role}</p>
      
      <div className="flex gap-2">
        <button
          onClick={onManage}
          className="flex-1 bg-blue-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Manage
        </button>
        {tenant.portal_slug && (
          <Link
            to={`/c/${tenant.portal_slug}`}
            target="_blank"
            className="px-3 py-2 bg-white/10 text-sm rounded-lg hover:bg-white/20 transition-colors"
            title="View public page"
          >
            👁️
          </Link>
        )}
      </div>
    </div>
  );
}
```

---

## FILE 8: client/src/pages/app/Dashboard.tsx

```tsx
/**
 * DASHBOARD
 * 
 * Shows different content based on tenant type:
 * - Community: Service runs, opted-in businesses, activity
 * - Business: Revenue, bookings, customers
 */

import React from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { currentTenant } = useTenant();

  if (!currentTenant) {
    return (
      <div className="p-8">
        <p className="text-gray-400">No tenant selected</p>
      </div>
    );
  }

  const isCommunity = currentTenant.tenant_type === 'community' || currentTenant.tenant_type === 'government';

  if (isCommunity) {
    return <CommunityDashboard tenant={currentTenant} />;
  }

  return <BusinessDashboard tenant={currentTenant} />;
}

function CommunityDashboard({ tenant }: { tenant: any }) {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{tenant.tenant_name}</h1>
            <p className="text-gray-400">Community Dashboard</p>
          </div>
          {tenant.portal_slug && (
            <Link
              to={`/c/${tenant.portal_slug}`}
              target="_blank"
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>👁️</span>
              <span>View Public Portal</span>
            </Link>
          )}
        </div>

        {/* Stats - Community specific */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="⏳"
            label="Pending Service Runs"
            value="2"
            sublabel="awaiting review"
          />
          <StatCard
            icon="🔧"
            label="Active Service Runs"
            value="3"
            sublabel="in progress"
          />
          <StatCard
            icon="🏪"
            label="Opted-in Businesses"
            value="5"
            sublabel="sharing availability"
          />
          <StatCard
            icon="💛"
            label="Good News Posts"
            value="12"
            sublabel="this month"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <QuickAction
            icon="📞"
            title="Availability Console"
            description="Answer calls with real-time availability"
            to="/app/availability"
          />
          <QuickAction
            icon="🔧"
            title="Review Service Runs"
            description="2 runs awaiting approval"
            to="/app/service-runs"
            badge={2}
          />
          <QuickAction
            icon="🎨"
            title="Edit Public Portal"
            description="Update branding and content"
            to="/app/content"
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3 text-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessDashboard({ tenant }: { tenant: any }) {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{tenant.tenant_name}</h1>
          <p className="text-gray-400">Business Dashboard</p>
        </div>

        {/* Stats - Business specific */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="💰"
            label="Total Revenue"
            value="$12,450"
            sublabel="+12% from last month"
          />
          <StatCard
            icon="📅"
            label="Active Bookings"
            value="24"
            sublabel="+3 from last month"
          />
          <StatCard
            icon="👥"
            label="Customers"
            value="156"
            sublabel="+8 from last month"
          />
          <StatCard
            icon="📈"
            label="Conversion Rate"
            value="3.2%"
            sublabel="+0.4% from last month"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <QuickAction
            icon="📦"
            title="Manage Catalog"
            description="Add or update your offerings"
            to="/app/catalog"
          />
          <QuickAction
            icon="📅"
            title="View Bookings"
            description="5 bookings this week"
            to="/app/bookings"
          />
          <QuickAction
            icon="💬"
            title="Conversations"
            description="2 unread messages"
            to="/app/conversations"
            badge={2}
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3 text-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sublabel }: { 
  icon: string; 
  label: string; 
  value: string; 
  sublabel: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{sublabel}</div>
    </div>
  );
}

function QuickAction({ icon, title, description, to, badge }: {
  icon: string;
  title: string;
  description: string;
  to: string;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-blue-500/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{title}</h3>
            {badge && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({ icon, text, time }: { icon: string; text: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <span>{icon}</span>
      <div className="flex-1">
        <p>{text}</p>
        <span className="text-xs text-gray-500">{time}</span>
      </div>
    </div>
  );
}
```

---

## FILE 9: client/src/pages/admin/ImpersonationConsolePage.tsx

```tsx
/**
 * IMPERSONATION CONSOLE
 * 
 * Platform admin page to start/stop impersonation sessions.
 * CRITICAL: Starting impersonation must REDIRECT to /app/dashboard
 */

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../contexts/TenantContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
}

export function ImpersonationConsolePage() {
  const { impersonation, startImpersonation, stopImpersonation } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      const res = await fetch('/api/admin/tenants', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleImpersonate(tenantId: string) {
    setStarting(tenantId);
    try {
      // This will redirect to /app/dashboard
      await startImpersonation(tenantId, 'Admin testing');
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      setStarting(null);
    }
  }

  async function handleStop() {
    try {
      await stopImpersonation();
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
    }
  }

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const typeIcons: Record<string, string> = {
    community: '🏔️',
    government: '🏛️',
    business: '🏢',
    individual: '👤',
    platform: '⚡',
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Impersonation Console</h1>
        <p className="text-gray-400 mb-8">
          Temporarily access tenant accounts for support and debugging
        </p>

        {/* Active impersonation warning */}
        {impersonation.is_impersonating && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-400">⚠️ Active Impersonation Session</h3>
                <p className="text-sm text-amber-300/80">
                  Currently impersonating: {impersonation.tenant_name}
                </p>
              </div>
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-amber-500 text-amber-950 rounded-lg font-medium hover:bg-amber-400"
              >
                Stop Impersonation
              </button>
            </div>
          </div>
        )}

        {/* Security notice */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Security Notice</h3>
          <p className="text-sm text-gray-400">
            All impersonation sessions are logged with full audit trail including:
          </p>
          <ul className="text-sm text-gray-400 mt-2 space-y-1">
            <li>• Admin identity and IP address</li>
            <li>• Target tenant</li>
            <li>• Session start/end times</li>
            <li>• All actions performed during impersonation</li>
          </ul>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Tenant list */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{typeIcons[tenant.type] || '📁'}</span>
                  <div>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-sm text-gray-500">
                      {tenant.slug} • {tenant.type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleImpersonate(tenant.id)}
                  disabled={starting === tenant.id || impersonation.is_impersonating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {starting === tenant.id ? 'Starting...' : 'Impersonate'}
                </button>
              </div>
            ))}

            {filteredTenants.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No tenants found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## API ENDPOINTS REQUIRED

The following endpoints must exist and work correctly:

### GET /api/me/context

```typescript
// Response when not impersonating
{
  "user": {
    "id": "uuid",
    "email": "string",
    "full_name": "string",
    "is_platform_admin": boolean
  },
  "memberships": [
    {
      "tenant_id": "uuid",
      "tenant_name": "string",
      "tenant_slug": "string",
      "tenant_type": "community|business|government|individual",
      "portal_slug": "string|null",
      "role": "owner|admin|member",
      "is_primary": boolean
    }
  ],
  "current_tenant_id": "uuid|null",
  "is_impersonating": false
}

// Response when impersonating
{
  "user": { ... },
  "memberships": [ /* impersonated tenant's membership */ ],
  "current_tenant_id": "impersonated_tenant_id",
  "is_impersonating": true,
  "impersonated_tenant": {
    "id": "uuid",
    "name": "string",
    "type": "string"
  },
  "impersonation_expires_at": "ISO datetime"
}
```

### POST /api/me/switch-tenant

```typescript
// Request
{ "tenant_id": "uuid" }

// Response
{ "success": true }
```

### POST /api/admin/impersonation/start

```typescript
// Request
{ "tenant_id": "uuid", "reason": "string" }

// Response
{
  "success": true,
  "tenant": { "id": "uuid", "name": "string", "type": "string" },
  "expires_at": "ISO datetime"
}
```

### POST /api/admin/impersonation/stop

```typescript
// Response
{ "success": true }
```

### GET /api/admin/tenants

```typescript
// Response
{
  "tenants": [
    {
      "id": "uuid",
      "name": "string",
      "slug": "string",
      "type": "string",
      "status": "active|inactive"
    }
  ]
}
```

---

## VERIFICATION CHECKLIST

After implementing all files, verify:

□ Navigate to /app → TenantPicker shows, NO left sidebar
□ Click "Manage" on community tenant → LEFT SIDEBAR appears with community nav
□ Left sidebar shows: Dashboard, Availability, Service Runs, Directory, Content, Settings
□ Click "Manage" on business tenant → LEFT SIDEBAR shows business nav
□ Left sidebar shows: Dashboard, Catalog, Bookings, Customers, Conversations, Settings
□ Tenant switcher dropdown works to change tenants
□ "My Places" link returns to /app
□ Navigate to /admin → Platform Admin layout with admin nav
□ Click "Impersonate" → REDIRECTS to /app/dashboard
□ Amber banner appears at top when impersonating
□ "Stop Impersonation" redirects back to /admin/impersonation
□ Navigate to /c/bamfield → Public portal, NO left sidebar, horizontal tabs

**ANY DEVIATION FROM THIS SPEC IS A BUG.**
