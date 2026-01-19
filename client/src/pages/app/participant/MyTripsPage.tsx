import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';

interface Trip {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  alertLevel: string | null;
  originName: string | null;
  primaryLocation: string | null;
  itemCount: number;
  reservedCount: number;
  isUpcoming: boolean;
  isPast: boolean;
}

interface TripsResponse {
  ok: boolean;
  trips: Trip[];
  count: number;
}

function TripCard({ trip }: { trip: Trip }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    planning: 'bg-blue-500/10 text-blue-500',
    confirmed: 'bg-green-500/10 text-green-500',
    active: 'bg-primary/10 text-primary',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive'
  };

  const alertColors: Record<string, string> = {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    orange: 'text-orange-500',
    red: 'text-red-500'
  };

  return (
    <Card className="hover-elevate" data-testid={`card-trip-${trip.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">{trip.title || 'Untitled Trip'}</CardTitle>
          {trip.primaryLocation && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{trip.primaryLocation}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trip.alertLevel && trip.alertLevel !== 'green' && (
            <AlertTriangle className={`h-4 w-4 ${alertColors[trip.alertLevel] || ''}`} />
          )}
          <Badge className={statusColors[trip.status] || ''}>
            {trip.status || 'draft'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {trip.startDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                {format(parseISO(trip.startDate), 'MMM d')}
                {trip.endDate && ` - ${format(parseISO(trip.endDate), 'MMM d, yyyy')}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{trip.itemCount} items</span>
            {trip.reservedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {trip.reservedCount} reserved
              </Badge>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Link href={`/app/participant/trips/${trip.id}`}>
            <Button variant="ghost" size="sm" data-testid={`button-view-trip-${trip.id}`}>
              View trip <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyTripsPage() {
  const { data, isLoading, error } = useQuery<TripsResponse>({
    queryKey: ['/api/p2/app/participant/trips']
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
            <p className="text-destructive">Failed to load trips. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const upcomingTrips = data.trips.filter(t => t.isUpcoming);
  const pastTrips = data.trips.filter(t => t.isPast);
  const otherTrips = data.trips.filter(t => !t.isUpcoming && !t.isPast);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">My Trips</h1>
          <p className="text-muted-foreground">View and manage your travel plans</p>
        </div>
      </div>

      {data.trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No trips yet</h3>
            <p className="text-muted-foreground mb-4">
              When you make a reservation, your trips will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList data-testid="tabs-trip-filter">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              Upcoming ({upcomingTrips.length})
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              Past ({pastTrips.length})
            </TabsTrigger>
            {otherTrips.length > 0 && (
              <TabsTrigger value="other" data-testid="tab-other">
                Planning ({otherTrips.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-4">
            {upcomingTrips.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No upcoming trips</p>
            ) : (
              upcomingTrips.map(trip => <TripCard key={trip.id} trip={trip} />)
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4 space-y-4">
            {pastTrips.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No past trips</p>
            ) : (
              pastTrips.map(trip => <TripCard key={trip.id} trip={trip} />)
            )}
          </TabsContent>

          {otherTrips.length > 0 && (
            <TabsContent value="other" className="mt-4 space-y-4">
              {otherTrips.map(trip => <TripCard key={trip.id} trip={trip} />)}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
