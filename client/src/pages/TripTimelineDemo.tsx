import { ArrowLeft, Share, Download, Edit } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TripTimelineView, TimelineEvent } from '../components/TripPlanning/TripTimelineView';
import { sampleBamfieldTrip, bamfieldTripSummary } from '../data/sampleBamfieldTrip';

export function TripTimelineDemo() {
  const handleEventClick = (event: TimelineEvent) => {
    console.log('Event clicked:', event);
  };

  const handleBookEvent = (event: TimelineEvent) => {
    console.log('Book event:', event);
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
          events={sampleBamfieldTrip}
          onEventClick={handleEventClick}
          onBookEvent={handleBookEvent}
        />
      </div>
    </div>
  );
}

export default TripTimelineDemo;
