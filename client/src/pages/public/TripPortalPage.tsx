import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Calendar, Map, Clock, Users, Car, 
  MapPin, Camera, Utensils, Tent, Fish, Sun, CloudRain,
  Share2, Plus, Check, AlertTriangle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TripData {
  trip: {
    id: string;
    accessCode: string;
    status: string;
    startDate: string;
    endDate: string;
    groupName: string;
    groupSize: number;
    originName: string;
    originType: string;
    hasVehicle: boolean;
    hasTrailer: boolean;
    trailerType: string;
    boatLengthFt: number;
    nextDestinationName: string;
    coordinateHandoff: boolean;
    currentAlertLevel: string;
    lastConditionsCheck: string;
  };
  portal: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tripDays: number;
  daysUntilTrip: number;
  calendar: CalendarDay[];
  itineraryItems: ItineraryItem[];
  timepoints: any[];
  participants: any[];
  passengers: any[];
  routePoints: any[];
}

interface CalendarDay {
  date: string;
  dayNumber: number;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  items: ItineraryItem[];
  timepoints: any[];
}

interface ItineraryItem {
  id: string;
  trip_id: string;
  item_type: string;
  title: string;
  description: string;
  is_reserved: boolean;
  status: string;
  day_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location_name: string;
  photo_moment: boolean;
  icon: string;
}

interface PortalMoment {
  id: string;
  portal_id: string;
  title: string;
  description: string;
  moment_type: string;
  best_time_of_day: string;
  best_weather: string;
  location_name: string;
  kid_friendly: boolean;
  pro_tip: string;
  safety_note: string;
  photo_moment: boolean;
  suggested_caption: string;
  icon: string;
  sort_order: number;
}

async function fetchTrip(accessCode: string): Promise<TripData> {
  const res = await fetch(`/api/public/trips/${accessCode}`);
  if (!res.ok) throw new Error('Trip not found');
  return res.json();
}

async function fetchMoments(portalId: string): Promise<{ moments: PortalMoment[]; grouped: Record<string, PortalMoment[]> }> {
  const res = await fetch(`/api/public/portals/${portalId}/moments`);
  if (!res.ok) throw new Error('Failed to fetch moments');
  return res.json();
}

function getItemIcon(itemType: string) {
  const icons: Record<string, typeof Calendar> = {
    travel: Car,
    accommodation: Tent,
    charter: Fish,
    parking: Car,
    meal: Utensils,
    activity: Sun,
    moment: Camera,
    beach: Sun,
    sunset: Sun,
    campfire: Tent,
    stop: MapPin,
    rainy_day: CloudRain,
    photo: Camera,
  };
  return icons[itemType] || Calendar;
}

function getMomentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stop: 'Must-See Stops',
    beach: 'Beach Activities',
    sunset: 'Sunset Spots',
    campfire: 'Evening Fun',
    meal: 'Dining',
    activity: 'Activities',
    photo: 'Photo Opportunities',
    rainy_day: 'Rainy Day Ideas',
  };
  return labels[type] || type;
}

export default function TripPortalPage() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const [activeTab, setActiveTab] = useState('calendar');
  const [showMomentsModal, setShowMomentsModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', accessCode],
    queryFn: () => fetchTrip(accessCode!),
    enabled: !!accessCode,
  });
  
  const { data: momentsData } = useQuery({
    queryKey: ['moments', data?.portal?.id],
    queryFn: () => fetchMoments(data!.portal!.id),
    enabled: !!data?.portal?.id,
  });
  
  const addItemMutation = useMutation({
    mutationFn: async ({ momentId, dayDate }: { momentId?: string; dayDate: string }) => {
      const res = await fetch(`/api/public/trips/${accessCode}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId, dayDate }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', accessCode] });
      setShowMomentsModal(false);
      setSelectedDay(null);
    },
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-container">
        <div className="text-foreground">Loading your expedition...</div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="error-container">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl mb-2" data-testid="error-title">Trip Not Found</h2>
            <p className="text-muted-foreground" data-testid="error-message">Check your access code and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { trip, portal, calendar, daysUntilTrip, tripDays } = data;
  
  const alertColors: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };
  
  return (
    <div className="min-h-screen bg-background" data-testid="trip-portal-page">
      <header className="bg-card border-b px-4 py-6" data-testid="trip-header">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="trip-name">
                {trip.groupName || 'Your Expedition'}
              </h1>
              <p className="text-muted-foreground" data-testid="portal-name">
                {portal?.name || 'Adventure Awaits'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-share">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm" data-testid="trip-stats">
            <div className="flex items-center text-muted-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              {trip.startDate && format(parseISO(trip.startDate), 'MMM d')} - {trip.endDate && format(parseISO(trip.endDate), 'MMM d, yyyy')}
            </div>
            <div className="flex items-center text-muted-foreground">
              <Users className="w-4 h-4 mr-2" />
              {trip.groupSize} {trip.groupSize === 1 ? 'guest' : 'guests'}
            </div>
            {trip.hasTrailer && (
              <div className="flex items-center text-muted-foreground">
                <Car className="w-4 h-4 mr-2" />
                {trip.trailerType === 'boat' ? `${trip.boatLengthFt}' boat` : trip.trailerType}
              </div>
            )}
            {trip.originName && (
              <div className="flex items-center text-muted-foreground">
                <MapPin className="w-4 h-4 mr-2" />
                From {trip.originName}
              </div>
            )}
          </div>
          
          <div className="mt-4 flex items-center gap-4" data-testid="trip-countdown">
            {daysUntilTrip > 0 ? (
              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-400">
                {daysUntilTrip} days until your trip
              </Badge>
            ) : daysUntilTrip === 0 ? (
              <Badge className="bg-green-600">Today is the day!</Badge>
            ) : (
              <Badge variant="outline">Trip completed</Badge>
            )}
            
            {trip.currentAlertLevel && (
              <div className={`w-3 h-3 rounded-full ${alertColors[trip.currentAlertLevel] || 'bg-muted'}`} 
                   title={`Alert level: ${trip.currentAlertLevel}`} />
            )}
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground" data-testid="trip-code">
            Trip Code: <span className="font-mono">{trip.accessCode}</span>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-4" data-testid="trip-main">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6" data-testid="trip-tabs">
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="arrival" data-testid="tab-arrival">
              <Clock className="w-4 h-4 mr-2" />
              Arrival Day
            </TabsTrigger>
            <TabsTrigger value="journey" data-testid="tab-journey">
              <Map className="w-4 h-4 mr-2" />
              Journey
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calendar" data-testid="calendar-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {calendar.map((day) => {
                return (
                  <Card 
                    key={day.date} 
                    className={`${day.isArrivalDay ? 'ring-2 ring-blue-500' : ''} ${day.isDepartureDay ? 'ring-2 ring-orange-500' : ''}`}
                    data-testid={`calendar-day-${day.date}`}
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-lg">
                        {format(parseISO(day.date), 'EEE, MMM d')}
                      </CardTitle>
                      {day.isArrivalDay && <Badge className="bg-blue-600">Arrival</Badge>}
                      {day.isDepartureDay && <Badge className="bg-orange-600">Departure</Badge>}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {day.items.length === 0 && day.timepoints.length === 0 ? (
                        <p className="text-muted-foreground text-sm italic">No plans yet</p>
                      ) : (
                        <>
                          {day.items.map((item) => {
                            const Icon = getItemIcon(item.item_type);
                            return (
                              <div 
                                key={item.id} 
                                className={`flex items-start gap-2 p-2 rounded ${item.is_reserved ? 'bg-green-900/20' : 'bg-muted/50'}`}
                                data-testid={`itinerary-item-${item.id}`}
                              >
                                <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{item.title}</p>
                                  {item.start_time && (
                                    <p className="text-xs text-muted-foreground">
                                      {item.start_time.slice(0, 5)}
                                    </p>
                                  )}
                                </div>
                                {item.is_reserved && <Check className="w-4 h-4 text-green-500" />}
                              </div>
                            );
                          })}
                        </>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-muted-foreground"
                        onClick={() => {
                          setSelectedDay(day.date);
                          setShowMomentsModal(true);
                        }}
                        data-testid={`button-add-activity-${day.date}`}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add activity
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="arrival" data-testid="arrival-content">
            <Card>
              <CardHeader>
                <CardTitle>Arrival Day Details</CardTitle>
              </CardHeader>
              <CardContent>
                {calendar.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Your trip begins on {format(parseISO(calendar[0].date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    {calendar[0].items.length > 0 ? (
                      <div className="space-y-2">
                        {calendar[0].items.map((item) => {
                          const Icon = getItemIcon(item.item_type);
                          return (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded">
                              <Icon className="w-5 h-5" />
                              <div>
                                <p className="font-medium">{item.title}</p>
                                {item.start_time && <p className="text-sm text-muted-foreground">{item.start_time.slice(0, 5)}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">No arrival day plans yet. Add some activities!</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="journey" data-testid="journey-content">
            <Card>
              <CardHeader>
                <CardTitle>Your Journey</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trip.originName && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Starting from</p>
                        <p className="text-muted-foreground">{trip.originName}</p>
                      </div>
                    </div>
                  )}
                  {portal && (
                    <div className="flex items-center gap-3">
                      <Tent className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">Destination</p>
                        <p className="text-muted-foreground">{portal.name}</p>
                      </div>
                    </div>
                  )}
                  {trip.nextDestinationName && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="font-medium">Next stop</p>
                        <p className="text-muted-foreground">{trip.nextDestinationName}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-muted-foreground text-sm mt-4">
                    {tripDays} day trip
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Dialog open={showMomentsModal} onOpenChange={setShowMomentsModal}>
        <DialogContent className="max-w-lg max-h-[80vh]" data-testid="moments-modal">
          <DialogHeader>
            <DialogTitle>
              Add to {selectedDay && format(parseISO(selectedDay), 'EEEE, MMM d')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {momentsData?.grouped && Object.entries(momentsData.grouped).map(([type, moments]) => (
                <div key={type}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{getMomentTypeLabel(type)}</h3>
                  <div className="space-y-2">
                    {moments.map((moment) => {
                      const Icon = getItemIcon(moment.moment_type);
                      return (
                        <button
                          key={moment.id}
                          onClick={() => selectedDay && addItemMutation.mutate({ momentId: moment.id, dayDate: selectedDay })}
                          disabled={addItemMutation.isPending}
                          className="w-full text-left p-3 rounded bg-muted/50 hover-elevate disabled:opacity-50"
                          data-testid={`moment-option-${moment.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="w-5 h-5 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">{moment.title}</p>
                              <p className="text-sm text-muted-foreground">{moment.description}</p>
                              {moment.pro_tip && (
                                <p className="text-xs text-muted-foreground mt-1 italic">Tip: {moment.pro_tip}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(!momentsData?.moments || momentsData.moments.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No suggested activities available for this destination.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
