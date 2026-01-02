import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Calendar, DollarSign, TrendingUp, Plus, 
  Loader2, MapPin, ArrowRight, Users, Bell, Clock, Check, X
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useEffect } from 'react';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return { 'Authorization': `Bearer ${token}` };
}

function DashboardContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Auth redirect temporarily disabled for testing - users stay on page
  // useEffect(() => {
  //   if (user && user.userType !== 'host' && user.userType !== 'admin') {
  //     setLocation('/');
  //   }
  // }, [user, setLocation]);

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/host-dashboard', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/host-dashboard/dashboard/stats', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
    enabled: !!user
  });

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
    queryKey: ['/api/host-dashboard', 'bookings', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/host-dashboard/bookings?status=pending', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load bookings');
      return res.json();
    },
    enabled: !!user
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: string }) => {
      const res = await fetch(`/api/host-dashboard/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update booking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host-dashboard'] });
    }
  });

  const stats = statsData?.stats;
  const properties = propertiesData?.properties || [];
  const pendingBookings = bookingsData?.bookings || [];

  const isLoading = loadingStats || loadingProperties || loadingBookings;

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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Host Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.firstName || 'Host'}!</p>
          </div>
          <Link href="/host/properties/add">
            <Button data-testid="button-add-property">
              <Plus className="h-4 w-4 mr-2" /> Add Property
            </Button>
          </Link>
        </div>

        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Properties</p>
                    <p className="text-2xl font-bold" data-testid="stat-properties">{stats.totalProperties}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-500" data-testid="stat-pending">{stats.pendingBookings}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Guests</p>
                    <p className="text-2xl font-bold text-green-500" data-testid="stat-active">{stats.activeGuests}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-blue-500" data-testid="stat-revenue">${stats.monthRevenue?.toFixed(0) || 0}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Notifications</p>
                    <p className="text-2xl font-bold" data-testid="stat-notifications">{stats.unreadNotifications}</p>
                  </div>
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Your Properties</CardTitle>
                <CardDescription>Manage your listings</CardDescription>
              </div>
              <Link href="/host/properties">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No properties yet</p>
                  <Link href="/host/properties/add">
                    <Button>Add Your First Property</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {properties.slice(0, 5).map((property: any) => (
                    <div key={property.id} className="p-4 rounded-lg hover-elevate border" data-testid={`property-${property.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                            {property.thumbnailUrl ? (
                              <img src={property.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <Link href={`/host/properties/${property.id}`} className="font-medium hover:text-primary">
                              {property.name}
                            </Link>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {property.city}, {property.region}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{property.totalSpots} spots</span>
                              {property.pendingBookings > 0 && (
                                <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">
                                  {property.pendingBookings} pending
                                </Badge>
                              )}
                              {property.activeGuests > 0 && (
                                <Badge variant="outline" className="text-green-500 border-green-500 text-xs">
                                  {property.activeGuests} active
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-500 font-medium">${property.monthRevenue?.toFixed(0) || 0}</p>
                          <p className="text-xs text-muted-foreground">this month</p>
                          <Badge variant={property.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                            {property.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/host/properties/${property.id}/calendar`}>
                            <Calendar className="h-3 w-3 mr-1" /> Calendar
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/host/properties/${property.id}/bookings`}>Bookings</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/staging/${property.id}`}>View Listing</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Pending Bookings</CardTitle>
                <CardDescription>Requires action</CardDescription>
              </div>
              <Link href="/host/bookings">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {pendingBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBookings.slice(0, 5).map((booking: any) => (
                    <div key={booking.id} className="p-3 rounded-lg border" data-testid={`booking-${booking.id}`}>
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div>
                          <p className="font-medium">{booking.guestName}</p>
                          <p className="text-sm text-muted-foreground">{booking.propertyName}</p>
                        </div>
                        <p className="text-green-500 font-medium">${booking.totalCost?.toFixed(0) || 0}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {new Date(booking.checkInDate).toLocaleDateString()} - {new Date(booking.checkOutDate).toLocaleDateString()}
                        <span className="ml-2">({booking.numNights} nights)</span>
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => updateBookingStatus.mutate({ bookingId: booking.id, status: 'confirmed' })}
                          disabled={updateBookingStatus.isPending}
                          data-testid={`confirm-booking-${booking.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => updateBookingStatus.mutate({ bookingId: booking.id, status: 'cancelled' })}
                          disabled={updateBookingStatus.isPending}
                          data-testid={`cancel-booking-${booking.id}`}
                        >
                          <X className="h-3 w-3 mr-1" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </HostLayout>
  );
}

export default function HostDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Auth check temporarily disabled for testing - show dashboard to all users
  return <DashboardContent />;
}
