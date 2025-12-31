import { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  MapPin,
  Route,
  Ship,
  Plane,
  Bus,
  Car,
  AlertTriangle,
  Check,
  X,
  Clock,
  ExternalLink,
  Loader2,
  Snowflake,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { VehicleProfile, RouteSegment, RouteAlternative, TransportProvider } from '../../types/tripPlanning';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RouteExplorerProps {
  vehicle: VehicleProfile | null;
  onBack: () => void;
}

const routeTypeIcons: Record<string, typeof Route> = {
  highway: Route,
  secondary: Route,
  gravel: Route,
  logging_road: Route,
  water: Ship,
  air: Plane
};

const providerTypeIcons: Record<string, typeof Ship> = {
  ferry: Ship,
  float_plane: Plane,
  water_taxi: Ship,
  bus: Bus
};

export function RouteExplorer({ vehicle, onBack }: RouteExplorerProps) {
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [providers, setProviders] = useState<TransportProvider[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<RouteSegment | null>(null);
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [segmentsRes, providersRes] = await Promise.all([
        fetch('/api/v1/planning/route-segments'),
        fetch('/api/v1/planning/transport-providers')
      ]);
      
      const segmentsData = await segmentsRes.json();
      const providersData = await providersRes.json();
      
      setSegments(segmentsData.segments || []);
      setProviders(providersData.providers || []);
    } catch (error) {
      console.error('Error fetching route data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectSegment(segment: RouteSegment) {
    setSelectedSegment(segment);
    try {
      const altRes = await fetch(`/api/v1/planning/route-segments/${segment.id}/alternatives`);
      const altData = await altRes.json();
      setAlternatives(altData.alternatives || []);
    } catch (error) {
      console.error('Error fetching alternatives:', error);
      setAlternatives([]);
    }
  }

  const vehicleSuitable = (segment: RouteSegment) => {
    if (!vehicle) return true;
    if (segment.route_type === 'logging_road') {
      return vehicle.rough_gravel_suitable;
    }
    return true;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Route Explorer
              </CardTitle>
              <CardDescription>View route segments, conditions, and transport alternatives</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading routes...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Route Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No route segments available
                  </p>
                ) : (
                  segments.map(segment => {
                    const Icon = routeTypeIcons[segment.route_type] || Route;
                    return (
                      <button
                        key={segment.id}
                        onClick={() => selectSegment(segment)}
                        className={`w-full text-left p-3 rounded-lg transition ${
                          selectedSegment?.id === segment.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        data-testid={`button-segment-${segment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{segment.name}</p>
                            <p className="text-sm opacity-80">
                              {segment.distance_km} km | {Math.round(segment.typical_duration_minutes / 60 * 10) / 10}h
                            </p>
                          </div>
                          {segment.route_type === 'logging_road' && (
                            <Badge variant="outline" className="text-orange-500 border-orange-500">
                              Caution
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {!selectedSegment ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a route segment to view details</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSegment.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedSegment.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-muted-foreground">From</p>
                        <p className="font-medium">{selectedSegment.start_location_name}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-muted-foreground">To</p>
                        <p className="font-medium">{selectedSegment.end_location_name}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className="font-medium">{selectedSegment.distance_km} km</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-medium">{Math.round(selectedSegment.typical_duration_minutes / 60 * 10) / 10} hours</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Requirements</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSegment.winter_tires_required && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Snowflake className="w-3 h-3" />
                          Winter Tires Required
                        </Badge>
                      )}
                      {selectedSegment.high_clearance_recommended && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <ChevronUp className="w-3 h-3" />
                          High Clearance Recommended
                        </Badge>
                      )}
                      {selectedSegment.minimum_vehicle_class && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          Min: {selectedSegment.minimum_vehicle_class}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {selectedSegment.hazards && selectedSegment.hazards.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Hazards
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSegment.hazards.map((hazard, i) => (
                          <Badge key={i} variant="destructive" className="capitalize">
                            {hazard.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSegment.route_type === 'logging_road' && (
                    <Card className="bg-orange-500/10 border-orange-500/20">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-orange-400 font-medium mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Logging Road Safety
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>Logging trucks have RIGHT OF WAY - pull over and stop</li>
                          <li>Drive with headlights ON at all times</li>
                          <li>Use VHF radio channel if available (check signage)</li>
                          <li>Industrial traffic typically Mon-Fri 6am-6pm</li>
                          <li>Watch for potholes, washouts, and wildlife</li>
                          <li>Carry emergency supplies: food, water, first aid</li>
                          <li>Tell someone your plans and expected arrival time</li>
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {selectedSegment.winter_tires_required && (
                    <Card className="bg-blue-500/10 border-blue-500/20">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                          <Snowflake className="w-4 h-4" />
                          Winter Tire Requirements
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>Winter tires required Oct 1 - Apr 30</li>
                          <li>Look for M+S or Mountain Snowflake symbol</li>
                          <li>Minimum 3.5mm tread depth</li>
                          <li>Chains may be required in severe conditions</li>
                          <li>Check DriveBC before departure</li>
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {vehicle && (
                    <Card className={vehicleSuitable(selectedSegment) ? 'bg-green-500/20' : 'bg-red-500/20'}>
                      <CardContent className="pt-3 pb-3">
                        <p className={`font-medium flex items-center gap-2 ${
                          vehicleSuitable(selectedSegment)
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {vehicleSuitable(selectedSegment) ? (
                            <><Check className="w-4 h-4" /> Your vehicle is suitable for this route</>
                          ) : (
                            <><X className="w-4 h-4" /> Your vehicle may not be suitable for this route</>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {alternatives.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <RefreshCw className="w-4 h-4" />
                        Alternatives (if route unavailable)
                      </p>
                      <div className="space-y-2">
                        {alternatives.map(alt => (
                          <Card key={alt.id} className="bg-muted/50">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">
                                  {alt.provider_name || alt.alternative_description}
                                </p>
                                <span className="text-sm text-muted-foreground">
                                  +{alt.additional_time_minutes}min, +${alt.additional_cost_estimate || 0}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Use when: {alt.trigger_conditions?.join(', ')}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="w-5 h-5" />
            Transport Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {providers.map(provider => {
              const Icon = providerTypeIcons[provider.provider_type] || Bus;
              return (
                <Card key={provider.id} className="bg-muted/50">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <p className="font-medium">{provider.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{provider.base_location}</p>
                    <div className="flex flex-wrap gap-1">
                      {provider.has_live_api && (
                        <Badge variant="secondary" className="text-xs">Live Data</Badge>
                      )}
                      {provider.accepts_vehicles && (
                        <Badge variant="secondary" className="text-xs">Vehicles OK</Badge>
                      )}
                      {provider.accepts_kayaks && (
                        <Badge variant="secondary" className="text-xs">Kayaks OK</Badge>
                      )}
                    </div>
                    {provider.website && (
                      <a 
                        href={provider.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline mt-2 flex items-center gap-1"
                      >
                        Visit Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RouteExplorer;
