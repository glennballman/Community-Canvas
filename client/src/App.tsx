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

// Pages - App Operations
import OperationsBoard from './pages/app/operations/OperationsBoard';

// Pages - CRM
import PlacesList from './pages/crm/PlacesList';
import PlaceDetail from './pages/crm/PlaceDetail';
import PeopleList from './pages/crm/PeopleList';
import PersonDetail from './pages/crm/PersonDetail';
import OrgsList from './pages/crm/OrgsList';
import OrgDetail from './pages/crm/OrgDetail';

// Pages - Services (restored from legacy - real implementations)
import ServiceRuns from './pages/services/ServiceRuns';
import CreateServiceRun from './pages/services/CreateServiceRun';
import ServiceRunDetail from './pages/services/ServiceRunDetail';
import ServiceDirectory from './pages/services/ServiceDirectory';
import BundlesBrowser from './pages/services/BundlesBrowser';
import WorkRequestDetail from './pages/WorkRequestDetail';

// Pages - Intake (Work Requests inbox)
import WorkRequestsList from './pages/intake/WorkRequestsList';
import IntakeWorkRequestDetail from './pages/intake/WorkRequestDetail';

// Pages - Projects
import ProjectsList from './pages/projects/ProjectsList';
import CreateProject from './pages/projects/CreateProject';
import ProjectDetail from './pages/projects/ProjectDetail';

// Pages - App Business
import InventoryPage from './pages/app/business/InventoryPage';
import InventoryItemDetail from './pages/app/business/InventoryItemDetail';
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
import AdminInventory from './pages/admin/AdminInventory';

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
                <Route path="operations" element={<OperationsBoard />} />
                <Route path="service-runs" element={<ServiceRuns />} />
                <Route path="service-runs/new" element={<CreateServiceRun />} />
                <Route path="service-runs/:slug" element={<ServiceRunDetail />} />
                <Route path="work-requests/:id" element={<WorkRequestDetail />} />
                <Route path="services" element={<ServiceDirectory />} />
                <Route path="bundles" element={<BundlesBrowser />} />
                <Route path="directory" element={<DirectoryPage />} />
                <Route path="content" element={<ContentBrandingPage />} />
                
                {/* CRM routes (shared between community and business) */}
                <Route path="crm/places" element={<PlacesList />} />
                <Route path="crm/places/:id" element={<PlaceDetail />} />
                <Route path="crm/people" element={<PeopleList />} />
                <Route path="crm/people/:id" element={<PersonDetail />} />
                <Route path="crm/orgs" element={<OrgsList />} />
                <Route path="crm/orgs/:id" element={<OrgDetail />} />
                
                {/* Intake - Work Requests (quick capture inbox) */}
                <Route path="intake/work-requests" element={<WorkRequestsList />} />
                <Route path="intake/work-requests/:id" element={<IntakeWorkRequestDetail />} />
                
                {/* Projects - Job tracking from lead to paid */}
                <Route path="projects" element={<ProjectsList />} />
                <Route path="projects/new" element={<CreateProject />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                
                {/* Business tenant routes */}
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="inventory/:id" element={<InventoryItemDetail />} />
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
                <Route path="inventory" element={<AdminInventory />} />
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
