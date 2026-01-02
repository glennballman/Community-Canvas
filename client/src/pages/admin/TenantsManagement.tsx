import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Users, Globe, Home, User, Search, Plus, Edit, UserPlus, Shield, Briefcase, Landmark } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    tenant_type: string;
    business_type: string;
    government_level: string;
    city: string;
    province: string;
    status: string;
    created_at: string;
    member_count: number;
    owner_email: string;
    owner_first_name: string;
    owner_last_name: string;
}

interface TenantMember {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
    role: string;
    title: string;
    status: string;
    joined_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    platform: { icon: Shield, variant: 'default' },
    government: { icon: Landmark, variant: 'secondary' },
    business: { icon: Briefcase, variant: 'default' },
    property: { icon: Home, variant: 'outline' },
    individual: { icon: User, variant: 'outline' },
};

const typeOrder = ['platform', 'government', 'business', 'property', 'individual'];

export default function TenantsManagement() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);

    const [typeFilter, setTypeFilter] = useState('');
    const [search, setSearch] = useState('');

    const token = localStorage.getItem('cc_token');

    const loadTenants = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/api/foundation/tenants?';
            if (typeFilter) url += `type=${typeFilter}&`;
            if (search) url += `search=${encodeURIComponent(search)}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setTenants(data.tenants);
            }
        } catch (err) {
            console.error('Failed to load tenants:', err);
        } finally {
            setLoading(false);
        }
    }, [typeFilter, search, token]);

    useEffect(() => {
        loadTenants();
    }, [loadTenants]);

    async function loadTenantDetails(tenantId: string) {
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/foundation/tenants/${tenantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setSelectedTenant(data.tenant);
                setTenantMembers(data.members || []);
            }
        } catch (err) {
            console.error('Failed to load tenant details:', err);
        } finally {
            setDetailLoading(false);
        }
    }

    const groupedTenants = tenants.reduce((acc, t) => {
        if (!acc[t.tenant_type]) acc[t.tenant_type] = [];
        acc[t.tenant_type].push(t);
        return acc;
    }, {} as Record<string, Tenant[]>);

    const getTypeIcon = (type: string) => {
        const config = typeConfig[type] || typeConfig.individual;
        const Icon = config.icon;
        return <Icon className="w-4 h-4" />;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Tenant Management</h1>
                    <p className="text-muted-foreground">Manage organizations and their members</p>
                </div>
                <Button data-testid="button-create-tenant">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tenant
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {typeOrder.map(type => {
                    const count = tenants.filter(t => t.tenant_type === type).length;
                    const config = typeConfig[type];
                    const Icon = config.icon;
                    const isSelected = typeFilter === type;
                    
                    return (
                        <Card 
                            key={type}
                            onClick={() => setTypeFilter(isSelected ? '' : type)}
                            className={`cursor-pointer hover-elevate transition-colors ${
                                isSelected ? 'ring-2 ring-primary' : ''
                            }`}
                            data-testid={`filter-${type}`}
                        >
                            <CardContent className="p-4 text-center">
                                <Icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                                <div className="text-2xl font-bold">{count}</div>
                                <div className="text-sm text-muted-foreground capitalize">{type}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardContent className="pt-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            data-testid="input-search-tenants"
                            type="text"
                            placeholder="Search tenants by name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {loading ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                Loading tenants...
                            </CardContent>
                        </Card>
                    ) : (
                        typeOrder.filter(type => !typeFilter || type === typeFilter).map(type => {
                            const typeTenants = groupedTenants[type] || [];
                            if (typeTenants.length === 0) return null;

                            const config = typeConfig[type];
                            const Icon = config.icon;

                            return (
                                <Card key={type} className="overflow-hidden">
                                    <div className="bg-muted px-4 py-2 flex items-center gap-2 border-b">
                                        <Icon className="w-4 h-4" />
                                        <span className="font-medium capitalize">{type} Tenants</span>
                                        <Badge variant="secondary" className="ml-auto">{typeTenants.length}</Badge>
                                    </div>
                                    <div className="divide-y">
                                        {typeTenants.map(tenant => (
                                            <div
                                                key={tenant.id}
                                                data-testid={`row-tenant-${tenant.id}`}
                                                onClick={() => loadTenantDetails(tenant.id)}
                                                className={`px-4 py-3 cursor-pointer hover-elevate ${
                                                    selectedTenant?.id === tenant.id ? 'bg-accent' : ''
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">{tenant.name}</div>
                                                        <div className="text-muted-foreground text-sm truncate">
                                                            {tenant.city && `${tenant.city}, `}
                                                            {tenant.slug}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-primary flex items-center gap-1 justify-end">
                                                            <Users className="w-3 h-3" />
                                                            {tenant.member_count || 0}
                                                        </div>
                                                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                                            {tenant.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>

                <div className="lg:col-span-1">
                    {selectedTenant ? (
                        <Card className="sticky top-4">
                            <CardContent className="p-4 space-y-4">
                                {detailLoading ? (
                                    <div className="space-y-4">
                                        <Skeleton className="h-8 w-24" />
                                        <Skeleton className="h-6 w-48" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="pb-4 border-b">
                                            <Badge variant={typeConfig[selectedTenant.tenant_type]?.variant || 'outline'} className="mb-2">
                                                {getTypeIcon(selectedTenant.tenant_type)}
                                                <span className="ml-1 capitalize">{selectedTenant.tenant_type}</span>
                                            </Badge>
                                            <h3 className="text-xl font-bold">{selectedTenant.name}</h3>
                                            <p className="text-muted-foreground">/{selectedTenant.slug}</p>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            {selectedTenant.city && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Location</span>
                                                    <span>{selectedTenant.city}, {selectedTenant.province}</span>
                                                </div>
                                            )}
                                            {selectedTenant.business_type && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Business Type</span>
                                                    <span>{selectedTenant.business_type}</span>
                                                </div>
                                            )}
                                            {selectedTenant.government_level && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Level</span>
                                                    <span>{selectedTenant.government_level}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Status</span>
                                                <Badge variant={selectedTenant.status === 'active' ? 'default' : 'secondary'}>
                                                    {selectedTenant.status}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Created</span>
                                                <span>{new Date(selectedTenant.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-medium">Members ({tenantMembers.length})</h4>
                                                <Button variant="ghost" size="sm" data-testid="button-add-member">
                                                    <UserPlus className="w-3 h-3 mr-1" />
                                                    Add
                                                </Button>
                                            </div>
                                            <ScrollArea className="max-h-48">
                                                <div className="space-y-2">
                                                    {tenantMembers.length === 0 ? (
                                                        <p className="text-muted-foreground text-sm">No members</p>
                                                    ) : (
                                                        tenantMembers.map(m => (
                                                            <div key={m.id} className="bg-muted rounded-md p-2 flex items-center gap-2">
                                                                <Avatar className="w-8 h-8">
                                                                    <AvatarFallback className="text-xs">
                                                                        {(m.first_name?.[0] || m.email[0]).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-medium truncate">
                                                                        {m.first_name} {m.last_name}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">{m.role}</div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>

                                        <div className="pt-4 border-t space-y-2">
                                            <Button className="w-full" size="sm" data-testid="button-edit-tenant">
                                                <Edit className="w-4 h-4 mr-2" />
                                                Edit Tenant
                                            </Button>
                                            <Button variant="outline" className="w-full" size="sm" data-testid="button-manage-members">
                                                <Users className="w-4 h-4 mr-2" />
                                                Manage Members
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-muted-foreground">Select a tenant to view details</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
