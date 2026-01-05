import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useTenant } from '@/contexts/TenantContext';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Calendar,
  Package,
  Users,
  Settings,
  LogOut,
  Building2,
  MessageSquare,
  Menu,
  Phone,
  Wrench,
  Building,
  Palette,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function TenantAppLayout() {
  const { user, loading, isAuthenticated } = useAuth();
  const { isActive: isImpersonating } = useImpersonation();
  const { currentTenant, isCommunityOperator } = useTenant();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated && !isImpersonating) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const communityNavItems = [
    { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Availability', path: '/app/availability', icon: Phone },
    { label: 'Service Runs', path: '/app/service-runs', icon: Wrench },
    { label: 'Directory', path: '/app/directory', icon: Building },
    { label: 'Content', path: '/app/content', icon: Palette },
    { label: 'Settings', path: '/app/settings', icon: Settings },
  ];

  const businessNavItems = [
    { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Catalog', path: '/app/catalog', icon: Package },
    { label: 'Bookings', path: '/app/bookings', icon: Calendar },
    { label: 'Customers', path: '/app/customers', icon: Users },
    { label: 'Conversations', path: '/app/conversations', icon: MessageSquare },
    { label: 'Settings', path: '/app/settings', icon: Settings },
  ];

  const navItems = isCommunityOperator ? communityNavItems : businessNavItems;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <Link key={item.path} to={item.path}>
          <Button
            variant={isActive(item.path) ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2 justify-start w-full lg:w-auto"
            data-testid={`link-nav-${item.label.toLowerCase()}`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Button>
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="tenant-app-layout">
      <ImpersonationBanner />
      
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Link 
            to="/app" 
            className="font-semibold text-lg flex items-center gap-2"
            data-testid="link-app-home"
          >
            <Building2 className="h-5 w-5" />
            <span className="hidden sm:inline">{currentTenant?.name || 'My Places'}</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ml-4">
            <NavLinks />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <nav className="flex flex-col gap-2 mt-6">
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-medium">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/profile" className="cursor-pointer" data-testid="link-profile">
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/app/settings" className="cursor-pointer" data-testid="link-settings">
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/logout" className="cursor-pointer text-destructive" data-testid="link-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
