import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Truck, 
  Car, 
  Plus, 
  CheckCircle2, 
  Wrench, 
  Clock, 
  ChevronDown,
  User,
  Link2,
  Link2Off,
  Caravan
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { VehicleForm } from './VehicleForm';
import { TrailerForm } from './TrailerForm';

interface FleetStats {
  vehicles: {
    total_vehicles: number;
    available: number;
    in_use: number;
    maintenance: number;
    reserved: number;
    retired: number;
  };
  trailers: {
    total_trailers: number;
    available: number;
    in_use: number;
    maintenance: number;
  };
}

interface FleetVehicle {
  id: string;
  nickname: string;
  fleet_number: string;
  year: number;
  make: string;
  model: string;
  color: string;
  fleet_status: string;
  assigned_to_name: string;
  primary_photo_url: string;
  last_check_out: string;
  last_check_in: string;
  photo_count: number;
  equipment_count: number;
}

interface FleetTrailer {
  id: string;
  nickname: string;
  fleet_number: string;
  trailer_type: string;
  color: string;
  fleet_status: string;
  currently_hitched_to: string;
  hitched_to_nickname: string;
  hitched_to_fleet_number: string;
  length_feet: number;
  gvwr_lbs: number;
  primary_photo_url: string;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  available: 'default',
  in_use: 'secondary',
  maintenance: 'destructive',
  reserved: 'outline',
  retired: 'outline'
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In Use',
  maintenance: 'Maintenance',
  reserved: 'Reserved',
  retired: 'Retired'
};

export function FleetDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showTrailerForm, setShowTrailerForm] = useState(false);

  const vehiclesUrl = statusFilter !== 'all' 
    ? `/api/v1/fleet/vehicles?status=${statusFilter}` 
    : '/api/v1/fleet/vehicles';
  
  const trailersUrl = statusFilter !== 'all'
    ? `/api/v1/fleet/trailers?status=${statusFilter}`
    : '/api/v1/fleet/trailers';

  const statsQuery = useQuery<FleetStats>({
    queryKey: ['/api/v1/fleet/stats']
  });

  const vehiclesQuery = useQuery<{ vehicles: FleetVehicle[] }>({
    queryKey: [vehiclesUrl]
  });

  const trailersQuery = useQuery<{ trailers: FleetTrailer[] }>({
    queryKey: [trailersUrl]
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({ vehicleId, status }: { vehicleId: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/v1/fleet/vehicles/${vehicleId}`, { fleet_status: status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/fleet/stats'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet/vehicles');
        }
      });
    }
  });

  const unhitchMutation = useMutation({
    mutationFn: async (trailerId: string) => {
      const res = await apiRequest('POST', `/api/v1/fleet/trailers/${trailerId}/unhitch`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/fleet/stats'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet/trailers');
        }
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet/vehicles');
        }
      });
    }
  });

  const stats = statsQuery.data;
  const vehicles = vehiclesQuery.data?.vehicles || [];
  const trailers = trailersQuery.data?.trailers || [];
  const loading = statsQuery.isLoading || vehiclesQuery.isLoading || trailersQuery.isLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 text-primary" />
              <CardTitle>Fleet Management</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTrailerForm(true)} data-testid="button-add-trailer">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Trailer
              </Button>
              <Button onClick={() => setShowVehicleForm(true)} data-testid="button-add-vehicle">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Vehicle
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Manage vehicles, trailers, and assignments</p>
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Total Vehicles" value={Number(stats.vehicles.total_vehicles)} icon={Car} />
              <StatCard label="Available" value={Number(stats.vehicles.available)} icon={CheckCircle2} variant="success" />
              <StatCard label="In Use" value={Number(stats.vehicles.in_use)} icon={Clock} variant="info" />
              <StatCard label="Maintenance" value={Number(stats.vehicles.maintenance)} icon={Wrench} variant="warning" />
              <StatCard label="Trailers" value={Number(stats.trailers.total_trailers)} icon={Caravan} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['all', 'available', 'in_use', 'maintenance'].map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              data-testid={`filter-${status}`}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading fleet...</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="vehicles" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="vehicles" data-testid="tab-vehicles">
              <Car className="w-4 h-4 mr-1.5" />
              Vehicles ({vehicles.length})
            </TabsTrigger>
            <TabsTrigger value="trailers" data-testid="tab-trailers">
              <Caravan className="w-4 h-4 mr-1.5" />
              Trailers ({trailers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            {vehicles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Car className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mt-2">No vehicles found</p>
                  <Button className="mt-4" onClick={() => setShowVehicleForm(true)} data-testid="button-add-first-vehicle">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Your First Vehicle
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map(vehicle => (
                  <VehicleCard 
                    key={vehicle.id} 
                    vehicle={vehicle} 
                    onStatusChange={(status) => updateVehicleMutation.mutate({ vehicleId: vehicle.id, status })}
                    isPending={updateVehicleMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trailers">
            {trailers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Caravan className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mt-2">No trailers found</p>
                  <Button className="mt-4" onClick={() => setShowTrailerForm(true)} data-testid="button-add-first-trailer">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Your First Trailer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trailers.map(trailer => (
                  <TrailerCard 
                    key={trailer.id} 
                    trailer={trailer} 
                    onUnhitch={() => unhitchMutation.mutate(trailer.id)}
                    isPending={unhitchMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={showVehicleForm} onOpenChange={setShowVehicleForm}>
        <DialogContent className="max-w-4xl p-0">
          <VehicleForm 
            onSave={() => setShowVehicleForm(false)}
            onCancel={() => setShowVehicleForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showTrailerForm} onOpenChange={setShowTrailerForm}>
        <DialogContent className="max-w-4xl p-0">
          <TrailerForm 
            onSave={() => setShowTrailerForm(false)}
            onCancel={() => setShowTrailerForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  variant 
}: { 
  label: string; 
  value: number; 
  icon: typeof Car;
  variant?: 'success' | 'info' | 'warning';
}) {
  const bgClass = variant === 'success' 
    ? 'bg-green-500/10' 
    : variant === 'info' 
      ? 'bg-blue-500/10' 
      : variant === 'warning' 
        ? 'bg-yellow-500/10' 
        : 'bg-muted/50';
  
  const textClass = variant === 'success' 
    ? 'text-green-500' 
    : variant === 'info' 
      ? 'text-blue-500' 
      : variant === 'warning' 
        ? 'text-yellow-500' 
        : 'text-foreground';
  
  return (
    <div className={`${bgClass} rounded-lg p-3 text-center`}>
      <Icon className={`w-5 h-5 mx-auto mb-1 ${textClass}`} />
      <p className={`text-2xl font-bold ${textClass}`}>{value}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

function VehicleCard({ 
  vehicle, 
  onStatusChange,
  isPending 
}: { 
  vehicle: FleetVehicle; 
  onStatusChange: (status: string) => void;
  isPending: boolean;
}) {
  const displayName = vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const displayNumber = vehicle.fleet_number || vehicle.id.slice(0, 8);
  
  return (
    <Card className="overflow-hidden" data-testid={`vehicle-card-${vehicle.id}`}>
      <div className="h-32 bg-muted relative flex items-center justify-center">
        {vehicle.primary_photo_url ? (
          <img src={vehicle.primary_photo_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <Car className="w-12 h-12 text-muted-foreground opacity-30" />
        )}
        
        <div className="absolute top-2 right-2">
          <Badge variant={STATUS_VARIANTS[vehicle.fleet_status] || 'secondary'}>
            {STATUS_LABELS[vehicle.fleet_status] || vehicle.fleet_status}
          </Badge>
        </div>
        
        <div className="absolute bottom-2 left-2">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm font-mono">
            {displayNumber}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg">{displayName}</h3>
        <p className="text-muted-foreground text-sm">
          {vehicle.year} {vehicle.make} {vehicle.model}
          {vehicle.color && ` - ${vehicle.color}`}
        </p>
        
        {vehicle.assigned_to_name && (
          <p className="text-primary text-sm mt-2 flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {vehicle.assigned_to_name}
          </p>
        )}
        
        {vehicle.last_check_out && (
          <p className="text-muted-foreground text-xs mt-1">
            Last out: {new Date(vehicle.last_check_out).toLocaleDateString()}
          </p>
        )}
        
        <div className="flex gap-2 mt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1" 
                disabled={isPending}
                data-testid={`button-status-${vehicle.id}`}
              >
                Status
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {['available', 'in_use', 'maintenance', 'reserved'].map(status => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className={vehicle.fleet_status === status ? 'bg-accent' : ''}
                >
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" data-testid={`button-details-${vehicle.id}`}>
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TrailerCard({ 
  trailer, 
  onUnhitch,
  isPending 
}: { 
  trailer: FleetTrailer; 
  onUnhitch: () => void;
  isPending: boolean;
}) {
  const displayName = trailer.nickname || `${trailer.trailer_type.replace(/_/g, ' ')} Trailer`;
  const displayNumber = trailer.fleet_number || trailer.id.slice(0, 8);
  
  return (
    <Card className="overflow-hidden" data-testid={`trailer-card-${trailer.id}`}>
      <div className="h-32 bg-muted relative flex items-center justify-center">
        {trailer.primary_photo_url ? (
          <img src={trailer.primary_photo_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <Caravan className="w-12 h-12 text-muted-foreground opacity-30" />
        )}
        
        <div className="absolute top-2 right-2">
          <Badge variant={STATUS_VARIANTS[trailer.fleet_status] || 'secondary'}>
            {STATUS_LABELS[trailer.fleet_status] || trailer.fleet_status}
          </Badge>
        </div>
        
        <div className="absolute bottom-2 left-2">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm font-mono">
            {displayNumber}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg capitalize">{displayName}</h3>
        <p className="text-muted-foreground text-sm capitalize">
          {trailer.trailer_type.replace(/_/g, ' ')}
          {trailer.color && ` - ${trailer.color}`}
        </p>
        
        <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
          {trailer.length_feet && <span>{trailer.length_feet}' long</span>}
          {trailer.gvwr_lbs && <span>- {trailer.gvwr_lbs.toLocaleString()} lbs GVWR</span>}
        </div>
        
        {trailer.currently_hitched_to && (
          <div className="mt-2 p-2 bg-primary/10 rounded-lg">
            <p className="text-primary text-sm flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" />
              Hitched to: {trailer.hitched_to_nickname || trailer.hitched_to_fleet_number}
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onUnhitch}
              disabled={isPending}
              className="mt-1 h-auto p-0 text-xs text-primary"
              data-testid={`button-unhitch-${trailer.id}`}
            >
              <Link2Off className="w-3 h-3 mr-1" />
              Unhitch
            </Button>
          </div>
        )}
        
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="flex-1" data-testid={`button-hitch-${trailer.id}`}>
            Hitch To...
          </Button>
          <Button size="sm" data-testid={`button-trailer-details-${trailer.id}`}>
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default FleetDashboard;
