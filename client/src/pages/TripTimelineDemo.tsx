import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Share, Download, Edit, RefreshCw, AlertTriangle, Cloud, Radio } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TripTimelineView, TimelineEvent } from '../components/TripPlanning/TripTimelineView';
import { sampleBamfieldTrip, bamfieldTripSummary } from '../data/sampleBamfieldTrip';
import { 
  getAlertsAlongRoute, 
  getCurrentWeather, 
  mapAlertSeverity, 
  mapWeatherConditionToIcon,
  BAMFIELD_ROUTE_POINTS,
  LiveAlert,
  LiveWeather
} from '../lib/routeRealTimeData';
import { getLiveWebcamUrl } from '../lib/routeWebcams';

export function TripTimelineDemo() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Fetch live alerts along the route (refresh every 5 minutes)
  const { data: liveAlerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['/trip-alerts', 'bamfield-route'],
    queryFn: () => getAlertsAlongRoute(BAMFIELD_ROUTE_POINTS, 25),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
  });
  
  // Fetch current weather (refresh every 30 minutes)
  const { data: liveWeather, isLoading: weatherLoading, refetch: refetchWeather } = useQuery({
    queryKey: ['/trip-weather'],
    queryFn: getCurrentWeather,
    refetchInterval: 30 * 60 * 1000, // 30 minutes
    staleTime: 25 * 60 * 1000,
  });
  
  // Auto-refresh webcam URLs every 5 minutes
  const [webcamRefreshKey, setWebcamRefreshKey] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setWebcamRefreshKey(k => k + 1);
      setLastRefresh(new Date());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Convert live alerts to timeline alert events and inject into timeline
  const eventsWithLiveData: TimelineEvent[] = useMemo(() => {
    // Start with a copy of the sample trip events with refreshed webcam URLs
    const events = sampleBamfieldTrip.map(event => {
      if (event.type === 'webcam' && event.photos?.length) {
        return {
          ...event,
          photos: event.photos.map(photo => ({
            ...photo,
            url: getLiveWebcamUrl(photo.url.split('?')[0]) // Refresh cache-busted URL
          }))
        };
      }
      return event;
    });
    
    // Update weather data on events if we have live weather
    if (liveWeather) {
      events.forEach(event => {
        if (event.weather) {
          event.weather = {
            ...event.weather,
            temperature: liveWeather.temperature,
            condition: liveWeather.condition,
            icon: mapWeatherConditionToIcon(liveWeather.condition)
          };
        }
      });
    }
    
    // Create alert events from live alerts
    const alertEvents: TimelineEvent[] = liveAlerts.slice(0, 5).map((alert) => ({
      id: `live-alert-${alert.id}`,
      type: 'alert' as const,
      time: new Date().toISOString(), // Show at current time
      title: alert.title || 'Road Alert',
      subtitle: `${alert.distanceKm}km from route - ${alert.region_name || 'BC'}`,
      description: alert.summary || alert.message,
      location: {
        name: alert.region_name || 'Along Route',
      },
      photos: [],
      alerts: [{
        severity: mapAlertSeverity(alert.severity) === 'major' ? 'major' : 
                  mapAlertSeverity(alert.severity) === 'minor' ? 'minor' : 'info',
        title: alert.title || 'Alert',
        description: alert.summary || alert.message || '',
        source: 'DriveBC'
      }],
    }));
    
    // Insert live alerts at the beginning of the timeline if any exist
    if (alertEvents.length > 0) {
      return [...alertEvents, ...events];
    }
    
    return events;
  }, [sampleBamfieldTrip, liveAlerts, liveWeather, webcamRefreshKey]);
  
  const handleEventClick = (event: TimelineEvent) => {
    console.log('Event clicked:', event);
  };

  const handleBookEvent = (event: TimelineEvent) => {
    console.log('Book event:', event);
  };
  
  const handleManualRefresh = () => {
    refetchAlerts();
    refetchWeather();
    setWebcamRefreshKey(k => k + 1);
    setLastRefresh(new Date());
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button size="icon" variant="ghost" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="font-semibold" data-testid="text-page-title">Trip Details</h1>
                <p className="text-sm text-muted-foreground">
                  {bamfieldTripSummary.startDate} - {bamfieldTripSummary.endDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" data-testid="button-share">
                <Share className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" data-testid="button-download">
                <Download className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" data-testid="button-edit">
                <Edit className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Live Data Status Bar */}
        <Card className="p-3 mb-4" data-testid="card-live-status">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-green-500 animate-pulse" />
                <span className="text-sm font-medium">Live Data</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">
                  {alertsLoading ? 'Loading...' : `${liveAlerts.length} alerts`}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  {weatherLoading ? 'Loading...' : (liveWeather ? `${liveWeather.temperature}°C ${liveWeather.condition}` : 'No data')}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleManualRefresh}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Show live alerts banner if any critical alerts */}
          {liveAlerts.filter(a => ['emergency', 'critical', 'major'].includes(a.severity)).length > 0 && (
            <div className="mt-3 p-2 bg-destructive/10 rounded-md border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-destructive">Active Road Alerts: </span>
                  {liveAlerts
                    .filter(a => ['emergency', 'critical', 'major'].includes(a.severity))
                    .slice(0, 3)
                    .map(a => a.title)
                    .join(' | ')}
                </div>
              </div>
            </div>
          )}
        </Card>
        
        {/* Trip Summary Card */}
        <Card className="p-4 mb-6" data-testid="card-trip-summary">
          <div className="flex flex-wrap gap-6">
            <div className="flex-1 min-w-[150px]">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold text-green-500" data-testid="text-total-cost">
                ${bamfieldTripSummary.totalCost.total}
              </p>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p>Fuel: ${bamfieldTripSummary.totalCost.fuel}</p>
                <p>Ferry: ${bamfieldTripSummary.totalCost.ferry}</p>
                <p>Accommodation: ${bamfieldTripSummary.totalCost.accommodation}</p>
                <p>Meals: ${bamfieldTripSummary.totalCost.meals}</p>
              </div>
            </div>

            <div className="flex-1 min-w-[150px]">
              <p className="text-sm text-muted-foreground">Distance</p>
              <p className="text-2xl font-bold" data-testid="text-total-distance">
                {bamfieldTripSummary.totalDistance} km
              </p>
              <p className="text-xs text-muted-foreground mt-1">Round trip</p>
            </div>

            <div className="flex-1 min-w-[150px]">
              <p className="text-sm text-muted-foreground">Crew</p>
              <p className="text-2xl font-bold" data-testid="text-crew-count">
                {bamfieldTripSummary.crew.length}
              </p>
              <div className="text-xs text-muted-foreground mt-1">
                {bamfieldTripSummary.crew.map(c => c.name).join(', ')}
              </div>
            </div>

            <div className="flex-1 min-w-[150px]">
              <p className="text-sm text-muted-foreground">Vehicle</p>
              <p className="font-bold" data-testid="text-vehicle-name">
                {bamfieldTripSummary.vehicle.name}
              </p>
              <p className="text-xs text-muted-foreground">{bamfieldTripSummary.vehicle.type}</p>
              {bamfieldTripSummary.trailer && (
                <p className="text-xs text-muted-foreground mt-1">
                  + {bamfieldTripSummary.trailer.name}
                </p>
              )}
            </div>
          </div>
        </Card>

        <TripTimelineView
          tripId={bamfieldTripSummary.id}
          tripName={bamfieldTripSummary.name}
          events={eventsWithLiveData}
          onEventClick={handleEventClick}
          onBookEvent={handleBookEvent}
        />
        
        {/* Data Sources Footer */}
        <div className="mt-6 p-4 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground text-center">
            Live data from DriveBC (webcams, alerts), Environment Canada (weather). 
            Auto-refreshes: Webcams 5min, Weather 30min, Alerts 5min.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TripTimelineDemo;
