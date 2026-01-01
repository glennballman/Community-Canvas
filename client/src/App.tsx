import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/Dashboard/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import AdminLayout from "@/pages/AdminLayout";
import AdminHome from "@/pages/AdminHome";
import AdminMatrix from "@/pages/AdminMatrix";
import AdminGeo from "@/pages/AdminGeo";
import AdminInfrastructure from "@/pages/AdminInfrastructure";
import AdminChambers from "@/pages/AdminChambers";
import AdminNAICS from "@/pages/AdminNAICS";
import AdminSources from "@/pages/AdminSources";
import AdminLogs from "@/pages/AdminLogs";
import AdminSettings from "@/pages/AdminSettings";
import Documentation from "@/pages/Documentation";
import TripTimelineDemo from "@/pages/TripTimelineDemo";
import Accommodations from "@/pages/Accommodations";
import NotFound from "@/pages/not-found";

function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminHome} />
        <Route path="/admin/matrix" component={AdminMatrix} />
        <Route path="/admin/geo" component={AdminGeo} />
        <Route path="/admin/infrastructure" component={AdminInfrastructure} />
        <Route path="/admin/chambers" component={AdminChambers} />
        <Route path="/admin/naics" component={AdminNAICS} />
        <Route path="/admin/sources" component={AdminSources} />
        <Route path="/admin/logs" component={AdminLogs} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/docs" component={Documentation} />
        <Route path="/admin/accommodations" component={Accommodations} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function PublicDashboard() {
  return <DashboardLayout />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={PublicDashboard} />
      <Route path="/legacy" component={Dashboard} />
      <Route path="/trip-timeline-demo" component={TripTimelineDemo} />
      <Route path="/accommodations" component={Accommodations} />
      <Route path="/admin/:rest*" component={AdminRoutes} />
      <Route path="/admin" component={AdminRoutes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
