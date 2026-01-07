import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Phone, Mail, Globe, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Org {
  id: string;
  name: string;
  legal_name: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  province: string | null;
  people_count: number;
  created_at: string;
  updated_at: string;
}

export default function OrgsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: '',
    telephone: '',
    email: '',
    website: '',
    notes: '',
  });

  const { data, isLoading } = useQuery<{ orgs: Org[]; total: number }>({
    queryKey: ['/api/crm/orgs', search],
    queryFn: () =>
      fetch(`/api/crm/orgs${search ? `?search=${encodeURIComponent(search)}` : ''}`, {
        credentials: 'include',
      }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (org: typeof newOrg) => {
      const res = await apiRequest('POST', '/api/crm/orgs', org);
      return res.json();
    },
    onSuccess: (result: { org: Org }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/orgs'] });
      setShowCreate(false);
      setNewOrg({ name: '', telephone: '', email: '', website: '', notes: '' });
      toast({ title: 'Organization created', description: `${result.org.name} has been added.` });
      navigate(`/app/crm/orgs/${result.org.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create organization', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!newOrg.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(newOrg);
  };

  const orgs = data?.orgs || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Organizations</h1>
          <p className="text-muted-foreground text-sm">
            Manage companies, strata councils, and property management firms
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-org">
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-orgs"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No organizations yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first organization to get started.
            </p>
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-org-empty">
              <Plus className="w-4 h-4 mr-2" />
              Add Organization
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Card
              key={org.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/app/crm/orgs/${org.id}`)}
              data-testid={`card-org-${org.id}`}
            >
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base truncate">{org.name}</CardTitle>
                {org.people_count > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    <Users className="w-3 h-3 mr-1" />
                    {org.people_count}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {org.telephone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{org.telephone}</span>
                  </div>
                )}
                {org.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{org.email}</span>
                  </div>
                )}
                {org.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="truncate">{org.website}</span>
                  </div>
                )}
                {org.city && (
                  <div className="text-xs text-muted-foreground/60">
                    {org.city}{org.province && `, ${org.province}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                placeholder="e.g., ABC Property Management"
                value={newOrg.name}
                onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                data-testid="input-org-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Phone</Label>
              <Input
                id="telephone"
                type="tel"
                placeholder="(250) 555-0123"
                value={newOrg.telephone}
                onChange={(e) => setNewOrg({ ...newOrg, telephone: e.target.value })}
                data-testid="input-org-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@example.com"
                value={newOrg.email}
                onChange={(e) => setNewOrg({ ...newOrg, email: e.target.value })}
                data-testid="input-org-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={newOrg.website}
                onChange={(e) => setNewOrg({ ...newOrg, website: e.target.value })}
                data-testid="input-org-website"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details..."
                value={newOrg.notes}
                onChange={(e) => setNewOrg({ ...newOrg, notes: e.target.value })}
                data-testid="input-org-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-save-org"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
