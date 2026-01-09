import { useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ArrowLeft, ArrowRight, Check, Loader2, Calendar, Truck,
  MapPin, Wrench, CreditCard, CheckCircle, Download, User, Dog
} from 'lucide-react';

interface PropertyDetail {
  id: number;
  name: string;
  city: string;
  region: string;
  baseNightlyRate: string | null;
  checkInTime: string;
  checkOutTime: string;
  petsAllowed: boolean;
  petFeePerNight: string | null;
  isHorseFriendly: boolean;
  [key: string]: any;
}

interface Spot {
  id: number;
  spotName: string;
  spotNumber: string;
  spotType: string;
  maxLengthFt: number | null;
  hasPower: boolean;
  powerAmps: number | null;
  hasWater: boolean;
  hasSewer: boolean;
  nightlyRate: string | null;
}

interface Provider {
  id: number;
  providerType: string;
  businessName: string | null;
  providerName: string | null;
  isResident: boolean;
  servicesOffered?: string[];
}

interface ReservationData {
  checkIn: string;
  checkOut: string;
  vehicleType: string;
  vehicleLength: string;
  vehicleWidth: string;
  vehicleNeeds: string[];
  guests: number;
  pets: number;
  horses: number;
  selectedSpot: number | null;
  selectedServices: number[];
  specialRequests: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  acceptTerms: boolean;
}

const vehicleTypes = [
  { value: 'motorhome_a', label: 'Class A Motorhome' },
  { value: 'motorhome_b', label: 'Class B Motorhome' },
  { value: 'motorhome_c', label: 'Class C Motorhome' },
  { value: 'travel_trailer', label: 'Travel Trailer' },
  { value: 'fifth_wheel', label: 'Fifth Wheel' },
  { value: 'truck_camper', label: 'Truck Camper' },
  { value: 'van', label: 'Camper Van' },
  { value: 'semi_truck', label: 'Semi Truck' },
  { value: 'horse_trailer', label: 'Horse Trailer' },
  { value: 'tent', label: 'Tent' },
  { value: 'other', label: 'Other' }
];

const defaultReservation: ReservationData = {
  checkIn: '',
  checkOut: '',
  vehicleType: '',
  vehicleLength: '',
  vehicleWidth: '',
  vehicleNeeds: [],
  guests: 1,
  pets: 0,
  horses: 0,
  selectedSpot: null,
  selectedServices: [],
  specialRequests: '',
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  acceptTerms: false
};

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
            ${i < currentStep ? 'bg-primary text-primary-foreground' : ''}
            ${i === currentStep ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : ''}
            ${i > currentStep ? 'bg-muted text-muted-foreground' : ''}
          `}>
            {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-1 ${i < currentStep ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function BookStaging() {
  const [, params] = useRoute('/staging/:id/book');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const propertyId = params?.id ? parseInt(params.id) : null;
  
  const [step, setStep] = useState(0);
  const [reservation, setReservation] = useState<ReservationData>(defaultReservation);
  const [reservationComplete, setReservationComplete] = useState(false);
  const [reservationRef, setReservationRef] = useState('');

  const steps = ['Dates & Vehicle', 'Select Spot', 'Services', 'Review', 'Payment'];

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkIn = urlParams.get('checkIn');
    const checkOut = urlParams.get('checkOut');
    if (checkIn) setReservation(b => ({ ...b, checkIn }));
    if (checkOut) setReservation(b => ({ ...b, checkOut }));
  }, []);

  const { data: property, isLoading: loadingProperty } = useQuery<PropertyDetail>({
    queryKey: ['/api/staging/properties', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const res = await fetch(`/api/staging/properties/${propertyId}`);
      if (!res.ok) throw new Error('Failed to load property');
      return res.json();
    }
  });

  const { data: spotsData } = useQuery({
    queryKey: ['/api/staging/properties', propertyId, 'spots'],
    enabled: !!propertyId,
    queryFn: async () => {
      const res = await fetch(`/api/staging/properties/${propertyId}/spots`);
      if (!res.ok) return { spots: [] };
      return res.json();
    }
  });

  const { data: providersData } = useQuery({
    queryKey: ['/api/staging/properties', propertyId, 'providers'],
    enabled: !!propertyId,
    queryFn: async () => {
      const res = await fetch(`/api/staging/properties/${propertyId}/providers`);
      if (!res.ok) return { providers: [] };
      return res.json();
    }
  });

  const createReservationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/staging/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Reservation failed');
      return res.json();
    },
    onSuccess: (data) => {
      setReservationRef(data.reservationRef || 'BK-' + Date.now());
      setReservationComplete(true);
      toast({ title: 'Reservation confirmed!' });
    },
    onError: () => {
      toast({ title: 'Reservation failed', description: 'Please try again', variant: 'destructive' });
    }
  });

  const calculateNights = () => {
    if (!reservation.checkIn || !reservation.checkOut) return 0;
    const start = new Date(reservation.checkIn);
    const end = new Date(reservation.checkOut);
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const calculatePrice = () => {
    const nights = calculateNights();
    const spot = spotsData?.spots?.find((s: Spot) => s.id === reservation.selectedSpot);
    const nightlyRate = spot?.nightlyRate 
      ? parseFloat(spot.nightlyRate) 
      : property?.baseNightlyRate 
        ? parseFloat(property.baseNightlyRate) 
        : 0;
    
    const subtotal = nightlyRate * nights;
    const petFee = reservation.pets > 0 && property?.petFeePerNight 
      ? parseFloat(property.petFeePerNight) * reservation.pets * nights 
      : 0;
    const taxes = (subtotal + petFee) * 0.12;
    const total = subtotal + petFee + taxes;

    return { nights, nightlyRate, subtotal, petFee, taxes, total };
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return reservation.checkIn && reservation.checkOut && reservation.vehicleType && reservation.guests > 0;
      case 1:
        return spotsData?.spots?.length === 0 || reservation.selectedSpot !== null;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return reservation.guestName && reservation.guestEmail && reservation.acceptTerms;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      const price = calculatePrice();
      createReservationMutation.mutate({
        propertyId,
        spotId: reservation.selectedSpot,
        checkInDate: reservation.checkIn,
        checkOutDate: reservation.checkOut,
        guestName: reservation.guestName,
        guestEmail: reservation.guestEmail,
        guestPhone: reservation.guestPhone,
        vehicleType: reservation.vehicleType,
        vehicleLength: reservation.vehicleLength ? parseInt(reservation.vehicleLength) : null,
        guests: reservation.guests,
        pets: reservation.pets,
        horses: reservation.horses,
        specialRequests: reservation.specialRequests,
        totalCost: price.total.toFixed(2),
        status: 'pending'
      });
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const availableSpots = spotsData?.spots?.filter((spot: Spot) => {
    if (!reservation.vehicleLength) return true;
    if (!spot.maxLengthFt) return true;
    return spot.maxLengthFt >= parseInt(reservation.vehicleLength);
  }) || [];

  if (loadingProperty) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Property not found</p>
          <Link href="/staging">
            <Button>Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (reservationComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Reservation Confirmed!</h1>
            <p className="text-muted-foreground mb-6">Your reservation has been submitted</p>
            
            <div className="bg-muted rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-muted-foreground">Reservation Reference</p>
              <p className="text-xl font-mono font-bold" data-testid="text-reservation-ref">{reservationRef}</p>
            </div>

            <div className="text-left space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium">{property.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-in</span>
                <span>{reservation.checkIn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-out</span>
                <span>{reservation.checkOut}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">${calculatePrice().total.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-left p-4 bg-muted rounded-lg mb-6">
              <p className="font-medium mb-2">Check-in Instructions</p>
              <p className="text-sm text-muted-foreground">
                Check-in time is {property.checkInTime || '2:00 PM'}. 
                Please proceed to the office upon arrival for key pickup and site assignment.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" data-testid="button-download-calendar">
                <Download className="h-4 w-4 mr-2" /> Add to Calendar
              </Button>
              <Link href="/staging/reservations">
                <Button className="w-full" data-testid="button-view-reservations">
                  View My Reservations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const price = calculatePrice();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Link href={`/staging/${propertyId}`}>
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Property
          </Button>
        </Link>

        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-1">Book Your Stay</h1>
            <p className="text-muted-foreground">{property.name}</p>
          </div>

          <StepIndicator currentStep={step} steps={steps} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="pt-6">
                  {step === 0 && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Calendar className="h-5 w-5" /> Dates
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Check In</Label>
                            <Input
                              type="date"
                              value={reservation.checkIn}
                              onChange={(e) => setReservation({ ...reservation, checkIn: e.target.value })}
                              min={new Date().toISOString().split('T')[0]}
                              data-testid="input-checkin"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Check Out</Label>
                            <Input
                              type="date"
                              value={reservation.checkOut}
                              onChange={(e) => setReservation({ ...reservation, checkOut: e.target.value })}
                              min={reservation.checkIn || new Date().toISOString().split('T')[0]}
                              data-testid="input-checkout"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Truck className="h-5 w-5" /> Vehicle
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Vehicle Type</Label>
                            <Select 
                              value={reservation.vehicleType} 
                              onValueChange={(v) => setReservation({ ...reservation, vehicleType: v })}
                            >
                              <SelectTrigger data-testid="select-vehicle-type">
                                <SelectValue placeholder="Select vehicle type" />
                              </SelectTrigger>
                              <SelectContent>
                                {vehicleTypes.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Length (ft)</Label>
                              <Input
                                type="number"
                                value={reservation.vehicleLength}
                                onChange={(e) => setReservation({ ...reservation, vehicleLength: e.target.value })}
                                placeholder="e.g. 35"
                                data-testid="input-vehicle-length"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Width (ft)</Label>
                              <Input
                                type="number"
                                value={reservation.vehicleWidth}
                                onChange={(e) => setReservation({ ...reservation, vehicleWidth: e.target.value })}
                                placeholder="e.g. 8"
                                data-testid="input-vehicle-width"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Hookup Needs</Label>
                            <div className="flex flex-wrap gap-4">
                              {['Power', 'Water', 'Sewer'].map(need => (
                                <div key={need} className="flex items-center gap-2">
                                  <Checkbox
                                    checked={reservation.vehicleNeeds.includes(need.toLowerCase())}
                                    onCheckedChange={(c) => {
                                      const needs = c 
                                        ? [...reservation.vehicleNeeds, need.toLowerCase()]
                                        : reservation.vehicleNeeds.filter(n => n !== need.toLowerCase());
                                      setReservation({ ...reservation, vehicleNeeds: needs });
                                    }}
                                  />
                                  <Label className="font-normal">{need}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <User className="h-5 w-5" /> Guests
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Guests</Label>
                            <Input
                              type="number"
                              min={1}
                              value={reservation.guests}
                              onChange={(e) => setReservation({ ...reservation, guests: parseInt(e.target.value) || 1 })}
                              data-testid="input-guests"
                            />
                          </div>
                          {property.petsAllowed && (
                            <div className="space-y-2">
                              <Label>Pets</Label>
                              <Input
                                type="number"
                                min={0}
                                value={reservation.pets}
                                onChange={(e) => setReservation({ ...reservation, pets: parseInt(e.target.value) || 0 })}
                                data-testid="input-pets"
                              />
                            </div>
                          )}
                          {property.isHorseFriendly && (
                            <div className="space-y-2">
                              <Label>Horses</Label>
                              <Input
                                type="number"
                                min={0}
                                value={reservation.horses}
                                onChange={(e) => setReservation({ ...reservation, horses: parseInt(e.target.value) || 0 })}
                                data-testid="input-horses"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-5 w-5" /> Select Your Spot
                      </h3>
                      
                      {availableSpots.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No specific spots available - property will assign on arrival</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => setReservation({ ...reservation, selectedSpot: -1 })}
                          >
                            Continue with any available spot
                          </Button>
                        </div>
                      ) : (
                        <RadioGroup
                          value={reservation.selectedSpot?.toString() || ''}
                          onValueChange={(v) => setReservation({ ...reservation, selectedSpot: parseInt(v) })}
                        >
                          <div className="space-y-3">
                            {availableSpots.map((spot: Spot) => (
                              <div 
                                key={spot.id}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                                  reservation.selectedSpot === spot.id 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-muted hover-elevate'
                                }`}
                                onClick={() => setReservation({ ...reservation, selectedSpot: spot.id })}
                              >
                                <div className="flex items-start gap-3">
                                  <RadioGroupItem value={spot.id.toString()} id={`spot-${spot.id}`} />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <Label htmlFor={`spot-${spot.id}`} className="font-medium cursor-pointer">
                                        {spot.spotName || `Spot ${spot.spotNumber}`}
                                      </Label>
                                      {spot.nightlyRate && (
                                        <span className="font-semibold">${parseFloat(spot.nightlyRate).toFixed(0)}/night</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {spot.spotType} {spot.maxLengthFt && `- Up to ${spot.maxLengthFt}ft`}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {spot.hasPower && <Badge variant="outline" className="text-xs">Power {spot.powerAmps}A</Badge>}
                                      {spot.hasWater && <Badge variant="outline" className="text-xs">Water</Badge>}
                                      {spot.hasSewer && <Badge variant="outline" className="text-xs">Sewer</Badge>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Wrench className="h-5 w-5" /> Add Services (Optional)
                      </h3>
                      
                      {providersData?.providers?.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                          No on-site services available at this property
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {providersData?.providers?.map((provider: Provider) => (
                            <div
                              key={provider.id}
                              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                                reservation.selectedServices.includes(provider.id)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-muted hover-elevate'
                              }`}
                              onClick={() => {
                                const services = reservation.selectedServices.includes(provider.id)
                                  ? reservation.selectedServices.filter(id => id !== provider.id)
                                  : [...reservation.selectedServices, provider.id];
                                setReservation({ ...reservation, selectedServices: services });
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox checked={reservation.selectedServices.includes(provider.id)} />
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">
                                      {provider.businessName || provider.providerName}
                                    </span>
                                    {provider.isResident && (
                                      <Badge className="bg-green-500 text-xs">Resident</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {provider.providerType?.replace(/_/g, ' ')}
                                  </p>
                                  {provider.providerType === 'mechanic' && (
                                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                      Oil change while you sleep!
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-6">
                      <h3 className="font-semibold">Review Your Reservation</h3>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                          <div>
                            <p className="text-sm text-muted-foreground">Check-in</p>
                            <p className="font-medium">{reservation.checkIn}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Check-out</p>
                            <p className="font-medium">{reservation.checkOut}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Vehicle</p>
                            <p className="font-medium">{vehicleTypes.find(t => t.value === reservation.vehicleType)?.label}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Guests</p>
                            <p className="font-medium">{reservation.guests} {reservation.pets > 0 && `+ ${reservation.pets} pet(s)`}</p>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-medium mb-2">Price Breakdown</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>${price.nightlyRate.toFixed(2)} x {price.nights} nights</span>
                              <span>${price.subtotal.toFixed(2)}</span>
                            </div>
                            {price.petFee > 0 && (
                              <div className="flex justify-between">
                                <span>Pet fees</span>
                                <span>${price.petFee.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                              <span>Taxes (12%)</span>
                              <span>${price.taxes.toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold text-base">
                              <span>Total</span>
                              <span>${price.total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Special Requests (optional)</Label>
                          <Textarea
                            value={reservation.specialRequests}
                            onChange={(e) => setReservation({ ...reservation, specialRequests: e.target.value })}
                            placeholder="Any special requirements or requests..."
                            data-testid="textarea-special-requests"
                          />
                        </div>

                        <div className="p-4 bg-muted rounded-lg">
                          <h4 className="font-medium mb-2">Cancellation Policy</h4>
                          <p className="text-sm text-muted-foreground">
                            Free cancellation up to 48 hours before check-in. After that, 
                            the first night is non-refundable.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-6">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Complete Your Reservation
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input
                            value={reservation.guestName}
                            onChange={(e) => setReservation({ ...reservation, guestName: e.target.value })}
                            placeholder="John Doe"
                            data-testid="input-guest-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={reservation.guestEmail}
                            onChange={(e) => setReservation({ ...reservation, guestEmail: e.target.value })}
                            placeholder="john@example.com"
                            data-testid="input-guest-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            type="tel"
                            value={reservation.guestPhone}
                            onChange={(e) => setReservation({ ...reservation, guestPhone: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                            data-testid="input-guest-phone"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">
                          Payment will be collected upon confirmation. You won't be charged now.
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={reservation.acceptTerms}
                          onCheckedChange={(c) => setReservation({ ...reservation, acceptTerms: c === true })}
                          data-testid="checkbox-terms"
                        />
                        <Label className="font-normal text-sm">
                          I agree to the terms of service and cancellation policy
                        </Label>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={step === 0}
                  data-testid="button-back-step"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || createReservationMutation.isPending}
                  data-testid="button-next-step"
                >
                  {createReservationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {step === steps.length - 1 ? 'Complete Reservation' : 'Continue'}
                  {step < steps.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{property.name}</CardTitle>
                  <CardDescription>
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {property.city || property.region}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reservation.checkIn && reservation.checkOut && (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dates</span>
                        <span>{price.nights} night(s)</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>${price.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
