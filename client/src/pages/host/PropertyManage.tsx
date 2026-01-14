import { useState, useEffect, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useHostAuth, ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Calendar, MapPin, Settings, Users, Truck, 
  Loader2, Plus, Trash2, Edit, Check, X, Download, Upload,
  ChevronLeft, ChevronRight, Wrench, DollarSign, Star, Bed
} from 'lucide-react';

interface Property {
  id: number;
  canvasId: string;
  name: string;
  propertyType: string;
  region: string;
  city: string;
  status: string;
  thumbnailUrl: string | null;
  crewScore: number;
  rvScore: number;
  truckerScore: number;
  totalSpots: number;
  [key: string]: any;
}

interface Spot {
  id: number;
  spotName: string;
  spotNumber: string;
  spotType: string;
  maxLengthFt: number | null;
  hasPower: boolean;
  powerAmps: number | null;
  hasWater: boolean;
  hasSewer: boolean;
  nightlyRate: string | null;
}

interface Pricing {
  id: number;
  pricingType: string;
  nightlyRate: string | null;
  weeklyRate: string | null;
  monthlyRate: string | null;
  seasonName: string | null;
  isActive: boolean;
}

interface Provider {
  id: number;
  providerType: string;
  businessName: string | null;
  providerName: string | null;
  phone: string | null;
  isResident: boolean;
  servicesOffered: string[];
}

interface Reservation {
  id: number;
  propertyId: number;
  reservationRef: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalCost: string | null;
}

interface CalendarBlock {
  id: number;
  startDate: string;
  endDate: string;
  blockType: string;
  notes: string | null;
}

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

function PropertyManageContent() {
  const [, params] = useRoute('/host/properties/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const propertyId = params?.id ? parseInt(params.id) : null;
  
  const [activeTab, setActiveTab] = useState('calendar');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockType, setBlockType] = useState('blocked');
  const [blockNotes, setBlockNotes] = useState('');
  
  // Spot modal
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [spotForm, setSpotForm] = useState({
    spotName: '', spotNumber: '', spotType: 'rv', maxLengthFt: '', 
    hasPower: false, powerAmps: '', hasWater: false, hasSewer: false, nightlyRate: ''
  });
  
  // Provider modal
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerForm, setProviderForm] = useState({
    providerType: '', businessName: '', providerName: '', phone: '', isResident: false
  });
  
  // Pricing modal
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    pricingType: 'base_nightly', nightlyRate: '', weeklyRate: '', monthlyRate: '', seasonName: ''
  });

  // Queries
  const { data: property, isLoading: loadingProperty } = useQuery<Property>({
    queryKey: ['/api/host/properties', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const res = await fetch(`/api/host/properties/${propertyId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load property');
      return res.json();
    }
  });

  const { data: calendarData } = useQuery({
    queryKey: ['/api/host/calendar', propertyId],
    enabled: !!propertyId && activeTab === 'calendar',
    queryFn: async () => {
      const res = await fetch(`/api/host/calendar/${propertyId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load calendar');
      return res.json();
    }
  });

  const { data: spotsData } = useQuery({
    queryKey: ['/api/host/properties', propertyId, 'spots'],
    enabled: !!propertyId && activeTab === 'spots',
    queryFn: async () => {
      const res = await fetch(`/api/host/properties/${propertyId}/spots`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load spots');
      return res.json();
    }
  });

  const { data: pricingData } = useQuery({
    queryKey: ['/api/host/properties', propertyId, 'pricing'],
    enabled: !!propertyId && activeTab === 'pricing',
    queryFn: async () => {
      const res = await fetch(`/api/host/properties/${propertyId}/pricing`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load pricing');
      return res.json();
    }
  });

  const { data: providersData } = useQuery({
    queryKey: ['/api/host/properties', propertyId, 'providers'],
    enabled: !!propertyId && activeTab === 'providers',
    queryFn: async () => {
      const res = await fetch(`/api/host/properties/${propertyId}/providers`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load providers');
      return res.json();
    }
  });

  const { data: reservationsData } = useQuery({
    queryKey: ['/api/host/reservations'],
    enabled: !!propertyId && activeTab === 'reservations',
    queryFn: async () => {
      const res = await fetch(`/api/host/reservations`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load reservations');
      return res.json();
    }
  });

  // Mutations
  const updatePropertyMutation = useMutation({
    mutationFn: async (data: Partial<Property>) => {
      const res = await fetch(`/api/host/properties/${propertyId}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/properties', propertyId] });
      toast({ title: 'Property updated' });
    }
  });

  const createBlockMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/host/calendar/${propertyId}/block`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/calendar', propertyId] });
      setShowBlockModal(false);
      setSelectedDates([]);
      setBlockNotes('');
      toast({ title: 'Dates blocked' });
    }
  });

  const createSpotMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/host/properties/${propertyId}/spots`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create spot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/properties', propertyId, 'spots'] });
      setShowSpotModal(false);
      resetSpotForm();
      toast({ title: 'Spot added' });
    }
  });

  const deleteSpotMutation = useMutation({
    mutationFn: async (spotId: number) => {
      const res = await fetch(`/api/host/properties/${propertyId}/spots/${spotId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete spot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/properties', propertyId, 'spots'] });
      toast({ title: 'Spot deleted' });
    }
  });

  const createPricingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/host/properties/${propertyId}/pricing`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create pricing');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/properties', propertyId, 'pricing'] });
      setShowPricingModal(false);
      resetPricingForm();
      toast({ title: 'Pricing rule added' });
    }
  });

  const createProviderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/host/properties/${propertyId}/providers`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to add provider');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/properties', propertyId, 'providers'] });
      setShowProviderModal(false);
      resetProviderForm();
      toast({ title: 'Provider added' });
    }
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: number) => {
      const res = await fetch(`/api/host/properties/${propertyId}/providers/${providerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete provider');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/properties', propertyId, 'providers'] });
      toast({ title: 'Provider removed' });
    }
  });

  useEffect(() => {
    if (property) setEditedName(property.name);
  }, [property]);

  const resetSpotForm = () => {
    setSpotForm({
      spotName: '', spotNumber: '', spotType: 'rv', maxLengthFt: '',
      hasPower: false, powerAmps: '', hasWater: false, hasSewer: false, nightlyRate: ''
    });
    setEditingSpot(null);
  };

  const resetPricingForm = () => {
    setPricingForm({ pricingType: 'base_nightly', nightlyRate: '', weeklyRate: '', monthlyRate: '', seasonName: '' });
  };

  const resetProviderForm = () => {
    setProviderForm({ providerType: '', businessName: '', providerName: '', phone: '', isResident: false });
  };

  // Calendar helpers
  const calendarMonths = useMemo(() => {
    const months = [];
    const start = new Date(calendarMonth);
    start.setDate(1);
    for (let i = 0; i < 3; i++) {
      const month = new Date(start);
      month.setMonth(month.getMonth() + i);
      months.push(month);
    }
    return months;
  }, [calendarMonth]);

  const getDateStatus = (date: Date): 'available' | 'blocked' | 'reserved' => {
    const dateStr = date.toISOString().split('T')[0];
    const blocks = calendarData?.blocks || [];
    const reservations = calendarData?.reservations || [];
    
    for (const reservation of reservations) {
      if (dateStr >= reservation.checkInDate && dateStr < reservation.checkOutDate) {
        return 'reserved';
      }
    }
    
    for (const block of blocks) {
      if (dateStr >= block.startDate && dateStr <= block.endDate) {
        return 'blocked';
      }
    }
    
    return 'available';
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => d.toDateString() === date.toDateString());
  };

  const handleDateClick = (date: Date) => {
    if (!rangeStart) {
      setRangeStart(date);
      setSelectedDates([date]);
    } else {
      const start = rangeStart < date ? rangeStart : date;
      const end = rangeStart < date ? date : rangeStart;
      const dates: Date[] = [];
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      setSelectedDates(dates);
      setRangeStart(null);
    }
  };

  const handleBlockSelected = () => {
    if (selectedDates.length === 0) return;
    setShowBlockModal(true);
  };

  const confirmBlock = () => {
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    createBlockMutation.mutate({
      startDate: sorted[0].toISOString().split('T')[0],
      endDate: sorted[sorted.length - 1].toISOString().split('T')[0],
      blockType,
      notes: blockNotes
    });
  };

  const handleSaveName = () => {
    updatePropertyMutation.mutate({ name: editedName });
    setIsEditingName(false);
  };

  const handleStatusToggle = () => {
    const newStatus = property?.status === 'active' ? 'inactive' : 'active';
    updatePropertyMutation.mutate({ status: newStatus });
  };

  const handleAddSpot = () => {
    createSpotMutation.mutate({
      ...spotForm,
      maxLengthFt: spotForm.maxLengthFt ? parseInt(spotForm.maxLengthFt) : null,
      powerAmps: spotForm.powerAmps ? parseInt(spotForm.powerAmps) : null,
      nightlyRate: spotForm.nightlyRate ? parseFloat(spotForm.nightlyRate) : null
    });
  };

  const handleAddPricing = () => {
    createPricingMutation.mutate({
      ...pricingForm,
      nightlyRate: pricingForm.nightlyRate ? parseFloat(pricingForm.nightlyRate) : null,
      weeklyRate: pricingForm.weeklyRate ? parseFloat(pricingForm.weeklyRate) : null,
      monthlyRate: pricingForm.monthlyRate ? parseFloat(pricingForm.monthlyRate) : null
    });
  };

  const handleAddProvider = () => {
    createProviderMutation.mutate(providerForm);
  };

  const renderCalendarMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];
    
    for (let i = 0; i < startPadding; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return (
      <div className="flex-1 min-w-[280px]">
        <div className="text-center font-medium mb-2">
          {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, i) => {
            if (!date) return <div key={i} />;
            const status = getDateStatus(date);
            const selected = isDateSelected(date);
            const isPast = date < new Date(new Date().setHours(0,0,0,0));
            
            return (
              <button
                key={i}
                onClick={() => !isPast && handleDateClick(date)}
                disabled={isPast}
                className={`
                  h-8 text-sm rounded-md transition-colors
                  ${isPast ? 'text-muted-foreground/50 cursor-not-allowed' : 'cursor-pointer hover-elevate'}
                  ${selected ? 'ring-2 ring-primary' : ''}
                  ${status === 'available' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''}
                  ${status === 'blocked' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
                  ${status === 'reserved' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                `}
                data-testid={`calendar-day-${date.toISOString().split('T')[0]}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loadingProperty) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Property not found</p>
          <Button onClick={() => setLocation('/host/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/host/dashboard')} className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          
          <div className="flex flex-wrap items-start gap-4">
            <div 
              className="w-24 h-24 rounded-md bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover-elevate"
              data-testid="button-change-thumbnail"
            >
              {property.thumbnailUrl ? (
                <img src={property.thumbnailUrl} alt={property.name} className="w-full h-full object-cover" />
              ) : (
                <MapPin className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="text-xl font-bold"
                      data-testid="input-property-name"
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveName} data-testid="button-save-name">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold" data-testid="text-property-name">{property.name}</h1>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditingName(true)} data-testid="button-edit-name">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin className="h-4 w-4" />
                <span>{property.city || property.region}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{property.propertyType?.replace(/_/g, ' ')}</Badge>
                {property.crewScore > 0 && <Badge className="bg-orange-500">Crew: {property.crewScore}</Badge>}
                {property.rvScore > 0 && <Badge className="bg-green-500">RV: {property.rvScore}</Badge>}
                {property.truckerScore > 0 && <Badge className="bg-blue-500">Trucker: {property.truckerScore}</Badge>}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="status-toggle" className="text-sm">Active</Label>
              <Switch
                id="status-toggle"
                checked={property.status === 'active'}
                onCheckedChange={handleStatusToggle}
                data-testid="switch-status"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="calendar" data-testid="tab-calendar"><Calendar className="h-4 w-4 mr-1" /> Calendar</TabsTrigger>
            <TabsTrigger value="spots" data-testid="tab-spots"><Bed className="h-4 w-4 mr-1" /> Spots</TabsTrigger>
            <TabsTrigger value="amenities" data-testid="tab-amenities"><Settings className="h-4 w-4 mr-1" /> Amenities</TabsTrigger>
            <TabsTrigger value="pricing" data-testid="tab-pricing"><DollarSign className="h-4 w-4 mr-1" /> Pricing</TabsTrigger>
            <TabsTrigger value="providers" data-testid="tab-providers"><Wrench className="h-4 w-4 mr-1" /> Providers</TabsTrigger>
            <TabsTrigger value="reservations" data-testid="tab-reservations"><Users className="h-4 w-4 mr-1" /> Reservations</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews"><Star className="h-4 w-4 mr-1" /> Reviews</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Availability Calendar</CardTitle>
                  <CardDescription>Click dates to select, then block or manage availability</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    const prev = new Date(calendarMonth);
                    prev.setMonth(prev.getMonth() - 1);
                    setCalendarMonth(prev);
                  }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const next = new Date(calendarMonth);
                    next.setMonth(next.getMonth() + 1);
                    setCalendarMonth(next);
                  }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" data-testid="button-import-ical">
                    <Upload className="h-4 w-4 mr-1" /> Import iCal
                  </Button>
                  <Button variant="outline" size="sm" data-testid="button-export-ical">
                    <Download className="h-4 w-4 mr-1" /> Export iCal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
                    <span className="text-sm">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
                    <span className="text-sm">Blocked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/30" />
                    <span className="text-sm">Reserved</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-6 mb-6">
                  {calendarMonths.map((month, i) => (
                    <div key={i}>{renderCalendarMonth(month)}</div>
                  ))}
                </div>
                
                {selectedDates.length > 0 && (
                  <div className="flex items-center gap-4 p-4 rounded-md bg-muted">
                    <span className="text-sm">{selectedDates.length} date(s) selected</span>
                    <Button onClick={handleBlockSelected} data-testid="button-block-selected">Block Selected</Button>
                    <Button variant="ghost" onClick={() => setSelectedDates([])}>Clear</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="spots">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Spots Management</CardTitle>
                  <CardDescription>Manage individual spots at your property</CardDescription>
                </div>
                <Button onClick={() => { resetSpotForm(); setShowSpotModal(true); }} data-testid="button-add-spot">
                  <Plus className="h-4 w-4 mr-1" /> Add Spot
                </Button>
              </CardHeader>
              <CardContent>
                {spotsData?.spots?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No spots configured yet</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {spotsData?.spots?.map((spot: Spot) => (
                      <Card key={spot.id} className="relative">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{spot.spotName || `Spot ${spot.spotNumber}`}</CardTitle>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteSpotMutation.mutate(spot.id)}
                              data-testid={`button-delete-spot-${spot.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1 text-sm">
                            <p>Type: <span className="text-muted-foreground">{spot.spotType}</span></p>
                            {spot.maxLengthFt && <p>Max Length: <span className="text-muted-foreground">{spot.maxLengthFt}ft</span></p>}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {spot.hasPower && <Badge variant="outline" className="text-xs">Power {spot.powerAmps}A</Badge>}
                              {spot.hasWater && <Badge variant="outline" className="text-xs">Water</Badge>}
                              {spot.hasSewer && <Badge variant="outline" className="text-xs">Sewer</Badge>}
                            </div>
                            {spot.nightlyRate && <p className="mt-2 font-medium">${spot.nightlyRate}/night</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="amenities">
            <Card>
              <CardHeader>
                <CardTitle>Amenities</CardTitle>
                <CardDescription>Configure amenities and features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <h4 className="font-medium mb-3">RV/Camping</h4>
                    <div className="space-y-2">
                      {['Full Hookups', 'Partial Hookups', 'Dump Station', 'Pull-Through Sites', 'Big Rig Friendly'].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <Checkbox id={item} />
                          <Label htmlFor={item} className="font-normal">{item}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Trucking</h4>
                    <div className="space-y-2">
                      {['Semi Parking', 'Reefer Plug-In', 'High-Flow Diesel', 'CAT Scale', 'Truck Wash'].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <Checkbox id={item} />
                          <Label htmlFor={item} className="font-normal">{item}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Equestrian</h4>
                    <div className="space-y-2">
                      {['Horse Stalls', 'Paddocks', 'Round Pen', 'Arena', 'Trail Access'].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <Checkbox id={item} />
                          <Label htmlFor={item} className="font-normal">{item}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Facilities</h4>
                    <div className="space-y-2">
                      {['Restrooms', 'Showers', 'Laundry', 'Store', 'WiFi', 'Pool', 'Clubhouse'].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <Checkbox id={item} />
                          <Label htmlFor={item} className="font-normal">{item}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Button className="mt-6" data-testid="button-save-amenities">Save Amenities</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Pricing Rules</CardTitle>
                  <CardDescription>Set base rates and seasonal pricing</CardDescription>
                </div>
                <Button onClick={() => { resetPricingForm(); setShowPricingModal(true); }} data-testid="button-add-pricing">
                  <Plus className="h-4 w-4 mr-1" /> Add Pricing Rule
                </Button>
              </CardHeader>
              <CardContent>
                {pricingData?.pricing?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pricing rules configured</p>
                ) : (
                  <div className="space-y-4">
                    {pricingData?.pricing?.map((rule: Pricing) => (
                      <div key={rule.id} className="flex items-center justify-between p-4 rounded-md bg-muted">
                        <div>
                          <p className="font-medium">{rule.pricingType.replace(/_/g, ' ')}</p>
                          {rule.seasonName && <p className="text-sm text-muted-foreground">{rule.seasonName}</p>}
                        </div>
                        <div className="text-right">
                          {rule.nightlyRate && <p>${rule.nightlyRate}/night</p>}
                          {rule.weeklyRate && <p className="text-sm text-muted-foreground">${rule.weeklyRate}/week</p>}
                          {rule.monthlyRate && <p className="text-sm text-muted-foreground">${rule.monthlyRate}/month</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Service Providers</CardTitle>
                  <CardDescription>On-site services available to guests</CardDescription>
                </div>
                <Button onClick={() => { resetProviderForm(); setShowProviderModal(true); }} data-testid="button-add-provider">
                  <Plus className="h-4 w-4 mr-1" /> Add Provider
                </Button>
              </CardHeader>
              <CardContent>
                {providersData?.providers?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No service providers configured</p>
                ) : (
                  <div className="space-y-4">
                    {providersData?.providers?.map((provider: Provider) => (
                      <div key={provider.id} className="flex items-center justify-between p-4 rounded-md bg-muted">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{provider.businessName || provider.providerName}</p>
                            {provider.isResident && <Badge className="bg-green-500">Resident</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{provider.providerType}</p>
                          {provider.phone && <p className="text-sm">{provider.phone}</p>}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteProviderMutation.mutate(provider.id)}
                          data-testid={`button-delete-provider-${provider.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations">
            <Card>
              <CardHeader>
                <CardTitle>Reservations</CardTitle>
                <CardDescription>View and manage reservations</CardDescription>
              </CardHeader>
              <CardContent>
                {reservationsData?.reservations?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No reservations yet</p>
                ) : (
                  <div className="space-y-4">
                    {reservationsData?.reservations?.filter((b: Reservation) => b.propertyId === propertyId).map((reservation: Reservation) => (
                      <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-md bg-muted">
                        <div>
                          <p className="font-medium">{reservation.guestName}</p>
                          <p className="text-sm text-muted-foreground">{reservation.reservationRef}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm">{reservation.checkInDate} - {reservation.checkOutDate}</p>
                        </div>
                        <div>
                          <Badge variant={reservation.status === 'confirmed' ? 'default' : 'secondary'}>
                            {reservation.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
                <CardDescription>Guest feedback and ratings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">No reviews yet</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Property Settings</CardTitle>
                <CardDescription>Configure property settings and policies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Check-in Time</Label>
                      <Input type="time" defaultValue={property.checkInTime || '14:00'} />
                    </div>
                    <div className="space-y-2">
                      <Label>Check-out Time</Label>
                      <Input type="time" defaultValue={property.checkOutTime || '11:00'} />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Nights</Label>
                      <Input type="number" defaultValue={property.minNights || 1} min={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Stay (days)</Label>
                      <Input type="number" defaultValue={property.maxStayDays || 30} min={1} />
                    </div>
                  </div>
                  <Button data-testid="button-save-settings">Save Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Dates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Block Type</Label>
              <Select value={blockType} onValueChange={setBlockType}>
                <SelectTrigger data-testid="select-block-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="owner_use">Owner Use</SelectItem>
                  <SelectItem value="seasonal_closed">Seasonal Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea 
                value={blockNotes} 
                onChange={(e) => setBlockNotes(e.target.value)}
                placeholder="Add notes about this block..."
                data-testid="textarea-block-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockModal(false)}>Cancel</Button>
            <Button onClick={confirmBlock} disabled={createBlockMutation.isPending} data-testid="button-confirm-block">
              {createBlockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Block Dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSpotModal} onOpenChange={setShowSpotModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Spot Name</Label>
                <Input 
                  value={spotForm.spotName} 
                  onChange={(e) => setSpotForm({...spotForm, spotName: e.target.value})}
                  placeholder="e.g. Riverside 1"
                  data-testid="input-spot-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Spot Number</Label>
                <Input 
                  value={spotForm.spotNumber} 
                  onChange={(e) => setSpotForm({...spotForm, spotNumber: e.target.value})}
                  placeholder="e.g. A1"
                  data-testid="input-spot-number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Spot Type</Label>
                <Select value={spotForm.spotType} onValueChange={(v) => setSpotForm({...spotForm, spotType: v})}>
                  <SelectTrigger data-testid="select-spot-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rv">RV</SelectItem>
                    <SelectItem value="tent">Tent</SelectItem>
                    <SelectItem value="cabin">Cabin</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="horse">Horse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Length (ft)</Label>
                <Input 
                  type="number"
                  value={spotForm.maxLengthFt} 
                  onChange={(e) => setSpotForm({...spotForm, maxLengthFt: e.target.value})}
                  data-testid="input-max-length"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hookups</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={spotForm.hasPower} 
                    onCheckedChange={(c) => setSpotForm({...spotForm, hasPower: c === true})}
                  />
                  <Label className="font-normal">Power</Label>
                  {spotForm.hasPower && (
                    <Input 
                      className="w-20" 
                      placeholder="Amps"
                      value={spotForm.powerAmps}
                      onChange={(e) => setSpotForm({...spotForm, powerAmps: e.target.value})}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={spotForm.hasWater} 
                    onCheckedChange={(c) => setSpotForm({...spotForm, hasWater: c === true})}
                  />
                  <Label className="font-normal">Water</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={spotForm.hasSewer} 
                    onCheckedChange={(c) => setSpotForm({...spotForm, hasSewer: c === true})}
                  />
                  <Label className="font-normal">Sewer</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nightly Rate ($)</Label>
              <Input 
                type="number"
                step="0.01"
                value={spotForm.nightlyRate} 
                onChange={(e) => setSpotForm({...spotForm, nightlyRate: e.target.value})}
                placeholder="Leave blank to use property default"
                data-testid="input-spot-rate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSpotModal(false)}>Cancel</Button>
            <Button onClick={handleAddSpot} disabled={createSpotMutation.isPending} data-testid="button-save-spot">
              {createSpotMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Spot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPricingModal} onOpenChange={setShowPricingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pricing Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pricing Type</Label>
              <Select value={pricingForm.pricingType} onValueChange={(v) => setPricingForm({...pricingForm, pricingType: v})}>
                <SelectTrigger data-testid="select-pricing-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base_nightly">Base Nightly</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pricingForm.pricingType === 'seasonal' && (
              <div className="space-y-2">
                <Label>Season Name</Label>
                <Input 
                  value={pricingForm.seasonName} 
                  onChange={(e) => setPricingForm({...pricingForm, seasonName: e.target.value})}
                  placeholder="e.g. Summer Peak"
                  data-testid="input-season-name"
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nightly ($)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={pricingForm.nightlyRate} 
                  onChange={(e) => setPricingForm({...pricingForm, nightlyRate: e.target.value})}
                  data-testid="input-nightly-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Weekly ($)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={pricingForm.weeklyRate} 
                  onChange={(e) => setPricingForm({...pricingForm, weeklyRate: e.target.value})}
                  data-testid="input-weekly-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly ($)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={pricingForm.monthlyRate} 
                  onChange={(e) => setPricingForm({...pricingForm, monthlyRate: e.target.value})}
                  data-testid="input-monthly-rate"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPricingModal(false)}>Cancel</Button>
            <Button onClick={handleAddPricing} disabled={createPricingMutation.isPending} data-testid="button-save-pricing">
              {createPricingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProviderModal} onOpenChange={setShowProviderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service Provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Type</Label>
              <Select value={providerForm.providerType} onValueChange={(v) => setProviderForm({...providerForm, providerType: v})}>
                <SelectTrigger data-testid="select-provider-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mechanic">Mechanic</SelectItem>
                  <SelectItem value="tire_service">Tire Service</SelectItem>
                  <SelectItem value="towing">Towing</SelectItem>
                  <SelectItem value="propane">Propane</SelectItem>
                  <SelectItem value="rv_service">RV Service</SelectItem>
                  <SelectItem value="farrier">Farrier</SelectItem>
                  <SelectItem value="veterinarian">Veterinarian</SelectItem>
                  <SelectItem value="catering">Catering</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input 
                  value={providerForm.businessName} 
                  onChange={(e) => setProviderForm({...providerForm, businessName: e.target.value})}
                  data-testid="input-provider-business"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input 
                  value={providerForm.providerName} 
                  onChange={(e) => setProviderForm({...providerForm, providerName: e.target.value})}
                  data-testid="input-provider-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input 
                value={providerForm.phone} 
                onChange={(e) => setProviderForm({...providerForm, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
                data-testid="input-provider-phone"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={providerForm.isResident} 
                onCheckedChange={(c) => setProviderForm({...providerForm, isResident: c === true})}
              />
              <Label className="font-normal">Resident on property (highlight!)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProviderModal(false)}>Cancel</Button>
            <Button onClick={handleAddProvider} disabled={createProviderMutation.isPending} data-testid="button-save-provider">
              {createProviderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PropertyManage() {
  return (
    <ProtectedHostRoute>
      <PropertyManageContent />
    </ProtectedHostRoute>
  );
}
