import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Search,
  Calendar,
  Clock,
  MapPin,
  User,
  DollarSign,
  Check,
  AlertTriangle,
  Anchor,
  Bike,
  Car,
  ParkingCircle,
  Wrench,
  Ship,
  Home,
  Tent,
  Package
} from 'lucide-react';

interface RentalCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  itemCount: number;
}

type ReservationMode = 'check_in_out' | 'arrive_depart' | 'pickup_return';
type DurationPreset = 'half_day_4h' | 'full_day_8h' | 'overnight_24h' | 'nights' | 'custom' | null;

interface RentalItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  categorySlug: string;
  categoryIcon: string;
  communityName: string | null;
  locationName: string;
  pricingModel: string;
  rateHourly: number | null;
  rateHalfDay: number | null;
  rateDaily: number | null;
  rateWeekly: number | null;
  damageDeposit: number;
  capacity: number;
  brand: string | null;
  model: string | null;
  includedItems: string[];
  photos: string[];
  requiredWaiverSlug: string | null;
  requiredDocumentType: string | null;
  minimumAge: number;
  isAvailable: boolean;
  ownerName: string;
  reservationMode: ReservationMode;
  defaultDurationPreset: DurationPreset;
  defaultStartTimeLocal: string;
  defaultEndTimeLocal: string;
  turnoverBufferMinutes: number;
}

const RESERVATION_MODE_LABELS: Record<ReservationMode, { start: string; end: string }> = {
  check_in_out: { start: 'Checking in', end: 'Checking out' },
  arrive_depart: { start: 'Arriving', end: 'Departing' },
  pickup_return: { start: 'Pickup', end: 'Return' },
};

const DURATION_PRESETS: Record<string, { label: string; hours: number }> = {
  half_day_4h: { label: 'Half day (4 hrs)', hours: 4 },
  half_day_5h: { label: 'Half day (5 hrs)', hours: 5 },
  full_day_8h: { label: 'Full day (8 hrs)', hours: 8 },
  full_day_10h: { label: 'Full day (10 hrs)', hours: 10 },
  overnight_24h: { label: 'Overnight (24 hrs)', hours: 24 },
  flex: { label: 'Flexible', hours: 4 },
  nights: { label: 'By night', hours: 24 },
  custom: { label: 'Custom', hours: 0 },
};

interface CheckoutEligibility {
  ready: boolean;
  hasWaiver: boolean;
  hasDocument: boolean;
  hasPayment: boolean;
  blockers: string[];
  warnings: string[];
  requirements: {
    waiver: string;
    document: string;
    payment: string;
  };
  requiredWaiver: string | null;
  requiredDocument: string | null;
}

interface PriceQuote {
  duration_hours: number;
  duration_days: number;
  pricing_model: string;
  rate_applied: number;
  subtotal: number;
  damage_deposit: number;
  tax: number;
  total: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'watercraft': <Anchor className="w-5 h-5" />,
  'bicycles': <Bike className="w-5 h-5" />,
  'motorized-recreation': <Car className="w-5 h-5" />,
  'parking': <ParkingCircle className="w-5 h-5" />,
  'tools': <Wrench className="w-5 h-5" />,
  'moorage': <Ship className="w-5 h-5" />,
  'boats': <Ship className="w-5 h-5" />,
  'accommodations': <Home className="w-5 h-5" />,
  'cottages': <Home className="w-5 h-5" />,
  'rv-camping': <Tent className="w-5 h-5" />
};

export default function RentalBrowser() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [items, setItems] = useState<RentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [reservationStart, setReservationStart] = useState('');
  const [reservationEnd, setReservationEnd] = useState('');
  const [reservationDuration, setReservationDuration] = useState<number>(2);
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [eligibility, setEligibility] = useState<CheckoutEligibility | null>(null);
  const [reservationInProgress, setReservationInProgress] = useState(false);

  const loadRentals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`/api/rentals/browse?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      
      if (data.success) {
        setCategories(data.categories || []);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load rentals:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, token]);

  useEffect(() => {
    loadRentals();
  }, [loadRentals]);

  function snapTo15Min(date: Date): Date {
    const mins = date.getMinutes();
    const snapped = Math.ceil(mins / 15) * 15;
    date.setMinutes(snapped, 0, 0);
    return date;
  }

  async function selectItem(item: RentalItem) {
    setSelectedItem(item);
    setPriceQuote(null);
    setEligibility(null);
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let startDate: Date;
    let endDate: Date;
    let duration: number;
    
    if (item.reservationMode === 'check_in_out') {
      const [checkInH, checkInM] = (item.defaultStartTimeLocal || '16:00').split(':').map(Number);
      const [checkOutH, checkOutM] = (item.defaultEndTimeLocal || '11:00').split(':').map(Number);
      
      startDate = new Date(tomorrow);
      startDate.setHours(checkInH, checkInM, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(checkOutH, checkOutM, 0, 0);
      
      duration = 24;
    } else {
      const [defaultStartH, defaultStartM] = (item.defaultStartTimeLocal || '09:00').split(':').map(Number);
      const [defaultEndH, defaultEndM] = (item.defaultEndTimeLocal || '17:00').split(':').map(Number);
      
      const preset = item.defaultDurationPreset || 'full_day_8h';
      const presetConfig = DURATION_PRESETS[preset];
      duration = presetConfig?.hours && presetConfig.hours > 0 
        ? presetConfig.hours 
        : 8;
      
      startDate = snapTo15Min(new Date());
      const currentMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const defaultStartMinutes = defaultStartH * 60 + defaultStartM;
      const defaultEndMinutes = defaultEndH * 60 + defaultEndM;
      
      if (currentMinutes < defaultStartMinutes) {
        startDate.setHours(defaultStartH, defaultStartM, 0, 0);
      } else if (currentMinutes >= defaultEndMinutes) {
        startDate = new Date(tomorrow);
        startDate.setHours(defaultStartH, defaultStartM, 0, 0);
      }
      
      endDate = new Date(startDate);
      endDate.setTime(endDate.getTime() + duration * 60 * 60 * 1000);
    }
    
    setReservationStart(startDate.toISOString().slice(0, 16));
    setReservationEnd(endDate.toISOString().slice(0, 16));
    setReservationDuration(duration);
    
    if (token) {
      try {
        const res = await fetch(`/api/rentals/${item.id}/eligibility`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setEligibility(data.eligibility);
        }
      } catch (err) {
        console.error('Failed to check eligibility:', err);
      }
    }
  }

  async function calculatePrice() {
    if (!selectedItem || !reservationStart || !reservationEnd) return;
    
    try {
      const res = await fetch(`/api/rentals/${selectedItem.id}/quote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          startTs: reservationStart,
          endTs: reservationEnd
        })
      });
      const data = await res.json();
      if (data.success) {
        setPriceQuote(data.quote);
      }
    } catch (err) {
      console.error('Failed to calculate price:', err);
    }
  }

  useEffect(() => {
    if (selectedItem && reservationStart && reservationEnd) {
      calculatePrice();
    }
  }, [reservationStart, reservationEnd, selectedItem]);

  function setDurationHours(hours: number) {
    setReservationDuration(hours);
    if (reservationStart && selectedItem) {
      const start = new Date(reservationStart);
      
      if (selectedItem.reservationMode === 'check_in_out') {
        const nights = Math.round(hours / 24) || 1;
        const [checkOutH, checkOutM] = (selectedItem.defaultEndTimeLocal || '11:00').split(':').map(Number);
        
        const end = new Date(start);
        end.setDate(end.getDate() + nights);
        end.setHours(checkOutH, checkOutM, 0, 0);
        setReservationEnd(end.toISOString().slice(0, 16));
      } else {
        const end = new Date(start);
        end.setTime(end.getTime() + hours * 60 * 60 * 1000);
        setReservationEnd(end.toISOString().slice(0, 16));
      }
    }
  }

  async function confirmReservation() {
    if (!selectedItem || !reservationStart || !reservationEnd || !eligibility?.ready || !token) return;
    
    setReservationInProgress(true);
    try {
      const res = await fetch(`/api/rentals/${selectedItem.id}/book`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          startTs: reservationStart,
          endTs: reservationEnd
        })
      });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Reservation confirmed!', description: 'Check "My Reservations" for details.' });
        setSelectedItem(null);
        loadRentals();
      } else {
        toast({ title: 'Reservation failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create reservation', variant: 'destructive' });
    } finally {
      setReservationInProgress(false);
    }
  }

  const filteredItems = items.filter(item => 
    !searchQuery || 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function formatPrice(item: RentalItem): string {
    if (item.rateHourly) return `$${item.rateHourly}/hr`;
    if (item.rateDaily) return `$${item.rateDaily}/day`;
    if (item.rateWeekly) return `$${item.rateWeekly}/wk`;
    return 'Contact for pricing';
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" data-testid="heading-rentals">Rent Equipment</h1>
        <p className="text-muted-foreground">
          Kayaks, bikes, tools, parking, and more available in your community
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-rentals"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.name} ({cat.itemCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          data-testid="filter-all"
        >
          All
        </Button>
        {categories.filter(c => c.itemCount > 0).map(cat => (
          <Button
            key={cat.slug}
            variant={selectedCategory === cat.slug ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat.slug)}
            data-testid={`filter-${cat.slug}`}
          >
            {categoryIcons[cat.slug] || <Package className="w-4 h-4 mr-1" />}
            <span className="ml-1">{cat.name}</span>
            <Badge variant="secondary" className="ml-1 text-xs">{cat.itemCount}</Badge>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="empty-rentals">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No equipment found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <Card
              key={item.id}
              className="hover-elevate cursor-pointer overflow-visible"
              onClick={() => selectItem(item)}
              data-testid={`card-rental-${item.slug}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-md bg-muted">
                      {categoryIcons[item.categorySlug] || <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                  <Badge variant={item.isAvailable ? 'default' : 'secondary'}>
                    {item.isAvailable ? 'Available' : 'Booked'}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {item.locationName || item.communityName || 'Location TBD'}
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatPrice(item)}
                  </span>
                </div>
                
                {item.brand && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.brand} {item.model}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg" data-testid="modal-reservation">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {categoryIcons[selectedItem.categorySlug] || <Package className="w-5 h-5" />}
                  {selectedItem.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedItem.locationName}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {selectedItem.ownerName}
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    {formatPrice(selectedItem)}
                  </div>
                </div>
                
                {selectedItem.includedItems.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Included:</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedItem.includedItems.map((itm, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{itm}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.reservationMode === 'check_in_out' ? (
                      [1, 2, 3, 5, 7].map(nights => (
                        <Button
                          key={nights}
                          size="sm"
                          variant={reservationDuration === nights * 24 ? 'default' : 'outline'}
                          onClick={() => setDurationHours(nights * 24)}
                          data-testid={`button-nights-${nights}`}
                        >
                          {nights} {nights === 1 ? 'night' : 'nights'}
                        </Button>
                      ))
                    ) : (
                      Object.entries(DURATION_PRESETS).map(([key, { label, hours }]) => (
                        <Button
                          key={key}
                          size="sm"
                          variant={reservationDuration === hours ? 'default' : 'outline'}
                          onClick={() => setDurationHours(hours)}
                          data-testid={`button-duration-${key}`}
                        >
                          {label}
                        </Button>
                      ))
                    )}
                    <Button
                      size="sm"
                      variant={![4, 8, 24, 48, 72, 120, 168].includes(reservationDuration) ? 'default' : 'outline'}
                      onClick={() => {}}
                      data-testid="button-duration-custom"
                    >
                      Custom
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">
                      {RESERVATION_MODE_LABELS[selectedItem.reservationMode]?.start || 'Start'}
                    </Label>
                    <Input
                      id="start-time"
                      type="datetime-local"
                      value={reservationStart}
                      onChange={(e) => setReservationStart(e.target.value)}
                      step={900}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">
                      {RESERVATION_MODE_LABELS[selectedItem.reservationMode]?.end || 'End'}
                    </Label>
                    <Input
                      id="end-time"
                      type="datetime-local"
                      value={reservationEnd}
                      onChange={(e) => setReservationEnd(e.target.value)}
                      step={900}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
                
                {priceQuote && (
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {priceQuote.duration_hours < 24 
                            ? `${priceQuote.duration_hours} hours @ $${priceQuote.rate_applied}/${priceQuote.pricing_model}` 
                            : `${priceQuote.duration_days} days @ $${priceQuote.rate_applied}/${priceQuote.pricing_model}`}
                        </span>
                        <span>${priceQuote.subtotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax (12%)</span>
                        <span>${priceQuote.tax}</span>
                      </div>
                      {priceQuote.damage_deposit > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Deposit (refundable)</span>
                          <span>${priceQuote.damage_deposit}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Total</span>
                        <span className="text-green-600 dark:text-green-400">${priceQuote.total}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {eligibility && (
                  <Card className={eligibility.ready ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}>
                    <CardContent className="py-3">
                      {eligibility.ready ? (
                        <div>
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                            <Check className="w-5 h-5" />
                            <span>Ready to reserve!</span>
                          </div>
                          
                          {eligibility.warnings && eligibility.warnings.length > 0 && (
                            <div className="mt-2 text-sm border-t border-yellow-500/30 pt-2">
                              <div className="text-yellow-600 dark:text-yellow-400 font-medium mb-1 flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Complete before pickup:
                              </div>
                              {eligibility.warnings.map((warning: string, i: number) => {
                                const parts = warning.split(':');
                                const timingPart = parts[0] || '';
                                const item = parts[1] || '';
                                const timingLabel = timingPart.includes('checkout') ? 'at checkout' : 'before use';
                                const isWaiver = timingPart.includes('waiver');
                                return (
                                  <div key={i} className="flex items-center gap-2 text-yellow-500/80 text-xs">
                                    <span>-</span>
                                    <span>
                                      {isWaiver 
                                        ? `Sign ${item.replace(/-/g, ' ')} waiver (${timingLabel})`
                                        : `Provide ${item.replace(/-/g, ' ')} (${timingLabel})`
                                      }
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium mb-2">
                            <AlertTriangle className="w-5 h-5" />
                            Required to reserve:
                          </div>
                          <div className="space-y-1 text-sm">
                            {eligibility.blockers?.map((blocker: string, i: number) => {
                              if (blocker === 'payment_method') {
                                return (
                                  <div key={i} className="flex items-center justify-between">
                                    <span>Add payment method</span>
                                    <Button size="sm" variant="ghost">Add</Button>
                                  </div>
                                );
                              }
                              if (blocker.startsWith('waiver:')) {
                                return (
                                  <div key={i} className="flex items-center justify-between">
                                    <span>Sign {blocker.split(':')[1]?.replace(/-/g, ' ')} waiver</span>
                                    <Button size="sm" variant="ghost">Sign Now</Button>
                                  </div>
                                );
                              }
                              if (blocker.startsWith('document:')) {
                                return (
                                  <div key={i} className="flex items-center justify-between">
                                    <span>Add {blocker.split(':')[1]?.replace(/-/g, ' ')}</span>
                                    <Button size="sm" variant="ghost">Add</Button>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {!token && (
                  <Card className="bg-blue-500/10 border-blue-500/30">
                    <CardContent className="py-3 text-center text-sm">
                      <a href="/login" className="text-blue-600 dark:text-blue-400 font-medium">
                        Log in to reserve this item
                      </a>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItem(null)} data-testid="button-cancel-reservation">
                  Cancel
                </Button>
                <Button
                  onClick={confirmReservation}
                  disabled={!eligibility?.ready || reservationInProgress || !priceQuote}
                  data-testid="button-confirm-reservation"
                >
                  {reservationInProgress && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {eligibility?.ready 
                    ? `Confirm Reservation - $${priceQuote?.total || '0'}` 
                    : 'Complete requirements to reserve'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
