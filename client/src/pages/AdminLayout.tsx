import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Grid3X3, 
  Database, 
  Settings,
  Plus,
  FileText,
  Activity,
  Globe,
  Radio,
  Store,
  TreePine,
  Book,
  Home,
  Shield,
  Download,
  Building2,
  Map,
  Truck,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminLayoutProps {
  children: React.ReactNode;
}

type NavItem = { path: string; label: string; icon: typeof LayoutDashboard } | { section: string };

const NAV_ITEMS: NavItem[] = [
  { section: "NAVIGATION" },
  { path: "/hub", label: "NAVIGATION HUB", icon: Map },
  { path: "/command-center", label: "COMMAND CENTER", icon: Shield },
  
  { section: "ADMIN" },
  { path: "/admin", label: "OVERVIEW", icon: LayoutDashboard },
  
  { section: "COMMUNITY DATA" },
  { path: "/admin/geo", label: "GEOGRAPHIC VIEW", icon: Globe },
  { path: "/admin/infrastructure", label: "INFRASTRUCTURE", icon: Radio },
  { path: "/admin/chambers", label: "CHAMBERS", icon: Store },
  { path: "/admin/naics", label: "NAICS EXPLORER", icon: TreePine },
  
  { section: "ACCOMMODATIONS" },
  { path: "/admin/accommodations", label: "ALL PROPERTIES", icon: Building2 },
  { path: "/staging", label: "STAGING SEARCH", icon: Search },
  { path: "/host/dashboard", label: "HOST PORTAL", icon: Home },
  
  { section: "OPERATIONS" },
  { path: "/admin/civos", label: "CIVOS DASHBOARD", icon: Shield },
  { path: "/fleet", label: "VEHICLE FLEET", icon: Truck },
  { path: "/admin/import", label: "DATA IMPORT", icon: Download },
  { path: "/admin/sources", label: "MANAGE SOURCES", icon: Database },
  { path: "/admin/matrix", label: "SOURCE MATRIX", icon: Grid3X3 },
  { path: "/admin/logs", label: "SCRAPE LOGS", icon: FileText },
  
  { section: "SYSTEM" },
  { path: "/admin/settings", label: "SETTINGS", icon: Settings },
  { path: "/admin/docs", label: "DOCUMENTATION", icon: Book },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  
  return (
    <div className="flex h-screen w-full bg-background font-mono">
      <aside className="w-56 border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-3 border-b border-border/50">
          <Link href="/hub">
            <div className="flex items-center gap-2 cursor-pointer hover-elevate p-2 rounded-md" data-testid="link-hub-header">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold tracking-wider text-muted-foreground">COMMUNITY CANVAS</span>
            </div>
          </Link>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item, index) => {
              if ('section' in item) {
                return (
                  <div key={item.section} className="pt-4 pb-1 first:pt-0">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-3">
                      {item.section}
                    </div>
                  </div>
                );
              }
              
              const isActive = location === item.path || 
                (item.path !== "/admin" && location.startsWith(item.path));
              const isExactAdmin = item.path === "/admin" && location === "/admin";
              const active = isExactAdmin || (item.path !== "/admin" && isActive);
              
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                      active 
                        ? "bg-primary/20 text-primary border border-primary/30" 
                        : "text-muted-foreground hover-elevate"
                    }`}
                    data-testid={`link-admin-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="tracking-wide">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
          
          <div className="mt-6 pt-4 border-t border-border/30">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Quick Actions
            </div>
            <Link href="/admin/sources">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" data-testid="button-add-source">
                <Plus className="w-3 h-3" />
                ADD NEW SOURCE
              </Button>
            </Link>
          </div>
        </ScrollArea>
        
        <div className="p-3 border-t border-border/50 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>SYSTEM ONLINE</span>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
