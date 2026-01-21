/**
 * APP ROUTES
 * 
 * Two primary route trees:
 * 1. /c/:slug/* - Public portal (no auth)
 * 2. /app/* - All authenticated routes including:
 *    - /app/platform/* - Platform Admin mode
 *    - /app/founder/* - Founder Solo mode
 *    - /app/* - Tenant app (auth required)
 * 
 * DEPRECATED (V3.5): /admin/* routes are permanently retired.
 * All Platform Admin functionality MUST live under /app/platform/*.
 */

// DEV ONLY: Warn about legacy /admin/* routes
if (import.meta.env.DEV && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
  console.error('❌ Legacy /admin route accessed — this path is retired. Use /app/platform/* instead.');
}

import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { PortalProvider } from './contexts/PortalContext';

// Global Components
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { DebugPanel } from './components/dev/DebugPanel';

// Layouts
import { TenantAppLayout } from './layouts/TenantAppLayout';
import { PlatformAdminLayout } from './layouts/PlatformAdminLayout';
import { PublicPortalLayout } from './layouts/PublicPortalLayout';
import { PlatformLayout } from './layouts/PlatformLayout';
import { FounderLayout } from './layouts/FounderLayout';

// Pages - App
import { TenantPicker } from './pages/app/TenantPicker';
import { Dashboard } from './pages/app/Dashboard';
import DashboardPage from './pages/app/DashboardPage';
import FounderHomePage from './pages/app/FounderHomePage';
import PlatformHomePage from './pages/app/PlatformHomePage';
import { AppHomeRedirect } from './components/routing/AppHomeRedirect';
import {
  FounderOrganizationsPage,
  FounderWorkPage,
  FounderReservationsPage,
  FounderAnalyticsPage,
} from './pages/app/founder';
import ReservationsIndexPage from './pages/app/ReservationsIndexPage';
import ReservationDetailPage from './pages/app/ReservationDetailPage';

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
import ServiceRunsCalendarPage from './pages/app/ServiceRunsCalendarPage';
import CreateServiceRun from './pages/services/CreateServiceRun';
import ServiceRunDetail from './pages/services/ServiceRunDetail';
import ServiceDirectory from './pages/services/ServiceDirectory';
import BundlesBrowser from './pages/services/BundlesBrowser';
import WorkRequestDetail from './pages/WorkRequestDetail';

// Pages - Intake (Work Requests inbox)
import WorkRequestsList from './pages/intake/WorkRequestsList';
import IntakeWorkRequestDetail from './pages/intake/WorkRequestDetail';

// Pages - Contractor Preview (PROMPT 8)
import ContractorWorkRequestPreview from './pages/app/ContractorWorkRequestPreview';

// Pages - Projects
import ProjectsList from './pages/projects/ProjectsList';
import CreateProject from './pages/projects/CreateProject';
import ProjectDetail from './pages/projects/ProjectDetail';

// Pages - App Business
import InventoryPage from './pages/app/business/InventoryPage';
import InventoryItemDetail from './pages/app/business/InventoryItemDetail';
import ReservationsPage from './pages/app/business/ReservationsPage';
import CustomersPage from './pages/app/business/CustomersPage';

// Pages - App Shared
import ConversationsPage from './pages/ConversationsPage';
import CirclesPage from './pages/app/CirclesPage';
import { CirclesListPage, CircleCreatePage, CircleDetailPage } from './pages/app/circles';
import SettingsPage from './pages/app/SettingsPage';
import NotificationsPage from './pages/app/NotificationsPage';
import SystemExplorerPage from './pages/app/SystemExplorerPage';

// Pages - V3 Placeholders
import OpsBoardPage from './pages/app/OpsBoardPage';
import ParkingPage from './pages/app/ParkingPage';
import ParkingPlanPage from './pages/app/ParkingPlanPage';
import MarinaPage from './pages/app/MarinaPage';
import MarinaPlanPage from './pages/app/MarinaPlanPage';
import HospitalityPage from './pages/app/HospitalityPage';
import EnforcementPage from './pages/app/EnforcementPage';

// Pages - N3 Service Run Monitor (Patent CC-01)
import ServiceRunAttentionPage from './pages/n3/ServiceRunAttentionPage';
import ServiceRunMonitorPage from './pages/n3/ServiceRunMonitorPage';

// Pages - Ops (P-UI-11)
import HousekeepingPage from './pages/app/ops/HousekeepingPage';
import IncidentsPage from './pages/app/ops/IncidentsPage';
import CoordinationReadinessPage from './pages/app/ops/CoordinationReadinessPage';

// Pages - Jobs (V3.5)
import JobsIndexPage from './pages/app/jobs/JobsIndexPage';
import JobEditorPage from './pages/app/jobs/JobEditorPage';
import JobDestinationsPage from './pages/app/jobs/JobDestinationsPage';
import PendingPaymentsPage from './pages/app/jobs/PendingPaymentsPage';
import EmbedConfiguratorPage from './pages/app/jobs/EmbedConfiguratorPage';
import JobsModerationPage from './pages/app/mod/JobsModerationPage';
import PaidPublicationsModerationPage from './pages/app/mod/PaidPublicationsModerationPage';
import ApplicationsQueuePage from './pages/app/mod/ApplicationsQueuePage';
import HiringPulsePage from './pages/app/mod/HiringPulsePage';
import PortalGrowthPage from './pages/app/mod/PortalGrowthPage';
import HousingWaitlistPage from './pages/app/mod/HousingWaitlistPage';
import BenchPage from './pages/app/mod/BenchPage';
import EmergencyPage from './pages/app/mod/EmergencyPage';
import TenantHousingOfferPage from './pages/app/TenantHousingOfferPage';
import JobApplicationsPage from './pages/app/jobs/JobApplicationsPage';
import JobEmergencyConfirmationPage from './pages/app/jobs/JobEmergencyConfirmationPage';

// Pages - Public Jobs Portal
import PortalJobsPage from './pages/public/PortalJobsPage';
import PortalJobDetailPage from './pages/public/PortalJobDetailPage';
import PortalJobApplyPage from './pages/public/PortalJobApplyPage';
import PortalCampaignApplyPage from './pages/public/PortalCampaignApplyPage';
import PortalEmployerPage from './pages/public/PortalEmployerPage';

// Pages - Public Proposal (P-UI-09)
import PublicProposalPage from './pages/public/PublicProposalPage';

// Pages - App Proposal (P-UI-09)
import ProposalDetailPage from './pages/app/ProposalDetailPage';

// Pages - Public Reservation Routes
import { PublicReserveRoutes } from './public/routes/PublicReserveRoutes';
import AdminHomePage from './pages/app/admin/AdminHomePage';
import AdminRolesPage from './pages/app/admin/AdminRolesPage';
import AdminSettingsPage from './pages/app/admin/AdminSettingsPage';
import FoliosListPage from './pages/app/admin/FoliosListPage';
import FolioDetailPage from './pages/app/admin/FolioDetailPage';
import UsageSummaryPage from './pages/app/admin/UsageSummaryPage';
import TenantsListPage from './pages/app/platform/TenantsListPage';
import TenantDetailPage from './pages/app/platform/TenantDetailPage';
import AnalyticsPage from './pages/app/platform/AnalyticsPage';
import CertificationsPage from './pages/app/admin/CertificationsPage';
import OperatorHomePage from './pages/app/operator/OperatorHomePage';
import OperatorEmergencyIndexPage from './pages/app/operator/OperatorEmergencyIndexPage';
import OperatorEmergencyRunPage from './pages/app/operator/OperatorEmergencyRunPage';
import OperatorAuditPage from './pages/app/operator/OperatorAuditPage';
import OperatorLegalHoldsIndexPage from './pages/app/operator/OperatorLegalHoldsIndexPage';
import OperatorLegalHoldDetailPage from './pages/app/operator/OperatorLegalHoldDetailPage';
import OperatorInsuranceIndexPage from './pages/app/operator/OperatorInsuranceIndexPage';
import OperatorInsuranceClaimPage from './pages/app/operator/OperatorInsuranceClaimPage';
import OperatorDisputesIndexPage from './pages/app/operator/OperatorDisputesIndexPage';
import OperatorDisputePage from './pages/app/operator/OperatorDisputePage';
import OperatorAuthorityIndexPage from './pages/app/operator/OperatorAuthorityIndexPage';
import OperatorAuthorityGrantPage from './pages/app/operator/OperatorAuthorityGrantPage';
import PortalsPage from './pages/app/admin/PortalsPage';

// Pages - Participant (P-UI-13A)
import MyTripsPage from './pages/app/participant/MyTripsPage';
import TripDetailPage from './pages/app/participant/TripDetailPage';
import MyApplicationsPage from './pages/app/participant/MyApplicationsPage';
import ApplicationDetailPage from './pages/app/participant/ApplicationDetailPage';

// Pages - Contractor (Prompt A1, A2)
import ContractorOnboardingEntry from './pages/contractor/ContractorOnboardingEntry';
import VehicleCapturePage from './pages/contractor/VehicleCapturePage';
import ToolCapturePage from './pages/contractor/ToolCapturePage';
import StickyNoteCapturePage from './pages/contractor/StickyNoteCapturePage';
import IngestionReviewPage from './pages/contractor/IngestionReviewPage';
import ServiceAreasPage from './pages/contractor/ServiceAreasPage';
import UploadResultsPage from './pages/contractor/UploadResultsPage';

// Pages - Dev Tools (M-2)
import DevMediaPage from './pages/app/dev/DevMediaPage';

// Pages - Fleet (P-UI-15)
import FleetPage from './pages/app/fleet/FleetPage';
import FleetAssetsPage from './pages/app/fleet/FleetAssetsPage';
import FleetAssetDetailPage from './pages/app/fleet/FleetAssetDetailPage';
import FleetMaintenancePage from './pages/app/fleet/FleetMaintenancePage';
import PortalAppearancePage from './pages/app/admin/PortalAppearancePage';
import PortalQaLaunchpadPage from './pages/app/admin/PortalQaLaunchpadPage';
import PortalQaPickerPage from './pages/app/admin/PortalQaPickerPage';
import PortalZonesPage from './pages/app/admin/PortalZonesPage';
import TenantsPageApp from './pages/app/admin/TenantsPage';

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
import ArticlesPage from './pages/admin/ArticlesPage';

// Pages - Public
import PresentationViewer from './pages/public/PresentationViewer';
import PortalHomePage from './pages/public/PortalHomePage';
import PortalReservePage from './pages/public/PortalReservePage';
import PortalOnboardingPage from './pages/public/PortalOnboardingPage';
import TripPortalPage from './pages/public/TripPortalPage';
import CommunityPortalHome from './pages/portal/CommunityPortalHome';

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

function InventoryRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/app/assets/${id}`} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <PortalProvider>
            {/* GLOBAL: Impersonation banner - appears on all pages when active */}
            <ImpersonationBanner />
            
            {/* DEV ONLY: Debug panel for API monitoring */}
            <DebugPanel />

            <Routes>
              {/* ========================================== */}
              {/* PUBLIC BUSINESS PORTAL - /p/:portalSlug/* */}
              {/* ========================================== */}
              <Route path="/p/:portalSlug" element={<PortalHomePage />} />
              <Route path="/p/:portalSlug/onboarding" element={<PortalOnboardingPage />} />
              <Route path="/p/:portalSlug/reserve" element={<PortalReservePage />} />
              <Route path="/p/:portalSlug/reserve/:assetId" element={<PortalReservePage />} />
              
              {/* Public Trip Portal - guest-facing trip view */}
              <Route path="/trip/:accessCode" element={<TripPortalPage />} />
              
              {/* PROMPT 8: Contractor Preview - public route with previewToken auth */}
              <Route path="/preview/contractor/work-request/:workRequestId" element={<ContractorWorkRequestPreview />} />
              
              {/* ========================================== */}
              {/* PUBLIC PROPOSAL - /p/proposal/:proposalId */}
              {/* ========================================== */}
              <Route path="/p/proposal/:proposalId" element={<PublicProposalPage />} />
              <Route path="/p/proposal/:proposalId/pay/:token" element={<PublicProposalPage />} />
              
              {/* ========================================== */}
              {/* PUBLIC JOBS PORTAL - /b/:portalSlug/jobs  */}
              {/* ========================================== */}
              <Route path="/b/:portalSlug/jobs" element={<PortalJobsPage />} />
              <Route path="/b/:portalSlug/jobs/:postingId" element={<PortalJobDetailPage />} />
              <Route path="/b/:portalSlug/jobs/:postingId/apply" element={<PortalJobApplyPage />} />
              <Route path="/b/:portalSlug/apply/:campaignKey" element={<PortalCampaignApplyPage />} />
              <Route path="/b/:portalSlug/employers/:employerId" element={<PortalEmployerPage />} />

              {/* ========================================== */}
              {/* PUBLIC RESERVATION - /reserve/*           */}
              {/* ========================================== */}
              <Route path="/reserve/*" element={<PublicReserveRoutes />} />

              {/* ========================================== */}
              {/* PUBLIC PORTAL - /c/:slug/*                */}
              {/* ========================================== */}
              <Route path="/c/:slug" element={<PublicPortalLayout />}>
                <Route index element={<CommunityPortalHome />} />
                <Route path="businesses" element={<PortalSection section="businesses" />} />
                <Route path="services" element={<PortalSection section="services" />} />
                <Route path="stay" element={<PortalSection section="stay" />} />
                <Route path="events" element={<PortalSection section="events" />} />
                <Route path="about" element={<PortalSection section="about" />} />
              </Route>

              {/* ========================================== */}
              {/* PLATFORM MODE - /app/platform/*           */}
              {/* Dedicated layout for Platform Admin mode  */}
              {/* ========================================== */}
              <Route path="/app/platform" element={<PlatformLayout />}>
                <Route index element={<PlatformHomePage />} />
                <Route path="tenants" element={<TenantsListPage />} />
                <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="system-explorer" element={<SystemExplorerPage />} />
                <Route path="data-management" element={<AdminInfrastructure />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="impersonation" element={<ImpersonationConsole />} />
              </Route>

              {/* ========================================== */}
              {/* FOUNDER MODE - /app/founder/*             */}
              {/* Dedicated layout for Founder Solo mode    */}
              {/* ========================================== */}
              <Route path="/app/founder" element={<FounderLayout />}>
                <Route index element={<FounderHomePage />} />
                <Route path="organizations" element={<FounderOrganizationsPage />} />
                <Route path="work" element={<FounderWorkPage />} />
                <Route path="reservations" element={<FounderReservationsPage />} />
                <Route path="analytics" element={<FounderAnalyticsPage />} />
              </Route>

              {/* ========================================== */}
              {/* TENANT APP - /app/*                       */}
              {/* Tenant-scoped routes (requires tenant)    */}
              {/* ========================================== */}
              <Route path="/app" element={<TenantAppLayout />}>
                <Route index element={<AppHomeRedirect />} />
                <Route path="places" element={<TenantPicker />} />
                <Route path="dashboard" element={<DashboardPage />} />
                
                {/* V3 Operations */}
                <Route path="ops" element={<OpsBoardPage />} />
                <Route path="ops/housekeeping" element={<HousekeepingPage />} />
                <Route path="ops/incidents" element={<IncidentsPage />} />
                <Route path="ops/coordination" element={<CoordinationReadinessPage />} />
                <Route path="operations" element={<OperationsBoard />} />
                
                {/* V3 Reservations */}
                <Route path="parking" element={<ParkingPage />} />
                <Route path="parking/plan" element={<ParkingPlanPage />} />
                <Route path="marina" element={<MarinaPage />} />
                <Route path="marina/plan" element={<MarinaPlanPage />} />
                <Route path="hospitality" element={<HospitalityPage />} />
                
                {/* V3.5 Jobs */}
                <Route path="jobs" element={<JobsIndexPage />} />
                <Route path="jobs/new" element={<JobEditorPage />} />
                <Route path="jobs/:id/edit" element={<JobEditorPage />} />
                <Route path="jobs/:id/destinations" element={<JobDestinationsPage />} />
                <Route path="jobs/payments/pending" element={<PendingPaymentsPage />} />
                <Route path="jobs/embeds" element={<EmbedConfiguratorPage />} />
                
                {/* V3.5 Jobs Moderation */}
                <Route path="mod/jobs" element={<JobsModerationPage />} />
                <Route path="mod/paid-publications" element={<PaidPublicationsModerationPage />} />
                <Route path="mod/applications" element={<ApplicationsQueuePage />} />
                <Route path="mod/hiring-pulse" element={<HiringPulsePage />} />
                <Route path="mod/portals/:portalId/growth" element={<PortalGrowthPage />} />
                <Route path="mod/portals/:portalId/housing-waitlist" element={<HousingWaitlistPage />} />
                <Route path="mod/housing" element={<HousingWaitlistPage />} />
                <Route path="mod/portals/:portalId/bench" element={<BenchPage />} />
                <Route path="mod/portals/:portalId/emergency" element={<EmergencyPage />} />
                
                {/* Tenant Portal Routes */}
                <Route path="portals/:portalId/housing" element={<TenantHousingOfferPage />} />
                
                {/* V3.5 Jobs Applications */}
                <Route path="jobs/:jobId/applications" element={<JobApplicationsPage />} />
                <Route path="jobs/:jobId/emergency/:requestId" element={<JobEmergencyConfirmationPage />} />
                
                {/* V3 Work */}
                <Route path="work-requests" element={<WorkRequestsList />} />
                <Route path="services/runs" element={<ServiceRuns />} />
                <Route path="services/runs/new" element={<CreateServiceRun />} />
                <Route path="services/runs/:slug" element={<ServiceRunDetail />} />
                
                {/* V3 Compliance */}
                <Route path="enforcement" element={<EnforcementPage />} />
                
                {/* N3 Service Run Monitor (Patent CC-01) */}
                <Route path="n3/attention" element={<ServiceRunAttentionPage />} />
                <Route path="n3/monitor/:runId" element={<ServiceRunMonitorPage />} />
                
                {/* V3 Admin */}
                <Route path="admin" element={<AdminHomePage />} />
                <Route path="operator" element={<OperatorHomePage />} />
                <Route path="operator/emergency" element={<OperatorEmergencyIndexPage />} />
                <Route path="operator/emergency/:runId" element={<OperatorEmergencyRunPage />} />
                <Route path="operator/legal" element={<OperatorLegalHoldsIndexPage />} />
                <Route path="operator/legal/:holdId" element={<OperatorLegalHoldDetailPage />} />
                <Route path="operator/insurance" element={<OperatorInsuranceIndexPage />} />
                <Route path="operator/insurance/claims/:claimId" element={<OperatorInsuranceClaimPage />} />
                <Route path="operator/disputes" element={<OperatorDisputesIndexPage />} />
                <Route path="operator/disputes/:disputeId" element={<OperatorDisputePage />} />
                <Route path="operator/authority" element={<OperatorAuthorityIndexPage />} />
                <Route path="operator/authority/grants/:grantId" element={<OperatorAuthorityGrantPage />} />
                <Route path="operator/audit" element={<OperatorAuditPage />} />
                <Route path="admin/roles" element={<AdminRolesPage />} />
                <Route path="admin/settings" element={<AdminSettingsPage />} />
                <Route path="admin/folios" element={<FoliosListPage />} />
                <Route path="admin/folios/:id" element={<FolioDetailPage />} />
                <Route path="admin/usage" element={<UsageSummaryPage />} />
                <Route path="admin/certifications" element={<CertificationsPage />} />
                <Route path="admin/portals" element={<PortalsPage />} />
                <Route path="admin/portals/qa" element={<PortalQaPickerPage />} />
                <Route path="admin/portals/:portalId/qa" element={<PortalQaLaunchpadPage />} />
                <Route path="admin/portals/:portalId/appearance" element={<PortalAppearancePage />} />
                <Route path="admin/portals/:portalId/zones" element={<PortalZonesPage />} />
                <Route path="admin/tenants" element={<TenantsPageApp />} />
                
                {/* Community tenant routes */}
                <Route path="availability" element={<AvailabilityConsole />} />
                <Route path="service-runs" element={<ServiceRuns />} />
                <Route path="service-runs/new" element={<CreateServiceRun />} />
                <Route path="service-runs/:slug" element={<ServiceRunDetail />} />
                <Route path="services/calendar" element={<ServiceRunsCalendarPage />} />
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
                
                {/* Business tenant routes - new schema-aligned paths */}
                <Route path="assets" element={<InventoryPage />} />
                <Route path="assets/:id" element={<InventoryItemDetail />} />
                <Route path="reservations" element={<ReservationsIndexPage />} />
                <Route path="reservations/:id" element={<ReservationDetailPage />} />
                <Route path="proposals/:proposalId" element={<ProposalDetailPage />} />
                <Route path="customers" element={<CustomersPage />} />
                
                {/* Redirects from old paths */}
                <Route path="inventory" element={<Navigate to="/app/assets" replace />} />
                <Route path="inventory/:id" element={<InventoryRedirect />} />
                <Route path="reservations" element={<Navigate to="/app/reservations" replace />} />
                <Route path="conversations" element={<Navigate to="/app/messages" replace />} />
                
                {/* Participant routes (P-UI-13A) */}
                <Route path="participant/trips" element={<MyTripsPage />} />
                <Route path="participant/trips/:tripId" element={<TripDetailPage />} />
                <Route path="participant/applications" element={<MyApplicationsPage />} />
                <Route path="participant/applications/:appId" element={<ApplicationDetailPage />} />
                
                {/* Contractor Onboarding (Prompt A1, A2) */}
                <Route path="contractor/onboard" element={<ContractorOnboardingEntry />} />
                <Route path="contractor/onboard/vehicle" element={<VehicleCapturePage />} />
                <Route path="contractor/onboard/tools" element={<ToolCapturePage />} />
                <Route path="contractor/onboard/sticky-note" element={<StickyNoteCapturePage />} />
                <Route path="contractor/onboard/ingestions/:id" element={<IngestionReviewPage />} />
                <Route path="contractor/onboard/service-areas" element={<ServiceAreasPage />} />
                <Route path="contractor/onboard/results" element={<UploadResultsPage />} />
                
                {/* Dev Tools (M-2) */}
                <Route path="dev/media" element={<DevMediaPage />} />
                
                {/* Fleet (P-UI-15) */}
                <Route path="fleet" element={<FleetPage />} />
                <Route path="fleet/assets" element={<FleetAssetsPage />} />
                <Route path="fleet/assets/:id" element={<FleetAssetDetailPage />} />
                <Route path="fleet/maintenance" element={<FleetMaintenancePage />} />
                
                {/* Shared routes */}
                <Route path="messages" element={<ConversationsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="circles" element={<CirclesListPage />} />
                <Route path="circles/new" element={<CircleCreatePage />} />
                <Route path="circles/:circleId" element={<CircleDetailPage />} />
                <Route path="circles/switch" element={<CirclesPage />} />
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
                <Route path="assets" element={<AdminInventory />} />
                <Route path="inventory" element={<Navigate to="/admin/assets" replace />} />
                <Route path="system-explorer" element={<SystemExplorerPage />} />
                <Route path="articles" element={<ArticlesPage />} />
                <Route path="presentations" element={<Navigate to="/admin/articles" replace />} />
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
              {/* PUBLIC PRESENTATION VIEWER                */}
              {/* ========================================== */}
              <Route path="/portal/:portalSlug/p/:presentationSlug" element={<PresentationViewer />} />

              {/* ========================================== */}
              {/* AUTH & REDIRECTS                          */}
              {/* ========================================== */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </PortalProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
