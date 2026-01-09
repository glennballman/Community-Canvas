import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Sailboat, 
  Plus, 
  Calendar, 
  MapPin, 
  Clock, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReservationItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  locationName: string;
  ownerName: string;
  photos: string[];
  category: string;
  categorySlug: string;
  categoryIcon: string;
  communityName: string;
}

interface Reservation {
  id: string;
  status: 'pending' | 'confirmed' | 'checked_out' | 'active' | 'returned' | 'completed' | 'cancelled' | 'no_show' | 'overdue';
  startsAt: string;
  endsAt: string;
  actualCheckoutAt: string | null;
  actualCheckinAt: string | null;
  pricingModel: string;
  rateApplied: number;
  durationHours: number;
  subtotal: number;
  tax: number;
  damageDepositHeld: number;
  total: number;
  paymentStatus: string;
  conditionAtCheckout: string;
  conditionAtReturn: string;
  damageReported: boolean;
  damageNotes: string;
  notes: string;
  createdAt: string;
  item: ReservationItem;
}

type FilterType = 'all' | 'active' | 'upcoming' | 'past';

export default function MyReservations() {
  const [filter, setFilter] = useState<FilterType>('all');
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery<{ success: boolean; reservations: Reservation[] }>({
    queryKey: ['/api/rentals/reservations'],
    queryFn: async () => {
      const res = await fetch('/api/rentals/reservations', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch reservations');
      return res.json();
    },
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await fetch(`/api/rentals/reservations/${reservationId}/cancel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to cancel reservation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rentals/reservations'] });
    },
  });

  const reservations = data?.reservations || [];
  const now = new Date();

  const filteredReservations = reservations.filter(b => {
    const start = new Date(b.startsAt);
    
    switch (filter) {
      case 'active':
        return ['active', 'checked_out'].includes(b.status);
      case 'upcoming':
        return ['pending', 'confirmed'].includes(b.status) && start > now;
      case 'past':
        return ['completed', 'returned', 'cancelled', 'no_show'].includes(b.status);
      default:
        return true;
    }
  });

  const activeCount = reservations.filter(b => ['active', 'checked_out'].includes(b.status)).length;
  const upcomingCount = reservations.filter(b => ['pending', 'confirmed'].includes(b.status)).length;
  const totalSpent = reservations.reduce((sum, b) => sum + (b.total || 0), 0);

  const getStatusBadge = (status: Reservation['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      confirmed: 'default',
      checked_out: 'default',
      active: 'default',
      returned: 'secondary',
      completed: 'secondary',
      cancelled: 'destructive',
      no_show: 'destructive',
      overdue: 'destructive'
    };
    
    const labels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      checked_out: 'Checked Out',
      active: 'Active',
      returned: 'Returned',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
      overdue: 'Overdue'
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'} data-testid={`badge-status-${status}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDuration = (hours: number) => {
    if (!hours) return 'N/A';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} day${days !== 1 ? 's' : ''}`;
    return `${days}d ${remainingHours}h`;
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-muted-foreground">Failed to load reservations. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Reservations</h1>
          <p className="text-muted-foreground">Manage your equipment rentals</p>
        </div>
        <Link href="/rentals">
          <Button data-testid="button-rent-equipment">
            <Plus className="w-4 h-4 mr-2" />
            Rent Equipment
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold" data-testid="text-total-count">{reservations.length}</div>
            <div className="text-sm text-muted-foreground">Total Reservations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500" data-testid="text-active-count">{activeCount}</div>
            <div className="text-sm text-muted-foreground">Active Now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500" data-testid="text-upcoming-count">{upcomingCount}</div>
            <div className="text-sm text-muted-foreground">Upcoming</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold" data-testid="text-total-spent">${totalSpent.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">Total Spent</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'upcoming', label: `Upcoming (${upcomingCount})` },
          { key: 'past', label: 'Past' }
        ].map(tab => (
          <Button
            key={tab.key}
            variant={filter === tab.key ? 'default' : 'outline'}
            onClick={() => setFilter(tab.key as FilterType)}
            data-testid={`button-filter-${tab.key}`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="w-16 h-16 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReservations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sailboat className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {filter === 'all' 
                ? "You don't have any reservations yet"
                : `No ${filter} reservations`}
            </p>
            <Link href="/rentals">
              <Button data-testid="button-browse-equipment">
                Browse Equipment
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReservations.map(reservation => (
            <Card 
              key={reservation.id}
              className={['active', 'checked_out'].includes(reservation.status) ? 'ring-2 ring-green-500/50' : ''}
              data-testid={`card-reservation-${reservation.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sailboat className="w-8 h-8 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium" data-testid={`text-item-name-${reservation.id}`}>
                            {reservation.item?.name || 'Unknown Item'}
                          </h3>
                          {getStatusBadge(reservation.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {reservation.item?.category || 'Category'} 
                          {reservation.item?.locationName && ` • ${reservation.item.locationName}`}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold" data-testid={`text-total-${reservation.id}`}>
                          ${reservation.total?.toFixed(2) || '0.00'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDuration(reservation.durationHours)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-4 text-sm flex-wrap">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDateTime(reservation.startsAt)}</span>
                      </div>
                      <span className="text-muted-foreground">to</span>
                      <div className="text-muted-foreground">
                        {formatDateTime(reservation.endsAt)}
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      {['pending', 'confirmed'].includes(reservation.status) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-${reservation.id}`}
                            >
                              {cancelMutation.isPending ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                  Cancelling...
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Cancel Reservation
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this reservation for {reservation.item?.name}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-dialog-no">Keep Reservation</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => cancelMutation.mutate(reservation.id)}
                                data-testid="button-cancel-dialog-yes"
                              >
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      
                      {reservation.status === 'confirmed' && (
                        <Button variant="ghost" size="sm" data-testid={`button-checkout-${reservation.id}`}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Check Out Equipment
                        </Button>
                      )}
                      
                      {['active', 'checked_out'].includes(reservation.status) && (
                        <Button variant="ghost" size="sm" className="text-green-500" data-testid={`button-return-${reservation.id}`}>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Return Equipment
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              
              {['active', 'checked_out'].includes(reservation.status) && (
                <div className="h-1 bg-green-500" />
              )}
              {reservation.status === 'overdue' && (
                <div className="h-1 bg-orange-500" />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
