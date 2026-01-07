import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, Building2, MapPin, Edit, Trash2, Save, X } from 'lucide-react';
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

interface Person {
  id: string;
  given_name: string;
  family_name: string | null;
  display_name: string | null;
  telephone: string | null;
  email: string | null;
  role_title: string | null;
  org_id: string | null;
  org_name: string | null;
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

interface Place {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
}

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState<Partial<Person>>({});

  const { data, isLoading } = useQuery<{ person: Person; places: Place[] }>({
    queryKey: ['/api/crm/people', id],
    queryFn: () =>
      fetch(`/api/crm/people/${id}`, { credentials: 'include' }).then((r) => r.json()),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Person>) => {
      const res = await apiRequest('PUT', `/api/crm/people/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/people', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/people'] });
      setEditing(false);
      toast({ title: 'Person updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update person', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/crm/people/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/people'] });
      toast({ title: 'Person deleted' });
      navigate('/app/crm/people');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete person', variant: 'destructive' });
    },
  });

  const handleStartEdit = () => {
    if (data?.person) {
      setEditData({
        given_name: data.person.given_name,
        family_name: data.person.family_name || '',
        telephone: data.person.telephone || '',
        email: data.person.email || '',
        role_title: data.person.role_title || '',
        address_line1: data.person.address_line1 || '',
        city: data.person.city || '',
        postal_code: data.person.postal_code || '',
        notes: data.person.notes || '',
      });
      setEditing(true);
    }
  };

  const handleSave = () => {
    if (!editData.given_name?.trim()) {
      toast({ title: 'First name required', variant: 'destructive' });
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

  if (!data?.person) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium">Person not found</h2>
        <Button variant="outline" onClick={() => navigate('/app/crm/people')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to People
        </Button>
      </div>
    );
  }

  const { person, places } = data;
  const displayName = person.display_name || [person.given_name, person.family_name].filter(Boolean).join(' ');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/crm/people')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          {editing ? (
            <div className="flex gap-2">
              <Input
                value={editData.given_name || ''}
                onChange={(e) => setEditData({ ...editData, given_name: e.target.value })}
                placeholder="First name"
                className="text-xl font-semibold h-auto py-1 max-w-[150px]"
                data-testid="input-edit-first-name"
              />
              <Input
                value={editData.family_name || ''}
                onChange={(e) => setEditData({ ...editData, family_name: e.target.value })}
                placeholder="Last name"
                className="text-xl font-semibold h-auto py-1 max-w-[150px]"
                data-testid="input-edit-last-name"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-semibold" data-testid="text-person-name">{displayName}</h1>
          )}
          {person.role_title && !editing && (
            <Badge variant="secondary" className="mt-1">{person.role_title}</Badge>
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
                <User className="w-5 h-5" />
                Person Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={editData.telephone || ''}
                        onChange={(e) => setEditData({ ...editData, telephone: e.target.value })}
                        placeholder="(250) 555-0123"
                        data-testid="input-edit-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        placeholder="email@example.com"
                        data-testid="input-edit-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role / Title</Label>
                    <Input
                      value={editData.role_title || ''}
                      onChange={(e) => setEditData({ ...editData, role_title: e.target.value })}
                      placeholder="e.g., Property Manager"
                      data-testid="input-edit-role"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={editData.address_line1 || ''}
                      onChange={(e) => setEditData({ ...editData, address_line1: e.target.value })}
                      placeholder="Street address"
                      data-testid="input-edit-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={editData.city || ''}
                        onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                        data-testid="input-edit-city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Code</Label>
                      <Input
                        value={editData.postal_code || ''}
                        onChange={(e) => setEditData({ ...editData, postal_code: e.target.value })}
                        data-testid="input-edit-postal"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {person.telephone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${person.telephone}`} className="hover:underline">{person.telephone}</a>
                    </div>
                  )}
                  {person.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a>
                    </div>
                  )}
                  {person.org_name && (
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{person.org_name}</span>
                    </div>
                  )}
                  {person.address_line1 && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {person.address_line1}
                        {person.city && `, ${person.city}`}
                        {person.province && `, ${person.province}`}
                      </span>
                    </div>
                  )}
                  {!person.telephone && !person.email && !person.address_line1 && (
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
                  placeholder="Add notes about this contact..."
                  rows={4}
                  data-testid="textarea-edit-notes"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {person.notes || <span className="text-muted-foreground">No notes</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Owned Places
              </CardTitle>
              <CardDescription>Properties owned by this contact</CardDescription>
            </CardHeader>
            <CardContent>
              {places.length === 0 ? (
                <p className="text-sm text-muted-foreground">No places assigned</p>
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
                <span>{new Date(person.created_at).toLocaleDateString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{new Date(person.updated_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{displayName}". This action cannot be undone.
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
