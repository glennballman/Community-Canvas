import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Grid3X3, 
  Database, 
  Settings,
  ArrowLeft,
  Plus,
  FileText,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: "/admin", label: "OVERVIEW", icon: LayoutDashboard },
  { path: "/admin/matrix", label: "SOURCE MATRIX", icon: Grid3X3 },
  { path: "/admin/sources", label: "MANAGE SOURCES", icon: Database },
  { path: "/admin/logs", label: "SCRAPE LOGS", icon: FileText },
  { path: "/admin/settings", label: "SETTINGS", icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  
  return (
    <div className="flex h-screen w-full bg-background font-mono">
      <aside className="w-56 border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold tracking-wider text-muted-foreground">ADMIN CONSOLE</span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" data-testid="link-back-dashboard">
              <ArrowLeft className="w-3 h-3" />
              BACK TO DASHBOARD
            </Button>
          </Link>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
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
