import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle, XCircle, List, Plus, Loader2 } from 'lucide-react';
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
import { useState, useMemo, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { format, parseISO } from 'date-fns';
import ScheduleBoard, { Resource, ScheduleEvent, ZoomLevel, ZOOM_CONFIGS } from '@/components/schedule/ScheduleBoard';
import { useTenant } from '@/contexts/TenantContext';

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

interface BookingsResponse {
  success: boolean;
  bookings: Booking[];
}

interface ResourcesResponse {
  success: boolean;
  resources: Resource[];
  grouped: Record<string, Resource[]>;
  asset_types: string[];
}

export default function BookingsPage() {
  const { currentTenant } = useTenant();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(search);
  const viewMode = params.get('view') === 'calendar' ? 'calendar' : 'list';
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const config = ZOOM_CONFIGS['week'];
    return config.getRange(new Date());
  });

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
    if (view === 'list') {
      setLocation('/app/reservations');
    } else {
      setLocation('/app/reservations?view=calendar');
    }
  };

  const bookingsUrl = viewMode === 'calendar' 
    ? `/api/schedule/bookings?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`
    : '/api/schedule/bookings';

  const { data: bookingsData, isLoading: bookingsLoading, isError: bookingsError } = useQuery<BookingsResponse>({
    queryKey: viewMode === 'calendar' 
      ? ['/api/schedule/bookings', currentTenant?.tenant_id, dateRange.from.toISOString(), dateRange.to.toISOString()]
      : ['/api/schedule/bookings', currentTenant?.tenant_id],
    queryFn: async () => {
      const token = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(bookingsUrl, { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch bookings');
      return response.json();
    },
    refetchOnMount: 'always',
    enabled: !!currentTenant?.tenant_id,
  });

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery<ResourcesResponse>({
    queryKey: ['/api/schedule/resources', currentTenant?.tenant_id],
    refetchOnMount: 'always',
    enabled: !!currentTenant?.tenant_id,
  });

  const resources = useMemo(() =>
    (resourcesData?.resources ?? []).filter(r => !('is_capability_unit' in r && r.is_capability_unit)),
    [resourcesData]
  );

  const groupedResources = useMemo(() => {
    const grouped: Record<string, Resource[]> = {};
    for (const resource of resources) {
      const type = resource.asset_type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(resource);
    }
    return grouped;
  }, [resources]);

  const assetTypes = useMemo(() => Object.keys(groupedResources), [groupedResources]);

  const bookings = bookingsData?.bookings ?? [];

  const bookingsAsEvents: ScheduleEvent[] = useMemo(() => {
    return bookings.map(b => ({
      id: b.id,
      resource_id: b.asset_id,
      event_type: 'booking' as const,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      title: b.primary_guest_name,
      is_booking: true,
    }));
  }, [bookings]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/schedule/bookings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule/bookings'] });
      setCreateModalOpen(false);
      resetForm();
      toast({ title: 'Reservation created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create reservation',
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
  };

  const openCreateModal = (resourceId?: string, slotStart?: Date) => {
    if (resourceId && slotStart) {
      const endDate = new Date(slotStart);
      endDate.setHours(endDate.getHours() + 1);

      setFormData(prev => ({
        ...prev,
        asset_id: resourceId,
        starts_at: format(slotStart, "yyyy-MM-dd'T'HH:mm"),
        ends_at: format(endDate, "yyyy-MM-dd'T'HH:mm"),
      }));
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

  const handleSlotClick = (resourceId: string, slotStart: Date) => {
    openCreateModal(resourceId, slotStart);
  };

  const handleRangeChange = useCallback((from: Date, to: Date, zoom: ZoomLevel) => {
    setDateRange({ from, to });
  }, []);

  if (viewMode === 'calendar') {
    return (
      <div className="h-full flex flex-col" data-testid="bookings-page">
        <ScheduleBoard
          resources={resources}
          groupedResources={groupedResources}
          assetTypes={assetTypes}
          events={bookingsAsEvents}
          isLoading={bookingsLoading || resourcesLoading}
          error={bookingsError ? new Error('Failed to load bookings') : null}
          onSlotClick={handleSlotClick}
          onRangeChange={handleRangeChange}
          title="Reservations"
          subtitle="Manage your reservations"
          headerActions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setView('list')}
                data-testid="button-view-toggle"
              >
                <List className="h-4 w-4 mr-2" />
                List View
              </Button>
              <Button onClick={() => openCreateModal()} data-testid="button-create-reservation">
                <Plus className="h-4 w-4 mr-2" />
                New Reservation
              </Button>
            </div>
          }
          showSearch={false}
          showTypeFilter={false}
          showInactiveToggle={false}
          initialZoom="week"
          allowedZoomLevels={['15m', '1h', 'day', 'week', 'month', 'season', 'year']}
          emptyStateMessage="No assets available for reservation"
        />

        <Dialog open={createModalOpen} onOpenChange={(open) => { setCreateModalOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Reservation</DialogTitle>
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
                    {resources.map(asset => (
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
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-reservation">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Reservation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reservations-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="text-muted-foreground">
            Manage your reservations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setView('calendar')}
            data-testid="button-view-toggle"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
          <Button onClick={() => openCreateModal()} data-testid="button-create-reservation">
            <Plus className="h-4 w-4 mr-2" />
            New Reservation
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
            <h3 className="font-medium text-destructive">Failed to Load Reservations</h3>
            <p className="text-sm text-muted-foreground mt-1">Please try again or contact support.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-reservations">All</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending-reservations">Pending</TabsTrigger>
            <TabsTrigger value="confirmed" data-testid="tab-confirmed-reservations">Confirmed</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-reservations">Completed</TabsTrigger>
          </TabsList>

          {['all', 'pending', 'confirmed', 'completed'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid gap-4">
                {(tab === 'all' ? bookings : bookings.filter(b => b.status === tab)).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium">No Reservations</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tab === 'all' ? 'Create your first reservation to get started.' : `No ${tab} reservations found.`}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  (tab === 'all' ? bookings : bookings.filter(b => b.status === tab)).map((booking) => (
                    <Card key={booking.id} className="hover-elevate" data-testid={`card-reservation-${booking.id}`}>
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
                  {resources.map(asset => (
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
