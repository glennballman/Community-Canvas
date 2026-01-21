/**
 * Platform Tenants List Page - P-UI-17
 * Route: /app/platform/tenants
 * 
 * Platform admin view of all tenants with key stats
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Users, Globe, Calendar, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getAuthHeaders } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  createdAt: string;
  portalsCount: number;
  activeUsers: number;
  lastActivity: string | null;
}

const typeColors: Record<string, string> = {
  government: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  business: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  property: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  individual: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default function TenantsListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery<{ success: boolean; tenants: Tenant[] }>({
    queryKey: ['/api/p2/platform/tenants'],
    queryFn: async () => {
      const res = await fetch('/api/p2/platform/tenants', { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    },
  });

  const tenants = data?.tenants ?? [];

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = searchTerm === '' || 
      tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || tenant.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    totalPortals: tenants.reduce((sum, t) => sum + t.portalsCount, 0),
    totalUsers: tenants.reduce((sum, t) => sum + t.activeUsers, 0),
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-platform-tenants">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Platform-wide tenant management</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" data-testid="stats-grid">
        <Card data-testid="stat-card-total">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="stat-value-total">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Tenants</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-active">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-value-active">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-portals">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold" data-testid="stat-value-portals">{stats.totalPortals}</div>
            </div>
            <p className="text-sm text-muted-foreground">Total Portals</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-users">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold" data-testid="stat-value-users">{stats.totalUsers}</div>
            </div>
            <p className="text-sm text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>Search and filter tenants across the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-tenants"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40" data-testid="select-type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-type-all">All Types</SelectItem>
                <SelectItem value="government" data-testid="option-type-government">Government</SelectItem>
                <SelectItem value="business" data-testid="option-type-business">Business</SelectItem>
                <SelectItem value="property" data-testid="option-type-property">Property</SelectItem>
                <SelectItem value="individual" data-testid="option-type-individual">Individual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32" data-testid="select-status-filter">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-status-all">All Status</SelectItem>
                <SelectItem value="active" data-testid="option-status-active">Active</SelectItem>
                <SelectItem value="inactive" data-testid="option-status-inactive">Inactive</SelectItem>
                <SelectItem value="suspended" data-testid="option-status-suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">Loading tenants...</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive" data-testid="text-error">Failed to load tenants</div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">No tenants found</div>
          ) : (
            <div className="space-y-2">
              {filteredTenants.map((tenant) => (
                <Link key={tenant.id} href={`/app/platform/tenants/${tenant.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer" data-testid={`tenant-row-${tenant.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-sm text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex gap-2">
                        <Badge className={typeColors[tenant.type] || 'bg-gray-100'}>{tenant.type}</Badge>
                        <Badge className={statusColors[tenant.status] || 'bg-gray-100'}>{tenant.status}</Badge>
                      </div>
                      <div className="text-right text-sm min-w-24">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {tenant.portalsCount} portals
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {tenant.activeUsers} users
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground min-w-32 text-right">
                        {tenant.lastActivity ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(tenant.lastActivity), { addSuffix: true })}
                          </div>
                        ) : (
                          <span>No activity</span>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
