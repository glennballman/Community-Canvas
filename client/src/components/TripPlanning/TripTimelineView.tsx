import { useState } from 'react';
import {
  Car,
  Ship,
  Fuel,
  Hotel,
  MapPin,
  Camera,
  CloudSun,
  AlertTriangle,
  Navigation,
  Thermometer,
  Wind,
  Droplets,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Wrench,
  Coffee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type EventType = 
  | 'departure'
  | 'drive_segment'
  | 'webcam'
  | 'ferry'
  | 'fuel_stop'
  | 'rest_stop'
  | 'accommodation'
  | 'activity'
  | 'job_site'
  | 'parking'
  | 'sightseeing'
  | 'meal'
  | 'arrival'
  | 'alert';

export type BookingStatus = 'confirmed' | 'pending' | 'not_booked' | 'cancelled';

export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
  windDirection?: string;
  precipitation?: number;
}

export interface TimelinePhoto {
  url: string;
  caption?: string;
  source?: string;
  timestamp?: string;
}

export interface TimelineAlert {
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  description: string;
  source?: string;
  roads?: string[];
  eventType?: string;
  startTime?: string;
  endTime?: string;
  region?: string;
  details?: Record<string, unknown>;
  sourceUrl?: string;
  distanceKm?: number;
  nearestPoint?: string;
}

export interface TimelineEvent {
  id: string;
  type: EventType;
  time: string;
  endTime?: string;
  title: string;
  subtitle?: string;
  description?: string;
  location?: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  photos: TimelinePhoto[];
  weather?: WeatherData;
  weatherForecast?: WeatherData[];
  alerts: TimelineAlert[];
  booking?: {
    status: BookingStatus;
    confirmationNumber?: string;
    provider?: string;
    price?: number;
    link?: string;
    phone?: string;
  };
  duration?: number;
  distance?: number;
  cost?: number;
  notes?: string;
  vehicle?: {
    id: string;
    name: string;
    photo?: string;
    licensePlate?: string;
  };
  trailer?: {
    id: string;
    name: string;
    photo?: string;
  };
  ferry?: {
    route: string;
    vessel?: string;
    sailingTime: string;
    deckSpace?: string;
  };
  fuel?: {
    stationName: string;
    pricePerLiter?: number;
    estimatedFillUp?: number;
  };
  accommodation?: {
    type: 'hotel' | 'motel' | 'airbnb' | 'vrbo' | 'camping' | 'cabin';
    checkIn?: string;
    checkOut?: string;
    roomType?: string;
    amenities?: string[];
  };
  routeAlternative?: {
    name: string;
    description: string;
    isGravel?: boolean;
    additionalTime?: number;
  };
  jobSite?: {
    jobNumber?: string;
    clientName?: string;
    scope?: string;
    estimatedHours?: number;
    jobberLink?: string;
    companyCamLink?: string;
  };
  routePoint?: string;
  dataFreshness?: {
    webcam?: string;
    weather?: string;
    alerts?: string;
  };
}

export interface TripTimelineViewProps {
  tripId: string;
  tripName: string;
  events: TimelineEvent[];
  isLoading?: boolean;
  onEventClick?: (event: TimelineEvent) => void;
  onBookEvent?: (event: TimelineEvent) => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRelativeWithTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const relative = formatRelativeTime(isoTimestamp);
  return `${relative} (${timeStr})`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getEventIcon(type: EventType) {
  switch (type) {
    case 'departure': return Car;
    case 'drive_segment': return Navigation;
    case 'webcam': return Camera;
    case 'ferry': return Ship;
    case 'fuel_stop': return Fuel;
    case 'rest_stop': return Coffee;
    case 'accommodation': return Hotel;
    case 'activity': return MapPin;
    case 'job_site': return Wrench;
    case 'parking': return MapPin;
    case 'sightseeing': return Camera;
    case 'meal': return Coffee;
    case 'arrival': return MapPin;
    case 'alert': return AlertTriangle;
    default: return MapPin;
  }
}

function getEventColor(type: EventType): string {
  switch (type) {
    case 'departure': return 'bg-blue-500';
    case 'drive_segment': return 'bg-gray-500';
    case 'webcam': return 'bg-purple-500';
    case 'ferry': return 'bg-cyan-500';
    case 'fuel_stop': return 'bg-yellow-500';
    case 'rest_stop': return 'bg-orange-400';
    case 'accommodation': return 'bg-indigo-500';
    case 'activity': return 'bg-green-500';
    case 'job_site': return 'bg-red-500';
    case 'parking': return 'bg-gray-400';
    case 'sightseeing': return 'bg-emerald-500';
    case 'meal': return 'bg-amber-500';
    case 'arrival': return 'bg-green-600';
    case 'alert': return 'bg-red-600';
    default: return 'bg-gray-500';
  }
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  switch (status) {
    case 'confirmed':
      return (
        <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Confirmed
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Pending
        </Badge>
      );
    case 'not_booked':
      return (
        <Badge variant="secondary">Not Booked</Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
  }
}

function WeatherWidget({ weather, compact = false, freshness }: { weather: WeatherData; compact?: boolean; freshness?: string }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Thermometer className="h-4 w-4 text-muted-foreground" />
        <span>{weather.temperature}C</span>
        <span className="text-muted-foreground">{weather.condition}</span>
        {freshness && (
          <span className="text-xs text-muted-foreground opacity-60">
            ({formatRelativeWithTimestamp(freshness)})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
      <div className="text-center">
        <CloudSun className="h-8 w-8 text-yellow-500 mx-auto" />
        <p className="text-2xl font-bold">{weather.temperature}C</p>
        <p className="text-sm text-muted-foreground">{weather.condition}</p>
        {freshness && (
          <p className="text-xs text-muted-foreground mt-1">
            as of {formatRelativeWithTimestamp(freshness)}
          </p>
        )}
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
        {weather.humidity !== undefined && (
          <div className="flex items-center gap-1">
            <Droplets className="h-4 w-4 text-blue-400" />
            <span>{weather.humidity}%</span>
          </div>
        )}
        {weather.windSpeed !== undefined && (
          <div className="flex items-center gap-1">
            <Wind className="h-4 w-4 text-gray-400" />
            <span>{weather.windSpeed} km/h</span>
          </div>
        )}
        {weather.precipitation !== undefined && (
          <div className="flex items-center gap-1">
            <Droplets className="h-4 w-4 text-cyan-400" />
            <span>{weather.precipitation}mm</span>
          </div>
        )}
      </div>
    </div>
  );
}

function WeatherForecastStrip({ forecast }: { forecast: WeatherData[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-2">Weather Forecast (-1h to +8h)</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {forecast.map((hour, i) => (
          <div 
            key={i} 
            className={`flex-shrink-0 text-center p-2 rounded ${
              i === 1 ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50'
            }`}
          >
            <p className="text-xs text-muted-foreground">
              {i === 0 ? '-1h' : i === 1 ? 'Arrival' : `+${i - 1}h`}
            </p>
            <p className="font-bold">{hour.temperature}</p>
            <p className="text-xs">{hour.condition}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: TimelinePhoto[] }) {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  
  if (photos.length === 0) return null;

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index));
  };

  const validPhotos = photos.filter((_, i) => !imageErrors.has(i));

  if (photos.length === 1) {
    if (imageErrors.has(0)) {
      return (
        <div className="relative rounded-lg overflow-hidden bg-muted h-48 flex items-center justify-center">
          <Camera className="h-8 w-8 text-muted-foreground" />
          {photos[0].caption && (
            <p className="absolute bottom-2 left-2 text-sm text-muted-foreground">{photos[0].caption}</p>
          )}
        </div>
      );
    }
    return (
      <div className="relative rounded-lg overflow-hidden">
        <img 
          src={photos[0].url} 
          alt={photos[0].caption || 'Event photo'}
          className="w-full h-48 object-cover"
          onError={() => handleImageError(0)}
        />
        {photos[0].source === 'webcam' && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 rounded text-xs text-white flex items-center gap-1">
            <span className="h-2 w-2 bg-white rounded-full animate-pulse"></span>
            LIVE
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2">
          {photos[0].caption && (
            <p className="text-sm text-white">{photos[0].caption}</p>
          )}
          {photos[0].source === 'webcam' && photos[0].timestamp && (
            <p className="text-xs text-gray-300">
              LIVE - DriveBC · Updated {photos[0].timestamp.includes('T') ? formatRelativeWithTimestamp(photos[0].timestamp) : photos[0].timestamp}
            </p>
          )}
          {photos[0].source !== 'webcam' && photos[0].timestamp && (
            <p className="text-xs text-gray-300">{photos[0].timestamp}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {photos.slice(0, 4).map((photo, i) => (
        <div key={i} className="relative rounded-lg overflow-hidden">
          {imageErrors.has(i) ? (
            <div className="w-full h-24 bg-muted flex items-center justify-center">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : (
            <img 
              src={photo.url} 
              alt={photo.caption || `Photo ${i + 1}`}
              className="w-full h-24 object-cover"
              onError={() => handleImageError(i)}
            />
          )}
          {photo.source === 'webcam' && !imageErrors.has(i) && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-500 rounded text-xs text-white flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse"></span>
              LIVE
            </div>
          )}
        </div>
      ))}
      {photos.length > 4 && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
          +{photos.length - 4} more
        </div>
      )}
    </div>
  );
}

function AlertBanner({ alert }: { alert: TimelineAlert }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const severityStyles = {
    critical: 'bg-red-500/20 border-red-500/50 text-red-400',
    major: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    minor: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  };

  const severityLabels = {
    critical: 'CLOSURE',
    major: 'MAJOR',
    minor: 'MINOR',
    info: 'INFO',
  };

  const hasDetails = alert.description || alert.roads?.length || alert.region || alert.startTime || alert.details;

  return (
    <div className={`rounded-lg border ${severityStyles[alert.severity]} overflow-hidden`}>
      <div 
        className="p-3 cursor-pointer"
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        data-testid={`alert-banner-${alert.title?.substring(0, 20)}`}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-current/20">
                {alert.eventType || severityLabels[alert.severity]}
              </span>
              {alert.nearestPoint && (
                <span className="text-xs opacity-70">{alert.nearestPoint}</span>
              )}
              {alert.distanceKm !== undefined && (
                <span className="text-xs opacity-60">{alert.distanceKm.toFixed(1)}km away</span>
              )}
            </div>
            <p className="font-medium text-sm mt-1">{alert.title}</p>
            {!isExpanded && alert.description && (
              <p className="text-xs opacity-80 mt-1 line-clamp-2">{alert.description}</p>
            )}
            {hasDetails && (
              <button 
                className="text-xs opacity-60 mt-1 hover:opacity-100 flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              >
                {isExpanded ? 'Show less' : 'Show details'}
                <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-current/20 mt-0">
          <div className="space-y-2 text-xs">
            {alert.description && (
              <div>
                <p className="opacity-60 font-medium">Description:</p>
                <p className="opacity-90 whitespace-pre-wrap">{alert.description}</p>
              </div>
            )}
            
            {alert.roads && alert.roads.length > 0 && (
              <div>
                <p className="opacity-60 font-medium">Affected Roads:</p>
                <p className="opacity-90">{alert.roads.join(', ')}</p>
              </div>
            )}
            
            {alert.region && (
              <div>
                <p className="opacity-60 font-medium">Region:</p>
                <p className="opacity-90">{alert.region}</p>
              </div>
            )}
            
            {(alert.startTime || alert.endTime) && (
              <div>
                <p className="opacity-60 font-medium">Timing:</p>
                <p className="opacity-90">
                  {alert.startTime && `From: ${new Date(alert.startTime).toLocaleString()}`}
                  {alert.startTime && alert.endTime && ' | '}
                  {alert.endTime && `Until: ${new Date(alert.endTime).toLocaleString()}`}
                </p>
              </div>
            )}
            
            {alert.details && Object.keys(alert.details).length > 0 && (
              <div>
                <p className="opacity-60 font-medium">Additional Details:</p>
                <div className="opacity-90 space-y-1">
                  {Object.entries(alert.details).map(([key, value]) => (
                    <p key={key} className="pl-2">
                      <span className="opacity-70">{key}:</span>{' '}
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </p>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-1">
              {alert.source && (
                <p className="opacity-50">Source: {alert.source}</p>
              )}
              {alert.sourceUrl && (
                <a 
                  href={alert.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on DriveBC
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineEventCard({ 
  event, 
  isFirst,
  isLast,
  onEventClick,
  onBookEvent 
}: { 
  event: TimelineEvent;
  isFirst: boolean;
  isLast: boolean;
  onEventClick?: (event: TimelineEvent) => void;
  onBookEvent?: (event: TimelineEvent) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = getEventIcon(event.type);
  const colorClass = getEventColor(event.type);

  return (
    <div className="relative flex gap-4" data-testid={`timeline-event-${event.id}`}>
      <div className="flex flex-col items-center">
        <div className="w-20 text-right pr-3 flex-shrink-0">
          <p className="text-sm font-medium">{formatTime(event.time)}</p>
          {event.duration && event.duration > 0 && (
            <p className="text-xs text-muted-foreground">{formatDuration(event.duration)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center">
        {!isFirst && <div className="w-0.5 h-4 bg-border"></div>}
        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[2rem]"></div>}
      </div>

      <div className="flex-1 pb-6">
        <div 
          className="bg-card border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onEventClick?.(event)}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{event.title}</h3>
                {event.subtitle && (
                  <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {event.cost !== undefined && event.cost > 0 && (
                  <span className="text-sm font-medium text-green-500">
                    ${event.cost.toFixed(2)}
                  </span>
                )}
                {event.booking && <BookingStatusBadge status={event.booking.status} />}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  data-testid={`button-toggle-${event.id}`}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.location.name}
                </span>
              )}
              {event.distance && (
                <span className="flex items-center gap-1">
                  <Navigation className="h-3.5 w-3.5" />
                  {event.distance} km
                </span>
              )}
              {event.weather && (
                <WeatherWidget weather={event.weather} compact freshness={event.dataFreshness?.weather} />
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="border-t border-border">
              {event.alerts.length > 0 && (
                <div className="p-4 space-y-2">
                  {event.alerts.map((alert, i) => (
                    <AlertBanner key={i} alert={alert} />
                  ))}
                </div>
              )}

              {event.photos.length > 0 && (
                <div className="p-4 pt-0">
                  <PhotoGallery photos={event.photos} />
                </div>
              )}

              {event.weatherForecast && event.weatherForecast.length > 0 && (
                <div className="px-4 pb-4">
                  <WeatherForecastStrip forecast={event.weatherForecast} />
                </div>
              )}

              {event.description && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
              )}

              {event.vehicle && (
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                      <Car className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{event.vehicle.name}</p>
                      {event.vehicle.licensePlate && (
                        <p className="text-sm text-muted-foreground">{event.vehicle.licensePlate}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {event.ferry && (
                <div className="px-4 pb-4">
                  <div className="p-3 bg-cyan-500/10 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-cyan-500" />
                      <span className="font-medium">{event.ferry.route}</span>
                    </div>
                    {event.ferry.vessel && (
                      <p className="text-sm">Vessel: {event.ferry.vessel}</p>
                    )}
                    <p className="text-sm">Sailing: {event.ferry.sailingTime}</p>
                    {event.ferry.deckSpace && (
                      <p className="text-sm">Deck: {event.ferry.deckSpace}</p>
                    )}
                  </div>
                </div>
              )}

              {event.fuel && (
                <div className="px-4 pb-4">
                  <div className="p-3 bg-yellow-500/10 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{event.fuel.stationName}</span>
                    </div>
                    {event.fuel.pricePerLiter && (
                      <p className="text-sm">Price: ${event.fuel.pricePerLiter}/L</p>
                    )}
                    {event.fuel.estimatedFillUp && (
                      <p className="text-sm">Est. fill: {event.fuel.estimatedFillUp}L</p>
                    )}
                  </div>
                </div>
              )}

              {event.accommodation && (
                <div className="px-4 pb-4">
                  <div className="p-3 bg-indigo-500/10 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium capitalize">{event.accommodation.type}</span>
                    </div>
                    {event.accommodation.roomType && (
                      <p className="text-sm">{event.accommodation.roomType}</p>
                    )}
                    {event.accommodation.checkIn && (
                      <p className="text-sm">Check-in: {event.accommodation.checkIn}</p>
                    )}
                    {event.accommodation.amenities && event.accommodation.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.accommodation.amenities.map((a, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {event.jobSite && (
                <div className="px-4 pb-4">
                  <div className="p-3 bg-red-500/10 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.jobSite.clientName || 'Job Site'}</span>
                      {event.jobSite.jobNumber && (
                        <span className="text-sm text-muted-foreground">#{event.jobSite.jobNumber}</span>
                      )}
                    </div>
                    {event.jobSite.scope && (
                      <p className="text-sm">{event.jobSite.scope}</p>
                    )}
                    {event.jobSite.estimatedHours && (
                      <p className="text-sm">Est. {event.jobSite.estimatedHours} hours</p>
                    )}
                    <div className="flex gap-2 pt-2">
                      {event.jobSite.jobberLink && (
                        <a 
                          href={event.jobSite.jobberLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Jobber
                        </a>
                      )}
                      {event.jobSite.companyCamLink && (
                        <a 
                          href={event.jobSite.companyCamLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Camera className="h-3 w-3" />
                          CompanyCam
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {event.booking && event.booking.status === 'not_booked' && onBookEvent && (
                <div className="px-4 pb-4">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookEvent(event);
                    }}
                    className="w-full"
                    data-testid={`button-book-${event.id}`}
                  >
                    Book Now
                  </Button>
                </div>
              )}

              {event.booking && event.booking.status === 'confirmed' && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {event.booking.confirmationNumber && (
                      <span className="text-muted-foreground">
                        Confirmation: <span className="font-mono">{event.booking.confirmationNumber}</span>
                      </span>
                    )}
                    {event.booking.link && (
                      <a 
                        href={event.booking.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Manage
                      </a>
                    )}
                    {event.booking.phone && (
                      <a 
                        href={`tel:${event.booking.phone}`}
                        className="text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3 w-3" />
                        {event.booking.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function groupEventsByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  
  events.forEach(event => {
    const dateKey = formatDate(event.time);
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  });
  
  return groups;
}

export function TripTimelineView({
  tripId,
  tripName,
  events,
  isLoading,
  onEventClick,
  onBookEvent,
}: TripTimelineViewProps) {
  const groupedEvents = groupEventsByDate(events);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12" data-testid="timeline-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center p-12" data-testid="timeline-empty">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium">No events yet</p>
        <p className="text-sm text-muted-foreground">Start planning your trip</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid={`trip-timeline-${tripId}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold" data-testid="timeline-title">{tripName}</h2>
        <p className="text-sm text-muted-foreground">{events.length} events planned</p>
      </div>

      {Array.from(groupedEvents.entries()).map(([dateKey, dayEvents], dayIndex) => (
        <div key={dateKey} data-testid={`timeline-day-${dayIndex}`}>
          <div className="sticky top-0 z-50 bg-background/95 backdrop-blur py-2 mb-4">
            <Badge variant="outline" className="text-sm font-medium">
              {dateKey}
            </Badge>
          </div>

          <div className="space-y-0">
            {dayEvents.map((event, eventIndex) => {
              const globalIndex = events.indexOf(event);
              return (
                <TimelineEventCard
                  key={event.id}
                  event={event}
                  isFirst={globalIndex === 0}
                  isLast={globalIndex === events.length - 1}
                  onEventClick={onEventClick}
                  onBookEvent={onBookEvent}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TripTimelineView;
