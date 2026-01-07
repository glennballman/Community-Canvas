import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, User, Phone, Mail, Building2 } from 'lucide-react';
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

interface Person {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  role_title: string | null;
  city: string | null;
  province: string | null;
  org_name: string | null;
  created_at: string;
  updated_at: string;
}

export default function PeopleList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPerson, setNewPerson] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    notes: '',
  });

  const { data, isLoading } = useQuery<{ people: Person[]; total: number }>({
    queryKey: ['/api/crm/people', search],
    queryFn: () =>
      fetch(`/api/crm/people${search ? `?search=${encodeURIComponent(search)}` : ''}`, {
        credentials: 'include',
      }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (person: typeof newPerson) => {
      const res = await apiRequest('POST', '/api/crm/people', person);
      return res.json();
    },
    onSuccess: (result: { person: Person }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/people'] });
      setShowCreate(false);
      setNewPerson({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
      toast({ title: 'Person created', description: `${result.person.first_name} has been added.` });
      navigate(`/app/crm/people/${result.person.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create person', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!newPerson.first_name.trim()) {
      toast({ title: 'First name required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(newPerson);
  };

  const people = data?.people || [];

  const getDisplayName = (p: Person) => {
    if (p.display_name) return p.display_name;
    return [p.first_name, p.last_name].filter(Boolean).join(' ');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">People</h1>
          <p className="text-muted-foreground text-sm">
            Manage people and property owners
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-person">
          <Plus className="w-4 h-4 mr-2" />
          Add Person
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-people"
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
      ) : people.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No contacts yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first contact to get started.
            </p>
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-person-empty">
              <Plus className="w-4 h-4 mr-2" />
              Add Person
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => (
            <Card
              key={person.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/app/crm/people/${person.id}`)}
              data-testid={`card-person-${person.id}`}
            >
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base truncate">{getDisplayName(person)}</CardTitle>
                {person.role_title && (
                  <Badge variant="secondary" className="shrink-0">
                    {person.role_title}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{person.phone}</span>
                  </div>
                )}
                {person.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{person.email}</span>
                  </div>
                )}
                {person.org_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{person.org_name}</span>
                  </div>
                )}
                {person.city && (
                  <div className="text-xs text-muted-foreground/60">
                    {person.city}{person.province && `, ${person.province}`}
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
            <DialogTitle>Add New Person</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  placeholder="First name"
                  value={newPerson.first_name}
                  onChange={(e) => setNewPerson({ ...newPerson, first_name: e.target.value })}
                  data-testid="input-person-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  placeholder="Last name"
                  value={newPerson.last_name}
                  onChange={(e) => setNewPerson({ ...newPerson, last_name: e.target.value })}
                  data-testid="input-person-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(250) 555-0123"
                value={newPerson.phone}
                onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                data-testid="input-person-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={newPerson.email}
                onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                data-testid="input-person-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details..."
                value={newPerson.notes}
                onChange={(e) => setNewPerson({ ...newPerson, notes: e.target.value })}
                data-testid="input-person-notes"
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
              data-testid="button-save-person"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Person'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
