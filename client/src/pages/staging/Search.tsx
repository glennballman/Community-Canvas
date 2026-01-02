import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Search, MapPin, Calendar, Truck, Filter, Star, 
  Loader2, ChevronLeft, ChevronRight, Wifi, Droplets,
  Zap, ShowerHead, Dog, Wrench, TreePine
} from 'lucide-react';

interface StagingProperty {
  id: number;
  canvasId: string;
  name: string;
  propertyType: string;
  region: string;
  city: string;
  thumbnailUrl: string | null;
  crewScore: number;
  rvScore: number;
  truckerScore: number;
  equestrianScore: number;
  totalSpots: number;
  overallRating: string | null;
  reviewCount: number;
  baseNightlyRate?: string;
  hasWifi: boolean;
  hasShowers: boolean;
  hasPower: boolean;
  petsAllowed: boolean;
  isHorseFriendly: boolean;
  acceptsSemiTrucks: boolean;
}

interface SearchFilters {
  query: string;
  region: string;
  checkIn: string;
  checkOut: string;
  vehicleLength: number;
  propertyTypes: string[];
  pullThrough: boolean;
  power: string;
  water: boolean;
  sewer: boolean;
  bathrooms: boolean;
  showers: boolean;
  laundry: boolean;
  wifi: boolean;
  petFriendly: boolean;
  horseFriendly: boolean;
  acceptsTrucks: boolean;
  hasOnSiteMechanic: boolean;
  priceMin: number;
  priceMax: number;
  minRating: number;
  sortBy: string;
  page: number;
}

const defaultFilters: SearchFilters = {
  query: '',
  region: '',
  checkIn: '',
  checkOut: '',
  vehicleLength: 0,
  propertyTypes: [],
  pullThrough: false,
  power: 'any',
  water: false,
  sewer: false,
  bathrooms: false,
  showers: false,
  laundry: false,
  wifi: false,
  petFriendly: false,
  horseFriendly: false,
  acceptsTrucks: false,
  hasOnSiteMechanic: false,
  priceMin: 0,
  priceMax: 500,
  minRating: 0,
  sortBy: 'best_match',
  page: 1
};

const propertyTypes = [
  { value: 'rv_park', label: 'RV Park' },
  { value: 'campground', label: 'Campground' },
  { value: 'truck_stop', label: 'Truck Stop' },
  { value: 'equestrian', label: 'Equestrian' },
  { value: 'boondocking', label: 'Boondocking' },
  { value: 'farm_stay', label: 'Farm Stay' }
];

const regions = [
  'Vancouver Metro', 'Vancouver Island', 'Okanagan', 'Kootenays',
  'Thompson-Nicola', 'Cariboo', 'Northern BC', 'Sunshine Coast',
  'Sea to Sky', 'Fraser Valley'
];

function FilterPanel({ filters, setFilters }: { filters: SearchFilters; setFilters: (f: SearchFilters) => void }) {
  const togglePropertyType = (type: string) => {
    const types = filters.propertyTypes.includes(type)
      ? filters.propertyTypes.filter(t => t !== type)
      : [...filters.propertyTypes, type];
    setFilters({ ...filters, propertyTypes: types, page: 1 });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Property Type</h3>
        <div className="space-y-2">
          {propertyTypes.map(type => (
            <div key={type.value} className="flex items-center gap-2">
              <Checkbox
                id={type.value}
                checked={filters.propertyTypes.includes(type.value)}
                onCheckedChange={() => togglePropertyType(type.value)}
              />
              <Label htmlFor={type.value} className="font-normal cursor-pointer">{type.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Vehicle Requirements</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Max Length: {filters.vehicleLength || 'Any'}ft</Label>
            <Slider
              value={[filters.vehicleLength]}
              onValueChange={([v]) => setFilters({ ...filters, vehicleLength: v, page: 1 })}
              max={80}
              step={5}
              className="mt-2"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-normal">Pull-through required</Label>
            <Switch
              checked={filters.pullThrough}
              onCheckedChange={(c) => setFilters({ ...filters, pullThrough: c, page: 1 })}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Hookups</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Power</Label>
            <Select value={filters.power} onValueChange={(v) => setFilters({ ...filters, power: v, page: 1 })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="30">30 Amp</SelectItem>
                <SelectItem value="50">50 Amp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.water} onCheckedChange={(c) => setFilters({ ...filters, water: c === true, page: 1 })} />
            <Label className="font-normal">Water hookup</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.sewer} onCheckedChange={(c) => setFilters({ ...filters, sewer: c === true, page: 1 })} />
            <Label className="font-normal">Sewer hookup</Label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Amenities</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.bathrooms} onCheckedChange={(c) => setFilters({ ...filters, bathrooms: c === true, page: 1 })} />
            <Label className="font-normal">Bathrooms</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.showers} onCheckedChange={(c) => setFilters({ ...filters, showers: c === true, page: 1 })} />
            <Label className="font-normal">Showers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.laundry} onCheckedChange={(c) => setFilters({ ...filters, laundry: c === true, page: 1 })} />
            <Label className="font-normal">Laundry</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.wifi} onCheckedChange={(c) => setFilters({ ...filters, wifi: c === true, page: 1 })} />
            <Label className="font-normal">WiFi</Label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Special Features</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.petFriendly} onCheckedChange={(c) => setFilters({ ...filters, petFriendly: c === true, page: 1 })} />
            <Label className="font-normal">Dog friendly</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.horseFriendly} onCheckedChange={(c) => setFilters({ ...filters, horseFriendly: c === true, page: 1 })} />
            <Label className="font-normal">Horse friendly</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.acceptsTrucks} onCheckedChange={(c) => setFilters({ ...filters, acceptsTrucks: c === true, page: 1 })} />
            <Label className="font-normal">Accepts semi trucks</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filters.hasOnSiteMechanic} onCheckedChange={(c) => setFilters({ ...filters, hasOnSiteMechanic: c === true, page: 1 })} />
            <Label className="font-normal text-green-600 dark:text-green-400">On-site mechanic!</Label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Price Range</h3>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            ${filters.priceMin} - ${filters.priceMax === 500 ? '500+' : filters.priceMax}
          </Label>
          <Slider
            value={[filters.priceMin, filters.priceMax]}
            onValueChange={([min, max]) => setFilters({ ...filters, priceMin: min, priceMax: max, page: 1 })}
            max={500}
            step={10}
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Minimum Rating</h3>
        <div className="flex items-center gap-2">
          {[0, 3, 3.5, 4, 4.5].map(rating => (
            <Button
              key={rating}
              variant={filters.minRating === rating ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilters({ ...filters, minRating: rating, page: 1 })}
            >
              {rating === 0 ? 'Any' : `${rating}+`}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: StagingProperty }) {
  return (
    <Link href={`/staging/${property.id}`}>
      <Card className="overflow-hidden hover-elevate cursor-pointer" data-testid={`card-property-${property.id}`}>
        <div className="aspect-video bg-muted relative">
          {property.thumbnailUrl ? (
            <img src={property.thumbnailUrl} alt={property.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <TreePine className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {property.baseNightlyRate && (
            <div className="absolute bottom-2 right-2 bg-background/90 px-2 py-1 rounded text-sm font-medium">
              ${parseFloat(property.baseNightlyRate).toFixed(0)}/night
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-1 line-clamp-1" data-testid={`text-property-name-${property.id}`}>
            {property.name}
          </h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <MapPin className="h-3 w-3" />
            <span>{property.city || property.region}</span>
          </div>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {property.crewScore > 0 && <Badge className="bg-orange-500 text-xs">Crew {property.crewScore}</Badge>}
            {property.rvScore > 0 && <Badge className="bg-green-500 text-xs">RV {property.rvScore}</Badge>}
            {property.truckerScore > 0 && <Badge className="bg-blue-500 text-xs">Trucker {property.truckerScore}</Badge>}
            {property.equestrianScore > 0 && <Badge className="bg-amber-500 text-xs">Horse {property.equestrianScore}</Badge>}
          </div>
          
          <div className="flex flex-wrap gap-2 text-muted-foreground">
            {property.hasWifi && <Wifi className="h-4 w-4" />}
            {property.hasPower && <Zap className="h-4 w-4" />}
            {property.hasShowers && <ShowerHead className="h-4 w-4" />}
            {property.petsAllowed && <Dog className="h-4 w-4" />}
          </div>
          
          {property.overallRating && (
            <div className="flex items-center gap-1 mt-3 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{parseFloat(property.overallRating).toFixed(1)}</span>
              <span className="text-muted-foreground">({property.reviewCount})</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function StagingSearch() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (filters.query) params.set('city', filters.query);
    if (filters.region) params.set('region', filters.region);
    if (filters.propertyTypes.length) params.set('propertyType', filters.propertyTypes[0]);
    if (filters.vehicleLength) params.set('vehicleLengthFt', filters.vehicleLength.toString());
    if (filters.pullThrough) params.set('needsPullThrough', 'true');
    if (filters.petFriendly) params.set('dogsAllowed', 'true');
    if (filters.horseFriendly) params.set('isHorseFriendly', 'true');
    if (filters.acceptsTrucks) params.set('acceptsSemi', 'true');
    if (filters.wifi) params.set('hasWifi', 'true');
    if (filters.showers) params.set('hasShowers', 'true');
    if (filters.laundry) params.set('hasLaundry', 'true');
    params.set('sortBy', filters.sortBy);
    params.set('limit', '50');
    params.set('offset', ((filters.page - 1) * 50).toString());
    return params.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['/api/staging/search', buildSearchParams()],
    queryFn: async () => {
      const res = await fetch(`/api/staging/search?${buildSearchParams()}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, page: 1 });
  };

  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-2" data-testid="text-hero-title">
            Find Your Perfect Spot
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            RV parks, campgrounds, truck stops, and equestrian facilities across BC
          </p>
          
          <form onSubmit={handleSearch} className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-3 items-end justify-center">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-sm mb-1 block">Location</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="City or region..."
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                    className="pl-9"
                    data-testid="input-search-query"
                  />
                </div>
              </div>
              <div className="w-40">
                <Label className="text-sm mb-1 block">Check In</Label>
                <Input
                  type="date"
                  value={filters.checkIn}
                  onChange={(e) => setFilters({ ...filters, checkIn: e.target.value })}
                  data-testid="input-check-in"
                />
              </div>
              <div className="w-40">
                <Label className="text-sm mb-1 block">Check Out</Label>
                <Input
                  type="date"
                  value={filters.checkOut}
                  onChange={(e) => setFilters({ ...filters, checkOut: e.target.value })}
                  data-testid="input-check-out"
                />
              </div>
              <div className="w-32">
                <Label className="text-sm mb-1 block">Length (ft)</Label>
                <Input
                  type="number"
                  placeholder="40"
                  value={filters.vehicleLength || ''}
                  onChange={(e) => setFilters({ ...filters, vehicleLength: parseInt(e.target.value) || 0 })}
                  data-testid="input-vehicle-length"
                />
              </div>
              <Button type="submit" size="lg" data-testid="button-search">
                <Search className="h-4 w-4 mr-2" /> Search
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
              </h2>
              <FilterPanel filters={filters} setFilters={setFilters} />
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="lg:hidden" data-testid="button-mobile-filters">
                      <Filter className="h-4 w-4 mr-2" /> Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 overflow-y-auto">
                    <h2 className="font-semibold mb-4">Filters</h2>
                    <FilterPanel filters={filters} setFilters={setFilters} />
                  </SheetContent>
                </Sheet>
                
                <p className="text-sm text-muted-foreground" data-testid="text-results-count">
                  {isLoading ? 'Searching...' : `${data?.total || 0} properties found`}
                </p>
              </div>

              <Select value={filters.sortBy} onValueChange={(v) => setFilters({ ...filters, sortBy: v, page: 1 })}>
                <SelectTrigger className="w-48" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best_match">Best Match</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="crew_score">Crew Score</SelectItem>
                  <SelectItem value="rv_score">RV Score</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : data?.properties?.length === 0 ? (
              <div className="text-center py-12">
                <TreePine className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No properties match your search criteria</p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data?.properties?.map((property: StagingProperty) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={filters.page === 1}
                      onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-4">
                      Page {filters.page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={filters.page >= totalPages}
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
