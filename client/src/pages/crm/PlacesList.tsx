import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MapPin, Image, Building2, User } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Place {
  id: string;
  name: string;
  place_type: string;
  address_line1: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  photo_count: number;
  owner_given_name: string | null;
  owner_family_name: string | null;
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

export default function PlacesList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPlace, setNewPlace] = useState({
    name: '',
    place_type: 'property',
    address_line1: '',
    city: '',
    postal_code: '',
    notes: '',
  });

  const { data, isLoading } = useQuery<{ places: Place[]; total: number }>({
    queryKey: ['/api/crm/places', search],
    queryFn: () =>
      fetch(`/api/crm/places${search ? `?search=${encodeURIComponent(search)}` : ''}`, {
        credentials: 'include',
      }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (place: typeof newPlace) => {
      const res = await apiRequest('POST', '/api/crm/places', place);
      return res.json();
    },
    onSuccess: (result: { place: Place }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/places'] });
      setShowCreate(false);
      setNewPlace({
        name: '',
        place_type: 'property',
        address_line1: '',
        city: '',
        postal_code: '',
        notes: '',
      });
      toast({ title: 'Place created', description: `${result.place.name} has been added.` });
      navigate(`/app/crm/places/${result.place.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create place', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!newPlace.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(newPlace);
  };

  const places = data?.places || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Places</h1>
          <p className="text-muted-foreground text-sm">
            Manage properties, sites, and locations
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-place">
          <Plus className="w-4 h-4 mr-2" />
          Add Place
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search places..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-places"
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
      ) : places.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No places yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first property or location to get started.
            </p>
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-place-empty">
              <Plus className="w-4 h-4 mr-2" />
              Add Place
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {places.map((place) => (
            <Card
              key={place.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/app/crm/places/${place.id}`)}
              data-testid={`card-place-${place.id}`}
            >
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base truncate">{place.name}</CardTitle>
                <Badge variant="secondary" className="shrink-0">
                  {PLACE_TYPES.find((t) => t.value === place.place_type)?.label || place.place_type}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {place.address_line1 && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {place.address_line1}
                      {place.city && `, ${place.city}`}
                    </span>
                  </div>
                )}
                {place.photo_count > 0 && (
                  <div className="flex items-center gap-2">
                    <Image className="w-3 h-3" />
                    <span>{place.photo_count} photo{place.photo_count !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {(place.owner_given_name || place.owner_org_name) && (
                  <div className="flex items-center gap-2">
                    {place.owner_org_name ? (
                      <>
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{place.owner_org_name}</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3" />
                        <span className="truncate">
                          {place.owner_given_name} {place.owner_family_name}
                        </span>
                      </>
                    )}
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
            <DialogTitle>Add New Place</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., 123 Main Street Property"
                value={newPlace.name}
                onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                data-testid="input-place-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={newPlace.place_type}
                onValueChange={(v) => setNewPlace({ ...newPlace, place_type: v })}
              >
                <SelectTrigger data-testid="select-place-type">
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
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={newPlace.address_line1}
                onChange={(e) => setNewPlace({ ...newPlace, address_line1: e.target.value })}
                data-testid="input-place-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={newPlace.city}
                  onChange={(e) => setNewPlace({ ...newPlace, city: e.target.value })}
                  data-testid="input-place-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal Code</Label>
                <Input
                  id="postal"
                  placeholder="V0R 1A0"
                  value={newPlace.postal_code}
                  onChange={(e) => setNewPlace({ ...newPlace, postal_code: e.target.value })}
                  data-testid="input-place-postal"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details..."
                value={newPlace.notes}
                onChange={(e) => setNewPlace({ ...newPlace, notes: e.target.value })}
                data-testid="input-place-notes"
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
              data-testid="button-save-place"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Place'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
