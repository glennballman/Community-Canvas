import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addDays } from "date-fns";
import { 
  ArrowLeft, Calendar as CalendarIcon, Search, 
  Home, Car, Anchor, Compass, Users, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalData {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  settings: {
    show_accommodations?: boolean;
    show_parking?: boolean;
    show_moorage?: boolean;
    show_activities?: boolean;
  };
}

interface AvailabilityResult {
  success: boolean;
  portal: { id: string; slug: string; name: string };
  query: { start: string; end: string };
  assets: Array<{
    asset_id: string;
    name: string;
    asset_type: string;
    schema_type: string | null;
    description: string | null;
    thumbnail_url: string | null;
    available: boolean;
    busy_periods: Array<{ start: string; end: string; source: string }>;
  }>;
  summary: { total: number; available: number; reserved: number };
}

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: typeof Home;
  assetTypes: string[];
}> = {
  accommodations: {
    label: "Accommodations",
    icon: Home,
    assetTypes: ["accommodation", "cabin", "cottage", "lodge", "room"]
  },
  parking: {
    label: "Parking",
    icon: Car,
    assetTypes: ["parking", "rv_site", "campsite"]
  },
  moorage: {
    label: "Moorage",
    icon: Anchor,
    assetTypes: ["moorage", "slip", "dock", "marina"]
  },
  activities: {
    label: "Activities",
    icon: Compass,
    assetTypes: ["activity", "tour", "rental", "experience"]
  }
};

type CategoryKey = keyof typeof CATEGORY_CONFIG;

function DateRangePicker({ 
  startDate, 
  endDate, 
  onStartChange, 
  onEndChange 
}: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartChange: (date: Date | undefined) => void;
  onEndChange: (date: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-2">
        <Label>Check-in</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
              data-testid="button-start-date"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartChange}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex flex-col gap-2">
        <Label>Check-out</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
              data-testid="button-end-date"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndChange}
              disabled={(date) => date < (startDate || new Date())}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function ResultCard({ 
  asset, 
  portalSlug,
  startDate,
  endDate,
  partySize
}: { 
  asset: AvailabilityResult['assets'][0];
  portalSlug: string;
  startDate: Date;
  endDate: Date;
  partySize: number;
}) {
  const navigate = useNavigate();
  const CategoryIcon = CATEGORY_CONFIG[
    Object.keys(CATEGORY_CONFIG).find(key => 
      CATEGORY_CONFIG[key as CategoryKey].assetTypes.includes(asset.asset_type)
    ) as CategoryKey
  ]?.icon || Home;

  const handleReserve = () => {
    const startISO = startDate.toISOString().split('T')[0];
    const endISO = endDate.toISOString().split('T')[0];
    const url = `/p/${portalSlug}/reserve/${asset.asset_id}?start=${startISO}&end=${endISO}${partySize > 0 ? `&partySize=${partySize}` : ''}`;
    navigate(url);
  };

  return (
    <Card 
      className={cn(
        "hover-elevate transition-all",
        !asset.available && "opacity-60"
      )}
      data-testid={`card-result-${asset.asset_id}`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-48 h-32 sm:h-auto bg-muted flex items-center justify-center rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none overflow-hidden">
          {asset.thumbnail_url ? (
            <img 
              src={asset.thumbnail_url} 
              alt={asset.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <CategoryIcon className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg" data-testid={`text-name-${asset.asset_id}`}>
                  {asset.name}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {asset.asset_type}
                </Badge>
              </div>
              
              {asset.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {asset.description}
                </p>
              )}
              
              {asset.schema_type && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{asset.schema_type}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {asset.available ? (
                <Badge variant="default" className="bg-green-600">Available</Badge>
              ) : (
                <Badge variant="secondary">Unavailable</Badge>
              )}
              
              <Button 
                onClick={handleReserve}
                disabled={!asset.available}
                data-testid={`button-reserve-${asset.asset_id}`}
              >
                Reserve
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ResultsList({ 
  results, 
  isLoading, 
  portalSlug,
  startDate,
  endDate,
  partySize,
  activeCategory
}: { 
  results: AvailabilityResult | undefined;
  isLoading: boolean;
  portalSlug: string;
  startDate: Date;
  endDate: Date;
  partySize: number;
  activeCategory: CategoryKey;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="loading-results">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <div className="flex">
              <Skeleton className="w-48 h-32" />
              <div className="flex-1 p-4 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!results) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-search">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select dates to search for availability</p>
      </div>
    );
  }

  const categoryAssetTypes = CATEGORY_CONFIG[activeCategory].assetTypes;
  const filteredAssets = results.assets.filter(asset => 
    categoryAssetTypes.includes(asset.asset_type)
  );

  if (filteredAssets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No {CATEGORY_CONFIG[activeCategory].label.toLowerCase()} found for these dates</p>
      </div>
    );
  }

  const available = filteredAssets.filter(a => a.available).length;

  return (
    <div className="space-y-4" data-testid="results-list">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {available} of {filteredAssets.length} {CATEGORY_CONFIG[activeCategory].label.toLowerCase()} available
        </p>
      </div>
      
      {filteredAssets.map(asset => (
        <ResultCard 
          key={asset.asset_id} 
          asset={asset}
          portalSlug={portalSlug}
          startDate={startDate}
          endDate={endDate}
          partySize={partySize}
        />
      ))}
    </div>
  );
}

export default function PortalSearchPage() {
  const params = useParams();
  const portalSlug = params.portalSlug as string;
  
  const [startDate, setStartDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 2));
  const [partySize, setPartySize] = useState<number>(2);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("accommodations");

  const { data: portal, isLoading: portalLoading } = useQuery<PortalData>({
    queryKey: [`/api/public/cc_portals/${portalSlug}`],
    enabled: !!portalSlug,
  });

  const startStr = startDate?.toISOString().split('T')[0];
  const endStr = endDate?.toISOString().split('T')[0];

  const { data: availability, isLoading: availabilityLoading } = useQuery<AvailabilityResult>({
    queryKey: [`/api/public/cc_portals/${portalSlug}/availability?start=${startStr}&end=${endStr}`],
    enabled: !!portalSlug && !!startDate && !!endDate,
  });

  const enabledCategories = Object.entries(CATEGORY_CONFIG).filter(([key]) => {
    if (!portal?.settings) return true;
    const settingKey = `show_${key}` as keyof typeof portal.settings;
    return portal.settings[settingKey] !== false;
  }).map(([key]) => key as CategoryKey);

  if (portalLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-5xl mx-auto py-8 px-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-search">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link to={`/p/${portalSlug}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-title">
              Search {portal?.name || 'Availability'}
            </h1>
            <p className="text-muted-foreground">
              Find and reserve your perfect stay
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">When are you visiting?</CardTitle>
            <CardDescription>Select your dates and party size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
              />
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="partySize">Guests</Label>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="partySize"
                    type="number"
                    min={1}
                    max={20}
                    value={partySize}
                    onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
                    className="w-20"
                    data-testid="input-party-size"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs 
          value={activeCategory} 
          onValueChange={(v) => setActiveCategory(v as CategoryKey)}
          className="mb-6"
        >
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${enabledCategories.length}, 1fr)` }}>
            {enabledCategories.map(key => {
              const config = CATEGORY_CONFIG[key];
              const Icon = config.icon;
              return (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="flex items-center gap-2"
                  data-testid={`tab-${key}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{config.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {enabledCategories.map(key => (
            <TabsContent key={key} value={key} className="mt-6">
              <ResultsList
                results={availability}
                isLoading={availabilityLoading}
                portalSlug={portalSlug}
                startDate={startDate!}
                endDate={endDate!}
                partySize={partySize}
                activeCategory={key}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
