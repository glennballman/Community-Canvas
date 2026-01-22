/**
 * Platform Tenants List Page - P-UI-17
 * Route: /app/platform/tenants
 * 
 * Platform admin view of all tenants with key stats
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Building2, Search, Users, Globe, Calendar, ArrowRight, Eye, UserCog, ExternalLink, Plus, UserPlus, UsersRound, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getAuthHeaders } from '@/lib/api';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';

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

interface Member {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  title?: string;
  joinedAt?: string;
  invitedAt?: string;
}

interface SearchUser {
  id: string;
  email: string;
  name: string;
  status: string;
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startImpersonation } = useTenant();

  // Create Tenant Modal state
  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [createTenantForm, setCreateTenantForm] = useState({ name: '', slug: '', type: 'business' });
  const [creating, setCreating] = useState(false);

  // Add Admin Modal state
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [addAdminTenant, setAddAdminTenant] = useState<Tenant | null>(null);
  const [addAdminEmail, setAddAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Manage Members Modal state
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersTenant, setMembersTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [newMemberMode, setNewMemberMode] = useState<'active' | 'invited'>('active');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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

  // Create tenant handler
  const handleCreateTenant = async () => {
    if (!createTenantForm.name.trim()) {
      toast({ title: 'Error', description: 'Tenant name is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const slug = createTenantForm.slug.trim() || createTenantForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await fetch('/api/p2/platform/tenants', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: createTenantForm.name.trim(),
          slug,
          tenantType: createTenantForm.type,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create tenant');
      }
      toast({ title: 'Success', description: 'Tenant created successfully' });
      setCreateTenantOpen(false);
      setCreateTenantForm({ name: '', slug: '', type: 'business' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/platform/tenants'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create tenant', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Add admin handler
  const handleAddAdmin = async () => {
    if (!addAdminTenant || !addAdminEmail.trim()) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }
    setAddingAdmin(true);
    try {
      const res = await fetch(`/api/p2/platform/tenants/${addAdminTenant.id}/assign-admin`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: addAdminEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to assign admin');
      }
      toast({ title: 'Success', description: `Admin assigned to ${addAdminTenant.name}` });
      setAddAdminOpen(false);
      setAddAdminEmail('');
      setAddAdminTenant(null);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/platform/tenants'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to assign admin', variant: 'destructive' });
    } finally {
      setAddingAdmin(false);
    }
  };

  // Load members for a tenant
  const loadMembers = async (tenantId: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/p2/platform/tenants/${tenantId}/members`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Search users
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const res = await fetch(`/api/p2/platform/users/search?q=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to search users');
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch (err) {
      console.error('Failed to search users:', err);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Add member to tenant
  const handleAddMember = async () => {
    if (!membersTenant || !selectedUser) {
      toast({ title: 'Error', description: 'Please select a user', variant: 'destructive' });
      return;
    }
    setAddingMember(true);
    try {
      const res = await fetch('/api/p2/platform/memberships', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId: membersTenant.id,
          userId: selectedUser.id,
          role: newMemberRole,
          mode: newMemberMode,
          setPassword: newMemberPassword || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add member');
      }
      const data = await res.json();
      toast({ 
        title: 'Success', 
        description: data.inviteLink 
          ? `User invited. Invite link: ${data.inviteLink}` 
          : 'Member added successfully' 
      });
      // Reset form and reload members
      setSelectedUser(null);
      setUserSearch('');
      setSearchResults([]);
      setNewMemberRole('member');
      setNewMemberMode('active');
      setNewMemberPassword('');
      loadMembers(membersTenant.id);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/platform/tenants'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add member', variant: 'destructive' });
    } finally {
      setAddingMember(false);
    }
  };

  // Remove member from tenant
  const handleRemoveMember = async (userId: string) => {
    if (!membersTenant) return;
    setRemovingMemberId(userId);
    try {
      const res = await fetch('/api/p2/platform/memberships', {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId: membersTenant.id,
          userId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove member');
      }
      toast({ title: 'Success', description: 'Member removed' });
      loadMembers(membersTenant.id);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/platform/tenants'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to remove member', variant: 'destructive' });
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Open members modal
  const openMembersModal = (tenant: Tenant) => {
    setMembersTenant(tenant);
    setMembersOpen(true);
    loadMembers(tenant.id);
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-platform-tenants">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tenants</h1>
            <p className="text-muted-foreground">Platform-wide tenant management</p>
          </div>
        </div>
        <Button onClick={() => setCreateTenantOpen(true)} data-testid="button-create-tenant">
          <Plus className="h-4 w-4 mr-2" />
          Create Tenant
        </Button>
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
                <div 
                  key={tenant.id} 
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer"
                  data-testid={`tenant-row-${tenant.id}`}
                  onClick={() => navigate(`/app/platform/tenants/${tenant.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-sm text-muted-foreground">{tenant.slug}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
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
                    <div className="text-sm text-muted-foreground min-w-24 text-right">
                      {tenant.lastActivity ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(tenant.lastActivity), { addSuffix: true })}
                        </div>
                      ) : (
                        <span>No activity</span>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/app/platform/tenants/${tenant.id}/portals`)}
                        data-testid={`button-portals-${tenant.id}`}
                        title="View Portals"
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/app/platform/tenants/${tenant.id}/users`)}
                        data-testid={`button-users-${tenant.id}`}
                        title="View Users"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openMembersModal(tenant)}
                        data-testid={`button-members-${tenant.id}`}
                        title="Manage Members"
                      >
                        <UsersRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            toast({ title: 'Impersonating', description: `Switching to ${tenant.name}...` });
                            await startImpersonation(tenant.id, 'Platform admin access');
                          } catch (err: any) {
                            toast({ title: 'Error', description: err?.message || 'Failed to start impersonation', variant: 'destructive' });
                          }
                        }}
                        data-testid={`button-impersonate-${tenant.id}`}
                        title="Impersonate Tenant"
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await startImpersonation(tenant.id, 'Platform admin view');
                          } catch (err: any) {
                            toast({ title: 'Error', description: err?.message || 'Failed to open tenant', variant: 'destructive' });
                          }
                        }}
                        data-testid={`button-open-tenant-${tenant.id}`}
                        title="Open Tenant App"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddAdminTenant(tenant);
                          setAddAdminOpen(true);
                        }}
                        data-testid={`button-add-admin-${tenant.id}`}
                        title="Add Admin"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Tenant Modal */}
      <Dialog open={createTenantOpen} onOpenChange={setCreateTenantOpen}>
        <DialogContent data-testid="dialog-create-tenant">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
            <DialogDescription>Create a new tenant organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Tenant Name *</Label>
              <Input
                id="tenant-name"
                value={createTenantForm.name}
                onChange={(e) => setCreateTenantForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Acme Corporation"
                data-testid="input-tenant-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug (optional)</Label>
              <Input
                id="tenant-slug"
                value={createTenantForm.slug}
                onChange={(e) => setCreateTenantForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="e.g., acme-corporation"
                data-testid="input-tenant-slug"
              />
              <p className="text-xs text-muted-foreground">Leave empty to auto-generate from name</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-type">Type</Label>
              <Select 
                value={createTenantForm.type} 
                onValueChange={(val) => setCreateTenantForm(f => ({ ...f, type: val }))}
              >
                <SelectTrigger data-testid="select-tenant-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTenantOpen(false)} data-testid="button-cancel-create-tenant">
              Cancel
            </Button>
            <Button onClick={handleCreateTenant} disabled={creating} data-testid="button-submit-create-tenant">
              {creating ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Admin Modal */}
      <Dialog open={addAdminOpen} onOpenChange={(open) => { setAddAdminOpen(open); if (!open) setAddAdminTenant(null); }}>
        <DialogContent data-testid="dialog-add-admin">
          <DialogHeader>
            <DialogTitle>Add Admin</DialogTitle>
            <DialogDescription>
              Assign an admin to {addAdminTenant?.name || 'tenant'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">User Email *</Label>
              <Input
                id="admin-email"
                type="email"
                value={addAdminEmail}
                onChange={(e) => setAddAdminEmail(e.target.value)}
                placeholder="e.g., user@example.com"
                data-testid="input-admin-email"
              />
              <p className="text-xs text-muted-foreground">Enter the email of an existing user</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAdminOpen(false)} data-testid="button-cancel-add-admin">
              Cancel
            </Button>
            <Button onClick={handleAddAdmin} disabled={addingAdmin} data-testid="button-submit-add-admin">
              {addingAdmin ? 'Assigning...' : 'Add Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={membersOpen} onOpenChange={(open) => { 
        setMembersOpen(open); 
        if (!open) {
          setMembersTenant(null);
          setMembers([]);
          setSelectedUser(null);
          setUserSearch('');
          setSearchResults([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-manage-members">
          <DialogHeader>
            <DialogTitle>Manage Members</DialogTitle>
            <DialogDescription>
              {membersTenant?.name || 'Tenant'} - Manage user memberships and roles
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Current Members */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Members ({members.length})</Label>
              {loadingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  No members yet
                </div>
              ) : (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {members.map(member => (
                    <div key={member.userId} className="flex items-center justify-between p-3" data-testid={`member-row-${member.userId}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid={`badge-role-${member.userId}`}>{member.role}</Badge>
                        <Badge className={member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} data-testid={`badge-status-${member.userId}`}>
                          {member.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={removingMemberId === member.userId}
                          data-testid={`button-remove-member-${member.userId}`}
                          title="Remove member"
                        >
                          {removingMemberId === member.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Member */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">Add New Member</Label>
              
              {/* User Search */}
              <div className="space-y-2">
                <Label htmlFor="user-search" className="text-xs">Search User</Label>
                <div className="relative">
                  <Input
                    id="user-search"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="Type email or name to search..."
                    data-testid="input-user-search"
                  />
                  {searchingUsers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {searchResults.length > 0 && !selectedUser && (
                  <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                    {searchResults.map(user => (
                      <div
                        key={user.id}
                        className="p-2 hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedUser(user);
                          setUserSearch(user.email);
                          setSearchResults([]);
                        }}
                        data-testid={`search-result-${user.id}`}
                      >
                        <div className="text-sm font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-primary/5">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{selectedUser.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedUser.email}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setSelectedUser(null);
                      setUserSearch('');
                    }}>
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label className="text-xs">Role</Label>
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger data-testid="select-member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode Toggle */}
              <div className="space-y-2">
                <Label className="text-xs">Activation Mode</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={newMemberMode === 'active' ? 'default' : 'outline'}
                    onClick={() => setNewMemberMode('active')}
                    data-testid="button-mode-active"
                  >
                    Active Now
                  </Button>
                  <Button
                    size="sm"
                    variant={newMemberMode === 'invited' ? 'default' : 'outline'}
                    onClick={() => setNewMemberMode('invited')}
                    data-testid="button-mode-invited"
                  >
                    Invite to Claim
                  </Button>
                </div>
              </div>

              {/* Set Password (Active mode only) */}
              {newMemberMode === 'active' && (
                <div className="space-y-2">
                  <Label htmlFor="set-password" className="text-xs">Set Password (optional)</Label>
                  <Input
                    id="set-password"
                    type="password"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    placeholder="Leave empty to keep current password"
                    data-testid="input-set-password"
                  />
                  <p className="text-xs text-muted-foreground">Platform admin power tool - set user password immediately</p>
                </div>
              )}

              <Button 
                onClick={handleAddMember} 
                disabled={addingMember || !selectedUser}
                className="w-full"
                data-testid="button-add-member"
              >
                {addingMember ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
