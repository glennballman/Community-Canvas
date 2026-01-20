import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wrench, Plus, AlertTriangle, Calendar, Car, Caravan, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { format, isBefore, addDays } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MaintenanceRecord {
  id: string;
  asset_type: string;
  vehicle_id: string | null;
  trailer_id: string | null;
  service_type: string;
  service_date: string;
  next_service_date: string | null;
  description: string;
  total_cost: number | null;
  service_provider: string;
  odometer_reading: number | null;
  vehicle_name?: string;
  trailer_name?: string;
}

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
}

interface Trailer {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
}

const SERVICE_TYPES = [
  'Oil Change',
  'Tire Rotation',
  'Brake Service',
  'Transmission Service',
  'Coolant Flush',
  'Air Filter',
  'Fuel Filter',
  'Spark Plugs',
  'Battery Replacement',
  'Belt Replacement',
  'Wheel Alignment',
  'Suspension',
  'Annual Inspection',
  'Safety Inspection',
  'Other'
];

export default function FleetMaintenancePage() {
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    asset_type: 'vehicle',
    vehicle_id: '',
    trailer_id: '',
    service_type: '',
    service_date: format(new Date(), 'yyyy-MM-dd'),
    next_service_date: '',
    description: '',
    total_cost: '',
    service_provider: '',
    odometer_reading: ''
  });

  const { toast } = useToast();

  const upcomingQuery = useQuery<{ records: MaintenanceRecord[] }>({
    queryKey: ['/api/vehicles/maintenance/upcoming']
  });

  const historyQuery = useQuery<{ records: MaintenanceRecord[] }>({
    queryKey: ['/api/vehicles/maintenance/history']
  });

  const vehiclesQuery = useQuery<{ success: boolean; vehicles: Vehicle[] }>({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const res = await fetch('/api/vehicles', { credentials: 'include' });
      return res.json();
    }
  });

  const trailersQuery = useQuery<{ success: boolean; trailers: Trailer[] }>({
    queryKey: ['/api/vehicles/trailers/list'],
    queryFn: async () => {
      const res = await fetch('/api/vehicles/trailers/list', { credentials: 'include' });
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: Record<string, unknown> = {
        asset_type: data.asset_type,
        service_type: data.service_type,
        service_date: data.service_date,
        description: data.description
      };
      
      if (data.asset_type === 'vehicle') {
        payload.vehicle_id = data.vehicle_id;
      } else {
        payload.trailer_id = data.trailer_id;
      }
      
      if (data.next_service_date) payload.next_service_date = data.next_service_date;
      if (data.total_cost) payload.total_cost = parseFloat(data.total_cost);
      if (data.service_provider) payload.service_provider = data.service_provider;
      if (data.odometer_reading) payload.odometer_reading = parseInt(data.odometer_reading);

      const res = await apiRequest('POST', '/api/vehicles/maintenance', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/maintenance/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/maintenance/history'] });
      setShowCreateModal(false);
      setFormData({
        asset_type: 'vehicle',
        vehicle_id: '',
        trailer_id: '',
        service_type: '',
        service_date: format(new Date(), 'yyyy-MM-dd'),
        next_service_date: '',
        description: '',
        total_cost: '',
        service_provider: '',
        odometer_reading: ''
      });
      toast({ title: 'Maintenance record created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create record', description: error.message, variant: 'destructive' });
    }
  });

  const upcomingRecords = upcomingQuery.data?.records || [];
  const historyRecords = historyQuery.data?.records || [];
  const vehicles = vehiclesQuery.data?.vehicles || [];
  const trailers = trailersQuery.data?.trailers || [];

  const today = new Date();
  const overdueRecords = upcomingRecords.filter(r => 
    r.next_service_date && isBefore(new Date(r.next_service_date), today)
  );
  const upcomingThisWeek = upcomingRecords.filter(r =>
    r.next_service_date && 
    !isBefore(new Date(r.next_service_date), today) &&
    isBefore(new Date(r.next_service_date), addDays(today, 7))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.service_type || (!formData.vehicle_id && !formData.trailer_id)) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Maintenance</h1>
            <p className="text-muted-foreground">Track and schedule fleet maintenance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/app/fleet">
            <Button variant="outline" data-testid="button-back-to-dashboard">
              <Truck className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-maintenance">
            <Plus className="w-4 h-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {overdueRecords.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Overdue Maintenance ({overdueRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueRecords.map(record => (
                <div 
                  key={record.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-md bg-destructive/10"
                  data-testid={`overdue-record-${record.id}`}
                >
                  <div className="flex items-center gap-2">
                    {record.asset_type === 'vehicle' ? (
                      <Car className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Caravan className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {record.vehicle_name || record.trailer_name || 'Unknown Asset'}
                      </p>
                      <p className="text-xs text-muted-foreground">{record.service_type}</p>
                    </div>
                  </div>
                  <Badge variant="destructive">
                    Due {record.next_service_date ? format(new Date(record.next_service_date), 'MMM d') : 'TBD'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'upcoming' | 'history')}>
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            <Calendar className="w-4 h-4 mr-2" />
            Upcoming ({upcomingRecords.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Wrench className="w-4 h-4 mr-2" />
            History ({historyRecords.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingQuery.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
                <p className="text-muted-foreground mt-2">Loading upcoming maintenance...</p>
              </CardContent>
            </Card>
          ) : upcomingRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mt-2">No upcoming maintenance scheduled</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingRecords.map(record => {
                const isOverdue = record.next_service_date && isBefore(new Date(record.next_service_date), today);
                return (
                  <Card key={record.id} data-testid={`upcoming-record-${record.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {record.asset_type === 'vehicle' ? (
                            <Car className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <Caravan className="w-5 h-5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">
                              {record.vehicle_name || record.trailer_name || 'Unknown Asset'}
                            </p>
                            <p className="text-sm text-muted-foreground">{record.service_type}</p>
                            {record.description && (
                              <p className="text-xs text-muted-foreground mt-1">{record.description}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={isOverdue ? 'destructive' : 'outline'}>
                          {record.next_service_date ? format(new Date(record.next_service_date), 'MMM d, yyyy') : 'TBD'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyQuery.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
                <p className="text-muted-foreground mt-2">Loading maintenance history...</p>
              </CardContent>
            </Card>
          ) : historyRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mt-2">No maintenance records found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {historyRecords.map(record => (
                <Card key={record.id} data-testid={`history-record-${record.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {record.asset_type === 'vehicle' ? (
                          <Car className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Caravan className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">
                            {record.vehicle_name || record.trailer_name || 'Unknown Asset'}
                          </p>
                          <p className="text-sm text-muted-foreground">{record.service_type}</p>
                          {record.description && (
                            <p className="text-xs text-muted-foreground mt-1">{record.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{format(new Date(record.service_date), 'MMM d, yyyy')}</p>
                        {record.total_cost && (
                          <p className="text-sm font-medium">${record.total_cost.toFixed(2)}</p>
                        )}
                        {record.service_provider && (
                          <p className="text-xs text-muted-foreground">{record.service_provider}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
            <DialogDescription>Record a completed maintenance service</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Type</Label>
                <Select 
                  value={formData.asset_type} 
                  onValueChange={(v) => setFormData({ ...formData, asset_type: v, vehicle_id: '', trailer_id: '' })}
                >
                  <SelectTrigger data-testid="select-asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{formData.asset_type === 'vehicle' ? 'Vehicle' : 'Trailer'}</Label>
                {formData.asset_type === 'vehicle' ? (
                  <Select 
                    value={formData.vehicle_id} 
                    onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}
                  >
                    <SelectTrigger data-testid="select-vehicle">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name || `${v.year} ${v.make} ${v.model}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select 
                    value={formData.trailer_id} 
                    onValueChange={(v) => setFormData({ ...formData, trailer_id: v })}
                  >
                    <SelectTrigger data-testid="select-trailer">
                      <SelectValue placeholder="Select trailer" />
                    </SelectTrigger>
                    <SelectContent>
                      {trailers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name || `${t.year} ${t.make} ${t.model}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select 
                value={formData.service_type} 
                onValueChange={(v) => setFormData({ ...formData, service_type: v })}
              >
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Date</Label>
                <Input
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                  data-testid="input-service-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Next Service Date (optional)</Label>
                <Input
                  type="date"
                  value={formData.next_service_date}
                  onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
                  data-testid="input-next-service-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the service performed..."
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_cost}
                  onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-cost"
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  value={formData.service_provider}
                  onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })}
                  placeholder="Service provider"
                  data-testid="input-provider"
                />
              </div>
              <div className="space-y-2">
                <Label>Odometer</Label>
                <Input
                  type="number"
                  value={formData.odometer_reading}
                  onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                  placeholder="km"
                  data-testid="input-odometer"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-maintenance">
                {createMutation.isPending ? 'Creating...' : 'Create Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
