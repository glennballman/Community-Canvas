import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Star, 
  ExternalLink, 
  Users, 
  Bed, 
  Bath, 
  DollarSign, 
  Calendar,
  Car,
  Utensils,
  Wifi,
  WashingMachine,
  Check,
  X,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Plus,
  Edit,
  Briefcase,
  Award
} from 'lucide-react';
import type { 
  AccommodationProperty, 
  AccommodationHost, 
  AccommodationBooking, 
  ICalFeed,
  PropertyStatus 
} from '@shared/types/accommodations';

interface PropertyDetailsProps {
  propertyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: PropertyStatus[] = ['discovered', 'contacted', 'onboarded', 'active', 'inactive'];

const STATUS_COLORS: Record<PropertyStatus, string> = {
  discovered: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  onboarded: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-muted text-muted-foreground border-border',
};

function CrewScoreBadge({ score }: { score: number }) {
  let colorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
  if (score >= 70) colorClass = 'bg-green-500/20 text-green-400 border-green-500/30';
  else if (score >= 50) colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  else if (score >= 30) colorClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30';

  return (
    <div className={`px-4 py-2 rounded-md border text-lg font-bold ${colorClass}`} data-testid="badge-crew-score-large">
      {score}
    </div>
  );
}

function FeatureCheck({ available, label, icon: Icon }: { available: boolean; label: string; icon: typeof Car }) {
  return (
    <div className={`flex items-center gap-2 ${available ? 'text-foreground' : 'text-muted-foreground'}`}>
      {available ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground" />
      )}
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function MiniCalendar({ blocks }: { blocks: { start: string; end: string }[] }) {
  const today = new Date();
  const days: { date: Date; blocked: boolean }[] = [];
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const blocked = blocks.some(block => {
      const start = new Date(block.start);
      const end = new Date(block.end);
      return date >= start && date <= end;
    });
    
    days.push({ date, blocked });
  }

  return (
    <div className="grid grid-cols-7 gap-1" data-testid="calendar-availability">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
        <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
          {d}
        </div>
      ))}
      {days.map((day, i) => (
        <div
          key={i}
          className={`text-center text-xs py-1 rounded ${
            day.blocked 
              ? 'bg-red-500/20 text-red-400' 
              : 'bg-green-500/20 text-green-400'
          }`}
          title={day.date.toLocaleDateString()}
        >
          {day.date.getDate()}
        </div>
      ))}
    </div>
  );
}

export function PropertyDetails({ propertyId, open, onOpenChange }: PropertyDetailsProps) {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<PropertyStatus | null>(null);

  const { data: property, isLoading } = useQuery<AccommodationProperty>({
    queryKey: ['/api/accommodations', propertyId],
    enabled: open && !!propertyId,
  });

  const { data: bookingsData } = useQuery<{ bookings: AccommodationBooking[] }>({
    queryKey: ['/api/accommodations', propertyId, 'bookings'],
    enabled: open && !!propertyId,
  });

  const { data: feedsData } = useQuery<{ feeds: ICalFeed[] }>({
    queryKey: ['/api/accommodations', propertyId, 'feeds'],
    enabled: open && !!propertyId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AccommodationProperty>) => {
      return apiRequest('PUT', `/api/accommodations/${propertyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accommodations'] });
      toast({ title: 'Property updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update property', variant: 'destructive' });
    },
  });

  const handleStatusChange = (status: PropertyStatus) => {
    setSelectedStatus(status);
    updateMutation.mutate({ status });
  };

  if (!open) return null;

  const currentStatus = selectedStatus || property?.status || 'discovered';
  const bookings = bookingsData?.bookings || [];
  const feeds = feedsData?.feeds || [];
  const availabilityBlocks = feeds.length > 0 ? [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : property ? (
              <div className="space-y-6">
                {/* HEADER */}
                <div className="flex gap-4" data-testid="section-header">
                  {property.thumbnailUrl ? (
                    <img
                      src={property.thumbnailUrl}
                      alt={property.name}
                      className="w-48 h-32 object-cover rounded-md"
                      data-testid="img-property-thumbnail"
                    />
                  ) : (
                    <div className="w-48 h-32 bg-muted rounded-md flex items-center justify-center">
                      <Bed className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-xl font-bold" data-testid="text-property-name">{property.name}</h2>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <MapPin className="w-3 h-3" />
                          <span data-testid="text-location">
                            {property.city ? `${property.city}, ` : ''}{property.region || 'BC'}
                          </span>
                        </div>
                      </div>
                      <CrewScoreBadge score={property.crewScore} />
                    </div>

                    <div className="flex items-center gap-4">
                      {property.overallRating && (
                        <div className="flex items-center gap-1" data-testid="rating-stars">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{property.overallRating.toFixed(2)}</span>
                          <span className="text-muted-foreground text-sm">
                            ({property.reviewCount} reviews)
                          </span>
                        </div>
                      )}

                      <Badge className={STATUS_COLORS[currentStatus]} data-testid="badge-status">
                        {currentStatus.toUpperCase()}
                      </Badge>
                    </div>

                    {property.sourceUrl && (
                      <a
                        href={property.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        data-testid="link-external"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View on {property.source === 'airbnb' ? 'Airbnb' : property.source === 'booking' ? 'Booking.com' : 'Source'}
                      </a>
                    )}
                  </div>
                </div>

                <Separator />

                {/* KEY INFO GRID */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4" data-testid="section-key-info">
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{property.maxGuests || '-'}</div>
                    <div className="text-xs text-muted-foreground">Max Guests</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <Bed className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{property.bedrooms || '-'}</div>
                    <div className="text-xs text-muted-foreground">Bedrooms</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <Bed className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{property.beds || '-'}</div>
                    <div className="text-xs text-muted-foreground">Beds</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <Bath className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{property.bathrooms || '-'}</div>
                    <div className="text-xs text-muted-foreground">Bathrooms</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">
                      {property.baseNightlyRate ? `$${property.baseNightlyRate.toFixed(0)}` : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">Per Night</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{property.minNights || '-'}</div>
                    <div className="text-xs text-muted-foreground">Min Nights</div>
                  </div>
                </div>

                {/* CREW-FRIENDLY FEATURES */}
                <Card data-testid="section-features">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Crew-Friendly Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FeatureCheck available={property.hasParking} label="Parking Available" icon={Car} />
                      <FeatureCheck available={property.hasKitchen} label="Full Kitchen" icon={Utensils} />
                      <FeatureCheck available={property.hasWifi} label="WiFi" icon={Wifi} />
                      <FeatureCheck 
                        available={property.hasWasher && property.hasDryer} 
                        label="Washer/Dryer" 
                        icon={WashingMachine} 
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* DESCRIPTION */}
                {property.description && (
                  <Card data-testid="section-description">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-48">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {property.description}
                        </p>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {/* AVAILABILITY SECTION */}
                <Card data-testid="section-availability">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium">Availability (Next 30 Days)</CardTitle>
                    {feeds.length === 0 && (
                      <Button size="sm" variant="outline" data-testid="button-add-ical">
                        <Plus className="w-3 h-3 mr-1" />
                        Add iCal Feed
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {feeds.length > 0 ? (
                      <MiniCalendar blocks={availabilityBlocks.map(b => ({ start: '', end: '' }))} />
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No iCal feeds configured. Add a feed to see availability.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* BOOKING HISTORY */}
                <Card data-testid="section-bookings">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium">Booking History</CardTitle>
                    <Button size="sm" variant="outline" data-testid="button-add-booking">
                      <Plus className="w-3 h-3 mr-1" />
                      Add Booking
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {bookings.length > 0 ? (
                      <div className="space-y-2">
                        {bookings.slice(0, 5).map((booking) => (
                          <div 
                            key={booking.id} 
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                            data-testid={`row-booking-${booking.id}`}
                          >
                            <div>
                              <span className="font-medium">{booking.bookingRef}</span>
                              <span className="text-muted-foreground ml-2">
                                {booking.checkInDate} - {booking.checkOutDate}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {booking.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No bookings recorded for this property.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Separator />

                {/* ACTION BUTTONS */}
                <div className="flex flex-wrap items-center gap-3" data-testid="section-actions">
                  <Button variant="outline" data-testid="button-edit-property">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Property
                  </Button>
                  
                  <Button variant="outline" data-testid="button-add-to-trip">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Add to Trip
                  </Button>

                  <Button variant="outline" data-testid="button-contact-host">
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Host
                  </Button>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={currentStatus} onValueChange={(v) => handleStatusChange(v as PropertyStatus)}>
                      <SelectTrigger className="w-36" data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* METADATA */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground" data-testid="section-metadata">
                  <span>ID: {property.id}</span>
                  {property.airbnbId && <span>Airbnb: {property.airbnbId}</span>}
                  {property.lastScrapedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last scraped: {new Date(property.lastScrapedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Property not found
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PropertyDetails;
