import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { api } from '@/lib/api';
import { debounce } from 'lodash';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Home, 
  Car, 
  Anchor, 
  Bike, 
  Wrench, 
  AlertTriangle,
  Phone,
  X,
  MapPin,
  Users,
  Loader2,
  Search,
  Copy,
  Check
} from 'lucide-react';

interface AvailabilityResult {
  item_id: string;
  business_tenant_id: string;
  business_name: string;
  item_name: string;
  short_description: string;
  item_type: string;
  category: string;
  photos: { url: string }[];
  price_amount: number | null;
  price_unit: string | null;
  price_visible: boolean;
  capacity_max: number | null;
  pickup_location: string;
  can_request_hold: boolean;
  sharing_status: 'full' | 'availability_only' | 'limited';
}

interface SearchFilters {
  query: string;
  date_start: string;
  date_end: string;
  party_size: string;
  item_type: string;
}

const TABS = [
  { id: 'stay', label: 'Stay', icon: Home, type: 'accommodation' },
  { id: 'parking', label: 'Parking', icon: Car, type: 'parking' },
  { id: 'moorage', label: 'Moorage', icon: Anchor, type: 'moorage' },
  { id: 'rentals', label: 'Rentals', icon: Bike, type: 'rental' },
  { id: 'services', label: 'Services', icon: Wrench, type: 'service' },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, type: null },
];

export default function AvailabilityConsole() {
  const { currentTenant, isCommunityOperator } = useTenant();
  const [activeTab, setActiveTab] = useState('stay');
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AvailabilityResult | null>(null);
  const [showPhoneScript, setShowPhoneScript] = useState(true);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    date_start: '',
    date_end: '',
    party_size: '',
    item_type: 'accommodation',
  });

  const debouncedSearch = useCallback(
    debounce((f: SearchFilters, tenantId: string) => {
      performSearch(f, tenantId);
    }, 300),
    []
  );

  useEffect(() => {
    const tab = TABS.find(t => t.id === activeTab);
    if (tab?.type) {
      setFilters(prev => ({ ...prev, item_type: tab.type! }));
    }
  }, [activeTab]);

  useEffect(() => {
    if (filters.item_type && currentTenant?.id) {
      debouncedSearch(filters, currentTenant.id);
    }
  }, [filters, currentTenant?.id]);

  async function performSearch(f: SearchFilters, tenantId: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tenant_id', tenantId);
      if (f.item_type) params.set('item_type', f.item_type);
      if (f.query) params.set('search', f.query);
      if (f.date_start) params.set('date_start', f.date_start);
      if (f.date_end) params.set('date_end', f.date_end);
      if (f.party_size) params.set('capacity', f.party_size);
      
      const data = await api.get(`/api/operator/availability?${params}`);
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdateFilter(key: keyof SearchFilters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  if (!isCommunityOperator) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Community Operators Only</h2>
            <p className="text-muted-foreground">
              The Availability Console is available to community and government operators who can search opted-in business catalogs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]" data-testid="availability-console">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Availability</h1>
              <p className="text-muted-foreground text-sm">
                Opted-in availability across the community - built for answering calls
              </p>
            </div>
            <Button
              onClick={() => setShowPhoneScript(!showPhoneScript)}
              variant={showPhoneScript ? 'default' : 'outline'}
              data-testid="button-toggle-phone-script"
            >
              <Phone className="h-4 w-4 mr-2" />
              Phone Script
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4 bg-muted/50 border-b">
          <p className="text-xs text-muted-foreground mb-2">
            Search once - see results from every opted-in tenant.
          </p>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={filters.query}
                onChange={(e) => handleUpdateFilter('query', e.target.value)}
                placeholder='What are they looking for? (e.g., "2 nights", "truck + trailer")'
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Input
              type="date"
              value={filters.date_start}
              onChange={(e) => handleUpdateFilter('date_start', e.target.value)}
              className="w-auto"
              data-testid="input-date-start"
            />
            <Input
              type="date"
              value={filters.date_end}
              onChange={(e) => handleUpdateFilter('date_end', e.target.value)}
              className="w-auto"
              data-testid="input-date-end"
            />
            <Input
              type="number"
              value={filters.party_size}
              onChange={(e) => handleUpdateFilter('party_size', e.target.value)}
              placeholder="Party size"
              className="w-24"
              data-testid="input-party-size"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <EmptyResults filters={filters} />
            ) : (
              <div className="space-y-3">
                {results.map((item) => (
                  <ResultCard
                    key={item.item_id}
                    item={item}
                    selected={selectedItem?.item_id === item.item_id}
                    onSelect={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {showPhoneScript && (
        <PhoneScriptPanel
          filters={filters}
          results={results}
          selectedItem={selectedItem}
          onClose={() => setShowPhoneScript(false)}
        />
      )}
    </div>
  );
}

function ResultCard({
  item,
  selected,
  onSelect
}: {
  item: AvailabilityResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer hover-elevate ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
      data-testid={`card-result-${item.item_id}`}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {item.photos?.[0]?.url ? (
              <img 
                src={item.photos[0].url} 
                alt={item.item_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Home className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{item.item_name}</h3>
                <p className="text-sm text-muted-foreground">{item.business_name}</p>
              </div>
              
              <Badge variant={
                item.sharing_status === 'full' ? 'default' :
                item.sharing_status === 'availability_only' ? 'secondary' : 'outline'
              }>
                {item.sharing_status === 'full' ? 'Opted-in' : 
                 item.sharing_status === 'availability_only' ? 'Availability only' : 'Limited'}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {item.short_description}
            </p>

            <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
              {item.price_visible && item.price_amount && (
                <span className="font-medium">
                  ${item.price_amount}
                  <span className="text-muted-foreground font-normal">/{item.price_unit}</span>
                </span>
              )}
              {item.capacity_max && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Up to {item.capacity_max}
                </span>
              )}
              {item.pickup_location && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.pickup_location}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button size="sm" data-testid={`button-script-${item.item_id}`}>
              <Phone className="h-4 w-4 mr-1" />
              Script
            </Button>
            {item.can_request_hold && (
              <Button variant="outline" size="sm" data-testid={`button-hold-${item.item_id}`}>
                Hold
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyResults({ filters }: { filters: SearchFilters }) {
  const hasFilters = filters.query || filters.date_start || filters.date_end || filters.party_size;
  
  return (
    <div className="text-center py-12" data-testid="empty-results">
      <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">
        {hasFilters ? 'No matches found' : 'Start searching'}
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        {hasFilters 
          ? 'Try adjusting your search criteria or check another category.'
          : 'Search across all opted-in businesses in your community. Results update as you type.'}
      </p>
    </div>
  );
}

function PhoneScriptPanel({
  filters,
  results,
  selectedItem,
  onClose
}: {
  filters: SearchFilters;
  results: AvailabilityResult[];
  selectedItem: AvailabilityResult | null;
  onClose: () => void;
}) {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  function copyToClipboard(text: string, blockId: string) {
    navigator.clipboard.writeText(text);
    setCopiedBlock(blockId);
    setTimeout(() => setCopiedBlock(null), 2000);
  }

  const contextSummary = [
    filters.query && `Looking for: ${filters.query}`,
    filters.date_start && `Dates: ${filters.date_start}${filters.date_end ? ` to ${filters.date_end}` : ''}`,
    filters.party_size && `Party size: ${filters.party_size}`,
  ].filter(Boolean).join(' | ');

  const hasMatches = results.length > 0;
  const topMatches = results.slice(0, 3);

  const greeting = "Thank you for calling! How can I help you today?";
  
  const noMatchScript = `I've checked our current availability, and unfortunately we don't have anything that matches those specific dates/requirements right now. However, I can take your contact information and let you know if something opens up.`;
  
  const matchScript = hasMatches && topMatches.length > 0
    ? `Great news! I found ${results.length} option${results.length > 1 ? 's' : ''} for you. The top match is ${topMatches[0].item_name} from ${topMatches[0].business_name}${topMatches[0].price_visible && topMatches[0].price_amount ? ` at $${topMatches[0].price_amount}/${topMatches[0].price_unit}` : ''}.`
    : '';

  return (
    <div className="w-96 border-l bg-card flex flex-col" data-testid="phone-script-panel">
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Script
          </h2>
          <p className="text-xs text-muted-foreground">Copy-ready responses - Updates as you search</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-script">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {contextSummary && (
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-3">
                <p className="text-sm font-medium">Current search:</p>
                <p className="text-sm text-muted-foreground">{contextSummary}</p>
              </CardContent>
            </Card>
          )}

          <ScriptBlock
            title="Greeting"
            text={greeting}
            copied={copiedBlock === 'greeting'}
            onCopy={() => copyToClipboard(greeting, 'greeting')}
          />

          {hasMatches ? (
            <ScriptBlock
              title="Found matches"
              text={matchScript}
              copied={copiedBlock === 'match'}
              onCopy={() => copyToClipboard(matchScript, 'match')}
            />
          ) : (
            <ScriptBlock
              title="No matches"
              text={noMatchScript}
              copied={copiedBlock === 'nomatch'}
              onCopy={() => copyToClipboard(noMatchScript, 'nomatch')}
            />
          )}

          {selectedItem && (
            <Card className="bg-muted">
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-2">Selected: {selectedItem.item_name}</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Business: {selectedItem.business_name}</p>
                  {selectedItem.price_visible && selectedItem.price_amount && (
                    <p>Price: ${selectedItem.price_amount}/{selectedItem.price_unit}</p>
                  )}
                  {selectedItem.capacity_max && (
                    <p>Capacity: Up to {selectedItem.capacity_max}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ScriptBlock({
  title,
  text,
  copied,
  onCopy
}: {
  title: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-medium">{title}</p>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onCopy}
            data-testid={`button-copy-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
