/**
 * FOUNDER HOME PAGE
 * 
 * Landing page for Founder Solo mode.
 * Shows aggregate overview across all tenants the user owns/manages.
 */

import { Link } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  Calendar,
  Briefcase,
  BarChart3,
  ArrowRight,
  Sparkles,
  Mountain,
  Landmark,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICONS: Record<string, LucideIcon> = {
  community: Mountain,
  government: Landmark,
  business: Briefcase,
  individual: Users,
};

export default function FounderHomePage() {
  const { user, memberships } = useTenant();

  const communities = memberships.filter(
    m => m.tenant_type === 'community' || m.tenant_type === 'government'
  );
  const businesses = memberships.filter(m => m.tenant_type === 'business');
  const personal = memberships.filter(m => m.tenant_type === 'individual');

  const totalTenants = memberships.length;

  return (
    <div className="p-6 space-y-6" data-testid="founder-home-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-founder-title">
            Founder Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user?.full_name || user?.email || 'Founder'}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          Founder Solo Mode
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-tenants">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Your Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTenants}</div>
            <p className="text-xs text-muted-foreground">
              {communities.length} communities, {businesses.length} businesses
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-communities">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Communities</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{communities.length}</div>
            <p className="text-xs text-muted-foreground">
              Active communities you manage
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-businesses">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Businesses</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businesses.length}</div>
            <p className="text-xs text-muted-foreground">
              Business operations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-activity">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Overview</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Aggregate metrics coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Places</CardTitle>
            <CardDescription>
              Quick access to your organizations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberships.slice(0, 5).map((m) => (
              <Link
                key={m.tenant_id}
                to={`/app/places`}
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                data-testid={`link-tenant-${m.tenant_id}`}
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = TYPE_ICONS[m.tenant_type] || Building2;
                    return (
                      <div className="h-8 w-8 rounded bg-accent flex items-center justify-center flex-shrink-0">
                        <IconComponent className="h-4 w-4 text-accent-foreground" />
                      </div>
                    );
                  })()}
                  <div>
                    <div className="font-medium">{m.tenant_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            {memberships.length > 5 && (
              <Link to="/app/places">
                <Button variant="outline" className="w-full" data-testid="button-view-all-places">
                  View all {memberships.length} places
                </Button>
              </Link>
            )}
            {memberships.length === 0 && (
              <p className="text-muted-foreground text-sm">No organizations yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks across your organizations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/app/places">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-manage-places">
                <Building2 className="h-4 w-4" />
                Manage Your Places
              </Button>
            </Link>
            <Link to="/app/platform">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-platform-admin">
                <Calendar className="h-4 w-4" />
                Platform Admin Console
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
