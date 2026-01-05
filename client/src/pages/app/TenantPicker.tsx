import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  User, 
  ExternalLink, 
  Plus, 
  Compass,
  Settings,
  LogOut,
  ChevronDown,
  Mountain
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TenantStats {
  bookings_today?: number;
  items_listed?: number;
  pending_requests?: number;
  active_runs?: number;
  needs_setup?: boolean;
}

interface TenantMembership {
  id: string;
  name: string;
  slug: string;
  type: string;
  role: string;
  is_primary?: boolean;
  portal_slug?: string;
  stats?: TenantStats;
}

export default function TenantPicker() {
  const { user, ccTenants, logout, isPlatformAdmin, loading } = useAuth();
  const { currentTenant, switchTenant, loading: tenantLoading } = useTenant();
  const [switching, setSwitching] = useState<string | null>(null);
  const navigate = useNavigate();

  // GUARD: If tenant is already selected (including via impersonation), redirect to dashboard
  useEffect(() => {
    if (!tenantLoading && currentTenant) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [currentTenant, tenantLoading, navigate]);

  // Show nothing while redirecting
  if (currentTenant) {
    return null;
  }

  async function handleSelectTenant(tenant: TenantMembership) {
    setSwitching(tenant.id);
    try {
      await switchTenant(tenant.id);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      navigate('/app/dashboard');
    } finally {
      setSwitching(null);
    }
  }

  const communities = ccTenants.filter(m => 
    m.type === 'community' || m.type === 'government'
  );
  const businesses = ccTenants.filter(m => m.type === 'business');
  const personal = ccTenants.filter(m => m.type === 'individual');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-tenant-picker">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your places...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="tenant-picker">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mountain className="h-6 w-6 text-primary" />
            <span className="font-semibold">Community Canvas</span>
          </div>
          <div className="flex items-center gap-4">
            {isPlatformAdmin && (
              <Link 
                to="/admin" 
                className="text-sm text-primary hover:underline"
                data-testid="link-platform-admin"
              >
                Platform Admin
              </Link>
            )}
            <UserDropdown user={user} onLogout={logout} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Your Places</h1>
          <p className="text-muted-foreground">Choose what you want to manage</p>
        </div>

        {ccTenants.length === 0 ? (
          <EmptyState isPlatformAdmin={isPlatformAdmin} />
        ) : (
          <>
            {communities.length > 0 && (
              <TenantSection
                icon={<Users className="h-6 w-6" />}
                title="Communities you manage"
                description="Answer the phone, coordinate services, and view opted-in availability"
                tenants={communities}
                onSelect={handleSelectTenant}
                switching={switching}
              />
            )}

            {businesses.length > 0 && (
              <TenantSection
                icon={<Building2 className="h-6 w-6" />}
                title="Businesses you manage"
                description="Publish your catalog, manage availability, and handle bookings"
                tenants={businesses}
                onSelect={handleSelectTenant}
                switching={switching}
              />
            )}

            {personal.length > 0 && (
              <TenantSection
                icon={<User className="h-6 w-6" />}
                title="Personal"
                description="Your personal profile and activity"
                tenants={personal}
                onSelect={handleSelectTenant}
                switching={switching}
              />
            )}

            <div className="mt-12 pt-8 border-t">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <Link to="/app/catalog/onboarding" data-testid="link-add-business">
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add a Business
                  </Button>
                </Link>
                <Link to="/explore" data-testid="link-join-community">
                  <Button variant="outline">
                    <Compass className="h-4 w-4 mr-2" />
                    Join a Community
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function TenantSection({
  icon,
  title,
  description,
  tenants,
  onSelect,
  switching
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tenants: TenantMembership[];
  onSelect: (tenant: TenantMembership) => void;
  switching: string | null;
}) {
  return (
    <section className="mb-10" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="text-primary">{icon}</div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-muted-foreground text-sm mb-4 ml-10">{description}</p>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 ml-10">
        {tenants.map((tenant) => (
          <TenantCard 
            key={tenant.id} 
            tenant={tenant} 
            onSelect={() => onSelect(tenant)}
            isSwitching={switching === tenant.id}
          />
        ))}
      </div>
    </section>
  );
}

function TenantCard({ 
  tenant, 
  onSelect,
  isSwitching
}: { 
  tenant: TenantMembership;
  onSelect: () => void;
  isSwitching: boolean;
}) {
  const isCommunity = tenant.type === 'community' || tenant.type === 'government';
  const stats = tenant.stats || {};

  return (
    <Card 
      className="hover-elevate group" 
      data-testid={`card-tenant-${tenant.id}`}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="min-w-0">
            <h3 className="font-medium group-hover:text-primary transition truncate">
              {tenant.name}
            </h3>
            <p className="text-sm text-muted-foreground capitalize">{tenant.role}</p>
          </div>
          {tenant.is_primary && (
            <Badge variant="secondary" className="shrink-0">
              Primary
            </Badge>
          )}
        </div>

        {(stats.active_runs !== undefined || stats.pending_requests !== undefined || 
          stats.bookings_today !== undefined || stats.items_listed !== undefined) && (
          <div className="flex gap-4 mb-4 text-sm flex-wrap">
            {isCommunity ? (
              <>
                {stats.active_runs !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Active runs: </span>
                    <span className="font-medium">{stats.active_runs}</span>
                  </div>
                )}
                {stats.pending_requests !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Pending: </span>
                    <span className="font-medium text-amber-500">{stats.pending_requests}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {stats.bookings_today !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Today: </span>
                    <span className="font-medium">{stats.bookings_today}</span>
                  </div>
                )}
                {stats.items_listed !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Items: </span>
                    <span className="font-medium">{stats.items_listed}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {stats.needs_setup && (
          <div className="mb-3">
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              Needs setup
            </Badge>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onSelect}
            className="flex-1"
            disabled={isSwitching}
            data-testid={`button-manage-${tenant.id}`}
          >
            {isSwitching ? 'Loading...' : 'Manage'}
          </Button>
          {tenant.portal_slug && (
            <Button
              variant="outline"
              size="icon"
              asChild
              title={isCommunity ? "View public portal" : "View listing"}
              data-testid={`button-view-portal-${tenant.id}`}
            >
              <Link to={`/c/${tenant.portal_slug}`} target="_blank">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  return (
    <div className="text-center py-16" data-testid="empty-state">
      <Mountain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold mb-2">You don't have anything to manage yet</h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Join a community, create a business listing, or ask an admin to invite you.
      </p>
      
      <div className="flex justify-center gap-4 flex-wrap">
        <Link to="/explore" data-testid="link-explore-communities">
          <Button>
            <Compass className="h-4 w-4 mr-2" />
            Explore Communities
          </Button>
        </Link>
        <Link to="/app/catalog/onboarding" data-testid="link-create-business">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create a Business
          </Button>
        </Link>
      </div>
      
      {isPlatformAdmin && (
        <Card className="mt-8 inline-block">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              As a platform admin, you can{' '}
              <Link to="/admin" className="text-primary underline" data-testid="link-admin-panel">
                access the admin panel
              </Link>
              {' '}to create tenants.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserDropdown({ 
  user, 
  onLogout 
}: { 
  user: { id: string; email: string; displayName: string; firstName?: string | null } | null;
  onLogout: () => void;
}) {
  if (!user) return null;

  const initials = (user.displayName || user.email)[0].toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2"
          data-testid="button-user-menu"
        >
          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
          <span className="text-sm hidden md:block">{user.displayName || user.email}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/app/profile" data-testid="link-profile">
            <User className="h-4 w-4 mr-2" />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/settings" data-testid="link-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
