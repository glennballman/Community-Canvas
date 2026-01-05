import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useTenant } from '@/contexts/TenantContext';
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
  Phone,
  Wrench,
  Building,
  Palette,
  ChevronDown,
  ArrowLeft,
  Mountain,
  User,
  Landmark,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function TenantAppLayout() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { isActive: isImpersonating } = useImpersonation();
  const { currentTenant, tenants, switchTenant, isCommunityOperator } = useTenant();
  const location = useLocation();
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTenantDropdownOpen(false);
      }
    }
    if (tenantDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tenantDropdownOpen]);

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

  // CRITICAL: At /app (tenant picker) with no tenant selected, render without sidebar
  const isAtTenantPicker = location.pathname === '/app';
  if (isAtTenantPicker && !currentTenant) {
    return (
      <div className="min-h-screen bg-background" data-testid="tenant-picker-layout">
        <Outlet />
      </div>
    );
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

  const getTenantIcon = (type: string) => {
    switch (type) {
      case 'community': return Mountain;
      case 'government': return Landmark;
      case 'business': return Building2;
      case 'individual': return User;
      default: return Building2;
    }
  };

  const TenantIcon = currentTenant ? getTenantIcon(currentTenant.type) : Building2;

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  async function handleTenantSwitch(tenantId: string) {
    await switchTenant(tenantId);
    setTenantDropdownOpen(false);
  }

  return (
    <div data-testid="tenant-app-layout">
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex min-h-screen w-full">
          <Sidebar>
            <SidebarHeader className="border-b">
              <div className="p-4">
                <Link to="/app" className="flex items-center gap-2" data-testid="link-app-home">
                  <Mountain className="h-5 w-5 text-primary" />
                  <span className="font-semibold group-data-[collapsible=icon]:hidden">Community Canvas</span>
                </Link>
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent className="p-2">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                      className="w-full p-3 rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent text-left flex items-center gap-2"
                      data-testid="button-tenant-switcher"
                    >
                      <TenantIcon className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                        <div className="font-medium truncate text-sm">{currentTenant?.name || 'Select Tenant'}</div>
                        <div className="text-xs text-muted-foreground capitalize">{currentTenant?.type}</div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
                    </button>

                    {tenantDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-auto">
                        {tenants.map((tenant) => {
                          const Icon = getTenantIcon(tenant.type);
                          const isSelected = tenant.id === currentTenant?.id;
                          return (
                            <button
                              key={tenant.id}
                              onClick={() => handleTenantSwitch(tenant.id)}
                              className={`w-full p-3 text-left hover:bg-accent flex items-center gap-2 first:rounded-t-md last:rounded-b-md ${
                                isSelected ? 'bg-accent' : ''
                              }`}
                              data-testid={`button-switch-tenant-${tenant.id}`}
                            >
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{tenant.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{tenant.type}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.path)}
                          tooltip={item.label}
                        >
                          <Link to={item.path} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="My Places">
                    <Link to="/app" data-testid="link-my-places">
                      <ArrowLeft className="h-4 w-4" />
                      <span>My Places</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="h-14 border-b bg-background flex items-center justify-between px-4 gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>

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
                  <DropdownMenuItem 
                    onClick={logout}
                    className="cursor-pointer text-destructive"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>

            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
