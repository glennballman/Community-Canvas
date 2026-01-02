import { Link, useLocation } from 'wouter';
import { useHostAuth } from '@/contexts/HostAuthContext';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  LayoutDashboard, Building2, Calendar, CreditCard, 
  Settings, LogOut, Plus, ChevronDown, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/host/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/host/properties', label: 'Properties', icon: Building2 },
  { href: '/host/bookings', label: 'Bookings', icon: Calendar },
  { href: '/host/payouts', label: 'Payouts', icon: CreditCard },
];

export function HostLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { host, logout } = useHostAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initials = host?.email 
    ? host.email.substring(0, 2).toUpperCase() 
    : 'H';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/host/dashboard">
                <span className="font-bold text-lg cursor-pointer" data-testid="link-host-home">
                  Canvas Host
                </span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(item => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={location.startsWith(item.href) ? 'secondary' : 'ghost'}
                      size="sm"
                      className="gap-2"
                      data-testid={`link-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/host/properties/add">
                <Button size="sm" className="hidden sm:flex gap-2" data-testid="button-add-property">
                  <Plus className="h-4 w-4" /> Add Property
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-profile-menu">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {host?.email}
                  </div>
                  <DropdownMenuSeparator />
                  <Link href="/host/settings">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-settings">
                      <Settings className="h-4 w-4 mr-2" /> Settings
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/host/payouts">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-payouts">
                      <CreditCard className="h-4 w-4 mr-2" /> Payouts
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-destructive" 
                    onClick={logout}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden py-4 border-t">
              <div className="flex flex-col gap-1">
                {navItems.map(item => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={location.startsWith(item.href) ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
                <Link href="/host/properties/add">
                  <Button className="w-full justify-start gap-2 mt-2" onClick={() => setMobileMenuOpen(false)}>
                    <Plus className="h-4 w-4" /> Add Property
                  </Button>
                </Link>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

export default HostLayout;
