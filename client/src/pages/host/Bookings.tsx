import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, Loader2, Search, User, MapPin, X, Check, Building2,
  Phone, Mail, Truck, Users, ArrowLeft
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

interface Booking {
  id: number;
  bookingRef: string;
  propertyId: number;
  propertyName: string;
  city: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  companyName: string | null;
  checkInDate: string;
  checkOutDate: string;
  numNights: number;
  numAdults: number;
  numChildren: number;
  numPets: number;
  vehicleDescription: string | null;
  vehicleLengthFt: number | null;
  specialRequests: string | null;
  totalCost: number;
  status: string;
  createdAt: string;
}

interface Property {
  id: number;
  name: string;
}

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return { 'Authorization': `Bearer ${token}` };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-green-600">Confirmed</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-600">Pending</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    case 'completed':
      return <Badge className="bg-blue-600">Completed</Badge>;
    case 'no_show':
      return <Badge variant="secondary">No Show</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function HostBookings() {
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ['/api/host-dashboard', 'properties'],
    queryFn: async () => {
      const res = await fetch('/api/host-dashboard/properties', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load properties');
      return res.json();
    },
    enabled: !!user
  });

  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ['/api/host-dashboard', 'bookings', statusFilter, propertyFilter],
    queryFn: async () => {
      let url = '/api/host-dashboard/bookings?';
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (propertyFilter !== 'all') url += `propertyId=${propertyFilter}&`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load bookings');
      return res.json();
    },
    enabled: !!user
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: string }) => {
      const res = await fetch(`/api/host-dashboard/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host-dashboard', 'bookings'] });
      setSelectedBooking(null);
    }
  });

  const properties: Property[] = propertiesData?.properties || [];
  const allBookings: Booking[] = bookingsData?.bookings || [];
  
  const filteredBookings = allBookings.filter(b =>
    b.guestName?.toLowerCase().includes(search.toLowerCase()) ||
    b.bookingRef?.toLowerCase().includes(search.toLowerCase()) ||
    b.guestEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const isLoading = authLoading || loadingProperties || loadingBookings;

  if (isLoading) {
    return (
      <HostLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </HostLayout>
    );
  }

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Link href="/host/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-bookings-title">Bookings</h1>
            <p className="text-muted-foreground">{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guest, email, or ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-bookings"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-48" data-testid="select-property-filter">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Guest</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Property</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Dates</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Nights</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBookings.map(booking => (
                    <tr key={booking.id} className="hover-elevate" data-testid={`booking-row-${booking.id}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{booking.guestName}</p>
                        <p className="text-sm text-muted-foreground">{booking.guestEmail}</p>
                        {booking.companyName && (
                          <p className="text-sm text-blue-500">{booking.companyName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p>{booking.propertyName}</p>
                        <p className="text-sm text-muted-foreground">{booking.city}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(booking.checkInDate).toLocaleDateString()}<br />
                        {new Date(booking.checkOutDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {booking.numNights}
                      </td>
                      <td className="px-4 py-3 text-right text-green-500 font-medium">
                        ${booking.totalCost?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBooking(booking)}
                          data-testid={`view-booking-${booking.id}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredBookings.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bookings found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>Booking {selectedBooking.bookingRef}</span>
                  {getStatusBadge(selectedBooking.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" /> Guest
                  </h3>
                  <p className="font-medium">{selectedBooking.guestName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {selectedBooking.guestEmail}
                  </p>
                  {selectedBooking.guestPhone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selectedBooking.guestPhone}
                    </p>
                  )}
                  {selectedBooking.companyName && (
                    <p className="text-sm text-blue-500">{selectedBooking.companyName}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Property
                  </h3>
                  <p className="font-medium">{selectedBooking.propertyName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {selectedBooking.city}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Dates
                  </h3>
                  <p className="font-medium">
                    {new Date(selectedBooking.checkInDate).toLocaleDateString()} - {new Date(selectedBooking.checkOutDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.numNights} nights</p>
                </div>

                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Guests
                  </h3>
                  <p className="font-medium">
                    {selectedBooking.numAdults} adult{selectedBooking.numAdults !== 1 ? 's' : ''}
                    {selectedBooking.numChildren > 0 && `, ${selectedBooking.numChildren} child${selectedBooking.numChildren !== 1 ? 'ren' : ''}`}
                    {selectedBooking.numPets > 0 && `, ${selectedBooking.numPets} pet${selectedBooking.numPets !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {selectedBooking.vehicleDescription && (
                  <div className="col-span-2">
                    <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Vehicle
                    </h3>
                    <p className="font-medium">{selectedBooking.vehicleDescription}</p>
                    {selectedBooking.vehicleLengthFt && (
                      <p className="text-sm text-muted-foreground">{selectedBooking.vehicleLengthFt} ft</p>
                    )}
                  </div>
                )}

                {selectedBooking.specialRequests && (
                  <div className="col-span-2">
                    <h3 className="text-sm text-muted-foreground mb-1">Special Requests</h3>
                    <p className="text-sm bg-muted p-2 rounded">{selectedBooking.specialRequests}</p>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold text-green-500">${selectedBooking.totalCost?.toFixed(2) || '0.00'}</p>
                </div>

                {selectedBooking.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ bookingId: selectedBooking.id, status: 'confirmed' })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="confirm-booking"
                    >
                      <Check className="h-4 w-4 mr-1" /> Confirm
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => updateStatusMutation.mutate({ bookingId: selectedBooking.id, status: 'cancelled' })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="cancel-booking"
                    >
                      <X className="h-4 w-4 mr-1" /> Decline
                    </Button>
                  </div>
                )}

                {selectedBooking.status === 'confirmed' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ bookingId: selectedBooking.id, status: 'completed' })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Mark Completed
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ bookingId: selectedBooking.id, status: 'no_show' })}
                      disabled={updateStatusMutation.isPending}
                    >
                      No Show
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </HostLayout>
  );
}
