import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Bed, Car, Plug, Droplets, Users, Home, Truck,
  Calendar, DollarSign, Star, Grid, List, Wifi, Dog, Coffee,
  Waves, Flame, UtensilsCrossed, Shirt, TreePine, Ship, Briefcase,
  ChevronDown, ChevronUp, X, MapPin, ExternalLink
} from 'lucide-react';

const AMENITIES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; category: string }> = {
  has_wifi: { label: 'WiFi', icon: Wifi, category: 'essentials' },
  has_kitchen: { label: 'Kitchen', icon: UtensilsCrossed, category: 'essentials' },
  has_laundry: { label: 'Laundry', icon: Shirt, category: 'essentials' },
  bedding_provided: { label: 'Bedding Provided', icon: Bed, category: 'essentials' },
  has_hot_tub: { label: 'Hot Tub', icon: Waves, category: 'comfort' },
  has_pool: { label: 'Pool', icon: Waves, category: 'comfort' },
  has_bbq_grills: { label: 'BBQ/Grill', icon: Flame, category: 'comfort' },
  has_fire_pits: { label: 'Fire Pit', icon: Flame, category: 'comfort' },
  has_coffee_maker: { label: 'Coffee Maker', icon: Coffee, category: 'comfort' },
  is_waterfront: { label: 'Waterfront', icon: Waves, category: 'outdoor' },
  has_boat_launch: { label: 'Boat Launch', icon: Ship, category: 'outdoor' },
  has_hiking_trails: { label: 'Hiking Trails', icon: TreePine, category: 'outdoor' },
  has_fishing: { label: 'Fishing', icon: Ship, category: 'outdoor' },
  has_kayak_rental: { label: 'Kayak Rental', icon: Ship, category: 'outdoor' },
  pets_allowed: { label: 'Pets Allowed', icon: Dog, category: 'pets' },
  has_dog_park: { label: 'Dog Park', icon: Dog, category: 'pets' },
  has_playground: { label: 'Playground', icon: Users, category: 'family' },
  has_shore_power: { label: 'Shore Power', icon: Plug, category: 'rv' },
  has_water_hookup: { label: 'Water Hookup', icon: Droplets, category: 'rv' },
  has_sewer_hookup: { label: 'Sewer Hookup', icon: Droplets, category: 'rv' },
  has_dump_station: { label: 'Dump Station', icon: Droplets, category: 'rv' },
  has_propane_refill: { label: 'Propane Refill', icon: Flame, category: 'rv' },
  has_workspace: { label: 'Workspace', icon: Briefcase, category: 'work' },
  long_term_ok: { label: 'Long Term OK', icon: Calendar, category: 'work' },
  crew_friendly: { label: 'Crew Friendly', icon: Users, category: 'work' },
};

interface SearchFilters {
  searchMode: 'browse' | 'work_order';
  nearLocation: string;
  radiusKm: number;
  startDate: string;
  endDate: string;
  totalPeople: number;
  privateBedroomsNeeded: number;
  vehicleSituation: 'none' | 'has_trailer' | 'needs_rental' | 'needs_spot';
  trailerLengthFt: number;
  maxDailyRate: number | null;
  selectedAmenities: string[];
  includeProperties: boolean;
  includeSpots: boolean;
  includeTrailers: boolean;
  workOrderId: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  asset_type: string;
  source_table: string;
  city: string | null;
  region: string | null;
  thumbnail_url: string | null;
  rate_daily: number | null;
  sleeps_total: number | null;
  overall_rating: number | null;
  review_count: number | null;
  crew_score: number | null;
  capabilities: Array<{ type: string; attrs: Record<string, unknown> }> | null;
  distance_km: number | null;
}

export default function AccommodationSearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    searchMode: 'browse',
    nearLocation: '',
    radiusKm: 50,
    startDate: '',
    endDate: '',
    totalPeople: 1,
    privateBedroomsNeeded: 0,
    vehicleSituation: 'none',
    trailerLengthFt: 25,
    maxDailyRate: null,
    selectedAmenities: [],
    includeProperties: true,
    includeSpots: true,
    includeTrailers: true,
    workOrderId: null,
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: results, isLoading, refetch, isFetched } = useQuery<{ results: SearchResult[]; total: number }>({
    queryKey: ['/api/crew/accommodation-search', filters],
    queryFn: async () => {
      const response = await fetch('/api/crew/accommodation-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: false,
  });

  const { data: workOrders } = useQuery<Array<{ id: string; work_order_ref: string; title: string }>>({
    queryKey: ['/api/crew/work-orders'],
  });

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleAmenity = (amenity: string) => {
    setFilters(prev => ({
      ...prev,
      selectedAmenities: prev.selectedAmenities.includes(amenity)
        ? prev.selectedAmenities.filter(a => a !== amenity)
        : [...prev.selectedAmenities, amenity]
    }));
  };

  const clearAmenities = () => {
    setFilters(prev => ({ ...prev, selectedAmenities: [] }));
  };

  const handleSearch = () => {
    refetch();
  };

  const renderAmenityCategory = (category: string, label: string) => (
    <div key={category}>
      <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(AMENITIES)
          .filter(([_, def]) => def.category === category)
          .map(([key, def]) => (
            <Button
              key={key}
              variant={filters.selectedAmenities.includes(key) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleAmenity(key)}
              className="flex items-center gap-1"
              data-testid={`button-amenity-${key}`}
            >
              <def.icon className="w-3 h-3" />
              {def.label}
            </Button>
          ))}
      </div>
    </div>
  );

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'property': return <Home className="w-4 h-4" />;
      case 'spot': return <Car className="w-4 h-4" />;
      case 'trailer': return <Truck className="w-4 h-4" />;
      default: return <Bed className="w-4 h-4" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'external_records': return 'Airbnb/VRBO';
      case 'cc_staging_properties': return 'Direct';
      case 'trailer_profiles': return 'Trailer';
      case 'cc_rental_items': return 'Equipment';
      default: return source;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Find Crew Accommodation</h1>
        <p className="text-muted-foreground">
          Search across Airbnb, RV parks, campgrounds, trailers - everything in one place
        </p>
      </div>

      <Tabs 
        value={filters.searchMode} 
        onValueChange={(v) => updateFilter('searchMode', v as 'browse' | 'work_order')}
        className="mb-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="browse" className="flex items-center gap-2" data-testid="tab-browse">
            <Search className="w-4 h-4" />
            Browse & Filter
          </TabsTrigger>
          <TabsTrigger value="work_order" className="flex items-center gap-2" data-testid="tab-work-order">
            <Briefcase className="w-4 h-4" />
            Match to Work Order
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Input
                    placeholder="City or community"
                    value={filters.nearLocation}
                    onChange={(e) => updateFilter('nearLocation', e.target.value)}
                    data-testid="input-location"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Within</span>
                    <Select 
                      value={filters.radiusKm.toString()}
                      onValueChange={(v) => updateFilter('radiusKm', parseInt(v))}
                    >
                      <SelectTrigger className="w-24 h-8" data-testid="select-radius">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 km</SelectItem>
                        <SelectItem value="25">25 km</SelectItem>
                        <SelectItem value="50">50 km</SelectItem>
                        <SelectItem value="100">100 km</SelectItem>
                        <SelectItem value="200">200 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Dates</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => updateFilter('startDate', e.target.value)}
                      className="text-sm"
                      data-testid="input-start-date"
                    />
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => updateFilter('endDate', e.target.value)}
                      className="text-sm"
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Crew Size</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={filters.totalPeople}
                        onChange={(e) => updateFilter('totalPeople', parseInt(e.target.value) || 1)}
                        className="w-16"
                        data-testid="input-crew-size"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Private BR:</span>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={filters.privateBedroomsNeeded}
                        onChange={(e) => updateFilter('privateBedroomsNeeded', parseInt(e.target.value) || 0)}
                        className="w-14"
                        data-testid="input-bedrooms"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Max Price/Night</label>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Any"
                      value={filters.maxDailyRate || ''}
                      onChange={(e) => updateFilter('maxDailyRate', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-24"
                      data-testid="input-max-price"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <label className="text-sm font-medium mb-3 block">Vehicle Situation</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'none', label: 'No trailer/RV', icon: Home },
                    { value: 'has_trailer', label: 'I have a trailer/RV', icon: Truck },
                    { value: 'needs_rental', label: 'Need to rent RV', icon: Truck },
                    { value: 'needs_spot', label: 'Just need parking spot', icon: Car },
                  ].map(option => (
                    <Button
                      key={option.value}
                      variant={filters.vehicleSituation === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateFilter('vehicleSituation', option.value as SearchFilters['vehicleSituation'])}
                      className="flex items-center gap-2"
                      data-testid={`button-vehicle-${option.value}`}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </Button>
                  ))}
                </div>
                {filters.vehicleSituation === 'has_trailer' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm">Trailer length:</span>
                    <Input
                      type="number"
                      value={filters.trailerLengthFt}
                      onChange={(e) => updateFilter('trailerLengthFt', parseInt(e.target.value) || 20)}
                      className="w-20"
                      data-testid="input-trailer-length"
                    />
                    <span className="text-sm">ft</span>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <label className="text-sm font-medium">Amenities & Features</label>
                  {filters.selectedAmenities.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAmenities} data-testid="button-clear-amenities">
                      Clear all ({filters.selectedAmenities.length})
                    </Button>
                  )}
                </div>
                
                {filters.selectedAmenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {filters.selectedAmenities.map(amenity => {
                      const def = AMENITIES[amenity];
                      if (!def) return null;
                      const Icon = def.icon;
                      return (
                        <Badge 
                          key={amenity} 
                          variant="secondary"
                          className="flex items-center gap-1 cursor-pointer"
                          onClick={() => toggleAmenity(amenity)}
                          data-testid={`badge-amenity-${amenity}`}
                        >
                          <Icon className="w-3 h-3" />
                          {def.label}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-4">
                  {renderAmenityCategory('essentials', 'Essentials')}
                  {renderAmenityCategory('comfort', 'Comfort')}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="flex items-center gap-1"
                    data-testid="button-toggle-advanced"
                  >
                    {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showAdvancedFilters ? 'Less filters' : 'More filters (Outdoor, RV, Work)'}
                  </Button>

                  {showAdvancedFilters && (
                    <>
                      {renderAmenityCategory('outdoor', 'Outdoor')}
                      {renderAmenityCategory('pets', 'Pets & Family')}
                      {renderAmenityCategory('rv', 'RV & Camping')}
                      {renderAmenityCategory('work', 'Work & Crew')}
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="lg" onClick={handleSearch} className="px-8" data-testid="button-search">
                  <Search className="w-5 h-5 mr-2" />
                  Search Accommodation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work_order">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Work Order</label>
                  <Select
                    value={filters.workOrderId || ''}
                    onValueChange={(v) => updateFilter('workOrderId', v || null)}
                  >
                    <SelectTrigger className="w-full max-w-md" data-testid="select-work-order">
                      <SelectValue placeholder="Choose a work order to find matching accommodation" />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrders?.map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {wo.work_order_ref} - {wo.title}
                        </SelectItem>
                      ))}
                      {(!workOrders || workOrders.length === 0) && (
                        <SelectItem value="__EMPTY__" disabled>No active work orders</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {filters.workOrderId && (
                  <div className="p-4 bg-blue-500/10 dark:bg-blue-400/10 rounded-lg border border-blue-500/20">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      This will find accommodation that fulfills all requirements defined in the work order,
                      including crew size, weather window, and location constraints.
                    </p>
                  </div>
                )}

                <Button size="lg" onClick={handleSearch} disabled={!filters.workOrderId} data-testid="button-match-work-order">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Find Matching Accommodation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isFetched && results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground" data-testid="text-result-count">
              Found {results.total} accommodation{results.total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {results.results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or expanding the search radius
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.results.map((asset) => (
                <Card key={asset.id} className="overflow-hidden hover-elevate" data-testid={`card-asset-${asset.id}`}>
                  <div className="relative">
                    {asset.thumbnail_url ? (
                      <img 
                        src={asset.thumbnail_url} 
                        alt={asset.name}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="h-48 w-full bg-muted flex items-center justify-center">
                        {getAssetTypeIcon(asset.asset_type)}
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2" variant="secondary">
                      {getSourceLabel(asset.source_table)}
                    </Badge>
                    {asset.crew_score && asset.crew_score >= 70 && (
                      <Badge className="absolute top-2 right-2 bg-green-600">
                        Crew Friendly
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium line-clamp-2 mb-1" data-testid={`text-asset-name-${asset.id}`}>
                      {asset.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {asset.city || 'Unknown'}{asset.region ? `, ${asset.region}` : ''}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {asset.sleeps_total && asset.sleeps_total > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Sleeps {asset.sleeps_total}
                        </Badge>
                      )}
                      {asset.capabilities?.some(c => c.type === 'parking') && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          Parking
                        </Badge>
                      )}
                      {asset.capabilities?.some(c => c.type === 'power_supply') && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Plug className="w-3 h-3" />
                          Power
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        {asset.overall_rating && (
                          <span className="flex items-center gap-1 text-sm">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {asset.overall_rating.toFixed(1)}
                            {asset.review_count && (
                              <span className="text-muted-foreground">({asset.review_count})</span>
                            )}
                          </span>
                        )}
                        {asset.distance_km && (
                          <span className="text-sm text-muted-foreground">
                            {asset.distance_km.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      {asset.rate_daily && (
                        <span className="font-semibold">
                          ${asset.rate_daily}/night
                        </span>
                      )}
                    </div>

                    <Button variant="outline" size="sm" className="w-full mt-3" data-testid={`button-view-${asset.id}`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {results.results.map((asset) => (
                <Card key={asset.id} className="hover-elevate" data-testid={`row-asset-${asset.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-24 h-24 flex-shrink-0">
                        {asset.thumbnail_url ? (
                          <img 
                            src={asset.thumbnail_url} 
                            alt={asset.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                            {getAssetTypeIcon(asset.asset_type)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h3 className="font-medium">{asset.name}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {asset.city || 'Unknown'}{asset.region ? `, ${asset.region}` : ''}
                              {asset.distance_km && ` (${asset.distance_km.toFixed(1)} km)`}
                            </p>
                          </div>
                          <div className="text-right">
                            {asset.rate_daily && (
                              <span className="font-semibold">${asset.rate_daily}/night</span>
                            )}
                            {asset.overall_rating && (
                              <p className="text-sm flex items-center gap-1 justify-end">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                {asset.overall_rating.toFixed(1)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary">{getSourceLabel(asset.source_table)}</Badge>
                          {asset.sleeps_total && asset.sleeps_total > 0 && (
                            <Badge variant="outline">Sleeps {asset.sleeps_total}</Badge>
                          )}
                          {asset.crew_score && asset.crew_score >= 70 && (
                            <Badge className="bg-green-600">Crew Friendly</Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-view-list-${asset.id}`}>
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
