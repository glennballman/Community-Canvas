// Road Trip Types

export interface RoadTrip {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: TripCategory;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'expert';
  seasons: Season[];
  tags: string[];
  duration: {
    min_hours: number;
    max_hours: number;
    recommended_days: number;
    best_start_time?: string;
  };
  region: string;
  start_location: Location;
  end_location: Location;
  segments: TripSegment[];
  estimated_cost: {
    budget: number;
    moderate: number;
    comfort: number;
  };
  hero_image?: string;
  rating: number;
  rating_count: number;
}

export type TripCategory = 
  | 'ski-snowboard' | 'hiking-camping' | 'beach-coastal' | 'wine-culinary'
  | 'wildlife-nature' | 'hot-springs' | 'island-hopping' | 'scenic-drives'
  | 'multi-day-trek' | 'urban-exploration';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface TripSegment {
  id: string;
  order: number;
  type: SegmentType;
  title: string;
  location: Location;
  duration_minutes: number;
  cost: { budget: number; moderate: number; comfort: number };
  details: TransportDetails | ActivityDetails | AccommodationDetails | MealDetails;
  webcam_ids: number[];
  weather_station_id?: string;
  road_segments?: string[];
  pro_tips?: string[];
}

export type SegmentType = 'departure' | 'transport' | 'activity' | 'accommodation' | 'meal' | 'photo-stop' | 'arrival';

export interface TransportDetails {
  type: 'transport';
  mode: 'drive' | 'ferry' | 'bus' | 'train' | 'flight' | 'water-taxi' | 'walk' | 'bike';
  route_name?: string;
  distance_km?: number;
  highway_numbers?: string[];
  operator?: string;
  fare?: number;
  fuel_estimate?: number;
  parking_cost?: number;
}

export interface ActivityDetails {
  type: 'activity';
  activity_type: string;
  provider_name?: string;
  provider_url?: string;
  pricing: { free: boolean; adult_price?: number; rental?: number };
  requirements?: string[];
  reservation_required?: boolean;
}

export interface AccommodationDetails {
  type: 'accommodation';
  accommodation_type: 'hostel' | 'hotel' | 'cabin' | 'campground' | 'rv-park';
  provider_name?: string;
  provider_url?: string;
  amenities?: string[];
}

export interface MealDetails {
  type: 'meal';
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'drinks';
  recommendations?: { budget: string; moderate: string; comfort: string };
}

export const difficultyColors: Record<string, string> = {
  easy: 'text-green-400 bg-green-500/20',
  moderate: 'text-yellow-400 bg-yellow-500/20',
  challenging: 'text-orange-400 bg-orange-500/20',
  expert: 'text-red-400 bg-red-500/20',
};
