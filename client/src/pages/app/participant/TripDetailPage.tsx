import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, MapPin, Clock, AlertTriangle, ChevronLeft, 
  CheckCircle2, Circle, Loader2, ExternalLink, Users
} from 'lucide-react';

interface ItineraryItem {
  id: string;
  itemType: string;
  title: string;
  description: string | null;
  isReserved: boolean;
  reservationId: string | null;
  status: string;
  dayDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  everyone: boolean;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  weatherSensitive: boolean;
  icon: string | null;
  color: string | null;
  sortOrder: number | null;
}

interface TripDetail {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  alertLevel: string | null;
  originName: string | null;
  groupSize: number | null;
  notes: string | null;
  monitoringActive: boolean;
}

interface TripDetailResponse {
  ok: boolean;
  trip: TripDetail;
  itinerary: ItineraryItem[];
  itineraryByDay: Record<string, ItineraryItem[]>;
  participants: any[];
}

function ItineraryItemCard({ item }: { item: ItineraryItem }) {
  const statusIcons: Record<string, typeof Circle> = {
    idea: Circle,
    planned: Circle,
    confirmed: CheckCircle2,
    completed: CheckCircle2
  };
  
  const StatusIcon = statusIcons[item.status] || Circle;

  const itemTypeColors: Record<string, string> = {
    activity: 'bg-blue-500/10 text-blue-500',
    accommodation: 'bg-purple-500/10 text-purple-500',
    transport: 'bg-orange-500/10 text-orange-500',
    dining: 'bg-green-500/10 text-green-500',
    attraction: 'bg-pink-500/10 text-pink-500'
  };

  return (
    <div 
      className="flex gap-3 p-3 rounded-lg border bg-card hover-elevate"
      data-testid={`card-itinerary-${item.id}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon 
          className={`h-5 w-5 ${item.status === 'confirmed' || item.status === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`} 
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.isReserved && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                Reserved
              </Badge>
            )}
            <Badge className={itemTypeColors[item.itemType] || 'bg-muted'}>
              {item.itemType}
            </Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {item.startTime && !item.allDay && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {item.startTime.slice(0, 5)}
                {item.endTime && ` - ${item.endTime.slice(0, 5)}`}
              </span>
            </div>
          )}
          {item.allDay && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>All day</span>
            </div>
          )}
          {item.locationName && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{item.locationName}</span>
            </div>
          )}
          {item.weatherSensitive && (
            <Badge variant="outline" className="text-xs">Weather dependent</Badge>
          )}
        </div>

        {item.isReserved && item.reservationId && (
          <div className="pt-2">
            <Link href={`/app/reservations/${item.reservationId}`}>
              <Button variant="outline" size="sm" data-testid={`button-view-reservation-${item.id}`}>
                View reservation <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;

  const { data, isLoading, error } = useQuery<TripDetailResponse>({
    queryKey: ['/api/p2/app/participant/trips', tripId],
    enabled: !!tripId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load trip details. Please try again.</p>
            <Link href="/app/participant/trips">
              <Button variant="outline" className="mt-4">
                <ChevronLeft className="mr-1 h-4 w-4" /> Back to My Trips
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { trip, itineraryByDay } = data;
  const sortedDays = Object.keys(itineraryByDay).sort();

  const alertColors: Record<string, string> = {
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    orange: 'bg-orange-500/10 text-orange-500',
    red: 'bg-red-500/10 text-red-500'
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    planning: 'bg-blue-500/10 text-blue-500',
    confirmed: 'bg-green-500/10 text-green-500',
    active: 'bg-primary/10 text-primary',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive'
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/participant/trips">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-trip-title">
            {trip.title || 'Trip Details'}
          </h1>
          {trip.originName && (
            <p className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {trip.originName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trip.alertLevel && trip.alertLevel !== 'green' && (
            <Badge className={alertColors[trip.alertLevel] || ''}>
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              {trip.alertLevel} alert
            </Badge>
          )}
          <Badge className={statusColors[trip.status] || ''}>
            {trip.status || 'draft'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-6 text-sm">
            {trip.startDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(parseISO(trip.startDate), 'MMMM d, yyyy')}
                  {trip.endDate && ` - ${format(parseISO(trip.endDate), 'MMMM d, yyyy')}`}
                </span>
              </div>
            )}
            {trip.groupSize && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{trip.groupSize} travelers</span>
              </div>
            )}
            {trip.monitoringActive && (
              <Badge variant="outline" className="text-green-600">
                Monitoring active
              </Badge>
            )}
          </div>
          {trip.notes && (
            <p className="text-sm text-muted-foreground border-t pt-3 mt-3">{trip.notes}</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Itinerary</h2>
        
        {sortedDays.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No itinerary items yet
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-6 pr-4">
              {sortedDays.map(day => (
                <div key={day} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm font-medium text-muted-foreground px-2">
                      {day === 'unscheduled' 
                        ? 'Unscheduled' 
                        : format(parseISO(day), 'EEEE, MMMM d')}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {itineraryByDay[day].map(item => (
                      <ItineraryItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
