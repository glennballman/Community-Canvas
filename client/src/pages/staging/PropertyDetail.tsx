import { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  MapPin, Star, Calendar, ArrowLeft, Loader2, Check, X,
  Wifi, Zap, Droplets, ShowerHead, Dog, Truck, TreePine,
  Phone, Clock, ExternalLink, Wrench, ChevronLeft, ChevronRight
} from 'lucide-react';

interface PropertyDetail {
  id: number;
  canvasId: string;
  name: string;
  description: string | null;
  propertyType: string;
  region: string;
  city: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  thumbnailUrl: string | null;
  images: string[];
  crewScore: number;
  rvScore: number;
  truckerScore: number;
  equestrianScore: number;
  totalSpots: number;
  overallRating: string | null;
  reviewCount: number;
  checkInTime: string;
  checkOutTime: string;
  minNights: number;
  maxStayDays: number;
  petsAllowed: boolean;
  dogsAllowed: boolean;
  maxPets: number | null;
  petFeePerNight: string | null;
  hasWifi: boolean;
  hasShowers: boolean;
  hasBathrooms: boolean;
  hasLaundry: boolean;
  hasShorePower: boolean;
  powerAmps: number | null;
  hasWaterHookup: boolean;
  hasSewerHookup: boolean;
  hasDumpStation: boolean;
  isHorseFriendly: boolean;
  acceptsSemiTrucks: boolean;
  baseNightlyRate?: string;
  baseWeeklyRate?: string;
  baseMonthlyRate?: string;
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
  isAvailable: boolean;
}

interface Provider {
  id: number;
  providerType: string;
  businessName: string | null;
  providerName: string | null;
  phone: string | null;
  isResident: boolean;
  available24hr: boolean;
}

function AmenityItem({ available, label, icon: Icon }: { available: boolean; label: string; icon: React.ElementType }) {
  return (
    <div className={`flex items-center gap-2 ${available ? '' : 'opacity-40'}`}>
      {available ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4" />}
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default function PropertyDetail() {
  const [, params] = useRoute('/staging/:id');
  const propertyId = params?.id ? parseInt(params.id) : null;
  
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const { data: property, isLoading } = useQuery<PropertyDetail>({
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

  const allImages = property?.thumbnailUrl 
    ? [property.thumbnailUrl, ...(property.images || [])]
    : property?.images || [];

  const calculatePrice = () => {
    if (!checkIn || !checkOut || !property?.baseNightlyRate) return null;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return null;
    return {
      nights,
      total: (parseFloat(property.baseNightlyRate) * nights).toFixed(2)
    };
  };

  const priceCalc = calculatePrice();

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <Link href="/staging">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
          </Button>
        </Link>
      </div>

      <div className="bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2 h-[300px] md:h-[400px]">
            <div 
              className="md:col-span-2 md:row-span-2 bg-muted-foreground/10 rounded-lg overflow-hidden cursor-pointer"
              onClick={() => allImages.length > 0 && setSelectedImage(0)}
            >
              {allImages[0] ? (
                <img src={allImages[0]} alt={property.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <TreePine className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>
            {allImages.slice(1, 5).map((img, i) => (
              <div 
                key={i}
                className="hidden md:block bg-muted-foreground/10 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setSelectedImage(i + 1)}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2" data-testid="text-property-name">{property.name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{property.city ? `${property.city}, ${property.region}` : property.region}</span>
                    {property.latitude && property.longitude && (
                      <a 
                        href={`https://maps.google.com/?q=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        <ExternalLink className="h-3 w-3 inline" /> View Map
                      </a>
                    )}
                  </div>
                </div>
                
                {property.overallRating && (
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-bold">{parseFloat(property.overallRating).toFixed(1)}</span>
                    <span className="text-muted-foreground">({property.reviewCount} reviews)</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="outline">{property.propertyType?.replace(/_/g, ' ')}</Badge>
                {property.crewScore > 0 && <Badge className="bg-orange-500">Crew Score: {property.crewScore}</Badge>}
                {property.rvScore > 0 && <Badge className="bg-green-500">RV Score: {property.rvScore}</Badge>}
                {property.truckerScore > 0 && <Badge className="bg-blue-500">Trucker Score: {property.truckerScore}</Badge>}
                {property.equestrianScore > 0 && <Badge className="bg-amber-500">Equestrian: {property.equestrianScore}</Badge>}
              </div>
            </div>

            {property.description && (
              <div>
                <h2 className="text-xl font-semibold mb-3">About this property</h2>
                <p className="text-muted-foreground whitespace-pre-line">{property.description}</p>
              </div>
            )}

            <Separator />

            <div>
              <h2 className="text-xl font-semibold mb-4">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">Hookups</h4>
                  <div className="space-y-2">
                    <AmenityItem available={property.hasShorePower} label={`Power${property.powerAmps ? ` (${property.powerAmps}A)` : ''}`} icon={Zap} />
                    <AmenityItem available={property.hasWaterHookup} label="Water" icon={Droplets} />
                    <AmenityItem available={property.hasSewerHookup} label="Sewer" icon={Droplets} />
                    <AmenityItem available={property.hasDumpStation} label="Dump Station" icon={Droplets} />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">Facilities</h4>
                  <div className="space-y-2">
                    <AmenityItem available={property.hasBathrooms} label="Bathrooms" icon={Check} />
                    <AmenityItem available={property.hasShowers} label="Showers" icon={ShowerHead} />
                    <AmenityItem available={property.hasLaundry} label="Laundry" icon={Check} />
                    <AmenityItem available={property.hasWifi} label="WiFi" icon={Wifi} />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">Special</h4>
                  <div className="space-y-2">
                    <AmenityItem available={property.petsAllowed || property.dogsAllowed} label="Pet Friendly" icon={Dog} />
                    <AmenityItem available={property.isHorseFriendly} label="Horse Friendly" icon={TreePine} />
                    <AmenityItem available={property.acceptsSemiTrucks} label="Semi Trucks OK" icon={Truck} />
                  </div>
                </div>
              </div>
            </div>

            {spotsData?.spots?.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold mb-4">Available Spots</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {spotsData.spots.filter((s: Spot) => s.isAvailable !== false).map((spot: Spot) => (
                      <Card key={spot.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{spot.spotName || `Spot ${spot.spotNumber}`}</h4>
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
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}

            {providersData?.providers?.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold mb-4">On-Site Services</h2>
                  <div className="space-y-4">
                    {providersData.providers.map((provider: Provider) => (
                      <Card key={provider.id} className={provider.providerType === 'mechanic' && provider.isResident ? 'border-green-500' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {provider.providerType === 'mechanic' && <Wrench className="h-4 w-4 text-green-500" />}
                                <h4 className="font-medium">{provider.businessName || provider.providerName}</h4>
                                {provider.isResident && (
                                  <Badge className="bg-green-500">Resident!</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground capitalize">{provider.providerType?.replace(/_/g, ' ')}</p>
                            </div>
                            {provider.phone && (
                              <a href={`tel:${provider.phone}`} className="flex items-center gap-1 text-primary">
                                <Phone className="h-4 w-4" />
                                <span className="text-sm">{provider.phone}</span>
                              </a>
                            )}
                          </div>
                          {provider.available24hr && (
                            <Badge variant="outline" className="mt-2">24/7 Available</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h2 className="text-xl font-semibold mb-4">Policies</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Check-in / Check-out</p>
                    <p className="text-sm text-muted-foreground">
                      Check-in: {property.checkInTime || '2:00 PM'}<br />
                      Check-out: {property.checkOutTime || '11:00 AM'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Stay Duration</p>
                    <p className="text-sm text-muted-foreground">
                      Min: {property.minNights || 1} night(s)<br />
                      Max: {property.maxStayDays || 'No limit'} days
                    </p>
                  </div>
                </div>
                {(property.petsAllowed || property.dogsAllowed) && (
                  <div className="flex items-start gap-3">
                    <Dog className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Pet Policy</p>
                      <p className="text-sm text-muted-foreground">
                        Pets allowed{property.maxPets ? ` (max ${property.maxPets})` : ''}<br />
                        {property.petFeePerNight && `$${property.petFeePerNight}/night fee`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-baseline gap-2">
                    {property.baseNightlyRate ? (
                      <>
                        <span className="text-2xl">${parseFloat(property.baseNightlyRate).toFixed(0)}</span>
                        <span className="text-muted-foreground font-normal">/ night</span>
                      </>
                    ) : (
                      <span>Contact for pricing</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Check In</Label>
                      <Input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        data-testid="input-booking-checkin"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Check Out</Label>
                      <Input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || new Date().toISOString().split('T')[0]}
                        data-testid="input-booking-checkout"
                      />
                    </div>
                  </div>

                  {priceCalc && (
                    <div className="p-3 bg-muted rounded-md space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>${property.baseNightlyRate} x {priceCalc.nights} nights</span>
                        <span>${priceCalc.total}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>${priceCalc.total}</span>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" size="lg" data-testid="button-book-now">
                    {checkIn && checkOut ? 'Book Now' : 'Check Availability'}
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    You won't be charged yet
                  </p>
                </CardContent>
              </Card>

              {property.baseWeeklyRate && (
                <div className="mt-4 p-4 rounded-md bg-muted">
                  <p className="text-sm font-medium mb-2">Extended Stay Discounts</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {property.baseWeeklyRate && <p>Weekly: ${parseFloat(property.baseWeeklyRate).toFixed(0)}</p>}
                    {property.baseMonthlyRate && <p>Monthly: ${parseFloat(property.baseMonthlyRate).toFixed(0)}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={selectedImage !== null} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedImage !== null && allImages[selectedImage] && (
            <div className="relative">
              <img 
                src={allImages[selectedImage]} 
                alt="" 
                className="w-full max-h-[80vh] object-contain"
              />
              <div className="absolute inset-y-0 left-0 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2"
                  onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))}
                  disabled={selectedImage === 0}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2"
                  onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))}
                  disabled={selectedImage === allImages.length - 1}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
