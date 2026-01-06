import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle, XCircle, List, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface Booking {
  id: string;
  booking_ref: string;
  asset_id: string;
  asset_name: string;
  asset_type: string;
  primary_guest_name: string;
  primary_guest_email: string | null;
  primary_guest_phone: string | null;
  num_guests: number;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  total: number | null;
  special_requests: string | null;
  created_at: string;
}

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  status: string;
}

interface BookingsResponse {
  success: boolean;
  bookings: Booking[];
}

interface ResourcesResponse {
  success: boolean;
  resources: Asset[];
}

export default function BookingsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const params = new URLSearchParams(search);
  const viewMode = params.get('view') === 'calendar' ? 'calendar' : 'list';
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);

  const [formData, setFormData] = useState({
    asset_id: '',
    primary_guest_name: '',
    primary_guest_email: '',
    primary_guest_phone: '',
    starts_at: '',
    ends_at: '',
    num_guests: 1,
    special_requests: '',
    status: 'pending' as 'pending' | 'confirmed',
  });

  const setView = (view: 'list' | 'calendar') => {
    console.debug('BookingsCalendarView clicked', { 
      currentPath: window.location.pathname + window.location.search,
      targetView: view 
    });
    if (view === 'list') {
      setLocation('/app/bookings');
    } else {
      setLocation('/app/bookings?view=calendar');
    }
  };

  const { data: bookingsData, isLoading: bookingsLoading, isError: bookingsError } = useQuery<BookingsResponse>({
    queryKey: ['/api/schedule/bookings'],
    refetchOnMount: 'always',
  });

  const { data: resourcesData } = useQuery<ResourcesResponse>({
    queryKey: ['/api/schedule/resources'],
  });

  const assets = useMemo(() => 
    (resourcesData?.resources ?? []).filter(r => !('is_capability_unit' in r && r.is_capability_unit)),
    [resourcesData]
  );

  const bookings = bookingsData?.bookings ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/schedule/bookings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule/bookings'] });
      setCreateModalOpen(false);
      resetForm();
      toast({ title: 'Booking created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create booking', 
        description: error?.message || 'Please try again',
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      asset_id: '',
      primary_guest_name: '',
      primary_guest_email: '',
      primary_guest_phone: '',
      starts_at: '',
      ends_at: '',
      num_guests: 1,
      special_requests: '',
      status: 'pending',
    });
    setSelectedSlot(null);
  };

  const openCreateModal = (slot?: { date: Date; hour: number }) => {
    if (slot) {
      const startDate = new Date(slot.date);
      startDate.setHours(slot.hour, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(slot.hour + 1, 0, 0, 0);
      
      setFormData(prev => ({
        ...prev,
        starts_at: format(startDate, "yyyy-MM-dd'T'HH:mm"),
        ends_at: format(endDate, "yyyy-MM-dd'T'HH:mm"),
      }));
      setSelectedSlot(slot);
    }
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.asset_id || !formData.primary_guest_name || !formData.starts_at || !formData.ends_at) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'confirmed':
        return <Badge><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case 'completed':
        return <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  const getBookingsForDay = (day: Date) => {
    return bookings.filter(booking => {
      const start = parseISO(booking.starts_at);
      const end = parseISO(booking.ends_at);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      return (start <= dayEnd && end >= dayStart);
    });
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  return (
    <div className="space-y-6" data-testid="bookings-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">
            Manage your reservations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setView(viewMode === 'calendar' ? 'list' : 'calendar')}
            data-testid="button-view-toggle"
          >
            {viewMode === 'calendar' ? (
              <>
                <List className="h-4 w-4 mr-2" />
                List View
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Calendar View
              </>
            )}
          </Button>
          <Button onClick={() => openCreateModal()} data-testid="button-create-booking">
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>

      {bookingsLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : bookingsError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-destructive mb-4" />
            <h3 className="font-medium text-destructive">Failed to Load Bookings</h3>
            <p className="text-sm text-muted-foreground mt-1">Please try again or contact support.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'calendar' ? (
        <div className="space-y-4" data-testid="calendar-view">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-medium">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="border rounded-md overflow-auto">
            <div className="grid grid-cols-8 min-w-[800px]">
              <div className="border-b border-r p-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                Time
              </div>
              {weekDays.map(day => (
                <div key={day.toISOString()} className="border-b border-r p-2 bg-muted/50 text-center">
                  <div className="text-xs font-medium text-muted-foreground">{format(day, 'EEE')}</div>
                  <div className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}

              {hours.map(hour => (
                <>
                  <div key={`hour-${hour}`} className="border-b border-r p-2 text-xs text-muted-foreground bg-muted/30">
                    {format(new Date().setHours(hour, 0), 'h a')}
                  </div>
                  {weekDays.map(day => {
                    const dayBookings = getBookingsForDay(day).filter(b => {
                      const start = parseISO(b.starts_at);
                      return start.getHours() <= hour && parseISO(b.ends_at).getHours() > hour;
                    });
                    return (
                      <div 
                        key={`${day.toISOString()}-${hour}`}
                        className="border-b border-r p-1 min-h-[48px] hover-elevate cursor-pointer relative"
                        onClick={() => openCreateModal({ date: day, hour })}
                        data-testid={`calendar-slot-${format(day, 'yyyy-MM-dd')}-${hour}`}
                      >
                        {dayBookings.slice(0, 1).map(booking => (
                          <div 
                            key={booking.id}
                            className="text-xs p-1 rounded bg-primary/10 text-primary truncate"
                            title={`${booking.primary_guest_name} - ${booking.asset_name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {booking.primary_guest_name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-bookings">All</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending-bookings">Pending</TabsTrigger>
            <TabsTrigger value="confirmed" data-testid="tab-confirmed-bookings">Confirmed</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-bookings">Completed</TabsTrigger>
          </TabsList>

          {['all', 'pending', 'confirmed', 'completed'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid gap-4">
                {(tab === 'all' ? bookings : bookings.filter(b => b.status === tab)).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium">No Bookings</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tab === 'all' ? 'Create your first booking to get started.' : `No ${tab} bookings found.`}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  (tab === 'all' ? bookings : bookings.filter(b => b.status === tab)).map((booking) => (
                    <Card key={booking.id} className="hover-elevate" data-testid={`card-booking-${booking.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg">{booking.primary_guest_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {booking.asset_name} - {format(parseISO(booking.starts_at), 'MMM d')} to {format(parseISO(booking.ends_at), 'MMM d')}
                          </p>
                        </div>
                        {getStatusBadge(booking.status)}
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog open={createModalOpen} onOpenChange={(open) => { setCreateModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="asset">What to book *</Label>
              <Select 
                value={formData.asset_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, asset_id: v }))}
              >
                <SelectTrigger data-testid="select-asset">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map(asset => (
                    <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_name">Guest Name *</Label>
              <Input 
                id="guest_name"
                value={formData.primary_guest_name}
                onChange={(e) => setFormData(prev => ({ ...prev, primary_guest_name: e.target.value }))}
                placeholder="John Smith"
                data-testid="input-guest-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Start *</Label>
                <Input 
                  id="starts_at"
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                  data-testid="input-starts-at"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at">End *</Label>
                <Input 
                  id="ends_at"
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                  data-testid="input-ends-at"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_email">Guest Email</Label>
              <Input 
                id="guest_email"
                type="email"
                value={formData.primary_guest_email}
                onChange={(e) => setFormData(prev => ({ ...prev, primary_guest_email: e.target.value }))}
                placeholder="john@example.com"
                data-testid="input-guest-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: 'pending' | 'confirmed') => setFormData(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="special_requests">Special Requests</Label>
              <Textarea 
                id="special_requests"
                value={formData.special_requests}
                onChange={(e) => setFormData(prev => ({ ...prev, special_requests: e.target.value }))}
                placeholder="Any special requirements..."
                data-testid="input-special-requests"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-booking">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
