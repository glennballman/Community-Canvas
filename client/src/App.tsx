import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import MobileNav from "@/components/MobileNav";
import DashboardLayout from "@/components/Dashboard/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import AdminLayout from "@/pages/AdminLayout";
import AdminHome from "@/pages/AdminHome";
import ImpersonationConsole from "@/pages/platform/ImpersonationConsole";
import AdminMatrix from "@/pages/AdminMatrix";
import AdminGeo from "@/pages/AdminGeo";
import AdminInfrastructure from "@/pages/AdminInfrastructure";
import AdminChambers from "@/pages/AdminChambers";
import AdminNAICS from "@/pages/AdminNAICS";
import AdminSources from "@/pages/AdminSources";
import AdminLogs from "@/pages/AdminLogs";
import AdminSettings from "@/pages/AdminSettings";
import DataImport from "@/pages/admin/DataImport";
import CivOSDashboard from "@/pages/admin/CivOSDashboard";
import UsersManagement from "@/pages/admin/UsersManagement";
import TenantsManagement from "@/pages/admin/TenantsManagement";
import Documentation from "@/pages/Documentation";
import TripTimelineDemo from "@/pages/TripTimelineDemo";
import Accommodations from "@/pages/Accommodations";
import NotFound from "@/pages/not-found";
import { HostAuthProvider } from "@/contexts/HostAuthContext";
import HostLogin from "@/pages/host/Login";
import HostSignup from "@/pages/host/Signup";
import ForgotPassword from "@/pages/host/ForgotPassword";
import PropertyManage from "@/pages/host/PropertyManage";
import HostDashboard from "@/pages/host/Dashboard";
import HostProperties from "@/pages/host/Properties";
import HostBookings from "@/pages/host/Bookings";
import HostSettings from "@/pages/host/Settings";
import HostPayouts from "@/pages/host/Payouts";
import AddProperty from "@/pages/host/AddProperty";
import HostCalendar from "@/pages/host/HostCalendar";
import StagingSearch from "@/pages/staging/Search";
import StagingPropertyDetail from "@/pages/staging/PropertyDetail";
import StagingBook from "@/pages/staging/BookingFlow";
import MyBookings from "@/pages/staging/MyBookings";
import ChamberDashboard from "@/pages/staging/ChamberDashboard";
import MapSearch from "@/pages/staging/MapSearch";
import NavigationHub from "@/pages/NavigationHub";
import FleetPage from "@/pages/FleetPage";
import MyProfile from "@/pages/MyProfile";
import ServiceCatalog from "@/pages/services/ServiceCatalog";
import BundlesBrowser from "@/pages/services/BundlesBrowser";
import ServiceRuns from "@/pages/services/ServiceRuns";
import ServiceRunDetail from "@/pages/services/ServiceRunDetail";
import CreateServiceRun from "@/pages/services/CreateServiceRun";
import IndividualProfile from "@/pages/profile/IndividualProfile";
import RentalBrowser from "@/pages/rentals/RentalBrowser";
import RentalBookings from "@/pages/rentals/MyBookings";
import AccommodationSearch from "@/pages/crew/AccommodationSearch";
import JobBoard from "@/pages/JobBoard";

function AppShellRoutes() {
  return (
    <AdminLayout>
      <Switch>
        {/* Admin routes */}
        <Route path="/admin" component={AdminHome} />
        <Route path="/admin/matrix" component={AdminMatrix} />
        <Route path="/admin/geo" component={AdminGeo} />
        <Route path="/admin/infrastructure" component={AdminInfrastructure} />
        <Route path="/admin/chambers" component={AdminChambers} />
        <Route path="/admin/naics" component={AdminNAICS} />
        <Route path="/admin/sources" component={AdminSources} />
        <Route path="/admin/logs" component={AdminLogs} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/import" component={DataImport} />
        <Route path="/admin/civos" component={CivOSDashboard} />
        <Route path="/admin/docs" component={Documentation} />
        <Route path="/admin/accommodations" component={Accommodations} />
        <Route path="/admin/users" component={UsersManagement} />
        <Route path="/admin/tenants" component={TenantsManagement} />
        <Route path="/profile" component={IndividualProfile} />
        <Route path="/profile/legacy" component={MyProfile} />
        
        {/* Service catalog */}
        <Route path="/services" component={ServiceCatalog} />
        <Route path="/services/catalog" component={ServiceCatalog} />
        <Route path="/services/bundles" component={BundlesBrowser} />
        <Route path="/services/runs" component={ServiceRuns} />
        <Route path="/services/runs/new" component={CreateServiceRun} />
        <Route path="/services/runs/:slug" component={ServiceRunDetail} />
        
        {/* Navigation hub */}
        <Route path="/hub" component={NavigationHub} />
        
        {/* Command center */}
        <Route path="/command-center" component={Dashboard} />
        <Route path="/legacy" component={Dashboard} />
        
        {/* Fleet management */}
        <Route path="/fleet" component={FleetPage} />
        
        {/* Staging routes */}
        <Route path="/staging" component={StagingSearch} />
        <Route path="/find-staging" component={StagingSearch} />
        <Route path="/staging/map" component={MapSearch} />
        <Route path="/staging/chamber" component={ChamberDashboard} />
        <Route path="/staging/bookings" component={MyBookings} />
        <Route path="/staging/:id/book" component={StagingBook} />
        <Route path="/staging/:id" component={StagingPropertyDetail} />
        
        {/* Host routes (dashboard, properties, bookings - NOT login/signup) */}
        <Route path="/host/dashboard" component={HostDashboard} />
        <Route path="/host/properties/add" component={AddProperty} />
        <Route path="/host/properties/:id/calendar" component={HostCalendar} />
        <Route path="/host/properties/:id/bookings" component={PropertyManage} />
        <Route path="/host/properties/:id" component={PropertyManage} />
        <Route path="/host/properties" component={HostProperties} />
        <Route path="/host/bookings" component={HostBookings} />
        <Route path="/host/settings" component={HostSettings} />
        <Route path="/host/payouts" component={HostPayouts} />
        
        {/* Trip timeline demo */}
        <Route path="/trip-timeline-demo" component={TripTimelineDemo} />
        
        {/* Accommodations */}
        <Route path="/accommodations" component={Accommodations} />
        
        {/* Platform console */}
        <Route path="/platform" component={ImpersonationConsole} />
        <Route path="/platform/impersonate" component={ImpersonationConsole} />
        
        {/* Rentals */}
        <Route path="/rentals" component={RentalBrowser} />
        <Route path="/rentals/bookings" component={RentalBookings} />
        
        {/* Crew accommodation search */}
        <Route path="/crew/accommodation-search" component={AccommodationSearch} />
        
        {/* Job board / opportunities */}
        <Route path="/jobs" component={JobBoard} />
        
        {/* Public site pages with AdminLayout */}
        <Route path="/public/overview" component={PublicOverview} />
        <Route path="/public/map" component={PublicMap} />
        <Route path="/public/webcams" component={PublicWebcams} />
        <Route path="/public/alerts" component={PublicAlerts} />
        <Route path="/public/roadtrips" component={PublicRoadTrips} />
        <Route path="/public/planning" component={PublicTripPlanning} />
        <Route path="/public/fleet" component={PublicFleet} />
        
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function PublicDashboard() {
  return <DashboardLayout />;
}

// Wrapper components for public site tabs within AdminLayout
function PublicOverview() {
  return <DashboardLayout defaultTab="overview" />;
}
function PublicMap() {
  return <DashboardLayout defaultTab="map" />;
}
function PublicWebcams() {
  return <DashboardLayout defaultTab="webcams" />;
}
function PublicAlerts() {
  return <DashboardLayout defaultTab="alerts" />;
}
function PublicRoadTrips() {
  return <DashboardLayout defaultTab="roadtrips" />;
}
function PublicTripPlanning() {
  return <DashboardLayout defaultTab="planning" />;
}
function PublicFleet() {
  return <DashboardLayout defaultTab="fleet" />;
}

function Router() {
  const [location] = useLocation();
  
  const isPublicRoute = 
    location === "/" ||
    location.startsWith("/public/") ||
    location === "/host/login" ||
    location === "/host/signup" ||
    location === "/host/forgot-password";
  
  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/" component={PublicDashboard} />
        <Route path="/public/overview" component={PublicOverview} />
        <Route path="/public/map" component={PublicMap} />
        <Route path="/public/webcams" component={PublicWebcams} />
        <Route path="/public/alerts" component={PublicAlerts} />
        <Route path="/public/roadtrips" component={PublicRoadTrips} />
        <Route path="/public/planning" component={PublicTripPlanning} />
        <Route path="/public/fleet" component={PublicFleet} />
        <Route path="/host/login" component={HostLogin} />
        <Route path="/host/signup" component={HostSignup} />
        <Route path="/host/forgot-password" component={ForgotPassword} />
      </Switch>
    );
  }
  
  return <AppShellRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <HostAuthProvider>
            <ImpersonationProvider>
              <ImpersonationBanner />
              <MobileNav />
              <main className="pb-16 lg:pb-0">
                <Router />
              </main>
              <Toaster />
            </ImpersonationProvider>
          </HostAuthProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
