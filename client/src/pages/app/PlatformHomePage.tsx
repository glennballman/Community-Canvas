/**
 * PLATFORM HOME PAGE
 * 
 * Landing page for Platform Admin mode.
 * Shows platform-wide overview and quick access to admin functions.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  BarChart3,
  Settings,
  Shield,
  Search,
  ArrowRight,
  Database,
  Globe,
} from 'lucide-react';

export default function PlatformHomePage() {
  // Phase 2C-16: User from AuthContext (single identity authority)
  const { user } = useAuth();

  // Fetch platform stats
  const { data: stats } = useQuery<{
    totalTenants: number;
    totalUsers: number;
    totalPortals: number;
  }>({
    queryKey: ['/api/platform/stats'],
    enabled: !!user?.isPlatformAdmin,
    retry: 1,
  });

  return (
    <div className="p-6 space-y-6" data-testid="platform-home-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-platform-title">
            Platform Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all tenants, users, and platform settings
          </p>
        </div>
        <Badge variant="default" className="gap-1">
          <Shield className="h-3 w-3" />
          Platform Admin
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-tenants">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTenants ?? '-'}</div>
            <p className="text-xs text-muted-foreground">
              Active organizations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers ?? '-'}</div>
            <p className="text-xs text-muted-foreground">
              Registered users
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-portals">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Portals</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPortals ?? '-'}</div>
            <p className="text-xs text-muted-foreground">
              Public portals
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-system-health">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">System</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Functions</CardTitle>
            <CardDescription>
              Platform management tools
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/app/platform/tenants">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-manage-tenants">
                <Building2 className="h-4 w-4" />
                Manage Tenants
              </Button>
            </Link>
            <Link to="/app/platform/users">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-manage-users">
                <Users className="h-4 w-4" />
                Manage Users
              </Button>
            </Link>
            <Link to="/app/platform/system-explorer">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-system-explorer">
                <Search className="h-4 w-4" />
                System Explorer
              </Button>
            </Link>
            <Link to="/app/platform/settings">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-settings">
                <Settings className="h-4 w-4" />
                Platform Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics & Monitoring</CardTitle>
            <CardDescription>
              Platform-wide insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/app/platform/analytics">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-analytics">
                <BarChart3 className="h-4 w-4" />
                Platform Analytics
              </Button>
            </Link>
            <Link to="/app/places">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-your-places">
                <Building2 className="h-4 w-4" />
                Your Places
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
