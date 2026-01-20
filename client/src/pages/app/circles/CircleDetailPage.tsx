import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Users, Settings, Shield, UserPlus, Trash2, Loader2, Link2 } from 'lucide-react';

interface Circle {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  member_count: number;
  delegation_count: number;
  created_at: string;
}

interface Member {
  id: string;
  circle_id: string;
  member_type: string;
  individual_id?: string;
  tenant_id?: string;
  role_id: string;
  role_name?: string;
  role_level?: string;
  individual_name?: string;
  individual_email?: string;
  tenant_name?: string;
  is_active: boolean;
  joined_at: string;
}

interface Role {
  id: string;
  name: string;
  level: string;
  scopes: string[];
}

interface Delegation {
  id: string;
  circle_id: string;
  delegated_by_individual_id: string;
  delegator_name?: string;
  delegator_email?: string;
  delegatee_member_type: string;
  delegatee_individual_id?: string;
  delegatee_tenant_id?: string;
  delegatee_name?: string;
  delegatee_email?: string;
  delegatee_tenant_name?: string;
  scopes: string[];
  status: string;
  expires_at?: string;
  created_at: string;
}

export default function CircleDetailPage() {
  const { circleId } = useParams<{ circleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('members');
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [revokingDelegation, setRevokingDelegation] = useState<string | null>(null);

  const { data: circleData, isLoading: circleLoading } = useQuery<{ circle: Circle; is_admin: boolean; is_member: boolean }>({
    queryKey: ['/api/p2/circles', circleId],
    enabled: !!circleId,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: Member[]; is_admin: boolean }>({
    queryKey: ['/api/p2/circles', circleId, 'members'],
    enabled: !!circleId,
  });

  const { data: rolesData } = useQuery<{ roles: Role[] }>({
    queryKey: ['/api/p2/circles', circleId, 'roles'],
    enabled: !!circleId,
  });

  const { data: delegationsData, isLoading: delegationsLoading } = useQuery<{ delegations: Delegation[]; is_admin: boolean }>({
    queryKey: ['/api/p2/circles', circleId, 'delegations'],
    enabled: !!circleId,
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest('DELETE', `/api/p2/circles/${circleId}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/circles', circleId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/circles', circleId] });
      toast({ title: 'Member removed' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove member',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
    onSettled: () => setDeletingMember(null),
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, roleId }: { memberId: string; roleId: string }) => {
      return apiRequest('PATCH', `/api/p2/circles/${circleId}/members/${memberId}`, { role_id: roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/circles', circleId, 'members'] });
      toast({ title: 'Role updated' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update role',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const revokeDelegation = useMutation({
    mutationFn: async (delegationId: string) => {
      return apiRequest('DELETE', `/api/p2/circles/${circleId}/delegations/${delegationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/circles', circleId, 'delegations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/circles', circleId] });
      toast({ title: 'Delegation revoked' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to revoke delegation',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
    onSettled: () => setRevokingDelegation(null),
  });

  const circle = circleData?.circle;
  const isAdmin = circleData?.is_admin ?? false;
  const members = membersData?.members ?? [];
  const roles = rolesData?.roles ?? [];
  const delegations = delegationsData?.delegations ?? [];

  const getRoleBadge = (level?: string, name?: string) => {
    if (!level) return null;
    switch (level) {
      case 'owner':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">{name || 'Owner'}</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">{name || 'Admin'}</Badge>;
      default:
        return <Badge variant="outline">{name || level}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="secondary">Active</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (circleLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2" data-testid="text-not-found">Circle not found</h3>
            <p className="text-muted-foreground mb-4">This circle doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/app/circles')} data-testid="button-back-list">
              Back to Circles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/circles')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-circle-name">{circle.name}</h1>
            <Badge variant={circle.status === 'active' ? 'secondary' : 'outline'} data-testid="badge-circle-status">
              {circle.status}
            </Badge>
            {isAdmin && (
              <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30" data-testid="badge-admin-indicator">
                Admin
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground" data-testid="text-circle-desc">
            {circle.description || 'No description'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" data-testid="button-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold" data-testid="text-member-count">{circle.member_count}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delegations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold" data-testid="text-delegation-count">{circle.delegation_count}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Slug</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-2 py-1 rounded" data-testid="text-circle-slug">{circle.slug}</code>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="h-4 w-4 mr-2" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="delegations" data-testid="tab-delegations">
            <Shield className="h-4 w-4 mr-2" />
            Delegations ({delegations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Circle Members</CardTitle>
                <CardDescription>People and organizations in this circle</CardDescription>
              </div>
              {isAdmin && (
                <Button size="sm" data-testid="button-add-member">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <p className="text-muted-foreground text-center py-6" data-testid="text-no-members">
                  No members yet
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                      data-testid={`member-row-${member.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-member-name-${member.id}`}>
                            {member.individual_name || member.tenant_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-member-email-${member.id}`}>
                            {member.individual_email || member.member_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isAdmin && member.role_level !== 'owner' ? (
                          <Select
                            value={member.role_id}
                            onValueChange={(roleId) => updateMemberRole.mutate({ memberId: member.id, roleId })}
                          >
                            <SelectTrigger className="w-[120px]" data-testid={`select-role-${member.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.filter((r) => r.level !== 'owner').map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          getRoleBadge(member.role_level, member.role_name)
                        )}
                        {isAdmin && member.role_level !== 'owner' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-remove-member-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Remove Member</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to remove {member.individual_name || 'this member'} from the circle?
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" data-testid="button-cancel-remove">Cancel</Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    setDeletingMember(member.id);
                                    removeMember.mutate(member.id);
                                  }}
                                  disabled={deletingMember === member.id}
                                  data-testid="button-confirm-remove"
                                >
                                  {deletingMember === member.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  Remove
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delegations" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Delegations</CardTitle>
                <CardDescription>Access delegated to external parties</CardDescription>
              </div>
              <Button size="sm" data-testid="button-add-delegation">
                <Shield className="h-4 w-4 mr-2" />
                Create Delegation
              </Button>
            </CardHeader>
            <CardContent>
              {delegationsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : delegations.length === 0 ? (
                <p className="text-muted-foreground text-center py-6" data-testid="text-no-delegations">
                  No delegations yet
                </p>
              ) : (
                <div className="space-y-3">
                  {delegations.map((delegation) => (
                    <div
                      key={delegation.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                      data-testid={`delegation-row-${delegation.id}`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium" data-testid={`text-delegatee-name-${delegation.id}`}>
                            {delegation.delegatee_name || delegation.delegatee_tenant_name || 'Unknown'}
                          </p>
                          {getStatusBadge(delegation.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Delegated by: {delegation.delegator_name || delegation.delegator_email || 'Unknown'}</span>
                          <span>|</span>
                          <span>Scopes: {delegation.scopes.join(', ')}</span>
                          {delegation.expires_at && (
                            <>
                              <span>|</span>
                              <span>Expires: {new Date(delegation.expires_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {delegation.status === 'active' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-revoke-delegation-${delegation.id}`}
                            >
                              Revoke
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Revoke Delegation</DialogTitle>
                              <DialogDescription>
                                This will immediately revoke the delegation. The delegatee will lose access.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" data-testid="button-cancel-revoke">Cancel</Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  setRevokingDelegation(delegation.id);
                                  revokeDelegation.mutate(delegation.id);
                                }}
                                disabled={revokingDelegation === delegation.id}
                                data-testid="button-confirm-revoke"
                              >
                                {revokingDelegation === delegation.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Revoke
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
