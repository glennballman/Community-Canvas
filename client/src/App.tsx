import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { HostAuthProvider } from "@/contexts/HostAuthContext";
import { TenantProvider } from "@/contexts/TenantContext";

import PublicPortalLayout from "@/layouts/PublicPortalLayout";
import TenantAppLayout from "@/layouts/TenantAppLayout";
import PlatformAdminLayout from "@/layouts/PlatformAdminLayout";

import CommunityPortalOverview from "@/pages/portal/CommunityPortalOverview";
import CommunityPortalBusinesses from "@/pages/portal/CommunityPortalBusinesses";
import CommunityPortalServices from "@/pages/portal/CommunityPortalServices";
import CommunityPortalStay from "@/pages/portal/CommunityPortalStay";

import TenantPicker from "@/pages/app/TenantPicker";
import TenantDashboard from "@/pages/app/TenantDashboard";
import ProfilePage from "@/pages/app/ProfilePage";
import SettingsPage from "@/pages/app/SettingsPage";

import AvailabilityConsole from "@/pages/app/community/AvailabilityConsole";
import ServiceRunsPage from "@/pages/app/community/ServiceRunsPage";
import DirectoryPage from "@/pages/app/community/DirectoryPage";
import ContentBrandingPage from "@/pages/app/community/ContentBrandingPage";

import CatalogPage from "@/pages/app/business/CatalogPage";
import CatalogOnboarding from "@/pages/app/business/CatalogOnboarding";
import AvailabilityPricingPage from "@/pages/app/business/AvailabilityPricingPage";
import BookingsPage from "@/pages/app/business/BookingsPage";
import CustomersPage from "@/pages/app/business/CustomersPage";

import LoginPage from "@/pages/auth/LoginPage";

import AdminHome from "@/pages/AdminHome";
import TenantsManagement from "@/pages/admin/TenantsManagement";
import UsersManagement from "@/pages/admin/UsersManagement";
import ImpersonationConsole from "@/pages/platform/ImpersonationConsole";
import AdminInfrastructure from "@/pages/AdminInfrastructure";
import AdminChambers from "@/pages/AdminChambers";
import AdminNAICS from "@/pages/AdminNAICS";
import AdminSettings from "@/pages/AdminSettings";
import AdminLogs from "@/pages/AdminLogs";
import DataImport from "@/pages/admin/DataImport";
import Accommodations from "@/pages/Accommodations";
import Documentation from "@/pages/Documentation";

import NotFound from "@/pages/not-found";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

function ServiceRunDetailPublic() { return <div className="p-6">Service Run Detail (Public)</div>; }
function CommunityPortalEvents() { return <div className="p-6">Events</div>; }
function CommunityPortalAbout() { return <div className="p-6">About</div>; }
function ServiceRunsPendingPage() { return <div className="p-6">Pending Service Runs</div>; }
function CreateServiceRunPage() { return <div className="p-6">Create Service Run</div>; }
function DirectoryBusinessesPage() { return <div className="p-6">Directory Businesses</div>; }
function AccommodationsPage() { return <div className="p-6">Accommodations</div>; }
function ParkingMooragePage() { return <div className="p-6">Parking & Moorage</div>; }
function AdminsPermissionsPage() { return <div className="p-6">Admins & Permissions</div>; }
function CatalogImportPage() { return <div className="p-6">Catalog Import</div>; }
function OperationsPage() { return <div className="p-6">Operations</div>; }
function PaymentsPage() { return <div className="p-6">Payments</div>; }
function ConversationsPage() { return <div className="p-6">Conversations</div>; }
function ConversationDetailPage() { return <div className="p-6">Conversation Detail</div>; }
function TenantDetailPage() { return <div className="p-6">Tenant Detail</div>; }
function AccommodationsDataPage() { return <div className="p-6">Accommodations Data</div>; }
function ImportExportPage() { return <div className="p-6">Import/Export</div>; }
function CommunitiesPage() { return <div className="p-6">Communities</div>; }
function SeedCommunitiesPage() { return <div className="p-6">Seed Communities</div>; }
function PortalConfigPage() { return <div className="p-6">Portal Config</div>; }
function ModerationQueuePage() { return <div className="p-6">Moderation Queue</div>; }
function FlaggedContentPage() { return <div className="p-6">Flagged Content</div>; }
function SystemLogsPage() { return <div className="p-6">System Logs</div>; }

function LogoutPage() {
  window.location.href = '/api/auth/logout';
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ImpersonationProvider>
            <TenantProvider>
              <HostAuthProvider>
                <BrowserRouter>
                <ImpersonationBanner />
                <Routes>
                  {/* ============================================ */}
                  {/* PUBLIC PORTAL - /c/:slug/*                   */}
                  {/* No authentication required                   */}
                  {/* ============================================ */}
                  <Route path="/c/:slug" element={<PublicPortalLayout />}>
                    <Route index element={<CommunityPortalOverview />} />
                    <Route path="businesses" element={<CommunityPortalBusinesses />} />
                    <Route path="services" element={<CommunityPortalServices />} />
                    <Route path="services/:runId" element={<ServiceRunDetailPublic />} />
                    <Route path="stay" element={<CommunityPortalStay />} />
                    <Route path="events" element={<CommunityPortalEvents />} />
                    <Route path="about" element={<CommunityPortalAbout />} />
                  </Route>

                  {/* ============================================ */}
                  {/* TENANT APP - /app/*                          */}
                  {/* Authentication required                      */}
                  {/* ============================================ */}
                  <Route path="/app" element={<TenantAppLayout />}>
                    <Route index element={<TenantPicker />} />
                    <Route path="dashboard" element={<TenantDashboard />} />
                    
                    {/* Community Admin Routes */}
                    <Route path="availability" element={<AvailabilityConsole />} />
                    <Route path="service-runs" element={<ServiceRunsPage />} />
                    <Route path="service-runs/pending" element={<ServiceRunsPendingPage />} />
                    <Route path="service-runs/new" element={<CreateServiceRunPage />} />
                    <Route path="directory" element={<DirectoryPage />} />
                    <Route path="directory/businesses" element={<DirectoryBusinessesPage />} />
                    <Route path="accommodations" element={<AccommodationsPage />} />
                    <Route path="parking-moorage" element={<ParkingMooragePage />} />
                    <Route path="content" element={<ContentBrandingPage />} />
                    <Route path="admins" element={<AdminsPermissionsPage />} />
                    
                    {/* Business Routes */}
                    <Route path="catalog" element={<CatalogPage />} />
                    <Route path="catalog/onboarding" element={<CatalogOnboarding />} />
                    <Route path="catalog/import" element={<CatalogImportPage />} />
                    <Route path="pricing" element={<AvailabilityPricingPage />} />
                    <Route path="bookings" element={<BookingsPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="operations" element={<OperationsPage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    
                    {/* Shared Routes */}
                    <Route path="conversations" element={<ConversationsPage />} />
                    <Route path="conversations/:id" element={<ConversationDetailPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* ============================================ */}
                  {/* PLATFORM ADMIN - /admin/*                    */}
                  {/* Platform admin required                      */}
                  {/* ============================================ */}
                  <Route path="/admin" element={<PlatformAdminLayout />}>
                    <Route index element={<AdminHome />} />
                    
                    {/* Tenants & Users */}
                    <Route path="tenants" element={<TenantsManagement />} />
                    <Route path="tenants/:id" element={<TenantDetailPage />} />
                    <Route path="users" element={<UsersManagement />} />
                    <Route path="impersonation" element={<ImpersonationConsole />} />
                    
                    {/* Data Management */}
                    <Route path="data/infrastructure" element={<AdminInfrastructure />} />
                    <Route path="data/chambers" element={<AdminChambers />} />
                    <Route path="data/naics" element={<AdminNAICS />} />
                    <Route path="data/accommodations" element={<AccommodationsDataPage />} />
                    <Route path="data/import-export" element={<ImportExportPage />} />
                    
                    {/* Communities */}
                    <Route path="communities" element={<CommunitiesPage />} />
                    <Route path="communities/seed" element={<SeedCommunitiesPage />} />
                    <Route path="communities/portals" element={<PortalConfigPage />} />
                    
                    {/* Moderation */}
                    <Route path="moderation/ai-queue" element={<ModerationQueuePage />} />
                    <Route path="moderation/flagged" element={<FlaggedContentPage />} />
                    
                    {/* System */}
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="logs" element={<AdminLogs />} />
                    <Route path="docs" element={<Documentation />} />
                    <Route path="import" element={<DataImport />} />
                    <Route path="accommodations" element={<Accommodations />} />
                  </Route>

                  {/* ============================================ */}
                  {/* AUTH & REDIRECTS                             */}
                  {/* ============================================ */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/logout" element={<LogoutPage />} />
                  
                  {/* Root redirects to app */}
                  <Route path="/" element={<Navigate to="/app" replace />} />
                  
                  {/* Legacy route redirects */}
                  <Route path="/conversations" element={<Navigate to="/app/conversations" replace />} />
                  <Route path="/service-runs" element={<Navigate to="/app/service-runs" replace />} />
                  <Route path="/platform" element={<Navigate to="/admin/impersonation" replace />} />
                  <Route path="/platform/impersonate" element={<Navigate to="/admin/impersonation" replace />} />
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              <Toaster />
              </HostAuthProvider>
            </TenantProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
