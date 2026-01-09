import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Calendar, MapPin, Loader2, ArrowLeft, TreePine, AlertCircle
} from 'lucide-react';

interface Reservation {
  id: number;
  reservationRef: string;
  propertyId: number;
  propertyName: string;
  propertyCity: string;
  propertyRegion: string;
  propertyThumbnail: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalCost: string | null;
  guestName: string;
  vehicleType: string | null;
  guests: number;
  pets: number;
  createdAt: string;
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

function ReservationCard({ reservation, onCancel }: { reservation: Reservation; onCancel: () => void }) {
  const checkIn = new Date(reservation.checkInDate);
  const checkOut = new Date(reservation.checkOutDate);
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  const isPast = checkOut < new Date();
  const canCancel = reservation.status === 'pending' || reservation.status === 'confirmed';

  return (
    <Card className="overflow-hidden" data-testid={`card-reservation-${reservation.id}`}>
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-48 h-32 sm:h-auto bg-muted flex-shrink-0">
          {reservation.propertyThumbnail ? (
            <img 
              src={reservation.propertyThumbnail} 
              alt={reservation.propertyName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <TreePine className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardContent className="flex-1 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-lg">{reservation.propertyName}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{reservation.propertyCity || reservation.propertyRegion}</span>
              </div>
            </div>
            {getStatusBadge(reservation.status)}
          </div>

          <div className="grid gap-2 text-sm mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {checkIn.toLocaleDateString()} - {checkOut.toLocaleDateString()}
                <span className="text-muted-foreground ml-1">({nights} night{nights !== 1 ? 's' : ''})</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Ref: <span className="font-mono">{reservation.reservationRef}</span></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {reservation.totalCost && (
              <span className="font-semibold">${parseFloat(reservation.totalCost).toFixed(2)}</span>
            )}
            <div className="flex gap-2">
              <Link href={`/staging/${reservation.propertyId}`}>
                <Button variant="outline" size="sm" data-testid={`button-view-property-${reservation.id}`}>
                  View Property
                </Button>
              </Link>
              {!isPast && canCancel && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive"
                  onClick={onCancel}
                  data-testid={`button-cancel-reservation-${reservation.id}`}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function MyReservations() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [cancelReservation, setCancelReservation] = useState<Reservation | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/staging/my-reservations'],
    queryFn: async () => {
      const res = await fetch('/api/staging/my-reservations');
      if (!res.ok) {
        if (res.status === 401) return { reservations: [] };
        throw new Error('Failed to load reservations');
      }
      return res.json();
    }
  });

  const now = new Date();
  const upcomingReservations = data?.reservations?.filter((b: Reservation) => 
    new Date(b.checkOutDate) >= now && b.status !== 'cancelled'
  ) || [];
  const pastReservations = data?.reservations?.filter((b: Reservation) => 
    new Date(b.checkOutDate) < now || b.status === 'cancelled'
  ) || [];

  const handleCancelConfirm = async () => {
    if (!cancelReservation) return;
    try {
      const res = await fetch(`/api/staging/reservations/${cancelReservation.id}/cancel`, {
        method: 'POST'
      });
      if (res.ok) {
        refetch();
      }
    } catch (error) {
      console.error('Cancel failed:', error);
    }
    setCancelReservation(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Link href="/staging">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
          </Button>
        </Link>

        <h1 className="text-2xl font-bold mb-6">My Reservations</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              Upcoming ({upcomingReservations.length})
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              Past ({pastReservations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingReservations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No upcoming reservations</p>
                  <Link href="/staging">
                    <Button data-testid="button-find-spot">Find a Spot</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingReservations.map((reservation: Reservation) => (
                  <ReservationCard 
                    key={reservation.id} 
                    reservation={reservation} 
                    onCancel={() => setCancelReservation(reservation)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastReservations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No past reservations</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastReservations.map((reservation: Reservation) => (
                  <ReservationCard 
                    key={reservation.id} 
                    reservation={reservation} 
                    onCancel={() => setCancelReservation(reservation)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!cancelReservation} onOpenChange={() => setCancelReservation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Cancel Reservation
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this reservation?
            </DialogDescription>
          </DialogHeader>
          {cancelReservation && (
            <div className="py-4">
              <p className="font-medium">{cancelReservation.propertyName}</p>
              <p className="text-sm text-muted-foreground">
                {cancelReservation.checkInDate} - {cancelReservation.checkOutDate}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Ref: {cancelReservation.reservationRef}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelReservation(null)}>
              Keep Reservation
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm} data-testid="button-confirm-cancel">
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
