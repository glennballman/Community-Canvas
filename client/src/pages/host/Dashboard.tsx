import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Calendar, DollarSign, TrendingUp, Plus, 
  Loader2, MapPin, ArrowRight
} from 'lucide-react';

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

function DashboardContent() {
  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ['/api/host/properties'],
    queryFn: async () => {
      const res = await fetch('/api/host/properties', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load properties');
      return res.json();
    }
  });

  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ['/api/host/bookings'],
    queryFn: async () => {
      const res = await fetch('/api/host/bookings', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load bookings');
      return res.json();
    }
  });

  const properties = propertiesData?.properties || [];
  const bookings = bookingsData?.bookings || [];
  const upcomingBookings = bookings.filter((b: any) => 
    new Date(b.checkInDate) >= new Date() && b.status !== 'cancelled'
  );

  const stats = [
    { label: 'Properties', value: properties.length, icon: Building2 },
    { label: 'Upcoming Bookings', value: upcomingBookings.length, icon: Calendar },
    { label: 'This Month', value: '$0', icon: DollarSign },
    { label: 'Total Revenue', value: '$0', icon: TrendingUp },
  ];

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-muted-foreground">Manage your properties and bookings</p>
          </div>
          <Link href="/host/properties/add">
            <Button data-testid="button-add-property">
              <Plus className="h-4 w-4 mr-2" /> Add Property
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <stat.icon className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
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
              {loadingProperties ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : properties.length === 0 ? (
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
                    <Link key={property.id} href={`/host/properties/${property.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer">
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {property.thumbnailUrl ? (
                            <img src={property.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{property.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {property.city || property.region}
                          </p>
                        </div>
                        <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                          {property.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Upcoming Bookings</CardTitle>
                <CardDescription>Next arrivals</CardDescription>
              </div>
              <Link href="/host/bookings">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingBookings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.slice(0, 5).map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div>
                        <p className="font-medium">{booking.guestName}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.checkInDate} - {booking.checkOutDate}
                        </p>
                      </div>
                      <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                        {booking.status}
                      </Badge>
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
  return (
    <ProtectedHostRoute>
      <DashboardContent />
    </ProtectedHostRoute>
  );
}
