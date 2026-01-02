import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Loader2, Search, User, MapPin } from 'lucide-react';

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-green-500">Confirmed</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500">Pending</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    case 'completed':
      return <Badge variant="secondary">Completed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function BookingsContent() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('upcoming');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/host/bookings'],
    queryFn: async () => {
      const res = await fetch('/api/host/bookings', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load bookings');
      return res.json();
    }
  });

  const allBookings = (data?.bookings || []).filter((b: any) =>
    b.guestName?.toLowerCase().includes(search.toLowerCase()) ||
    b.bookingRef?.toLowerCase().includes(search.toLowerCase())
  );

  const now = new Date();
  const upcoming = allBookings.filter((b: any) => 
    new Date(b.checkInDate) >= now && b.status !== 'cancelled'
  );
  const past = allBookings.filter((b: any) => 
    new Date(b.checkOutDate) < now || b.status === 'cancelled'
  );

  const displayBookings = tab === 'upcoming' ? upcoming : past;

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-bookings-title">Bookings</h1>
            <p className="text-muted-foreground">{allBookings.length} total bookings</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by guest or ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              Past ({past.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : displayBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {displayBookings.map((booking: any) => {
                  const checkIn = new Date(booking.checkInDate);
                  const checkOut = new Date(booking.checkOutDate);
                  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <Card key={booking.id} data-testid={`card-booking-${booking.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold">{booking.guestName}</p>
                              <p className="text-sm text-muted-foreground">
                                Ref: <span className="font-mono">{booking.bookingRef}</span>
                              </p>
                              {booking.propertyName && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" />
                                  {booking.propertyName}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {getStatusBadge(booking.status)}
                            {booking.totalCost && (
                              <p className="font-semibold mt-1">${parseFloat(booking.totalCost).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t">
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Check-in</p>
                              <p className="font-medium">{booking.checkInDate}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Check-out</p>
                              <p className="font-medium">{booking.checkOutDate}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Duration</p>
                              <p className="font-medium">{nights} night{nights !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            {booking.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline">Decline</Button>
                                <Button size="sm">Confirm</Button>
                              </>
                            )}
                            {booking.status === 'confirmed' && tab === 'upcoming' && (
                              <Button size="sm" variant="outline">Message Guest</Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </HostLayout>
  );
}

export default function HostBookings() {
  return (
    <ProtectedHostRoute>
      <BookingsContent />
    </ProtectedHostRoute>
  );
}
