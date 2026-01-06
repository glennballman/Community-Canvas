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

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

// Context
import { AuthProvider } from './contexts/AuthContext';
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

// Pages - App Community
import AvailabilityConsole from './pages/app/community/AvailabilityConsole';
import DirectoryPage from './pages/app/community/DirectoryPage';
import ContentBrandingPage from './pages/app/community/ContentBrandingPage';

// Pages - Services (restored from legacy - real implementations)
import ServiceRuns from './pages/services/ServiceRuns';
import CreateServiceRun from './pages/services/CreateServiceRun';
import ServiceRunDetail from './pages/services/ServiceRunDetail';
import ServiceCatalog from './pages/services/ServiceCatalog';
import BundlesBrowser from './pages/services/BundlesBrowser';
import WorkRequestDetail from './pages/WorkRequestDetail';

// Pages - App Business
import CatalogPage from './pages/app/business/CatalogPage';
import BookingsPage from './pages/app/business/BookingsPage';
import CustomersPage from './pages/app/business/CustomersPage';

// Pages - App Shared
import ConversationsPage from './pages/ConversationsPage';
import SettingsPage from './pages/app/SettingsPage';

// Pages - Admin
import { ImpersonationConsole } from './pages/admin/ImpersonationConsole';
import CivOSDashboard from './pages/admin/CivOSDashboard';
import TenantsManagement from './pages/admin/TenantsManagement';
import UsersManagement from './pages/admin/UsersManagement';
import AdminInfrastructure from './pages/AdminInfrastructure';
import AdminChambers from './pages/AdminChambers';
import AdminNAICS from './pages/AdminNAICS';
import Accommodations from './pages/Accommodations';
import DataImport from './pages/admin/DataImport';
import AdminSettings from './pages/AdminSettings';
import AdminLogs from './pages/AdminLogs';
import CommunitiesPage from './pages/admin/CommunitiesPage';
import SeedCommunitiesPage from './pages/admin/SeedCommunitiesPage';
import PortalConfigPage from './pages/admin/PortalConfigPage';
import AIQueuePage from './pages/admin/AIQueuePage';
import FlaggedContentPage from './pages/admin/FlaggedContentPage';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';

// Placeholder pages - for routes without existing components
function PortalOverview() {
  return <div style={{ padding: '32px' }}><h1>Welcome to this community!</h1></div>;
}

function PortalSection({ section }: { section: string }) {
  const titles: Record<string, string> = {
    businesses: 'Local Businesses',
    services: 'Community Services',
    stay: 'Places to Stay',
    events: 'Upcoming Events',
    about: 'About This Community',
  };
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>{titles[section] || section}</h1>
      <p style={{ opacity: 0.7 }}>Content for {section} coming soon...</p>
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            {/* GLOBAL: Impersonation banner - appears on all pages when active */}
            <ImpersonationBanner />

            <Routes>
              {/* ========================================== */}
              {/* PUBLIC PORTAL - /c/:slug/*                */}
              {/* ========================================== */}
              <Route path="/c/:slug" element={<PublicPortalLayout />}>
                <Route index element={<PortalOverview />} />
                <Route path="businesses" element={<PortalSection section="businesses" />} />
                <Route path="services" element={<PortalSection section="services" />} />
                <Route path="stay" element={<PortalSection section="stay" />} />
                <Route path="events" element={<PortalSection section="events" />} />
                <Route path="about" element={<PortalSection section="about" />} />
              </Route>

              {/* ========================================== */}
              {/* TENANT APP - /app/*                       */}
              {/* ========================================== */}
              <Route path="/app" element={<TenantAppLayout />}>
                <Route index element={<TenantPicker />} />
                <Route path="dashboard" element={<Dashboard />} />
                
                {/* Community tenant routes */}
                <Route path="availability" element={<AvailabilityConsole />} />
                <Route path="service-runs" element={<ServiceRuns />} />
                <Route path="service-runs/new" element={<CreateServiceRun />} />
                <Route path="service-runs/:slug" element={<ServiceRunDetail />} />
                <Route path="work-requests/:id" element={<WorkRequestDetail />} />
                <Route path="services" element={<ServiceCatalog />} />
                <Route path="bundles" element={<BundlesBrowser />} />
                <Route path="directory" element={<DirectoryPage />} />
                <Route path="content" element={<ContentBrandingPage />} />
                
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
                <Route index element={<CivOSDashboard />} />
                
                {/* Tenants & Users */}
                <Route path="tenants" element={<TenantsManagement />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="impersonation" element={<ImpersonationConsole />} />
                
                {/* Data Management */}
                <Route path="data/infrastructure" element={<AdminInfrastructure />} />
                <Route path="data/chambers" element={<AdminChambers />} />
                <Route path="data/naics" element={<AdminNAICS />} />
                <Route path="data/accommodations" element={<Accommodations />} />
                <Route path="data/import-export" element={<DataImport />} />
                
                {/* Communities */}
                <Route path="communities" element={<CommunitiesPage />} />
                <Route path="communities/seed" element={<SeedCommunitiesPage />} />
                <Route path="communities/portals" element={<PortalConfigPage />} />
                
                {/* Moderation */}
                <Route path="moderation/ai-queue" element={<AIQueuePage />} />
                <Route path="moderation/flagged" element={<FlaggedContentPage />} />
                
                {/* System */}
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logs" element={<AdminLogs />} />
              </Route>

              {/* ========================================== */}
              {/* AUTH & REDIRECTS                          */}
              {/* ========================================== */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
