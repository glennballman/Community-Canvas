import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Database,
  Map,
  FileText,
  Settings,
  Shield,
  Flag,
  Layers,
  Globe,
  Import,
  Menu,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Tenants & Users',
    items: [
      { label: 'Tenants', path: '/admin/tenants', icon: Building2 },
      { label: 'Users', path: '/admin/users', icon: Users },
      { label: 'Impersonation', path: '/admin/impersonation', icon: UserCog },
    ],
  },
  {
    title: 'Data Management',
    items: [
      { label: 'Infrastructure', path: '/admin/data/infrastructure', icon: Database },
      { label: 'Chambers', path: '/admin/data/chambers', icon: Layers },
      { label: 'NAICS', path: '/admin/data/naics', icon: FileText },
      { label: 'Accommodations', path: '/admin/data/accommodations', icon: Map },
      { label: 'Import/Export', path: '/admin/data/import-export', icon: Import },
    ],
  },
  {
    title: 'Communities',
    items: [
      { label: 'All Communities', path: '/admin/communities', icon: Globe },
      { label: 'Seed Communities', path: '/admin/communities/seed', icon: Database },
      { label: 'Portal Config', path: '/admin/communities/portals', icon: Settings },
    ],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'AI Queue', path: '/admin/moderation/ai-queue', icon: Shield },
      { label: 'Flagged Content', path: '/admin/moderation/flagged', icon: Flag },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', path: '/admin/settings', icon: Settings },
      { label: 'Logs', path: '/admin/logs', icon: FileText },
    ],
  },
];

export default function PlatformAdminLayout() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/app" replace />;
  }

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const SideNav = () => (
    <ScrollArea className="h-full py-4">
      <div className="px-3 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h4>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive(item.path) ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start gap-2"
                    data-testid={`link-admin-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="platform-admin-layout">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" data-testid="button-admin-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b">
                <span className="font-semibold">Platform Admin</span>
              </div>
              <SideNav />
            </SheetContent>
          </Sheet>

          <Link 
            to="/admin" 
            className="font-semibold text-lg flex items-center gap-2"
            data-testid="link-admin-home"
          >
            <Shield className="h-5 w-5 text-primary" />
            <span>Platform Admin</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/app">
              <Button variant="outline" size="sm" data-testid="button-back-to-app">
                Back to App
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground">{user?.email}</span>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-64 border-r min-h-[calc(100vh-3.5rem)]">
          <SideNav />
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
