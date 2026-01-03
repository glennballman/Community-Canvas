import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Globe,
  Radio,
  Store,
  TreePine,
  Building2,
  Search,
  MapPin,
  User,
  Truck,
  Shield,
  Download,
  Database,
  Grid3X3,
  FileText,
  Settings,
  Book,
  Map,
  Home,
  ChevronDown,
  ChevronRight,
  Activity,
  Compass,
  BarChart3,
  Camera,
  AlertTriangle,
  Navigation2,
  Wrench,
  Package,
  Play,
  ListChecks
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  count?: string;
}

interface NavSection {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navSections: NavSection[] = [
  {
    title: "Navigation",
    icon: Compass,
    defaultOpen: true,
    items: [
      { path: "/hub", label: "Navigation Hub", icon: Map },
      { path: "/command-center", label: "Command Center", icon: Shield },
      { path: "/", label: "Public Site", icon: Globe },
      { path: "/public/overview", label: "Overview", icon: BarChart3 },
      { path: "/public/map", label: "Map", icon: Map },
      { path: "/public/webcams", label: "Webcams", icon: Camera },
      { path: "/public/alerts", label: "Alerts", icon: AlertTriangle },
      { path: "/public/roadtrips", label: "Road Trips", icon: Navigation2 },
      { path: "/public/planning", label: "Trip Planning", icon: Compass },
      { path: "/public/fleet", label: "Fleet", icon: Truck },
    ]
  },
  {
    title: "Community Data",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { path: "/admin", label: "Overview", icon: LayoutDashboard },
      { path: "/admin/geo", label: "Geographic View", icon: Globe },
      { path: "/admin/infrastructure", label: "Infrastructure", icon: Radio },
      { path: "/admin/chambers", label: "Chambers", icon: Store },
      { path: "/admin/naics", label: "NAICS Explorer", icon: TreePine },
      { path: "/admin/civos", label: "CivOS Dashboard", icon: Shield },
    ]
  },
  {
    title: "Accommodations",
    icon: Building2,
    defaultOpen: true,
    items: [
      { path: "/admin/accommodations", label: "All Properties", icon: Building2, count: "7,458" },
      { path: "/staging", label: "Staging Search", icon: Search },
      { path: "/staging/map", label: "Map View", icon: MapPin },
      { path: "/host/dashboard", label: "Host Portal", icon: User },
    ]
  },
  {
    title: "Fleet & Operations",
    icon: Truck,
    defaultOpen: true,
    items: [
      { path: "/fleet", label: "Vehicle Fleet", icon: Truck },
    ]
  },
  {
    title: "Services",
    icon: Wrench,
    defaultOpen: true,
    items: [
      { path: "/services/catalog", label: "Service Catalog", icon: ListChecks },
      { path: "/services/bundles", label: "Bundles & Packages", icon: Package },
      { path: "/services/runs", label: "Service Runs", icon: Play },
      { path: "/services/runs/new", label: "Create Service Run", icon: Play },
    ]
  },
  {
    title: "Platform Admin",
    icon: Shield,
    defaultOpen: true,
    items: [
      { path: "/admin/users", label: "Users", icon: User },
      { path: "/admin/tenants", label: "Tenants", icon: Building2 },
      { path: "/profile", label: "My Profile", icon: User },
    ]
  },
  {
    title: "Data Management",
    icon: Database,
    defaultOpen: false,
    items: [
      { path: "/admin/import", label: "Accommodations Data Import", icon: Download },
      { path: "/admin/sources", label: "Manage Sources", icon: Database },
      { path: "/admin/matrix", label: "Source Matrix", icon: Grid3X3 },
      { path: "/admin/logs", label: "Scrape Logs", icon: FileText },
    ]
  },
  {
    title: "System",
    icon: Settings,
    defaultOpen: false,
    items: [
      { path: "/admin/settings", label: "Settings", icon: Settings },
      { path: "/admin/docs", label: "Documentation", icon: Book },
    ]
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    navSections.reduce((acc, section) => {
      acc[section.title] = section.defaultOpen ?? true;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const isActive = (path: string) => {
    // Exact match first
    if (location === path) return true;
    // Special case for /admin root
    if (path === "/admin" && location === "/admin") return true;
    if (path === "/" && location === "/") return true;
    // For nested routes, only match if exact or if it's a true sub-path
    // But avoid matching /services/runs when on /services/runs/new
    if (path !== "/admin" && path !== "/" && path !== "/services/runs") {
      if (location.startsWith(path + '/') || location === path) return true;
    }
    // For /services/runs specifically, only exact match
    if (path === "/services/runs" && location === "/services/runs") return true;
    return false;
  };

  return (
    <div className="flex h-screen w-full bg-background font-mono">
      {/* Fixed Left Sidebar - 280px */}
      <aside className="w-72 border-r border-border/50 bg-card/30 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <Link href="/hub">
            <div className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md" data-testid="link-sidebar-home">
              <Activity className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-sm font-bold text-foreground">Community Canvas</div>
                <div className="text-[10px] text-muted-foreground tracking-wider">BC STAGING NETWORK</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <ScrollArea className="flex-1">
          <nav className="p-2">
            {navSections.map(section => (
              <div key={section.title} className="mb-1">
                {/* Section Header - Collapsible */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground text-xs font-medium tracking-wider uppercase transition-colors"
                  data-testid={`section-toggle-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-2">
                    <section.icon className="w-3.5 h-3.5" />
                    <span>{section.title}</span>
                  </div>
                  {openSections[section.title] ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>

                {/* Section Items */}
                {openSections[section.title] && (
                  <div className="ml-2 space-y-0.5">
                    {section.items.map(item => {
                      const active = isActive(item.path);
                      return (
                        <Link key={item.path} href={item.path}>
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                              active 
                                ? "bg-primary/20 text-primary border border-primary/30" 
                                : "text-muted-foreground hover-elevate"
                            }`}
                            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="flex-1">{item.label}</span>
                            {item.count && (
                              <span className="text-[10px] text-muted-foreground">({item.count})</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer - System Status */}
        <div className="p-4 border-t border-border/50">
          <div className="text-[10px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <div className="text-muted-foreground/60">
              Last sync: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
