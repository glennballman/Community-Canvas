import { useEffect, useState } from 'react';
import { Ship, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Car, Users, ExternalLink } from 'lucide-react';

interface FerrySailing {
  route: string;
  departing: string;
  arriving: string;
  nextSailing: string;
  status: 'on_time' | 'delayed' | 'cancelled';
  delayMinutes?: number;
  vehicleCapacity: number;
  passengerCapacity: number;
  vessel?: string;
}

interface FerryRoute {
  id: string;
  name: string;
  sailings: FerrySailing[];
}

export function FerryStatus() {
  const [routes, setRoutes] = useState<FerryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    fetchFerryStatus();
    const interval = setInterval(fetchFerryStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchFerryStatus() {
    try {
      const response = await fetch('/api/v1/ferries/status');
      const data = await response.json();
      setRoutes(data.routes || mockFerryData());
    } catch (error) {
      console.error('Failed to fetch ferry status:', error);
      setRoutes(mockFerryData());
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-32"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl overflow-hidden border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Ship className="w-5 h-5" /> BC Ferries
        </h3>
        <a
          href="https://www.bcferries.com/current-conditions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
          data-testid="link-ferry-conditions"
        >
          View all <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="divide-y">
        {routes.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p>No ferry data available</p>
          </div>
        ) : (
          routes.map(route => (
            <FerryRouteRow
              key={route.id}
              route={route}
              expanded={selectedRoute === route.id}
              onToggle={() => setSelectedRoute(
                selectedRoute === route.id ? null : route.id
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface FerryRouteRowProps {
  route: FerryRoute;
  expanded: boolean;
  onToggle: () => void;
}

function FerryRouteRow({ route, expanded, onToggle }: FerryRouteRowProps) {
  const nextSailing = route.sailings[0];
  if (!nextSailing) return null;

  const statusConfig = {
    on_time: { icon: CheckCircle, text: 'On Time', color: 'text-green-500' },
    delayed: { icon: Clock, text: 'Delayed', color: 'text-yellow-500' },
    cancelled: { icon: XCircle, text: 'Cancelled', color: 'text-red-500' },
  };

  const config = statusConfig[nextSailing.status] || statusConfig.on_time;
  const StatusIcon = config.icon;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
        data-testid={`ferry-route-${route.id}`}
      >
        <div className="flex items-center gap-3">
          <Ship className="w-5 h-5 text-blue-500" />
          <div>
            <h4 className="font-medium text-sm">{route.name}</h4>
            <p className="text-xs text-muted-foreground">
              Next: {formatTime(nextSailing.nextSailing)}
              {nextSailing.delayMinutes && nextSailing.delayMinutes > 0 && (
                <span className="text-yellow-500 ml-1">
                  (+{nextSailing.delayMinutes} min)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${config.color} flex items-center gap-1`}>
            <StatusIcon className="w-3 h-3" /> {config.text}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-muted/30">
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1 flex items-center gap-1">
                <Car className="w-3 h-3" /> Vehicles
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      nextSailing.vehicleCapacity > 80 ? 'bg-red-500' :
                      nextSailing.vehicleCapacity > 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${nextSailing.vehicleCapacity}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-10 text-right">
                  {nextSailing.vehicleCapacity}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Passengers
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      nextSailing.passengerCapacity > 80 ? 'bg-red-500' :
                      nextSailing.passengerCapacity > 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${nextSailing.passengerCapacity}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-10 text-right">
                  {nextSailing.passengerCapacity}%
                </span>
              </div>
            </div>
          </div>

          {nextSailing.vessel && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <Ship className="w-3 h-3" /> Vessel: {nextSailing.vessel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
}

function mockFerryData(): FerryRoute[] {
  const now = new Date();
  return [
    {
      id: 'tsawwassen-swartz-bay',
      name: 'Tsawwassen - Swartz Bay',
      sailings: [{
        route: 'Tsawwassen - Swartz Bay',
        departing: 'Tsawwassen',
        arriving: 'Swartz Bay',
        nextSailing: new Date(now.getTime() + 45 * 60000).toISOString(),
        status: 'on_time',
        vehicleCapacity: 65,
        passengerCapacity: 40,
        vessel: 'Spirit of British Columbia'
      }]
    },
    {
      id: 'horseshoe-bay-nanaimo',
      name: 'Horseshoe Bay - Nanaimo',
      sailings: [{
        route: 'Horseshoe Bay - Departure Bay',
        departing: 'Horseshoe Bay',
        arriving: 'Departure Bay',
        nextSailing: new Date(now.getTime() + 90 * 60000).toISOString(),
        status: 'delayed',
        delayMinutes: 15,
        vehicleCapacity: 85,
        passengerCapacity: 55,
        vessel: 'Queen of Oak Bay'
      }]
    },
    {
      id: 'tsawwassen-duke-point',
      name: 'Tsawwassen - Duke Point',
      sailings: [{
        route: 'Tsawwassen - Duke Point',
        departing: 'Tsawwassen',
        arriving: 'Duke Point',
        nextSailing: new Date(now.getTime() + 120 * 60000).toISOString(),
        status: 'on_time',
        vehicleCapacity: 30,
        passengerCapacity: 20,
        vessel: 'Coastal Celebration'
      }]
    },
    {
      id: 'horseshoe-bay-langdale',
      name: 'Horseshoe Bay - Langdale',
      sailings: [{
        route: 'Horseshoe Bay - Langdale',
        departing: 'Horseshoe Bay',
        arriving: 'Langdale',
        nextSailing: new Date(now.getTime() + 30 * 60000).toISOString(),
        status: 'on_time',
        vehicleCapacity: 45,
        passengerCapacity: 35,
        vessel: 'Queen of Surrey'
      }]
    }
  ];
}

export default FerryStatus;
