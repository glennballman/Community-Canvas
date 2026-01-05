import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BookingsPage() {
  const bookings = [
    { id: '1', customer: 'John Smith', item: 'Excavator', dates: 'Jan 10-15', status: 'confirmed' },
    { id: '2', customer: 'Jane Doe', item: 'Cabin A', dates: 'Jan 20-25', status: 'pending' },
    { id: '3', customer: 'Bob Wilson', item: 'Parking Spot 1', dates: 'Jan 5-10', status: 'completed' },
  ];

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

  return (
    <div className="space-y-6" data-testid="bookings-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">
            Manage your reservations
          </p>
        </div>
        <Button variant="outline" data-testid="button-view-calendar">
          <Calendar className="h-4 w-4 mr-2" />
          Calendar View
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-bookings">All</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-bookings">Pending</TabsTrigger>
          <TabsTrigger value="confirmed" data-testid="tab-confirmed-bookings">Confirmed</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed-bookings">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="hover-elevate" data-testid={`card-booking-${booking.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{booking.customer}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {booking.item} - {booking.dates}
                    </p>
                  </div>
                  {getStatusBadge(booking.status)}
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
