import { useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check, Loader2, Calendar, Truck, User, ClipboardCheck, PartyPopper } from 'lucide-react';

interface Property {
  id: number;
  name: string;
  city: string;
  region: string;
  maxCombinedLengthFt: number;
  thumbnailUrl?: string;
  checkInTime: string;
  checkOutTime: string;
}

interface PricingEstimate {
  nightlyRate: number;
  numNights: number;
  subtotal: number;
  serviceFee: number;
  taxes: number;
  totalCost: number;
}

export default function BookingFlow() {
  const [, params] = useRoute('/staging/:id/book');
  const [, setLocation] = useLocation();
  const id = params?.id;

  const [step, setStep] = useState(1);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const [checkInDate, setCheckInDate] = useState(urlParams.get('checkIn') || '');
  const [checkOutDate, setCheckOutDate] = useState(urlParams.get('checkOut') || '');
  const [numAdults, setNumAdults] = useState(1);
  const [numChildren, setNumChildren] = useState(0);
  const [numPets, setNumPets] = useState(0);

  const [vehicleType, setVehicleType] = useState('');
  const [vehicleLengthFt, setVehicleLengthFt] = useState<number | ''>('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [pricing, setPricing] = useState<PricingEstimate | null>(null);
  const [bookingResult, setBookingResult] = useState<any>(null);

  useEffect(() => {
    async function loadProperty() {
      try {
        const res = await fetch(`/api/staging/properties/${id}`);
        const data = await res.json();
        if (data.property) {
          setProperty(data.property);
        } else {
          setError('Property not found');
        }
      } catch (err) {
        setError('Failed to load property');
      } finally {
        setLoading(false);
      }
    }
    if (id) loadProperty();
  }, [id]);

  useEffect(() => {
    if (checkInDate && checkOutDate && property) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      if (nights > 0) {
        fetch(`/api/staging/properties/${id}/pricing?checkIn=${checkInDate}&checkOut=${checkOutDate}`)
          .then(res => res.json())
          .then(data => {
            if (data.pricing) {
              setPricing(data.pricing);
            } else if (data.nightly) {
              const subtotal = data.nightly * nights;
              const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
              const taxes = Math.round(subtotal * 0.12 * 100) / 100;
              setPricing({
                nightlyRate: data.nightly,
                numNights: nights,
                subtotal,
                serviceFee,
                taxes,
                totalCost: subtotal + serviceFee + taxes
              });
            }
          })
          .catch(() => {
            const nightlyRate = 50;
            const subtotal = nightlyRate * nights;
            const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
            const taxes = Math.round(subtotal * 0.12 * 100) / 100;
            setPricing({
              nightlyRate,
              numNights: nights,
              subtotal,
              serviceFee,
              taxes,
              totalCost: subtotal + serviceFee + taxes
            });
          });
      }
    }
  }, [checkInDate, checkOutDate, property, id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/staging/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property?.id,
          guestType: companyName ? 'company' : 'individual',
          guestName,
          guestEmail,
          guestPhone,
          companyName: companyName || undefined,
          checkInDate,
          checkOutDate,
          numAdults,
          numChildren,
          numPets,
          vehicleType,
          vehicleLengthFt: vehicleLengthFt || undefined,
          vehicleDescription,
          licensePlate,
          specialRequests
        })
      });

      const data = await res.json();

      if (data.success) {
        setBookingResult(data);
        setStep(5);
      } else {
        setError(data.error || 'Failed to create booking');
      }
    } catch (err) {
      setError('Failed to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const stepIcons = [Calendar, Truck, User, ClipboardCheck, PartyPopper];
  const stepLabels = ['Dates', 'Vehicle', 'Guest Info', 'Review', 'Confirmation'];

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link href={`/staging/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to property
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-booking-title">Book Your Stay</h1>
          <p className="text-muted-foreground">{property?.name} - {property?.city}, {property?.region}</p>
        </div>

        <div className="flex mb-8 gap-1">
          {stepLabels.map((label, i) => {
            const Icon = stepIcons[i];
            return (
              <div key={i} className={`flex-1 text-center border-b-2 pb-2 ${
                step > i + 1 ? 'border-green-500' : step === i + 1 ? 'border-primary' : 'border-muted'
              }`}>
                <div className="flex items-center justify-center gap-1">
                  <Icon className={`h-4 w-4 ${
                    step > i + 1 ? 'text-green-500' : step === i + 1 ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <span className={`text-sm hidden sm:inline ${
                    step > i + 1 ? 'text-green-500' : step === i + 1 ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {error && step < 5 && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                {step === 1 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Select Dates & Guests</h2>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <Label>Check-in Date</Label>
                        <Input
                          type="date"
                          value={checkInDate}
                          onChange={(e) => setCheckInDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          data-testid="input-checkin-date"
                        />
                      </div>
                      <div>
                        <Label>Check-out Date</Label>
                        <Input
                          type="date"
                          value={checkOutDate}
                          onChange={(e) => setCheckOutDate(e.target.value)}
                          min={checkInDate || new Date().toISOString().split('T')[0]}
                          data-testid="input-checkout-date"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <Label>Adults</Label>
                        <Select value={String(numAdults)} onValueChange={(v) => setNumAdults(parseInt(v))}>
                          <SelectTrigger data-testid="select-adults">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Children</Label>
                        <Select value={String(numChildren)} onValueChange={(v) => setNumChildren(parseInt(v))}>
                          <SelectTrigger data-testid="select-children">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0,1,2,3,4,5,6].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Pets</Label>
                        <Select value={String(numPets)} onValueChange={(v) => setNumPets(parseInt(v))}>
                          <SelectTrigger data-testid="select-pets">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0,1,2,3,4].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={() => setStep(2)}
                      disabled={!checkInDate || !checkOutDate}
                      className="w-full"
                      data-testid="button-continue-step1"
                    >
                      Continue to Vehicle Info
                    </Button>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Vehicle Information</h2>

                    <div className="mb-4">
                      <Label>Vehicle Type</Label>
                      <Select value={vehicleType} onValueChange={setVehicleType}>
                        <SelectTrigger data-testid="select-vehicle-type">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="class_a">Class A Motorhome</SelectItem>
                          <SelectItem value="class_b">Class B (Camper Van)</SelectItem>
                          <SelectItem value="class_c">Class C Motorhome</SelectItem>
                          <SelectItem value="travel_trailer">Travel Trailer</SelectItem>
                          <SelectItem value="fifth_wheel">Fifth Wheel</SelectItem>
                          <SelectItem value="truck_camper">Truck Camper</SelectItem>
                          <SelectItem value="popup">Pop-up Camper</SelectItem>
                          <SelectItem value="tent">Tent</SelectItem>
                          <SelectItem value="semi_truck">Semi Truck</SelectItem>
                          <SelectItem value="work_truck">Work Truck</SelectItem>
                          <SelectItem value="horse_trailer">Horse Trailer</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>
                          Total Length (ft)
                          {property?.maxCombinedLengthFt && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              (max {property.maxCombinedLengthFt}ft)
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          value={vehicleLengthFt}
                          onChange={(e) => setVehicleLengthFt(e.target.value ? parseInt(e.target.value) : '')}
                          placeholder="e.g. 35"
                          data-testid="input-vehicle-length"
                        />
                        {vehicleLengthFt && property?.maxCombinedLengthFt && vehicleLengthFt > property.maxCombinedLengthFt && (
                          <p className="text-destructive text-sm mt-1">
                            Vehicle may be too long for this property
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>License Plate</Label>
                        <Input
                          type="text"
                          value={licensePlate}
                          onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                          placeholder="ABC 123"
                          data-testid="input-license-plate"
                        />
                      </div>
                    </div>

                    <div className="mb-6">
                      <Label>Vehicle Description (optional)</Label>
                      <Input
                        type="text"
                        value={vehicleDescription}
                        onChange={(e) => setVehicleDescription(e.target.value)}
                        placeholder="e.g. 2020 Winnebago Vista, white"
                        data-testid="input-vehicle-description"
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setStep(1)} className="flex-1" data-testid="button-back-step2">
                        Back
                      </Button>
                      <Button onClick={() => setStep(3)} className="flex-1" data-testid="button-continue-step2">
                        Continue to Guest Info
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Guest Information</h2>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="col-span-2">
                        <Label>Full Name *</Label>
                        <Input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="John Smith"
                          data-testid="input-guest-name"
                        />
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="john@example.com"
                          data-testid="input-guest-email"
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="250-555-1234"
                          data-testid="input-guest-phone"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <Label>Company Name (for business bookings)</Label>
                      <Input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Optional"
                        data-testid="input-company-name"
                      />
                    </div>

                    <div className="mb-6">
                      <Label>Special Requests</Label>
                      <Textarea
                        value={specialRequests}
                        onChange={(e) => setSpecialRequests(e.target.value)}
                        placeholder="Any special needs or requests..."
                        rows={3}
                        data-testid="input-special-requests"
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setStep(2)} className="flex-1" data-testid="button-back-step3">
                        Back
                      </Button>
                      <Button
                        onClick={() => setStep(4)}
                        disabled={!guestName || !guestEmail}
                        className="flex-1"
                        data-testid="button-continue-step3"
                      >
                        Review Booking
                      </Button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Review Your Booking</h2>

                    <div className="space-y-4 mb-6">
                      <div className="border-b pb-4">
                        <h3 className="font-medium mb-2">Dates & Guests</h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Check-in: {new Date(checkInDate).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          <p>Check-out: {new Date(checkOutDate).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          <p>Guests: {numAdults} adult{numAdults > 1 ? 's' : ''}{numChildren > 0 ? `, ${numChildren} child${numChildren > 1 ? 'ren' : ''}` : ''}{numPets > 0 ? `, ${numPets} pet${numPets > 1 ? 's' : ''}` : ''}</p>
                        </div>
                      </div>

                      {vehicleType && (
                        <div className="border-b pb-4">
                          <h3 className="font-medium mb-2">Vehicle</h3>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Type: {vehicleType.replace(/_/g, ' ')}</p>
                            {vehicleLengthFt && <p>Length: {vehicleLengthFt} ft</p>}
                            {licensePlate && <p>License: {licensePlate}</p>}
                            {vehicleDescription && <p>Description: {vehicleDescription}</p>}
                          </div>
                        </div>
                      )}

                      <div className="border-b pb-4">
                        <h3 className="font-medium mb-2">Guest</h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{guestName}</p>
                          <p>{guestEmail}</p>
                          {guestPhone && <p>{guestPhone}</p>}
                          {companyName && <p>Company: {companyName}</p>}
                        </div>
                      </div>

                      {specialRequests && (
                        <div>
                          <h3 className="font-medium mb-2">Special Requests</h3>
                          <p className="text-sm text-muted-foreground">{specialRequests}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setStep(3)} className="flex-1" data-testid="button-back-step4">
                        Back
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1"
                        data-testid="button-confirm-booking"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Confirm Booking'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {step === 5 && bookingResult && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
                    <p className="text-muted-foreground mb-6">
                      Your reservation has been submitted successfully.
                    </p>

                    <Card className="text-left mb-6">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Booking Reference</span>
                          <span className="font-mono font-bold" data-testid="text-booking-ref">{bookingResult.booking.bookingRef}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Property</span>
                          <span>{bookingResult.booking.propertyName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dates</span>
                          <span>{bookingResult.booking.checkInDate} to {bookingResult.booking.checkOutDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nights</span>
                          <span>{bookingResult.booking.numNights}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-medium">Total</span>
                          <span className="font-bold text-green-600">${bookingResult.booking.totalCost}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <p className="text-sm text-muted-foreground mb-4">
                      A confirmation email will be sent to {guestEmail}
                    </p>

                    <div className="flex gap-4 justify-center">
                      <Button variant="outline" asChild>
                        <Link href="/staging" data-testid="link-search-more">Search More Properties</Link>
                      </Button>
                      <Button asChild>
                        <Link href={`/staging/${id}`} data-testid="link-view-property">View Property</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="hidden lg:block">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Price Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {pricing ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>${pricing.nightlyRate} x {pricing.numNights} nights</span>
                      <span>${pricing.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Service fee</span>
                      <span>${pricing.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Taxes (GST + PST)</span>
                      <span>${pricing.taxes.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span data-testid="text-total-price">${pricing.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Select dates to see pricing</p>
                )}

                {property && (
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                    <p>Check-in: {property.checkInTime || '14:00'}</p>
                    <p>Check-out: {property.checkOutTime || '11:00'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
