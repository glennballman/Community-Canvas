import { useQuery } from '@tanstack/react-query';
import { Truck, Car, Caravan, Wrench, CheckCircle2, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format, addDays, isBefore } from 'date-fns';

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

interface MaintenanceRecord {
  id: string;
  asset_type: string;
  service_type: string;
  service_date: string;
  next_service_date: string | null;
  vehicle_id: string | null;
  trailer_id: string | null;
  vehicle_name?: string;
  trailer_name?: string;
  description: string;
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  variant = 'default' 
}: { 
  label: string; 
  value: number; 
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'info';
}) {
  const variantStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400'
  };

  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${variantStyles[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function FleetPage() {
  const statsQuery = useQuery<FleetStats>({
    queryKey: ['/api/v1/fleet/stats']
  });

  const maintenanceQuery = useQuery<{ records: MaintenanceRecord[] }>({
    queryKey: ['/api/vehicles/maintenance/upcoming']
  });

  const stats = statsQuery.data;
  const upcomingMaintenance = maintenanceQuery.data?.records || [];
  const fourteenDaysOut = addDays(new Date(), 14);
  
  const next14Days = upcomingMaintenance.filter(m => 
    m.next_service_date && isBefore(new Date(m.next_service_date), fourteenDaysOut)
  );

  const overdueCount = upcomingMaintenance.filter(m => 
    m.next_service_date && isBefore(new Date(m.next_service_date), new Date())
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fleet Dashboard</h1>
            <p className="text-muted-foreground">Manage vehicles, trailers, and maintenance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/app/fleet/assets">
            <Button variant="outline" data-testid="button-view-assets">
              <Car className="w-4 h-4 mr-2" />
              View Assets
            </Button>
          </Link>
          <Link to="/app/fleet/maintenance">
            <Button variant="outline" data-testid="button-view-maintenance">
              <Wrench className="w-4 h-4 mr-2" />
              Maintenance
            </Button>
          </Link>
        </div>
      </div>

      {statsQuery.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="w-12 h-12 mx-auto text-muted-foreground opacity-50 animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading fleet statistics...</p>
          </CardContent>
        </Card>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Vehicles" value={Number(stats.vehicles.total_vehicles)} icon={Car} />
            <StatCard label="Available" value={Number(stats.vehicles.available)} icon={CheckCircle2} variant="success" />
            <StatCard label="In Use" value={Number(stats.vehicles.in_use)} icon={Clock} variant="info" />
            <StatCard label="Maintenance" value={Number(stats.vehicles.maintenance)} icon={Wrench} variant="warning" />
            <StatCard label="Trailers" value={Number(stats.trailers.total_trailers)} icon={Caravan} />
            <StatCard label="Out of Service" value={Number(stats.vehicles.retired || 0)} icon={AlertTriangle} variant="warning" />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Next 14 Days - Maintenance
                  </CardTitle>
                  {overdueCount > 0 && (
                    <Badge variant="destructive" data-testid="badge-overdue-count">
                      {overdueCount} overdue
                    </Badge>
                  )}
                </div>
                <CardDescription>Upcoming scheduled maintenance</CardDescription>
              </CardHeader>
              <CardContent>
                {maintenanceQuery.isLoading ? (
                  <p className="text-muted-foreground text-sm">Loading...</p>
                ) : next14Days.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No maintenance scheduled in the next 14 days</p>
                ) : (
                  <div className="space-y-3">
                    {next14Days.slice(0, 5).map(record => {
                      const isOverdue = record.next_service_date && isBefore(new Date(record.next_service_date), new Date());
                      return (
                        <div 
                          key={record.id} 
                          className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                          data-testid={`maintenance-item-${record.id}`}
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
                          <Badge variant={isOverdue ? 'destructive' : 'outline'}>
                            {record.next_service_date ? format(new Date(record.next_service_date), 'MMM d') : 'TBD'}
                          </Badge>
                        </div>
                      );
                    })}
                    {next14Days.length > 5 && (
                      <Link to="/app/fleet/maintenance">
                        <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-maintenance">
                          View all {next14Days.length} items
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Quick Status
                </CardTitle>
                <CardDescription>Fleet health overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Vehicles Available</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {stats.vehicles.available} / {stats.vehicles.total_vehicles}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Trailers Available</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {stats.trailers.available} / {stats.trailers.total_trailers}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Currently in Use</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {Number(stats.vehicles.in_use) + Number(stats.trailers.in_use)} assets
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Under Maintenance</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {Number(stats.vehicles.maintenance) + Number(stats.trailers.maintenance)} assets
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mt-2">Unable to load fleet statistics</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
