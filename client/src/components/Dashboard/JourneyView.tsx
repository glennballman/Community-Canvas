import { useState, useEffect } from 'react';
import { 
  RoadTrip, TripSegment, difficultyColors,
  TransportDetails, ActivityDetails, MealDetails
} from '../../types/roadtrips';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, MapPin, Clock, Star, DollarSign, Target,
  Car, Ship, Bus, Train, Plane, Sailboat, Footprints, Bike,
  Snowflake, Waves, Wine, Flame, Camera, Eye, Tent, Building,
  Home, Utensils, BedDouble, Flag, Lightbulb, ExternalLink,
  Share2, Calendar, Bookmark, Cloud, Route, AlertTriangle, Anchor
} from 'lucide-react';

interface JourneyViewProps {
  trip: RoadTrip;
  onBack: () => void;
}

type BudgetLevel = 'budget' | 'moderate' | 'comfort';

const transportIcons: Record<string, React.ReactNode> = {
  drive: <Car className="w-5 h-5" />,
  ferry: <Ship className="w-5 h-5" />,
  bus: <Bus className="w-5 h-5" />,
  train: <Train className="w-5 h-5" />,
  flight: <Plane className="w-5 h-5" />,
  'water-taxi': <Sailboat className="w-5 h-5" />,
  walk: <Footprints className="w-5 h-5" />,
  bike: <Bike className="w-5 h-5" />,
};

const activityIcons: Record<string, React.ReactNode> = {
  skiing: <Snowflake className="w-5 h-5" />,
  snowboarding: <Snowflake className="w-5 h-5" />,
  beach: <Waves className="w-5 h-5" />,
  'wine-tasting': <Wine className="w-5 h-5" />,
  'hot-springs': <Flame className="w-5 h-5" />,
  photography: <Camera className="w-5 h-5" />,
  sightseeing: <Eye className="w-5 h-5" />,
  camping: <Tent className="w-5 h-5" />,
  museum: <Building className="w-5 h-5" />,
};

const segmentTypeIcons: Record<string, React.ReactNode> = {
  departure: <Home className="w-5 h-5" />,
  transport: <Car className="w-5 h-5" />,
  activity: <Star className="w-5 h-5" />,
  accommodation: <BedDouble className="w-5 h-5" />,
  meal: <Utensils className="w-5 h-5" />,
  'photo-stop': <Camera className="w-5 h-5" />,
  arrival: <Flag className="w-5 h-5" />,
};

export function JourneyView({ trip, onBack }: JourneyViewProps) {
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('moderate');
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [webcams, setWebcams] = useState<any[]>([]);
  const [routeConditions, setRouteConditions] = useState<any>(null);

  const [webcamLoading, setWebcamLoading] = useState(true);
  const [webcamsBySegment, setWebcamsBySegment] = useState<Map<string, any[]>>(new Map());

  useEffect(() => {
    fetchWebcams();
    fetchRouteConditions();
  }, [trip.id]);

  async function fetchWebcams() {
    try {
      setWebcamLoading(true);
      const allWebcamIds = trip.segments.flatMap(s => s.webcam_ids);
      if (allWebcamIds.length === 0) {
        setWebcamLoading(false);
        return;
      }
      
      const response = await fetch(`/api/v1/entities?type=webcam&limit=100`);
      const data = await response.json();
      const allWebcams = data.entities || data || [];
      
      const webcamMap = new Map<number, any>();
      allWebcams.forEach((w: any) => {
        if (w.id) webcamMap.set(w.id, w);
      });
      
      const segmentWebcams = new Map<string, any[]>();
      trip.segments.forEach(segment => {
        const segCams = segment.webcam_ids
          .map(id => webcamMap.get(id))
          .filter(Boolean);
        segmentWebcams.set(segment.id, segCams);
      });
      
      setWebcamsBySegment(segmentWebcams);
      
      const routeWebcams = allWebcamIds
        .map(id => webcamMap.get(id))
        .filter(Boolean)
        .filter((w, i, arr) => arr.findIndex(x => x.id === w.id) === i);
      setWebcams(routeWebcams);
      setWebcamLoading(false);
    } catch (error) {
      console.error('Failed to fetch webcams:', error);
      setWebcamLoading(false);
    }
  }

  async function fetchRouteConditions() {
    try {
      const response = await fetch(`/api/v1/alerts/active?limit=20`);
      const alerts = await response.json();
      setRouteConditions({ alerts: alerts.slice(0, 5) });
    } catch (error) {
      console.error('Failed to fetch conditions:', error);
    }
  }

  const totalCost = trip.segments.reduce((sum, seg) => sum + seg.cost[budgetLevel], 0);

  const getSegmentIcon = (segment: TripSegment): React.ReactNode => {
    if (segment.type === 'transport') {
      const details = segment.details as TransportDetails;
      return transportIcons[details.mode] || <Car className="w-5 h-5" />;
    }
    if (segment.type === 'activity') {
      const details = segment.details as ActivityDetails;
      return activityIcons[details.activity_type] || <Star className="w-5 h-5" />;
    }
    if (segment.type === 'meal') {
      return <Utensils className="w-5 h-5" />;
    }
    if (segment.type === 'accommodation') {
      return <BedDouble className="w-5 h-5" />;
    }
    return segmentTypeIcons[segment.type] || <MapPin className="w-5 h-5" />;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
          data-testid="button-back-to-trips"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to all trips
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                {segmentTypeIcons[trip.category as keyof typeof segmentTypeIcons] || <Target className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-trip-title">{trip.title}</h1>
                <p className="text-muted-foreground">{trip.tagline}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {trip.region}
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" /> {trip.duration.recommended_days > 1 ? `${trip.duration.recommended_days} days` : `${trip.duration.min_hours}h`}
              </span>
              <Badge variant="secondary" className={difficultyColors[trip.difficulty]}>
                {trip.difficulty}
              </Badge>
              <span className="text-yellow-500 flex items-center gap-1">
                <Star className="w-4 h-4 fill-current" /> {trip.rating} ({trip.rating_count} reviews)
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-muted-foreground text-sm">Total Estimated Cost</p>
            <p className="text-3xl font-bold text-green-500" data-testid="text-total-cost">${totalCost}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-muted-foreground text-xs uppercase mb-2">Select Your Budget</p>
          <div className="flex gap-2">
            {(['budget', 'moderate', 'comfort'] as BudgetLevel[]).map(level => (
              <Button
                key={level}
                variant={budgetLevel === level ? 'default' : 'secondary'}
                className="flex-1 flex-col h-auto py-3"
                onClick={() => setBudgetLevel(level)}
                data-testid={`button-budget-${level}`}
              >
                <div className="text-lg">
                  {level === 'budget' && <DollarSign className="w-5 h-5" />}
                  {level === 'moderate' && <><DollarSign className="w-4 h-4 inline" /><DollarSign className="w-4 h-4 inline" /></>}
                  {level === 'comfort' && <><DollarSign className="w-3 h-3 inline" /><DollarSign className="w-3 h-3 inline" /><DollarSign className="w-3 h-3 inline" /></>}
                </div>
                <div className="capitalize text-sm">{level}</div>
                <div className="text-xs opacity-80">${trip.estimated_cost[level]}</div>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
          <Target className="w-5 h-5" /> Your Journey
        </h2>

        <div className="relative">
          <div className="absolute top-12 left-0 right-0 h-1 bg-muted z-0" />
          <div className="flex justify-between relative z-10 overflow-x-auto pb-4">
            {trip.segments.map((segment, idx) => (
              <JourneyStep
                key={segment.id}
                segment={segment}
                icon={getSegmentIcon(segment)}
                cost={segment.cost[budgetLevel]}
                isFirst={idx === 0}
                isLast={idx === trip.segments.length - 1}
                isExpanded={expandedSegment === segment.id}
                onClick={() => setExpandedSegment(expandedSegment === segment.id ? null : segment.id)}
                webcamCount={(webcamsBySegment.get(segment.id) || []).length}
              />
            ))}
          </div>
        </div>

        {expandedSegment && (
          <SegmentDetail
            segment={trip.segments.find(s => s.id === expandedSegment)!}
            budgetLevel={budgetLevel}
            webcams={webcamsBySegment.get(expandedSegment) || []}
          />
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5" /> Live Cameras Along Your Route
          <span className="text-muted-foreground text-sm font-normal">({webcams.length} cameras)</span>
        </h3>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {webcamLoading ? (
            <div className="text-muted-foreground text-sm">Loading webcams...</div>
          ) : webcams.length > 0 ? (
            webcams.slice(0, 10).map((webcam, idx) => (
              <WebcamThumbnail key={webcam.id || idx} webcam={webcam} />
            ))
          ) : (
            <div className="text-muted-foreground text-sm">No webcams available for this route</div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
          <Route className="w-5 h-5" /> Current Route Conditions
        </h3>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Cloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
            <div className="text-foreground font-medium">-5C</div>
            <div className="text-muted-foreground text-xs">Light Snow</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Route className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
            <div className="text-foreground font-medium">Clear</div>
            <div className="text-muted-foreground text-xs">Road Status</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
            <div className="text-foreground font-medium">{routeConditions?.alerts?.length || 0}</div>
            <div className="text-muted-foreground text-xs">Active Alerts</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Anchor className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
            <div className="text-foreground font-medium">N/A</div>
            <div className="text-muted-foreground text-xs">Ferry Status</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Budget Breakdown
        </h3>

        <div className="space-y-2">
          {trip.segments.filter(s => s.cost[budgetLevel] > 0).map(segment => (
            <div key={segment.id} className="flex items-center justify-between py-2 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{getSegmentIcon(segment)}</span>
                <span className="text-muted-foreground">{segment.title}</span>
              </div>
              <span className="text-foreground font-medium">${segment.cost[budgetLevel]}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3 text-lg">
            <span className="text-foreground font-semibold">Total</span>
            <span className="text-green-500 font-bold">${totalCost}</span>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button className="flex-1" data-testid="button-share-trip">
          <Share2 className="w-4 h-4 mr-2" /> Share Trip
        </Button>
        <Button variant="secondary" className="flex-1" data-testid="button-add-calendar">
          <Calendar className="w-4 h-4 mr-2" /> Add to Calendar
        </Button>
        <Button variant="secondary" className="flex-1" data-testid="button-save-trip">
          <Bookmark className="w-4 h-4 mr-2" /> Save Trip
        </Button>
      </div>
    </div>
  );
}

interface JourneyStepProps {
  segment: TripSegment;
  icon: React.ReactNode;
  cost: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onClick: () => void;
  webcamCount: number;
}

function JourneyStep({ segment, icon, cost, isExpanded, onClick, webcamCount }: JourneyStepProps) {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div 
      className={`flex flex-col items-center cursor-pointer group min-w-[100px] ${isExpanded ? 'scale-105' : ''} transition-transform`}
      onClick={onClick}
      data-testid={`step-${segment.id}`}
    >
      <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all ${
        isExpanded 
          ? 'bg-primary text-primary-foreground ring-4 ring-primary/30' 
          : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
      }`}>
        {icon}
      </div>

      <div className="mt-2 text-center max-w-[100px]">
        <p className="text-foreground text-xs font-medium truncate">{segment.title.split(' ').slice(0, 2).join(' ')}</p>
        {segment.duration_minutes > 0 && (
          <p className="text-muted-foreground text-xs">{formatDuration(segment.duration_minutes)}</p>
        )}
        {cost > 0 && (
          <p className="text-green-500 text-sm font-medium">${cost}</p>
        )}
      </div>

      {webcamCount > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span>{webcamCount} cams</span>
        </div>
      )}
    </div>
  );
}

interface SegmentDetailProps {
  segment: TripSegment;
  budgetLevel: BudgetLevel;
  webcams: any[];
}

function SegmentDetail({ segment, budgetLevel, webcams }: SegmentDetailProps) {
  const details = segment.details;

  return (
    <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h4 className="text-foreground font-semibold text-lg">{segment.title}</h4>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {segment.location.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-green-500 font-bold text-xl">${segment.cost[budgetLevel]}</p>
          {segment.duration_minutes > 0 && (
            <p className="text-muted-foreground text-sm flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" /> {Math.floor(segment.duration_minutes / 60)}h {segment.duration_minutes % 60}m
            </p>
          )}
        </div>
      </div>

      {details.type === 'transport' && (
        <TransportDetailView details={details as TransportDetails} />
      )}
      {details.type === 'activity' && (
        <ActivityDetailView details={details as ActivityDetails} />
      )}
      {details.type === 'meal' && (
        <MealDetailView details={details as MealDetails} budgetLevel={budgetLevel} />
      )}

      {segment.pro_tips && segment.pro_tips.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <p className="text-yellow-500 text-sm font-medium mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Pro Tips
          </p>
          <ul className="text-muted-foreground text-sm space-y-1">
            {segment.pro_tips.map((tip, idx) => (
              <li key={idx}>- {tip}</li>
            ))}
          </ul>
        </div>
      )}

      {segment.webcam_ids.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground text-sm mb-2 flex items-center gap-2">
            <Camera className="w-4 h-4" /> Live Cameras ({segment.webcam_ids.length})
          </p>
          <div className="flex gap-2 overflow-x-auto">
            {webcams.slice(0, segment.webcam_ids.length).map((cam, idx) => (
              <WebcamThumbnail key={idx} webcam={cam} small />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransportDetailView({ details }: { details: TransportDetails }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {details.route_name && (
        <div className="bg-background rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Route</p>
          <p className="text-foreground">{details.route_name}</p>
        </div>
      )}
      {details.distance_km && (
        <div className="bg-background rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Distance</p>
          <p className="text-foreground">{details.distance_km} km</p>
        </div>
      )}
      {details.fuel_estimate && (
        <div className="bg-background rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Fuel Estimate</p>
          <p className="text-foreground">${details.fuel_estimate}</p>
        </div>
      )}
      {details.parking_cost && (
        <div className="bg-background rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Parking</p>
          <p className="text-foreground">${details.parking_cost}</p>
        </div>
      )}
      {details.operator && (
        <div className="bg-background rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Operator</p>
          <p className="text-foreground">{details.operator}</p>
        </div>
      )}
      {details.fare && (
        <div className="bg-background rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Fare</p>
          <p className="text-foreground">${details.fare}</p>
        </div>
      )}
    </div>
  );
}

function ActivityDetailView({ details }: { details: ActivityDetails }) {
  return (
    <div className="space-y-3">
      {details.provider_name && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{details.provider_name}</span>
          {details.provider_url && (
            <a 
              href={details.provider_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary text-sm hover:underline flex items-center gap-1"
            >
              Visit Website <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      {details.pricing && !details.pricing.free && (
        <div className="grid grid-cols-2 gap-3">
          {details.pricing.adult_price && (
            <div className="bg-background rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Admission</p>
              <p className="text-foreground">${details.pricing.adult_price}</p>
            </div>
          )}
          {details.pricing.rental && (
            <div className="bg-background rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Equipment Rental</p>
              <p className="text-foreground">${details.pricing.rental}</p>
            </div>
          )}
        </div>
      )}
      {details.requirements && details.requirements.length > 0 && (
        <div className="text-muted-foreground text-sm">
          Requirements: {details.requirements.join(', ')}
        </div>
      )}
      {details.reservation_required && (
        <div className="text-yellow-500 text-sm flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" /> Reservation required
        </div>
      )}
    </div>
  );
}

function MealDetailView({ details, budgetLevel }: { details: MealDetails; budgetLevel: BudgetLevel }) {
  return (
    <div className="space-y-2">
      {details.recommendations && (
        <div className="p-3 bg-background rounded-lg">
          <p className="text-muted-foreground text-xs mb-1">Recommended ({budgetLevel})</p>
          <p className="text-foreground">{details.recommendations[budgetLevel]}</p>
        </div>
      )}
    </div>
  );
}

function WebcamThumbnail({ webcam, small = false }: { webcam: any; small?: boolean }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = webcam.metadata?.direct_feed_url 
    ? `${webcam.metadata.direct_feed_url}?t=${Date.now()}`
    : null;

  return (
    <div className={`${small ? 'w-24 h-16' : 'w-40 h-28'} flex-shrink-0 bg-muted rounded-lg overflow-hidden relative`}>
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={webcam.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Camera className="w-6 h-6" />
        </div>
      )}
      <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
        <span className="text-white text-xs">LIVE</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
        <p className="text-white text-xs truncate">{webcam.name}</p>
      </div>
    </div>
  );
}

export default JourneyView;
