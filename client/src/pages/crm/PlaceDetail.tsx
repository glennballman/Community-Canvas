import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Image, Plus, Trash2, Edit, User, Building2, Phone, Mail, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  taken_at: string | null;
  sort_order: number;
  created_at: string;
}

interface Place {
  id: string;
  name: string;
  place_type: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  owner_person_id: string | null;
  owner_org_id: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_org_name: string | null;
  created_at: string;
  updated_at: string;
}

const PLACE_TYPES = [
  { value: 'property', label: 'Property' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'vacant_lot', label: 'Vacant Lot' },
  { value: 'public_space', label: 'Public Space' },
  { value: 'other', label: 'Other' },
];

export default function PlaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState<Partial<Place>>({});
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');

  const { data, isLoading } = useQuery<{ place: Place; photos: Photo[] }>({
    queryKey: ['/api/crm/places', id],
    queryFn: () =>
      fetch(`/api/crm/places/${id}`, { credentials: 'include' }).then((r) => r.json()),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Place>) => {
      const res = await apiRequest('PUT', `/api/crm/places/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/places', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/places'] });
      setEditing(false);
      toast({ title: 'Place updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update place', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/crm/places/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/places'] });
      toast({ title: 'Place deleted' });
      navigate('/app/crm/places');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete place', variant: 'destructive' });
    },
  });

  const addPhotoMutation = useMutation({
    mutationFn: async ({ url, caption }: { url: string; caption: string }) => {
      const res = await apiRequest('POST', `/api/crm/places/${id}/photos`, { url, caption });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/places', id] });
      setShowPhotoDialog(false);
      setNewPhotoUrl('');
      setNewPhotoCaption('');
      toast({ title: 'Photo added' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add photo', variant: 'destructive' });
    },
  });

  const handleStartEdit = () => {
    if (data?.place) {
      setEditData({
        name: data.place.name,
        place_type: data.place.place_type,
        address_line1: data.place.address_line1 || '',
        address_line2: data.place.address_line2 || '',
        city: data.place.city || '',
        province: data.place.province || 'BC',
        postal_code: data.place.postal_code || '',
        notes: data.place.notes || '',
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

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) {
      toast({ title: 'URL required', variant: 'destructive' });
      return;
    }
    addPhotoMutation.mutate({ url: newPhotoUrl, caption: newPhotoCaption });
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

  if (!data?.place) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium">Place not found</h2>
        <Button variant="outline" onClick={() => navigate('/app/crm/places')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Places
        </Button>
      </div>
    );
  }

  const { place, photos } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/crm/places')} data-testid="button-back">
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
            <h1 className="text-2xl font-semibold" data-testid="text-place-name">{place.name}</h1>
          )}
          <Badge variant="secondary" className="mt-1">
            {PLACE_TYPES.find((t) => t.value === place.place_type)?.label || place.place_type}
          </Badge>
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
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  Photos
                </CardTitle>
                <CardDescription>Site photos and documentation</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowPhotoDialog(true)} data-testid="button-add-photo">
                <Plus className="w-4 h-4 mr-2" />
                Add Photo
              </Button>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No photos yet. Add your first photo to document this place.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Place photo'}
                        className="w-full h-32 object-cover rounded-md"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-md">
                          {photo.caption}
                        </div>
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
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={editData.place_type || 'property'}
                      onValueChange={(v) => setEditData({ ...editData, place_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLACE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <div className="space-y-2 text-sm">
                  {place.address_line1 && <p>{place.address_line1}</p>}
                  {place.address_line2 && <p>{place.address_line2}</p>}
                  {(place.city || place.province || place.postal_code) && (
                    <p>
                      {[place.city, place.province, place.postal_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {!place.address_line1 && !place.city && (
                    <p className="text-muted-foreground">No address on file</p>
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
                  placeholder="Add notes about this place..."
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {place.notes || <span className="text-muted-foreground">No notes</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Owner / Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {place.owner_org_name ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{place.owner_org_name}</span>
                  </div>
                  {(place.owner_first_name || place.owner_last_name) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{place.owner_first_name} {place.owner_last_name}</span>
                    </div>
                  )}
                </div>
              ) : place.owner_first_name ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {place.owner_first_name} {place.owner_last_name}
                    </span>
                  </div>
                  {place.owner_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${place.owner_phone}`} className="hover:underline">
                        {place.owner_phone}
                      </a>
                    </div>
                  )}
                  {place.owner_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${place.owner_email}`} className="hover:underline truncate">
                        {place.owner_email}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No owner assigned</p>
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
                <span>{new Date(place.created_at).toLocaleDateString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{new Date(place.updated_at).toLocaleDateString()}</span>
              </div>
              {place.latitude && place.longitude && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span>Coordinates</span>
                    <span className="font-mono text-xs">
                      {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="photo-url">Photo URL *</Label>
              <Input
                id="photo-url"
                placeholder="https://example.com/photo.jpg"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                data-testid="input-photo-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo-caption">Caption</Label>
              <Input
                id="photo-caption"
                placeholder="Optional description"
                value={newPhotoCaption}
                onChange={(e) => setNewPhotoCaption(e.target.value)}
                data-testid="input-photo-caption"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhotoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPhoto} disabled={addPhotoMutation.isPending} data-testid="button-save-photo">
              {addPhotoMutation.isPending ? 'Adding...' : 'Add Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this place?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{place.name}" and all associated photos. This action cannot be undone.
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
