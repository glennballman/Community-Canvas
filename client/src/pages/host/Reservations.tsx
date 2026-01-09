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

interface Reservation {
  id: number;
  reservationRef: string;
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

export default function HostReservations() {
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ['/api/host-dashboard', 'properties'],
    queryFn: async () => {
      const res = await fetch('/api/host-dashboard/properties', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load properties');
      return res.json();
    },
    enabled: !!user
  });

  const { data: reservationsData, isLoading: loadingReservations } = useQuery({
    queryKey: ['/api/host-dashboard', 'reservations', statusFilter, propertyFilter],
    queryFn: async () => {
      let url = '/api/host-dashboard/reservations?';
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (propertyFilter !== 'all') url += `propertyId=${propertyFilter}&`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load reservations');
      return res.json();
    },
    enabled: !!user
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ reservationId, status }: { reservationId: number; status: string }) => {
      const res = await fetch(`/api/host-dashboard/reservations/${reservationId}/status`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host-dashboard', 'reservations'] });
      setSelectedReservation(null);
    }
  });

  const properties: Property[] = propertiesData?.properties || [];
  const allReservations: Reservation[] = reservationsData?.reservations || [];
  
  const filteredReservations = allReservations.filter(b =>
    b.guestName?.toLowerCase().includes(search.toLowerCase()) ||
    b.reservationRef?.toLowerCase().includes(search.toLowerCase()) ||
    b.guestEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const isLoading = authLoading || loadingProperties || loadingReservations;

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
            <h1 className="text-2xl font-bold" data-testid="text-reservations-title">Reservations</h1>
            <p className="text-muted-foreground">{filteredReservations.length} reservation{filteredReservations.length !== 1 ? 's' : ''}</p>
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
              data-testid="input-search-reservations"
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
                  {filteredReservations.map(reservation => (
                    <tr key={reservation.id} className="hover-elevate" data-testid={`reservation-row-${reservation.id}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{reservation.guestName}</p>
                        <p className="text-sm text-muted-foreground">{reservation.guestEmail}</p>
                        {reservation.companyName && (
                          <p className="text-sm text-blue-500">{reservation.companyName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p>{reservation.propertyName}</p>
                        <p className="text-sm text-muted-foreground">{reservation.city}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(reservation.checkInDate).toLocaleDateString()}<br />
                        {new Date(reservation.checkOutDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {reservation.numNights}
                      </td>
                      <td className="px-4 py-3 text-right text-green-500 font-medium">
                        ${reservation.totalCost?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(reservation.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReservation(reservation)}
                          data-testid={`view-reservation-${reservation.id}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredReservations.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reservations found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>Reservation {selectedReservation.reservationRef}</span>
                  {getStatusBadge(selectedReservation.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" /> Guest
                  </h3>
                  <p className="font-medium">{selectedReservation.guestName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {selectedReservation.guestEmail}
                  </p>
                  {selectedReservation.guestPhone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selectedReservation.guestPhone}
                    </p>
                  )}
                  {selectedReservation.companyName && (
                    <p className="text-sm text-blue-500">{selectedReservation.companyName}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Property
                  </h3>
                  <p className="font-medium">{selectedReservation.propertyName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {selectedReservation.city}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Dates
                  </h3>
                  <p className="font-medium">
                    {new Date(selectedReservation.checkInDate).toLocaleDateString()} - {new Date(selectedReservation.checkOutDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedReservation.numNights} nights</p>
                </div>

                <div>
                  <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Guests
                  </h3>
                  <p className="font-medium">
                    {selectedReservation.numAdults} adult{selectedReservation.numAdults !== 1 ? 's' : ''}
                    {selectedReservation.numChildren > 0 && `, ${selectedReservation.numChildren} child${selectedReservation.numChildren !== 1 ? 'ren' : ''}`}
                    {selectedReservation.numPets > 0 && `, ${selectedReservation.numPets} pet${selectedReservation.numPets !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {selectedReservation.vehicleDescription && (
                  <div className="col-span-2">
                    <h3 className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Vehicle
                    </h3>
                    <p className="font-medium">{selectedReservation.vehicleDescription}</p>
                    {selectedReservation.vehicleLengthFt && (
                      <p className="text-sm text-muted-foreground">{selectedReservation.vehicleLengthFt} ft</p>
                    )}
                  </div>
                )}

                {selectedReservation.specialRequests && (
                  <div className="col-span-2">
                    <h3 className="text-sm text-muted-foreground mb-1">Special Requests</h3>
                    <p className="text-sm bg-muted p-2 rounded">{selectedReservation.specialRequests}</p>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold text-green-500">${selectedReservation.totalCost?.toFixed(2) || '0.00'}</p>
                </div>

                {selectedReservation.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ reservationId: selectedReservation.id, status: 'confirmed' })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="confirm-reservation"
                    >
                      <Check className="h-4 w-4 mr-1" /> Confirm
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => updateStatusMutation.mutate({ reservationId: selectedReservation.id, status: 'cancelled' })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="cancel-reservation"
                    >
                      <X className="h-4 w-4 mr-1" /> Decline
                    </Button>
                  </div>
                )}

                {selectedReservation.status === 'confirmed' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ reservationId: selectedReservation.id, status: 'completed' })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Mark Completed
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ reservationId: selectedReservation.id, status: 'no_show' })}
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
