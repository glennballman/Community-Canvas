import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Phone, Mail, Globe, MapPin, Users, Edit, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Org {
  id: string;
  name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Person {
  id: string;
  first_name: string;
  last_name: string | null;
  role_title: string | null;
  phone: string | null;
  email: string | null;
}

interface Place {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
}

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState<Partial<Org>>({});

  const { data, isLoading } = useQuery<{ org: Org; people: Person[]; places: Place[] }>({
    queryKey: ['/api/crm/orgs', id],
    queryFn: () =>
      fetch(`/api/crm/orgs/${id}`, { credentials: 'include' }).then((r) => r.json()),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Org>) => {
      const res = await apiRequest('PUT', `/api/crm/orgs/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/orgs', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/orgs'] });
      setEditing(false);
      toast({ title: 'Organization updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update organization', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/crm/orgs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/orgs'] });
      toast({ title: 'Organization deleted' });
      navigate('/app/crm/orgs');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete organization', variant: 'destructive' });
    },
  });

  const handleStartEdit = () => {
    if (data?.org) {
      setEditData({
        name: data.org.name,
        legal_name: data.org.legal_name || '',
        phone: data.org.phone || '',
        email: data.org.email || '',
        website: data.org.website || '',
        address_line1: data.org.address_line1 || '',
        city: data.org.city || '',
        postal_code: data.org.postal_code || '',
        notes: data.org.notes || '',
      });
      setEditing(true);
    }
  };

  const handleSave = () => {
    if (!editData.name?.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    updateMutation.mutate(editData);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data?.org) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium">Organization not found</h2>
        <Button variant="outline" onClick={() => navigate('/app/crm/orgs')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Organizations
        </Button>
      </div>
    );
  }

  const { org, people, places } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/crm/orgs')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          {editing ? (
            <Input
              value={editData.name || ''}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="text-2xl font-semibold h-auto py-1"
              data-testid="input-edit-name"
            />
          ) : (
            <h1 className="text-2xl font-semibold" data-testid="text-org-name">{org.name}</h1>
          )}
          {org.legal_name && !editing && (
            <p className="text-sm text-muted-foreground">{org.legal_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleStartEdit} data-testid="button-edit">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} data-testid="button-delete">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label>Legal Name</Label>
                    <Input
                      value={editData.legal_name || ''}
                      onChange={(e) => setEditData({ ...editData, legal_name: e.target.value })}
                      placeholder="Full legal name (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        placeholder="(250) 555-0123"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        placeholder="contact@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={editData.website || ''}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={editData.address_line1 || ''}
                      onChange={(e) => setEditData({ ...editData, address_line1: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={editData.city || ''}
                        onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Code</Label>
                      <Input
                        value={editData.postal_code || ''}
                        onChange={(e) => setEditData({ ...editData, postal_code: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {org.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${org.phone}`} className="hover:underline">{org.phone}</a>
                    </div>
                  )}
                  {org.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${org.email}`} className="hover:underline">{org.email}</a>
                    </div>
                  )}
                  {org.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {org.website}
                      </a>
                    </div>
                  )}
                  {org.address_line1 && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {org.address_line1}
                        {org.city && `, ${org.city}`}
                        {org.province && `, ${org.province}`}
                      </span>
                    </div>
                  )}
                  {!org.phone && !org.email && !org.website && !org.address_line1 && (
                    <p className="text-muted-foreground text-sm">No contact information on file</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editData.notes || ''}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Add notes about this organization..."
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {org.notes || <span className="text-muted-foreground">No notes</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members
              </CardTitle>
              <CardDescription>People associated with this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {people.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members</p>
              ) : (
                <div className="space-y-2">
                  {people.map((person) => (
                    <div
                      key={person.id}
                      className="p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => navigate(`/app/crm/people/${person.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">
                          {person.first_name} {person.last_name}
                        </p>
                        {person.role_title && (
                          <Badge variant="secondary" className="text-xs">{person.role_title}</Badge>
                        )}
                      </div>
                      {(person.phone || person.email) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {person.phone || person.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Properties
              </CardTitle>
              <CardDescription>Places owned by this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {places.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties</p>
              ) : (
                <div className="space-y-2">
                  {places.map((place) => (
                    <div
                      key={place.id}
                      className="p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => navigate(`/app/crm/places/${place.id}`)}
                    >
                      <p className="font-medium text-sm">{place.name}</p>
                      {place.address_line1 && (
                        <p className="text-xs text-muted-foreground">
                          {place.address_line1}
                          {place.city && `, ${place.city}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{new Date(org.created_at).toLocaleDateString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{new Date(org.updated_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{org.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
