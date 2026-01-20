import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Car, Caravan, ArrowLeft, Wrench, Calendar, FileText, MapPin, Gauge, Fuel, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface VehicleDetail {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  license_plate: string;
  license_plate_province: string;
  vehicle_type: string;
  fuel_type: string;
  status: string;
  current_odometer: number;
  length_ft: number;
  width_ft: number;
  height_ft: number;
  gvwr_lbs: number;
  towing_capacity_lbs: number;
  has_hitch: boolean;
  hitch_class: number;
  notes: string;
  owner_name: string;
  primary_image_url: string | null;
  registration_expiry: string | null;
  insurance_expiry: string | null;
  inspection_expiry: string | null;
}

interface TrailerDetail {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  license_plate: string;
  license_plate_province: string;
  trailer_type: string;
  status: string;
  length_ft: number;
  width_ft: number;
  height_ft: number;
  gvwr_lbs: number;
  payload_capacity_lbs: number;
  axle_count: number;
  hitch_type: string;
  notes: string;
  owner_name: string;
  primary_image_url: string | null;
  registration_expiry: string | null;
  insurance_expiry: string | null;
}

interface MaintenanceRecord {
  id: string;
  service_type: string;
  service_date: string;
  description: string;
  total_cost: number;
  service_provider: string;
  odometer_reading: number;
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

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | number | null | undefined; icon?: React.ElementType }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function FleetAssetDetailPage() {
  const { id: assetId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const assetType = searchParams.get('type') || 'vehicle';

  const vehicleQuery = useQuery<{ success: boolean; vehicle: VehicleDetail; recentMaintenance: MaintenanceRecord[] }>({
    queryKey: ['/api/vehicles', assetId],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${assetId}`, { credentials: 'include' });
      return res.json();
    },
    enabled: assetType === 'vehicle' && !!assetId
  });

  const trailerQuery = useQuery<{ success: boolean; trailer: TrailerDetail }>({
    queryKey: ['/api/vehicles/trailers', assetId],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/trailers/${assetId}`, { credentials: 'include' });
      return res.json();
    },
    enabled: assetType === 'trailer' && !!assetId
  });

  const isLoading = (assetType === 'vehicle' && vehicleQuery.isLoading) || (assetType === 'trailer' && trailerQuery.isLoading);
  const asset = assetType === 'vehicle' ? vehicleQuery.data?.vehicle : trailerQuery.data?.trailer;
  const maintenanceHistory = assetType === 'vehicle' ? vehicleQuery.data?.recentMaintenance || [] : [];
  const Icon = assetType === 'vehicle' ? Car : Caravan;

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Icon className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading asset details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Icon className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mt-2">Asset not found</p>
            <Link to="/app/fleet/assets">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Assets
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vehicle = assetType === 'vehicle' ? asset as VehicleDetail : null;
  const trailer = assetType === 'trailer' ? asset as TrailerDetail : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/fleet/assets">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
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
              <h1 className="text-2xl font-bold">
                {asset.name || `${asset.year} ${asset.make} ${asset.model}`}
              </h1>
              <p className="text-muted-foreground">
                {asset.year} {asset.make} {asset.model}
              </p>
            </div>
          </div>
        </div>
        <Badge variant={STATUS_VARIANTS[asset.status] || 'outline'} className="text-sm px-3 py-1">
          {STATUS_LABELS[asset.status] || asset.status}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <DetailRow label="VIN" value={asset.vin} icon={FileText} />
            <DetailRow label="License Plate" value={asset.license_plate} icon={MapPin} />
            {asset.license_plate_province && (
              <DetailRow label="Province" value={asset.license_plate_province} />
            )}
            {vehicle && (
              <>
                <DetailRow label="Vehicle Type" value={vehicle.vehicle_type} icon={Car} />
                <DetailRow label="Fuel Type" value={vehicle.fuel_type} icon={Fuel} />
                <DetailRow label="Odometer" value={vehicle.current_odometer ? `${vehicle.current_odometer.toLocaleString()} km` : undefined} icon={Gauge} />
              </>
            )}
            {trailer && (
              <>
                <DetailRow label="Trailer Type" value={trailer.trailer_type} icon={Caravan} />
                <DetailRow label="Axle Count" value={trailer.axle_count} />
                <DetailRow label="Hitch Type" value={trailer.hitch_type} />
              </>
            )}
            <Separator className="my-3" />
            {asset.length_ft && (
              <DetailRow label="Dimensions (LxWxH)" value={`${asset.length_ft}' x ${asset.width_ft}' x ${asset.height_ft}'`} />
            )}
            <DetailRow label="GVWR" value={asset.gvwr_lbs ? `${asset.gvwr_lbs.toLocaleString()} lbs` : undefined} />
            {vehicle?.towing_capacity_lbs && (
              <DetailRow label="Towing Capacity" value={`${vehicle.towing_capacity_lbs.toLocaleString()} lbs`} />
            )}
            {vehicle?.has_hitch && (
              <DetailRow label="Hitch Class" value={vehicle.hitch_class ? `Class ${vehicle.hitch_class}` : 'Yes'} />
            )}
            {trailer?.payload_capacity_lbs && (
              <DetailRow label="Payload Capacity" value={`${trailer.payload_capacity_lbs.toLocaleString()} lbs`} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Status & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <DetailRow label="Owner" value={asset.owner_name} icon={User} />
            {vehicle?.registration_expiry && (
              <DetailRow 
                label="Registration Expires" 
                value={format(new Date(vehicle.registration_expiry), 'MMM d, yyyy')} 
                icon={Calendar} 
              />
            )}
            {vehicle?.insurance_expiry && (
              <DetailRow 
                label="Insurance Expires" 
                value={format(new Date(vehicle.insurance_expiry), 'MMM d, yyyy')} 
                icon={Calendar} 
              />
            )}
            {vehicle?.inspection_expiry && (
              <DetailRow 
                label="Inspection Expires" 
                value={format(new Date(vehicle.inspection_expiry), 'MMM d, yyyy')} 
                icon={Calendar} 
              />
            )}
            {trailer?.registration_expiry && (
              <DetailRow 
                label="Registration Expires" 
                value={format(new Date(trailer.registration_expiry), 'MMM d, yyyy')} 
                icon={Calendar} 
              />
            )}
            {trailer?.insurance_expiry && (
              <DetailRow 
                label="Insurance Expires" 
                value={format(new Date(trailer.insurance_expiry), 'MMM d, yyyy')} 
                icon={Calendar} 
              />
            )}
            {asset.notes && (
              <>
                <Separator className="my-3" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{asset.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {assetType === 'vehicle' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Maintenance History
              </CardTitle>
              <Link to={`/app/fleet/maintenance?vehicle=${assetId}`}>
                <Button variant="outline" size="sm" data-testid="button-view-maintenance-history">
                  View All
                </Button>
              </Link>
            </div>
            <CardDescription>Recent maintenance records</CardDescription>
          </CardHeader>
          <CardContent>
            {maintenanceHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No maintenance records found</p>
            ) : (
              <div className="space-y-3">
                {maintenanceHistory.map(record => (
                  <div 
                    key={record.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`maintenance-record-${record.id}`}
                  >
                    <div>
                      <p className="font-medium">{record.service_type}</p>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                      {record.service_provider && (
                        <p className="text-xs text-muted-foreground">{record.service_provider}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{format(new Date(record.service_date), 'MMM d, yyyy')}</p>
                      {record.total_cost && (
                        <p className="text-sm font-medium">${record.total_cost.toFixed(2)}</p>
                      )}
                      {record.odometer_reading && (
                        <p className="text-xs text-muted-foreground">{record.odometer_reading.toLocaleString()} km</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
