import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Edit2, MapPin, Save, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Zone {
  id: string;
  tenantId: string;
  portalId: string;
  key: string;
  name: string;
  kind: string;
  badgeLabelResident: string | null;
  badgeLabelContractor: string | null;
  badgeLabelVisitor: string | null;
  theme: Record<string, any>;
  accessProfile: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface ZonesResponse {
  ok: boolean;
  zones: Zone[];
}

interface ZoneFormData {
  key: string;
  name: string;
  kind: string;
  badgeLabelResident: string;
  badgeLabelContractor: string;
  badgeLabelVisitor: string;
}

const ZONE_KINDS = [
  { value: 'neighborhood', label: 'Neighborhood' },
  { value: 'community', label: 'Community' },
  { value: 'island', label: 'Island' },
  { value: 'access_point', label: 'Access Point' },
  { value: 'district', label: 'District' },
  { value: 'custom', label: 'Custom' },
];

const emptyFormData: ZoneFormData = {
  key: '',
  name: '',
  kind: 'neighborhood',
  badgeLabelResident: '',
  badgeLabelContractor: '',
  badgeLabelVisitor: '',
};

export default function PortalZonesPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState<ZoneFormData>(emptyFormData);
  const [deleteZone, setDeleteZone] = useState<Zone | null>(null);

  const { data, isLoading } = useQuery<ZonesResponse>({
    queryKey: ['/api/p2/app/zones', portalId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/zones?portalId=${portalId}`);
      if (!res.ok) throw new Error('Failed to fetch zones');
      return res.json();
    },
    enabled: !!portalId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ZoneFormData) => {
      const res = await apiRequest('POST', '/api/p2/app/zones', {
        portalId,
        ...data,
        badgeLabelResident: data.badgeLabelResident || null,
        badgeLabelContractor: data.badgeLabelContractor || null,
        badgeLabelVisitor: data.badgeLabelVisitor || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/zones', portalId] });
      toast({ title: 'Zone created', description: 'The zone has been created successfully.' });
      setIsDialogOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ zoneId, data }: { zoneId: string; data: ZoneFormData }) => {
      const res = await apiRequest('PUT', `/api/p2/app/zones/${zoneId}`, {
        ...data,
        badgeLabelResident: data.badgeLabelResident || null,
        badgeLabelContractor: data.badgeLabelContractor || null,
        badgeLabelVisitor: data.badgeLabelVisitor || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/zones', portalId] });
      toast({ title: 'Zone updated', description: 'The zone has been updated successfully.' });
      setIsDialogOpen(false);
      setEditingZone(null);
      setFormData(emptyFormData);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest('DELETE', `/api/p2/app/zones/${zoneId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/zones', portalId] });
      toast({ title: 'Zone deleted', description: 'The zone has been deleted.' });
      setDeleteZone(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleOpenCreate = () => {
    setEditingZone(null);
    setFormData(emptyFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      key: zone.key,
      name: zone.name,
      kind: zone.kind,
      badgeLabelResident: zone.badgeLabelResident || '',
      badgeLabelContractor: zone.badgeLabelContractor || '',
      badgeLabelVisitor: zone.badgeLabelVisitor || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.key.trim() || !formData.name.trim()) {
      toast({ title: 'Validation error', description: 'Key and name are required.', variant: 'destructive' });
      return;
    }

    if (editingZone) {
      updateMutation.mutate({ zoneId: editingZone.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleKeyChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setFormData(prev => ({ ...prev, key: sanitized }));
  };

  const zones = data?.zones || [];

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/app/admin/portals">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Portal Zones</h1>
          <p className="text-sm text-muted-foreground">
            Define geographic zones for organizing properties and work requests
          </p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-zone">
          <Plus className="h-4 w-4 mr-2" />
          Add Zone
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Zones
          </CardTitle>
          <CardDescription>
            Zones help organize properties and work requests by geographic area
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No zones defined yet</p>
              <p className="text-sm">Create zones to organize properties and work requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map(zone => (
                <div 
                  key={zone.id}
                  className="flex items-center gap-4 p-4 border rounded-md hover-elevate"
                  data-testid={`zone-row-${zone.key}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" data-testid={`text-zone-name-${zone.key}`}>{zone.name}</span>
                      <Badge variant="secondary" data-testid={`badge-zone-kind-${zone.key}`}>
                        {ZONE_KINDS.find(k => k.value === zone.kind)?.label || zone.kind}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Key: <code className="bg-muted px-1 rounded">{zone.key}</code>
                      {zone.badgeLabelResident && (
                        <span className="ml-3">Resident: {zone.badgeLabelResident}</span>
                      )}
                      {zone.badgeLabelContractor && (
                        <span className="ml-3">Contractor: {zone.badgeLabelContractor}</span>
                      )}
                      {zone.badgeLabelVisitor && (
                        <span className="ml-3">Visitor: {zone.badgeLabelVisitor}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenEdit(zone)}
                      data-testid={`button-edit-zone-${zone.key}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setDeleteZone(zone)}
                      data-testid={`button-delete-zone-${zone.key}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit Zone' : 'Create Zone'}</DialogTitle>
            <DialogDescription>
              {editingZone 
                ? 'Update the zone details below'
                : 'Define a new zone for organizing properties and work requests'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="East Bamfield"
                data-testid="input-zone-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key">Key (URL-safe identifier)</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={e => handleKeyChange(e.target.value)}
                placeholder="east-bamfield"
                disabled={!!editingZone}
                data-testid="input-zone-key"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kind">Type</Label>
              <Select
                value={formData.kind}
                onValueChange={value => setFormData(prev => ({ ...prev, kind: value }))}
              >
                <SelectTrigger data-testid="select-zone-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONE_KINDS.map(kind => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Badge Labels (optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input
                    placeholder="Resident"
                    value={formData.badgeLabelResident}
                    onChange={e => setFormData(prev => ({ ...prev, badgeLabelResident: e.target.value }))}
                    data-testid="input-badge-resident"
                  />
                  <span className="text-xs text-muted-foreground">Resident</span>
                </div>
                <div>
                  <Input
                    placeholder="Contractor"
                    value={formData.badgeLabelContractor}
                    onChange={e => setFormData(prev => ({ ...prev, badgeLabelContractor: e.target.value }))}
                    data-testid="input-badge-contractor"
                  />
                  <span className="text-xs text-muted-foreground">Contractor</span>
                </div>
                <div>
                  <Input
                    placeholder="Visitor"
                    value={formData.badgeLabelVisitor}
                    onChange={e => setFormData(prev => ({ ...prev, badgeLabelVisitor: e.target.value }))}
                    data-testid="input-badge-visitor"
                  />
                  <span className="text-xs text-muted-foreground">Visitor</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-zone"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <span className="mr-2">Saving...</span>
              )}
              {!(createMutation.isPending || updateMutation.isPending) && (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingZone ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteZone} onOpenChange={() => setDeleteZone(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteZone?.name}"? 
              Properties and work requests in this zone will become unzoned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteZone && deleteMutation.mutate(deleteZone.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
