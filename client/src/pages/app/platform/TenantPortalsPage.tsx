/**
 * Platform Tenant Portals Page - P-UI-17
 * Route: /app/platform/tenants/:tenantId/portals
 * 
 * Detailed view of all portals owned by a specific tenant
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Globe, Users, ArrowLeft, Search, Settings, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getAuthHeaders } from '@/lib/api';

interface Portal {
  id: string;
  name: string;
  slug: string;
  status: string;
  primaryAudience: string | null;
  createdAt: string;
  memberCount: number;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TenantDetailResponse {
  success: boolean;
  tenant: TenantDetail;
  portals: Portal[];
  recentMembers: any[];
  moduleFlags: Record<string, boolean> | null;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default function TenantPortalsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery<TenantDetailResponse>({
    queryKey: ['/api/p2/platform/tenants', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/platform/tenants/${tenantId}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch tenant');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const tenant = data?.tenant;
  const portals = data?.portals ?? [];

  const filteredPortals = portals.filter((portal) => {
    const matchesSearch =
      searchTerm === '' ||
      portal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      portal.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || portal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-loading">
        Loading portals...
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-6" data-testid="error-container">
        <Link to="/app/platform/tenants">
          <Button variant="ghost" className="mb-4" data-testid="button-back-error">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
        <div className="text-center py-8 text-destructive" data-testid="text-error">
          Failed to load tenant portals
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-platform-tenant-portals">
      <Link to="/app/platform/tenants">
        <Button variant="ghost" className="mb-2" data-testid="button-back-tenants">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {tenant.name} - Portals
          </h1>
          <p className="text-muted-foreground">
            {portals.length} portal{portals.length !== 1 ? 's' : ''} owned by this tenant
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4" data-testid="stats-grid">
        <Card data-testid="stat-card-total">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="stat-value-total">
              {portals.length}
            </div>
            <p className="text-sm text-muted-foreground">Total Portals</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-active">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-value-active">
              {portals.filter((p) => p.status === 'active').length}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Portals
          </CardTitle>
          <CardDescription>All portals owned by {tenant.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search portals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-portals"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32" data-testid="select-status-filter">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-status-all">
                  All Status
                </SelectItem>
                <SelectItem value="active" data-testid="option-status-active">
                  Active
                </SelectItem>
                <SelectItem value="inactive" data-testid="option-status-inactive">
                  Inactive
                </SelectItem>
                <SelectItem value="suspended" data-testid="option-status-suspended">
                  Suspended
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPortals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">
              {searchTerm || statusFilter !== 'all'
                ? 'No portals match your filters'
                : 'No portals created yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPortals.map((portal) => (
                <div
                  key={portal.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`portal-row-${portal.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium" data-testid={`text-portal-name-${portal.id}`}>
                        {portal.name}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-portal-slug-${portal.id}`}>
                        /{portal.slug}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span data-testid={`text-member-count-${portal.id}`}>{portal.memberCount}</span>
                      </div>
                      {portal.primaryAudience && (
                        <div className="text-xs text-muted-foreground">{portal.primaryAudience}</div>
                      )}
                    </div>
                    <Badge
                      variant={portal.status === 'active' ? 'default' : 'secondary'}
                      data-testid={`badge-portal-status-${portal.id}`}
                    >
                      {portal.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Link to={`/app/platform/tenants/${tenantId}/portals/${portal.id}`}>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-portal-config-${portal.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                    <a href={`/c/${portal.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-portal-external-${portal.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
