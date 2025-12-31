import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RoadTrip, TripCategory, Season, difficultyColors } from '../../types/roadtrips';
import { sampleTrips } from '../../data/sampleTrips';
import { JourneyView } from './JourneyView';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Search, Map, Clock, DollarSign, Star, ChevronRight,
  Snowflake, Mountain, Waves, Wine, Bird, Flame, Ship, Route, Tent, Building,
  Sun, Leaf, TreeDeciduous, CloudSnow, Loader2, CheckCircle, Lock
} from 'lucide-react';

interface TripQualification {
  qualified: boolean;
  gapCount: number;
  gaps: string[];
}

interface RoadTripsTabProps {
  regionId?: string;
}

const categoryIcons: Record<TripCategory, React.ReactNode> = {
  'ski-snowboard': <Snowflake className="w-4 h-4" />,
  'hiking-camping': <Tent className="w-4 h-4" />,
  'beach-coastal': <Waves className="w-4 h-4" />,
  'wine-culinary': <Wine className="w-4 h-4" />,
  'wildlife-nature': <Bird className="w-4 h-4" />,
  'hot-springs': <Flame className="w-4 h-4" />,
  'island-hopping': <Ship className="w-4 h-4" />,
  'scenic-drives': <Route className="w-4 h-4" />,
  'multi-day-trek': <Mountain className="w-4 h-4" />,
  'urban-exploration': <Building className="w-4 h-4" />,
};

const seasonIcons: Record<Season, React.ReactNode> = {
  spring: <TreeDeciduous className="w-3 h-3" />,
  summer: <Sun className="w-3 h-3" />,
  fall: <Leaf className="w-3 h-3" />,
  winter: <CloudSnow className="w-3 h-3" />,
};

function transformDbTrip(dbTrip: any): RoadTrip {
  return {
    id: dbTrip.id,
    title: dbTrip.title,
    tagline: dbTrip.tagline || '',
    description: dbTrip.description || '',
    category: dbTrip.category as TripCategory,
    difficulty: dbTrip.difficulty || 'moderate',
    seasons: dbTrip.seasons || [],
    tags: dbTrip.tags || [],
    duration: {
      min_hours: dbTrip.duration_min_hours || 0,
      max_hours: dbTrip.duration_max_hours || 0,
      recommended_days: dbTrip.recommended_days || 1,
      best_start_time: dbTrip.best_start_time || null,
    },
    region: dbTrip.region || '',
    start_location: {
      name: dbTrip.start_location_name || '',
      latitude: parseFloat(dbTrip.start_location_lat) || 0,
      longitude: parseFloat(dbTrip.start_location_lng) || 0,
    },
    end_location: {
      name: dbTrip.end_location_name || '',
      latitude: parseFloat(dbTrip.end_location_lat) || 0,
      longitude: parseFloat(dbTrip.end_location_lng) || 0,
    },
    estimated_cost: {
      budget: dbTrip.cost_budget || 0,
      moderate: dbTrip.cost_moderate || 0,
      comfort: dbTrip.cost_comfort || 0,
    },
    rating: parseFloat(dbTrip.rating) || 0,
    rating_count: dbTrip.rating_count || 0,
    segments: (dbTrip.segments || []).map((seg: any) => ({
      id: seg.id,
      type: seg.segment_type,
      title: seg.title,
      location: {
        name: seg.location_name || '',
        latitude: parseFloat(seg.location_lat) || 0,
        longitude: parseFloat(seg.location_lng) || 0,
      },
      duration_minutes: seg.duration_minutes || 0,
      cost: {
        budget: seg.cost_budget || 0,
        moderate: seg.cost_moderate || 0,
        comfort: seg.cost_comfort || 0,
      },
      details: seg.details || {},
      pro_tips: seg.pro_tips || [],
      webcam_ids: seg.webcam_ids || [],
      road_segments: seg.road_segments || [],
    })),
  };
}

export function RoadTripsTab({ regionId }: RoadTripsTabProps) {
  const { data: tripsData, isLoading } = useQuery<{ trips: any[] }>({
    queryKey: ['/api/v1/trips'],
  });
  
  const trips = useMemo(() => {
    if (!tripsData?.trips) return sampleTrips;
    return tripsData.trips.map(transformDbTrip);
  }, [tripsData]);

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TripCategory | 'all'>('all');
  const [selectedSeason, setSelectedSeason] = useState<Season | 'all'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'duration' | 'cost'>('popular');
  const [qualifications, setQualifications] = useState<Record<string, TripQualification>>({});
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentParticipant();
  }, []);

  async function loadCurrentParticipant() {
    try {
      const stored = localStorage.getItem('tripPlanning_participantId');
      if (stored) {
        setParticipantId(stored);
        loadQualifications(stored);
      }
    } catch (error) {
      console.error('Error loading participant:', error);
    }
  }

  async function loadQualifications(pid: string) {
    try {
      const response = await fetch(`/api/v1/planning/participants/${pid}/trip-qualifications`);
      if (response.ok) {
        const data = await response.json();
        setQualifications(data.qualifications || {});
      }
    } catch (error) {
      console.error('Error loading qualifications:', error);
    }
  }
  
  // Fetch full trip details with segments when a trip is selected
  const { data: tripDetailData, isLoading: isLoadingDetail } = useQuery<any>({
    queryKey: ['/api/v1/trips', selectedTripId],
    enabled: !!selectedTripId,
  });
  
  const selectedTrip = useMemo(() => {
    if (!tripDetailData) return null;
    return transformDbTrip(tripDetailData);
  }, [tripDetailData]);

  const filteredTrips = useMemo(() => {
    let filtered = trips;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.tagline.toLowerCase().includes(query) ||
        t.region.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (selectedSeason !== 'all') {
      filtered = filtered.filter(t => t.seasons.includes(selectedSeason));
    }

    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating;
        case 'duration': return a.duration.min_hours - b.duration.min_hours;
        case 'cost': return a.estimated_cost.budget - b.estimated_cost.budget;
        default: return b.rating_count - a.rating_count;
      }
    });

    return filtered;
  }, [trips, searchQuery, selectedCategory, selectedSeason, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: trips.length };
    trips.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [trips]);

  if (selectedTripId) {
    if (isLoadingDetail || !selectedTrip) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading trip details...</span>
        </div>
      );
    }
    return (
      <JourneyView 
        trip={selectedTrip} 
        onBack={() => setSelectedTripId(null)} 
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-road-trips-title">
              <Map className="w-5 h-5" />
              BC Road Trips
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredTrips.length} trips)
              </span>
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Curated adventures with live conditions and webcams
            </p>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border"
            data-testid="select-sort-trips"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="duration">Shortest First</option>
            <option value="cost">Lowest Cost</option>
          </select>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search trips by name, region, or activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-trips"
          />
        </div>

        <div className="mt-4">
          <p className="text-muted-foreground text-xs uppercase mb-2">Filter by Category</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              data-testid="button-category-all"
            >
              All ({categoryCounts.all})
            </Button>
            {(Object.keys(categoryIcons) as TripCategory[]).map((cat) => (
              categoryCounts[cat] > 0 && (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="capitalize"
                  data-testid={`button-category-${cat}`}
                >
                  {categoryIcons[cat]}
                  <span className="ml-1">{cat.replace(/-/g, ' ')}</span>
                  <span className="ml-1">({categoryCounts[cat]})</span>
                </Button>
              )
            ))}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-muted-foreground text-xs uppercase mb-2">Season</p>
          <div className="flex gap-2">
            <Button
              variant={selectedSeason === 'all' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSelectedSeason('all')}
              data-testid="button-season-all"
            >
              All
            </Button>
            {(['winter', 'spring', 'summer', 'fall'] as Season[]).map(season => (
              <Button
                key={season}
                variant={selectedSeason === season ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedSeason(season)}
                className="capitalize"
                data-testid={`button-season-${season}`}
              >
                {seasonIcons[season]}
                <span className="ml-1">{season}</span>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {filteredTrips.map(trip => (
          <TripCard
            key={trip.id}
            trip={trip}
            qualification={qualifications[trip.id]}
            onClick={() => setSelectedTripId(trip.id)}
          />
        ))}
      </div>

      {filteredTrips.length === 0 && (
        <Card className="p-12 text-center">
          <Map className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">No trips match your filters</p>
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedSeason('all');
            }}
            className="mt-4 text-primary"
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
        </Card>
      )}
    </div>
  );
}

interface TripCardProps {
  trip: RoadTrip;
  qualification?: TripQualification;
  onClick: () => void;
}

function TripCard({ trip, qualification, onClick }: TripCardProps) {
  const formatDuration = () => {
    if (trip.duration.recommended_days > 1) {
      return `${trip.duration.recommended_days} days`;
    }
    return `${trip.duration.min_hours}h`;
  };

  return (
    <Card
      onClick={onClick}
      className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group relative"
      data-testid={`card-trip-${trip.id}`}
    >
      {qualification && (
        <div className="absolute top-3 right-3 z-10">
          {qualification.qualified ? (
            <Badge variant="default" className="bg-green-500/80 text-white backdrop-blur-sm" data-testid={`badge-qualified-${trip.id}`}>
              <CheckCircle className="w-3 h-3 mr-1" /> Ready
            </Badge>
          ) : (
            <Badge 
              variant="secondary" 
              className="bg-orange-500/30 text-orange-400 backdrop-blur-sm" 
              title={`Need: ${qualification.gaps.join(', ')}`}
              data-testid={`badge-unqualified-${trip.id}`}
            >
              <Lock className="w-3 h-3 mr-1" /> {qualification.gapCount} skill{qualification.gapCount !== 1 ? 's' : ''} needed
            </Badge>
          )}
        </div>
      )}
      <div className="flex">
        <div className="w-48 h-36 bg-gradient-to-br from-muted to-muted/50 flex-shrink-0 flex items-center justify-center">
          <span className="text-4xl text-muted-foreground">
            {categoryIcons[trip.category]}
          </span>
        </div>

        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-muted-foreground">{categoryIcons[trip.category]}</span>
                <span className="text-xs text-muted-foreground capitalize">{trip.category.replace(/-/g, ' ')}</span>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-xs text-muted-foreground">{trip.region}</span>
                <span className="text-muted-foreground/50">|</span>
                <span className="flex gap-1">
                  {trip.seasons.map(s => (
                    <span key={s} className="text-muted-foreground">{seasonIcons[s]}</span>
                  ))}
                </span>
              </div>

              <h3 className="text-foreground font-semibold text-lg group-hover:text-primary transition-colors">
                {trip.title}
              </h3>

              <p className="text-muted-foreground text-sm mt-1">{trip.tagline}</p>

              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {formatDuration()}
                </span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" /> From ${trip.estimated_cost.budget}
                </span>
                <Badge variant="secondary" className={difficultyColors[trip.difficulty]}>
                  {trip.difficulty}
                </Badge>
                <span className="text-sm text-yellow-500 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-current" /> {trip.rating} ({trip.rating_count})
                </span>
              </div>
            </div>

            <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default RoadTripsTab;
