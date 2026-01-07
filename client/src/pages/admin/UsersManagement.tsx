import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Users, Shield, Building2, Award, Search, UserPlus, Edit, KeyRound, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface User {
    id: string;
    email: string;
    given_name: string;
    family_name: string;
    display_name: string;
    is_platform_admin: boolean;
    status: string;
    created_at: string;
    last_login_at: string;
    tenant_count: number;
}

interface UserDetail {
    id: string;
    email: string;
    given_name: string;
    family_name: string;
    display_name: string;
    telephone: string;
    avatar_url: string;
    is_platform_admin: boolean;
    status: string;
    email_verified: boolean;
    created_at: string;
    last_login_at: string;
    login_count: number;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
    tenant_type: string;
    role: string;
    title: string;
    membership_status: string;
}

interface Qualification {
    id: string;
    qualification_type: string;
    name: string;
    category: string;
    issuing_authority: string;
    expiry_date: string;
    is_verified: boolean;
}

export default function UsersManagement() {
    const { token, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
    const [userTenants, setUserTenants] = useState<Tenant[]>([]);
    const [userQualifications, setUserQualifications] = useState<Qualification[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [total, setTotal] = useState(0);

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({ email: '', firstName: '', lastName: '' });
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [saving, setSaving] = useState(false);

    const loadUsers = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            let url = '/api/foundation/users?limit=50';
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                setUsers(data.users);
                setTotal(data.total);
            }
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, token]);

    useEffect(() => {
        if (token) {
            loadUsers();
        }
    }, [loadUsers, token]);

    if (authLoading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-muted-foreground">Initializing...</div>
            </div>
        );
    }

    async function loadUserDetails(userId: string) {
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/foundation/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                setSelectedUser(data.user);
                setUserTenants(data.tenants || []);
                setUserQualifications(data.qualifications || []);
            }
        } catch (err) {
            console.error('Failed to load user details:', err);
        } finally {
            setDetailLoading(false);
        }
    }

    const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'active': return 'default';
            case 'suspended': return 'destructive';
            case 'pending': return 'secondary';
            case 'banned': return 'destructive';
            default: return 'outline';
        }
    };

    const getTenantTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (type) {
            case 'platform': return 'default';
            case 'government': return 'secondary';
            case 'business': return 'default';
            default: return 'outline';
        }
    };

    function openEditDialog() {
        if (!selectedUser) return;
        setEditForm({
            email: selectedUser.email,
            firstName: selectedUser.given_name,
            lastName: selectedUser.family_name
        });
        setEditDialogOpen(true);
    }

    function openPasswordDialog() {
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setPasswordDialogOpen(true);
    }

    async function handleSaveUser() {
        if (!selectedUser || !token) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/foundation/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: editForm.email,
                    given_name: editForm.firstName,
                    family_name: editForm.lastName
                })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Success', description: 'User updated successfully' });
                setEditDialogOpen(false);
                loadUserDetails(selectedUser.id);
                loadUsers();
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to update user', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    async function handleResetPassword() {
        if (!selectedUser || !token) return;
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
            return;
        }
        if (passwordForm.newPassword.length < 8) {
            toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/foundation/users/${selectedUser.id}/password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    new_password: passwordForm.newPassword
                })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Success', description: 'Password updated successfully' });
                setPasswordDialogOpen(false);
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to reset password', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to reset password', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">User Management</h1>
                    <p className="text-muted-foreground">Manage platform users and their access</p>
                </div>
                <Button data-testid="button-invite-user">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite User
                </Button>
            </div>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                data-testid="input-search-users"
                                type="text"
                                placeholder="Search by name or email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="banned">Banned</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="text-muted-foreground text-sm">
                            {total} users total
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenants</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <Skeleton className="w-10 h-10 rounded-full" />
                                                            <div className="space-y-1">
                                                                <Skeleton className="h-4 w-32" />
                                                                <Skeleton className="h-3 w-48" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                                                    <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                                                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                                </tr>
                                            ))
                                        ) : users.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                                    No users found
                                                </td>
                                            </tr>
                                        ) : (
                                            users.map(user => (
                                                <tr 
                                                    key={user.id}
                                                    data-testid={`row-user-${user.id}`}
                                                    onClick={() => loadUserDetails(user.id)}
                                                    className={`cursor-pointer hover-elevate ${
                                                        selectedUser?.id === user.id ? 'bg-accent' : ''
                                                    }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarFallback className="bg-primary text-primary-foreground">
                                                                    {(user.given_name?.[0] || user.email[0]).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium flex items-center gap-2">
                                                                    {user.given_name} {user.family_name}
                                                                    {user.is_platform_admin && (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            <Shield className="w-3 h-3 mr-1" />
                                                                            ADMIN
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-muted-foreground text-sm">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={getStatusBadgeVariant(user.status)}>
                                                            {user.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {user.tenant_count || 0}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground text-sm">
                                                        {user.last_login_at 
                                                            ? new Date(user.last_login_at).toLocaleDateString()
                                                            : 'Never'
                                                        }
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    {selectedUser ? (
                        <Card className="sticky top-4">
                            <CardContent className="p-4 space-y-4">
                                {detailLoading ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-col items-center">
                                            <Skeleton className="w-16 h-16 rounded-full mb-3" />
                                            <Skeleton className="h-6 w-32 mb-2" />
                                            <Skeleton className="h-4 w-48" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-center pb-4 border-b">
                                            <Avatar className="w-16 h-16 mx-auto mb-3">
                                                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                                                    {(selectedUser.given_name?.[0] || selectedUser.email[0]).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <h3 className="text-xl font-bold">
                                                {selectedUser.given_name} {selectedUser.family_name}
                                            </h3>
                                            <p className="text-muted-foreground">{selectedUser.email}</p>
                                            {selectedUser.is_platform_admin && (
                                                <Badge variant="secondary" className="mt-2">
                                                    <Shield className="w-3 h-3 mr-1" />
                                                    Platform Administrator
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-muted rounded-md p-3 text-center">
                                                <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                                                    <Building2 className="w-5 h-5" />
                                                    {userTenants.length}
                                                </div>
                                                <div className="text-xs text-muted-foreground">Tenants</div>
                                            </div>
                                            <div className="bg-muted rounded-md p-3 text-center">
                                                <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                                                    <Award className="w-5 h-5" />
                                                    {userQualifications.length}
                                                </div>
                                                <div className="text-xs text-muted-foreground">Qualifications</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Status</span>
                                                <Badge variant={getStatusBadgeVariant(selectedUser.status)}>
                                                    {selectedUser.status}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Email Verified</span>
                                                <span className={selectedUser.email_verified ? 'text-green-500' : 'text-yellow-500'}>
                                                    {selectedUser.email_verified ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Login Count</span>
                                                <span>{selectedUser.login_count || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Created</span>
                                                <span>
                                                    {new Date(selectedUser.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-medium mb-2">Tenant Memberships</h4>
                                            {userTenants.length === 0 ? (
                                                <p className="text-muted-foreground text-sm">No tenant memberships</p>
                                            ) : (
                                                <ScrollArea className="max-h-32">
                                                    <div className="space-y-2">
                                                        {userTenants.map(t => (
                                                            <div key={t.id} className="bg-muted rounded-md p-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-sm font-medium truncate">{t.name}</span>
                                                                    <Badge variant={getTenantTypeBadgeVariant(t.tenant_type)} className="text-xs shrink-0">
                                                                        {t.tenant_type}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                    {t.role} {t.title && `- ${t.title}`}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            )}
                                        </div>

                                        {userQualifications.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-medium mb-2">Qualifications</h4>
                                                <ScrollArea className="max-h-24">
                                                    <div className="space-y-1">
                                                        {userQualifications.map(q => (
                                                            <div key={q.id} className="flex items-center justify-between text-sm">
                                                                <span className="text-muted-foreground">{q.name}</span>
                                                                {q.is_verified && (
                                                                    <Badge variant="outline" className="text-xs text-green-500">
                                                                        Verified
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t space-y-2">
                                            <Button className="w-full" size="sm" data-testid="button-edit-user" onClick={openEditDialog}>
                                                <Edit className="w-4 h-4 mr-2" />
                                                Edit User
                                            </Button>
                                            <Button variant="outline" className="w-full" size="sm" data-testid="button-reset-password" onClick={openPasswordDialog}>
                                                <KeyRound className="w-4 h-4 mr-2" />
                                                Reset Password
                                            </Button>
                                            {selectedUser.status === 'active' ? (
                                                <Button variant="destructive" className="w-full" size="sm" data-testid="button-suspend-user">
                                                    <UserX className="w-4 h-4 mr-2" />
                                                    Suspend User
                                                </Button>
                                            ) : (
                                                <Button variant="outline" className="w-full" size="sm" data-testid="button-activate-user">
                                                    <UserCheck className="w-4 h-4 mr-2" />
                                                    Activate User
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-muted-foreground">Select a user to view details</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>Update user details below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input 
                                id="edit-email"
                                data-testid="input-edit-email"
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-firstName">First Name</Label>
                            <Input 
                                id="edit-firstName"
                                data-testid="input-edit-firstName"
                                value={editForm.firstName}
                                onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-lastName">Last Name</Label>
                            <Input 
                                id="edit-lastName"
                                data-testid="input-edit-lastName"
                                value={editForm.lastName}
                                onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveUser} disabled={saving} data-testid="button-save-user">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>Enter a new password for {selectedUser?.given_name} {selectedUser?.family_name}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input 
                                id="new-password"
                                data-testid="input-new-password"
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input 
                                id="confirm-password"
                                data-testid="input-confirm-password"
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleResetPassword} disabled={saving} data-testid="button-confirm-password">
                            {saving ? 'Saving...' : 'Reset Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
