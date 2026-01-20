import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, Caravan, Search, Filter, ChevronRight, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router-dom';

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  status: string;
  license_plate: string;
  owner_name: string;
  primary_image_url: string | null;
}

interface Trailer {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  trailer_type: string;
  status: string;
  license_plate: string;
  owner_name: string;
  primary_image_url: string | null;
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

function AssetCard({ asset, type }: { asset: Vehicle | Trailer; type: 'vehicle' | 'trailer' }) {
  const Icon = type === 'vehicle' ? Car : Caravan;
  
  return (
    <Link to={`/app/fleet/assets/${asset.id}?type=${type}`}>
      <Card className="hover-elevate cursor-pointer" data-testid={`asset-card-${asset.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {asset.primary_image_url ? (
                <img 
                  src={asset.primary_image_url} 
                  alt={asset.name || 'Asset'} 
                  className="w-16 h-12 object-cover rounded-md"
                />
              ) : (
                <div className="w-16 h-12 bg-muted rounded-md flex items-center justify-center">
                  <Icon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{asset.name || `${asset.year} ${asset.make} ${asset.model}`}</p>
                <p className="text-sm text-muted-foreground">
                  {asset.year} {asset.make} {asset.model}
                </p>
                {asset.license_plate && (
                  <p className="text-xs text-muted-foreground">{asset.license_plate}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={STATUS_VARIANTS[asset.status] || 'outline'}>
                {STATUS_LABELS[asset.status] || asset.status}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function FleetAssetsPage() {
  const [tab, setTab] = useState<'vehicles' | 'trailers'>('vehicles');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const vehiclesQuery = useQuery<{ success: boolean; vehicles: Vehicle[] }>({
    queryKey: ['/api/vehicles', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);
      const res = await fetch(`/api/vehicles?${params.toString()}`, { credentials: 'include' });
      return res.json();
    }
  });

  const trailersQuery = useQuery<{ success: boolean; trailers: Trailer[] }>({
    queryKey: ['/api/vehicles/trailers/list', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/vehicles/trailers/list?${params.toString()}`, { credentials: 'include' });
      return res.json();
    }
  });

  const vehicles = vehiclesQuery.data?.vehicles || [];
  const trailers = trailersQuery.data?.trailers || [];

  const filteredVehicles = search 
    ? vehicles.filter(v => 
        v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.make?.toLowerCase().includes(search.toLowerCase()) ||
        v.model?.toLowerCase().includes(search.toLowerCase()) ||
        v.license_plate?.toLowerCase().includes(search.toLowerCase())
      )
    : vehicles;

  const filteredTrailers = search
    ? trailers.filter(t =>
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.make?.toLowerCase().includes(search.toLowerCase()) ||
        t.model?.toLowerCase().includes(search.toLowerCase()) ||
        t.license_plate?.toLowerCase().includes(search.toLowerCase())
      )
    : trailers;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fleet Assets</h1>
            <p className="text-muted-foreground">
              {vehicles.length} vehicles, {trailers.length} trailers
            </p>
          </div>
        </div>
        <Link to="/app/fleet">
          <Button variant="outline" data-testid="button-back-to-dashboard">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, make, model, or plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-assets"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="in_use">In Use</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'vehicles' | 'trailers')}>
        <TabsList>
          <TabsTrigger value="vehicles" data-testid="tab-vehicles">
            <Car className="w-4 h-4 mr-2" />
            Vehicles ({filteredVehicles.length})
          </TabsTrigger>
          <TabsTrigger value="trailers" data-testid="tab-trailers">
            <Caravan className="w-4 h-4 mr-2" />
            Trailers ({filteredTrailers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          {vehiclesQuery.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Car className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
                <p className="text-muted-foreground mt-2">Loading vehicles...</p>
              </CardContent>
            </Card>
          ) : filteredVehicles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Car className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mt-2">
                  {search || statusFilter !== 'all' ? 'No vehicles match your filters' : 'No vehicles found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredVehicles.map(vehicle => (
                <AssetCard key={vehicle.id} asset={vehicle} type="vehicle" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trailers" className="mt-4">
          {trailersQuery.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Caravan className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
                <p className="text-muted-foreground mt-2">Loading trailers...</p>
              </CardContent>
            </Card>
          ) : filteredTrailers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Caravan className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mt-2">
                  {search || statusFilter !== 'all' ? 'No trailers match your filters' : 'No trailers found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredTrailers.map(trailer => (
                <AssetCard key={trailer.id} asset={trailer} type="trailer" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
