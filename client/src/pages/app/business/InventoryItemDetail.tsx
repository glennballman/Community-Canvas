import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Info,
  Ban,
  Check,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CapabilityUnit {
  id: string;
  name: string;
  capability_type: string;
  status: 'operational' | 'inoperable' | 'maintenance';
  notes: string | null;
}

interface Capacity {
  id: string;
  key: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  applies_to: string | null;
  notes: string | null;
  capability_unit_id: string | null;
  capability_unit_name: string | null;
}

interface Constraint {
  id: string;
  constraint_type: string;
  severity: 'info' | 'warning' | 'blocking';
  details: string | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  capability_unit_id: string | null;
  capability_unit_name: string | null;
}

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  description: string | null;
}

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: typeof Check }> = {
  operational: { variant: 'default', icon: Check },
  inoperable: { variant: 'destructive', icon: Ban },
  maintenance: { variant: 'secondary', icon: Wrench },
};

const SEVERITY_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: typeof Info }> = {
  info: { variant: 'secondary', icon: Info },
  warning: { variant: 'default', icon: AlertTriangle },
  blocking: { variant: 'destructive', icon: Ban },
};

const COMMON_CAPACITY_KEYS = [
  { key: 'max_weight_lbs', label: 'Max Weight', unit: 'lbs' },
  { key: 'max_length_ft', label: 'Max Length', unit: 'ft' },
  { key: 'max_people', label: 'Max People', unit: 'people' },
  { key: 'max_pallets', label: 'Max Pallets', unit: 'pallets' },
  { key: 'max_rv_length_ft', label: 'Max RV Length', unit: 'ft' },
];

const COMMON_CONSTRAINT_TYPES = [
  'requires_manual_loading',
  'no_ferry_after',
  'no_saltwater',
  'winter_only',
  'broken',
  'winter_tires_required',
  'requires_certification',
];

export default function InventoryItemDetail() {
  const params = useParams();
  const assetId = params.id;
  const { toast } = useToast();
  
  const [showCapabilityDialog, setShowCapabilityDialog] = useState(false);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [showConstraintDialog, setShowConstraintDialog] = useState(false);
  const [editingCapability, setEditingCapability] = useState<CapabilityUnit | null>(null);
  const [editingCapacity, setEditingCapacity] = useState<Capacity | null>(null);
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null);
  
  const [capabilityForm, setCapabilityForm] = useState<{
    name: string;
    capability_type: string;
    status: 'operational' | 'inoperable' | 'maintenance';
    notes: string;
  }>({
    name: '',
    capability_type: '',
    status: 'operational',
    notes: '',
  });
  
  const [capacityForm, setCapacityForm] = useState({
    key: '',
    value_num: '',
    value_text: '',
    unit: '',
    applies_to: '',
    notes: '',
    capability_unit_id: '',
  });
  
  const [constraintForm, setConstraintForm] = useState<{
    constraint_type: string;
    severity: 'info' | 'warning' | 'blocking';
    details: string;
    active: boolean;
    start_date: string;
    end_date: string;
    capability_unit_id: string;
  }>({
    constraint_type: '',
    severity: 'info',
    details: '',
    active: true,
    start_date: '',
    end_date: '',
    capability_unit_id: '',
  });
  
  const { data: asset, isLoading: assetLoading } = useQuery<Asset>({
    queryKey: ['/api/rentals/items', assetId],
    enabled: !!assetId,
  });
  
  const { data: capabilityUnits = [], isLoading: capabilitiesLoading } = useQuery<CapabilityUnit[]>({
    queryKey: ['/api/capacity/assets', assetId, 'capability-units'],
    enabled: !!assetId,
  });
  
  const { data: capacities = [], isLoading: capacitiesLoading } = useQuery<Capacity[]>({
    queryKey: ['/api/capacity/assets', assetId, 'capacities'],
    enabled: !!assetId,
  });
  
  const { data: constraints = [], isLoading: constraintsLoading } = useQuery<Constraint[]>({
    queryKey: ['/api/capacity/assets', assetId, 'constraints'],
    enabled: !!assetId,
  });
  
  const createCapabilityMutation = useMutation({
    mutationFn: async (data: typeof capabilityForm) => {
      return apiRequest('POST', '/api/capacity/capability-units', {
        ...data,
        asset_id: assetId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'capability-units'] });
      setShowCapabilityDialog(false);
      resetCapabilityForm();
      toast({ title: 'Capability added successfully' });
    },
    onError: () => toast({ title: 'Failed to add capability', variant: 'destructive' }),
  });
  
  const updateCapabilityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof capabilityForm> }) => {
      return apiRequest('PATCH', `/api/capacity/capability-units/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'capability-units'] });
      setShowCapabilityDialog(false);
      setEditingCapability(null);
      resetCapabilityForm();
      toast({ title: 'Capability updated successfully' });
    },
    onError: () => toast({ title: 'Failed to update capability', variant: 'destructive' }),
  });
  
  const deleteCapabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/capacity/capability-units/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'capability-units'] });
      toast({ title: 'Capability deleted' });
    },
    onError: () => toast({ title: 'Failed to delete capability', variant: 'destructive' }),
  });
  
  const createCapacityMutation = useMutation({
    mutationFn: async (data: typeof capacityForm) => {
      return apiRequest('POST', '/api/capacity/capacities', {
        asset_id: assetId,
        key: data.key,
        value_num: data.value_num ? parseFloat(data.value_num) : null,
        value_text: data.value_text || null,
        unit: data.unit || null,
        applies_to: data.applies_to || null,
        notes: data.notes || null,
        capability_unit_id: data.capability_unit_id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'capacities'] });
      setShowCapacityDialog(false);
      resetCapacityForm();
      toast({ title: 'Capacity added successfully' });
    },
    onError: () => toast({ title: 'Failed to add capacity', variant: 'destructive' }),
  });
  
  const deleteCapacityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/capacity/capacities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'capacities'] });
      toast({ title: 'Capacity deleted' });
    },
    onError: () => toast({ title: 'Failed to delete capacity', variant: 'destructive' }),
  });
  
  const createConstraintMutation = useMutation({
    mutationFn: async (data: typeof constraintForm) => {
      return apiRequest('POST', '/api/capacity/constraints', {
        asset_id: assetId,
        constraint_type: data.constraint_type,
        severity: data.severity,
        details: data.details || null,
        active: data.active,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        capability_unit_id: data.capability_unit_id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'constraints'] });
      setShowConstraintDialog(false);
      resetConstraintForm();
      toast({ title: 'Constraint added successfully' });
    },
    onError: () => toast({ title: 'Failed to add constraint', variant: 'destructive' }),
  });
  
  const deleteConstraintMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/capacity/constraints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/capacity/assets', assetId, 'constraints'] });
      toast({ title: 'Constraint deleted' });
    },
    onError: () => toast({ title: 'Failed to delete constraint', variant: 'destructive' }),
  });
  
  function resetCapabilityForm() {
    setCapabilityForm({ name: '', capability_type: '', status: 'operational' as const, notes: '' });
  }
  
  function resetCapacityForm() {
    setCapacityForm({ key: '', value_num: '', value_text: '', unit: '', applies_to: '', notes: '', capability_unit_id: '' });
  }
  
  function resetConstraintForm() {
    setConstraintForm({ constraint_type: '', severity: 'info' as const, details: '', active: true, start_date: '', end_date: '', capability_unit_id: '' });
  }
  
  function openEditCapability(unit: CapabilityUnit) {
    setEditingCapability(unit);
    setCapabilityForm({
      name: unit.name,
      capability_type: unit.capability_type,
      status: unit.status,
      notes: unit.notes || '',
    });
    setShowCapabilityDialog(true);
  }
  
  if (assetLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="asset-detail">
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/app/assets">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{asset?.name || 'Asset'}</h1>
          <p className="text-muted-foreground capitalize">{asset?.asset_type || 'Asset'}</p>
        </div>
      </div>
      
      <Tabs defaultValue="capabilities" className="w-full">
        <TabsList data-testid="tabs-asset-detail">
          <TabsTrigger value="capabilities" data-testid="tab-capabilities">
            Capability Units ({capabilityUnits.length})
          </TabsTrigger>
          <TabsTrigger value="capacities" data-testid="tab-capacities">
            Capacities ({capacities.length})
          </TabsTrigger>
          <TabsTrigger value="constraints" data-testid="tab-constraints">
            Constraints ({constraints.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="capabilities" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Child capabilities like cranes, lift gates, rooms, or slips that can be individually tracked.
            </p>
            <Button onClick={() => setShowCapabilityDialog(true)} data-testid="button-add-capability">
              <Plus className="h-4 w-4 mr-2" />
              Add Capability
            </Button>
          </div>
          
          {capabilitiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : capabilityUnits.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No Capability Units</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add child capabilities like cranes, lift gates, or rooms.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capabilityUnits.map((unit) => {
                const statusConfig = STATUS_BADGES[unit.status];
                const StatusIcon = statusConfig.icon;
                return (
                  <Card key={unit.id} data-testid={`card-capability-${unit.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{unit.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{unit.capability_type}</p>
                      </div>
                      <Badge variant={statusConfig.variant}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {unit.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-2">
                      {unit.notes && (
                        <p className="text-sm text-muted-foreground truncate flex-1">{unit.notes}</p>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditCapability(unit)}
                          data-testid={`button-edit-capability-${unit.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCapabilityMutation.mutate(unit.id)}
                          data-testid={`button-delete-capability-${unit.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="capacities" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Capacity limits like max weight, max length, or max passengers.
            </p>
            <Button onClick={() => setShowCapacityDialog(true)} data-testid="button-add-capacity">
              <Plus className="h-4 w-4 mr-2" />
              Add Capacity
            </Button>
          </div>
          
          {capacitiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : capacities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No Capacities Defined</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add capacity limits like max weight or max people.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capacities.map((cap) => (
                <Card key={cap.id} data-testid={`card-capacity-${cap.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{cap.key.replace(/_/g, ' ')}</CardTitle>
                      {cap.capability_unit_name && (
                        <p className="text-xs text-muted-foreground">On: {cap.capability_unit_name}</p>
                      )}
                    </div>
                    <span className="text-lg font-mono">
                      {cap.value_num != null ? cap.value_num : cap.value_text}
                      {cap.unit && <span className="text-sm text-muted-foreground ml-1">{cap.unit}</span>}
                    </span>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2">
                    {cap.applies_to && (
                      <Badge variant="secondary">{cap.applies_to}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCapacityMutation.mutate(cap.id)}
                      data-testid={`button-delete-capacity-${cap.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="constraints" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Constraints that may limit or block bookings. Blocking constraints prevent bookings during their time window.
            </p>
            <Button onClick={() => setShowConstraintDialog(true)} data-testid="button-add-constraint">
              <Plus className="h-4 w-4 mr-2" />
              Add Constraint
            </Button>
          </div>
          
          {constraintsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : constraints.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No Constraints</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add constraints like maintenance schedules or operational requirements.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {constraints.map((con) => {
                const severityConfig = SEVERITY_BADGES[con.severity];
                const SeverityIcon = severityConfig.icon;
                return (
                  <Card key={con.id} data-testid={`card-constraint-${con.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{con.constraint_type.replace(/_/g, ' ')}</CardTitle>
                          {!con.active && <Badge variant="outline">Inactive</Badge>}
                        </div>
                        {con.capability_unit_name && (
                          <p className="text-xs text-muted-foreground">On: {con.capability_unit_name}</p>
                        )}
                      </div>
                      <Badge variant={severityConfig.variant}>
                        <SeverityIcon className="h-3 w-3 mr-1" />
                        {con.severity}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {con.details && (
                        <p className="text-sm text-muted-foreground">{con.details}</p>
                      )}
                      {(con.start_date || con.end_date) && (
                        <p className="text-xs text-muted-foreground">
                          {con.start_date && `From: ${new Date(con.start_date).toLocaleDateString()}`}
                          {con.start_date && con.end_date && ' - '}
                          {con.end_date && `To: ${new Date(con.end_date).toLocaleDateString()}`}
                        </p>
                      )}
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteConstraintMutation.mutate(con.id)}
                          data-testid={`button-delete-constraint-${con.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      <Dialog open={showCapabilityDialog} onOpenChange={(open) => {
        setShowCapabilityDialog(open);
        if (!open) {
          setEditingCapability(null);
          resetCapabilityForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCapability ? 'Edit Capability' : 'Add Capability Unit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={capabilityForm.name}
                onChange={(e) => setCapabilityForm({ ...capabilityForm, name: e.target.value })}
                placeholder="e.g., Crane, Lift Gate, Room 2"
                data-testid="input-capability-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                value={capabilityForm.capability_type}
                onChange={(e) => setCapabilityForm({ ...capabilityForm, capability_type: e.target.value })}
                placeholder="e.g., crane, liftgate, room, slip"
                data-testid="input-capability-type"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={capabilityForm.status}
                onValueChange={(value: 'operational' | 'inoperable' | 'maintenance') =>
                  setCapabilityForm({ ...capabilityForm, status: value })
                }
              >
                <SelectTrigger data-testid="select-capability-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="inoperable">Inoperable</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              {capabilityForm.status === 'maintenance' && (
                <p className="text-xs text-muted-foreground">
                  Setting to Maintenance will create a block on the Operations Board.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={capabilityForm.notes}
                onChange={(e) => setCapabilityForm({ ...capabilityForm, notes: e.target.value })}
                placeholder="Additional notes..."
                data-testid="input-capability-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapabilityDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingCapability) {
                  updateCapabilityMutation.mutate({ id: editingCapability.id, data: capabilityForm });
                } else {
                  createCapabilityMutation.mutate(capabilityForm);
                }
              }}
              disabled={!capabilityForm.name || !capabilityForm.capability_type}
              data-testid="button-save-capability"
            >
              {createCapabilityMutation.isPending || updateCapabilityMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingCapability ? 'Save Changes' : 'Add Capability'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showCapacityDialog} onOpenChange={(open) => {
        setShowCapacityDialog(open);
        if (!open) resetCapacityForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Capacity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Capacity Key</Label>
              <Select
                value={capacityForm.key}
                onValueChange={(value) => {
                  const preset = COMMON_CAPACITY_KEYS.find(k => k.key === value);
                  setCapacityForm({
                    ...capacityForm,
                    key: value,
                    unit: preset?.unit || capacityForm.unit,
                  });
                }}
              >
                <SelectTrigger data-testid="select-capacity-key">
                  <SelectValue placeholder="Select or type custom..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CAPACITY_KEYS.map((k) => (
                    <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={capacityForm.key}
                onChange={(e) => setCapacityForm({ ...capacityForm, key: e.target.value })}
                placeholder="Or enter custom key..."
                data-testid="input-capacity-key"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value (numeric)</Label>
                <Input
                  type="number"
                  value={capacityForm.value_num}
                  onChange={(e) => setCapacityForm({ ...capacityForm, value_num: e.target.value })}
                  placeholder="e.g., 12000"
                  data-testid="input-capacity-value"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={capacityForm.unit}
                  onChange={(e) => setCapacityForm({ ...capacityForm, unit: e.target.value })}
                  placeholder="e.g., lbs, ft, people"
                  data-testid="input-capacity-unit"
                />
              </div>
            </div>
            {capabilityUnits.length > 0 && (
              <div className="space-y-2">
                <Label>Applies to Capability Unit (optional)</Label>
                <Select
                  value={capacityForm.capability_unit_id}
                  onValueChange={(value) => setCapacityForm({ ...capacityForm, capability_unit_id: value })}
                >
                  <SelectTrigger data-testid="select-capacity-capability">
                    <SelectValue placeholder="Asset level (none)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Asset level</SelectItem>
                    {capabilityUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapacityDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createCapacityMutation.mutate(capacityForm)}
              disabled={!capacityForm.key || (!capacityForm.value_num && !capacityForm.value_text)}
              data-testid="button-save-capacity"
            >
              {createCapacityMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Capacity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showConstraintDialog} onOpenChange={(open) => {
        setShowConstraintDialog(open);
        if (!open) resetConstraintForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Constraint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Constraint Type</Label>
              <Select
                value={constraintForm.constraint_type}
                onValueChange={(value) => setConstraintForm({ ...constraintForm, constraint_type: value })}
              >
                <SelectTrigger data-testid="select-constraint-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CONSTRAINT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={constraintForm.severity}
                onValueChange={(value: 'info' | 'warning' | 'blocking') =>
                  setConstraintForm({ ...constraintForm, severity: value })
                }
              >
                <SelectTrigger data-testid="select-constraint-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info - Display only</SelectItem>
                  <SelectItem value="warning">Warning - Show warning but allow</SelectItem>
                  <SelectItem value="blocking">Blocking - Prevents booking</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea
                value={constraintForm.details}
                onChange={(e) => setConstraintForm({ ...constraintForm, details: e.target.value })}
                placeholder="Describe the constraint..."
                data-testid="input-constraint-details"
              />
            </div>
            {constraintForm.severity === 'blocking' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={constraintForm.start_date}
                    onChange={(e) => setConstraintForm({ ...constraintForm, start_date: e.target.value })}
                    data-testid="input-constraint-starts"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={constraintForm.end_date}
                    onChange={(e) => setConstraintForm({ ...constraintForm, end_date: e.target.value })}
                    data-testid="input-constraint-ends"
                  />
                </div>
              </div>
            )}
            {capabilityUnits.length > 0 && (
              <div className="space-y-2">
                <Label>Applies to Capability Unit (optional)</Label>
                <Select
                  value={constraintForm.capability_unit_id}
                  onValueChange={(value) => setConstraintForm({ ...constraintForm, capability_unit_id: value })}
                >
                  <SelectTrigger data-testid="select-constraint-capability">
                    <SelectValue placeholder="Asset level (none)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Asset level</SelectItem>
                    {capabilityUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConstraintDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createConstraintMutation.mutate(constraintForm)}
              disabled={!constraintForm.constraint_type}
              data-testid="button-save-constraint"
            >
              {createConstraintMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Constraint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
