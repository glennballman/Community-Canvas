/**
 * Platform Tenant Detail Page - P-UI-17
 * Route: /app/platform/tenants/:tenantId
 * 
 * Detailed view of a single tenant with portals, members, and module flags
 */

import { useQuery } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, Globe, Users, ArrowLeft, Calendar, Shield, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Portal {
  id: string;
  name: string;
  slug: string;
  status: string;
  primaryAudience: string | null;
  createdAt: string;
  memberCount: number;
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
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
  recentMembers: Member[];
  moduleFlags: Record<string, boolean> | null;
}

const typeColors: Record<string, string> = {
  government: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  business: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  property: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  individual: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  staff: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function TenantDetailPage() {
  const [, params] = useRoute('/app/platform/tenants/:tenantId');
  const tenantId = params?.tenantId;

  const { data, isLoading, error } = useQuery<TenantDetailResponse>({
    queryKey: ['/api/p2/platform/tenants', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/platform/tenants/${tenantId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch tenant');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const tenant = data?.tenant;
  const portals = data?.portals ?? [];
  const members = data?.recentMembers ?? [];
  const moduleFlags = data?.moduleFlags;

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-loading">Loading tenant details...</div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-6" data-testid="error-container">
        <Link href="/app/platform/tenants">
          <Button variant="ghost" className="mb-4" data-testid="button-back-error">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
        <div className="text-center py-8 text-destructive" data-testid="text-error">Failed to load tenant</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-platform-tenant-detail">
      <Link href="/app/platform/tenants">
        <Button variant="ghost" className="mb-2" data-testid="button-back-tenants">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-tenant-name">{tenant.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={typeColors[tenant.type] || 'bg-gray-100'} data-testid="badge-tenant-type">{tenant.type}</Badge>
              <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'} data-testid="badge-tenant-status">{tenant.status}</Badge>
              <span className="text-sm text-muted-foreground" data-testid="text-tenant-slug">/{tenant.slug}</span>
            </div>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div className="flex items-center gap-1 justify-end">
            <Calendar className="h-3 w-3" />
            Created {format(new Date(tenant.createdAt), 'MMM d, yyyy')}
          </div>
          {tenant.updatedAt && (
            <div>Updated {formatDistanceToNow(new Date(tenant.updatedAt), { addSuffix: true })}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" data-testid="stats-grid">
        <Card data-testid="stat-card-portals">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold" data-testid="stat-value-portals">{portals.length}</div>
            </div>
            <p className="text-sm text-muted-foreground">Portals</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-members">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold" data-testid="stat-value-members">{members.length}</div>
            </div>
            <p className="text-sm text-muted-foreground">Recent Members</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-modules">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold" data-testid="stat-value-modules">{moduleFlags ? Object.keys(moduleFlags).length : 0}</div>
            </div>
            <p className="text-sm text-muted-foreground">Module Flags</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Portals
            </CardTitle>
            <CardDescription>All portals owned by this tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portals.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-portals">No portals</div>
            ) : (
              portals.map((portal) => (
                <div key={portal.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`portal-row-${portal.id}`}>
                  <div>
                    <div className="font-medium" data-testid={`text-portal-name-${portal.id}`}>{portal.name}</div>
                    <div className="text-sm text-muted-foreground" data-testid={`text-portal-slug-${portal.id}`}>/{portal.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-right">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {portal.memberCount} members
                      </div>
                      {portal.primaryAudience && (
                        <div className="text-muted-foreground">{portal.primaryAudience}</div>
                      )}
                    </div>
                    <Badge variant={portal.status === 'active' ? 'default' : 'secondary'} data-testid={`badge-portal-status-${portal.id}`}>{portal.status}</Badge>
                    <a href={`/b/${portal.slug}`} target="_blank" rel="noopener noreferrer" data-testid={`link-portal-external-${portal.id}`}>
                      <Button size="icon" variant="ghost" data-testid={`button-portal-external-${portal.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Members
            </CardTitle>
            <CardDescription>Latest tenant members (up to 10)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-members">No members</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`member-row-${member.id}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{member.name}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[member.role] || 'bg-gray-100'} data-testid={`badge-member-role-${member.id}`}>{member.role}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {moduleFlags && Object.keys(moduleFlags).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Module Flags
            </CardTitle>
            <CardDescription>Enabled features for this tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(moduleFlags).map(([key, value]) => (
                <Badge key={key} variant={value ? 'default' : 'secondary'}>
                  {key}: {value ? 'ON' : 'OFF'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
