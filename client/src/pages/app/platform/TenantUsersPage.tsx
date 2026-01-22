/**
 * Platform Tenant Users Page - P-UI-17
 * Route: /app/platform/tenants/:tenantId/users
 * 
 * Detailed view of all users for a specific tenant
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, ArrowLeft, Search, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getAuthHeaders } from '@/lib/api';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
}

interface TenantUsersResponse {
  success: boolean;
  users: User[];
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  staff: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const isDevMode = () => {
  return import.meta.env.DEV;
};

export default function TenantUsersPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [settingPassword, setSettingPassword] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<TenantUsersResponse>({
    queryKey: ['/api/p2/platform/tenants', tenantId, 'users'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/platform/tenants/${tenantId}/users`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const users = data?.users ?? [];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchTerm === '' ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSetPassword = async (userId: string) => {
    try {
      setSettingPassword(userId);
      const password = Math.random().toString(36).substring(2, 10);

      const response = await fetch(`/api/p2/platform/users/${userId}/set-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: 'Success',
            description: `Password set to: ${password}`,
          });
        } else {
          toast({
            title: 'Error',
            description: data.message || 'Failed to set password',
            variant: 'destructive',
          });
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: errData.message || 'Failed to set password',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to set password',
        variant: 'destructive',
      });
    } finally {
      setSettingPassword(null);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-loading">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" data-testid="error-container">
        <Link to="/app/platform/tenants">
          <Button variant="ghost" className="mb-4" data-testid="button-back-error">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
        <div className="text-center py-8 text-destructive" data-testid="text-error">
          Failed to load tenant users
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-platform-tenant-users">
      <Link to="/app/platform/tenants">
        <Button variant="ghost" className="mb-2" data-testid="button-back-tenants">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Tenant Users
          </h1>
          <p className="text-muted-foreground">
            {users.length} user{users.length !== 1 ? 's' : ''} in this tenant
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" data-testid="stats-grid">
        <Card data-testid="stat-card-total">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="stat-value-total">
              {users.length}
            </div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-active">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-value-active">
              {users.filter((u) => u.status === 'active').length}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-admins">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-value-admins">
              {users.filter((u) => u.role === 'admin' || u.role === 'owner').length}
            </div>
            <p className="text-sm text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>All users in this tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" data-testid="select-role-filter">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-role-all">
                  All Roles
                </SelectItem>
                <SelectItem value="owner" data-testid="option-role-owner">
                  Owner
                </SelectItem>
                <SelectItem value="admin" data-testid="option-role-admin">
                  Admin
                </SelectItem>
                <SelectItem value="manager" data-testid="option-role-manager">
                  Manager
                </SelectItem>
                <SelectItem value="staff" data-testid="option-role-staff">
                  Staff
                </SelectItem>
                <SelectItem value="viewer" data-testid="option-role-viewer">
                  Viewer
                </SelectItem>
              </SelectContent>
            </Select>
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

          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'No users match your filters'
                : 'No users found'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium" data-testid={`text-user-name-${user.id}`}>
                        {user.name}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground" data-testid={`text-user-joined-${user.id}`}>
                        Joined {formatDistanceToNow(new Date(user.joinedAt), { addSuffix: true })}
                      </div>
                    </div>

                    <Badge
                      className={roleColors[user.role] || 'bg-gray-100'}
                      data-testid={`badge-user-role-${user.id}`}
                    >
                      {user.role}
                    </Badge>

                    <Badge
                      variant={user.status === 'active' ? 'default' : 'secondary'}
                      data-testid={`badge-user-status-${user.id}`}
                    >
                      {user.status}
                    </Badge>
                  </div>

                  {isDevMode() && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSetPassword(user.id)}
                      disabled={settingPassword === user.id}
                      data-testid={`button-set-password-${user.id}`}
                      title="Set password (dev only)"
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
