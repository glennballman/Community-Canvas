import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { 
  ArrowLeft, Calendar as CalendarIcon, Check, MapPin, 
  Users, Bed, Bath, Star, Loader2, AlertCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Asset {
  id: string;
  name: string;
  description: string | null;
  asset_type: string;
  schema_type: string | null;
  is_available: boolean;
  rate_daily: number | null;
  rate_hourly: number | null;
  thumbnail_url: string | null;
  sleeps_total: number | null;
  bedrooms: number | null;
  bathrooms_full: number | null;
  overall_rating: number | null;
  review_count: number;
  media: {
    hero: { url: string; thumbnail?: string; alt?: string } | null;
    gallery: Array<{ url: string; thumbnail?: string; alt?: string }>;
  };
}

interface AvailabilityResult {
  success: boolean;
  portal: { id: string; slug: string; name: string };
  query: { start: string; end: string };
  assets: Array<{
    asset_id: string;
    name: string;
    asset_type: string;
    description: string | null;
    thumbnail_url: string | null;
    available: boolean;
    busy_periods: Array<{ start: string; end: string }>;
  }>;
  summary: { total: number; available: number; booked: number };
}

function DateRangePicker({ 
  startDate, 
  endDate, 
  onStartChange, 
  onEndChange 
}: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartChange: (date: Date | undefined) => void;
  onEndChange: (date: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex-1 min-w-[200px]">
        <Label>Check-in Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal mt-1",
                !startDate && "text-muted-foreground"
              )}
              data-testid="button-start-date"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartChange}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex-1 min-w-[200px]">
        <Label>Check-out Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal mt-1",
                !endDate && "text-muted-foreground"
              )}
              data-testid="button-end-date"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndChange}
              disabled={(date) => date < (startDate || new Date())}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function AssetCard({ 
  asset, 
  available,
  portalSlug,
  startDate,
  endDate,
  onSelect
}: { 
  asset: AvailabilityResult['assets'][0] & { details?: Asset };
  available: boolean;
  portalSlug: string;
  startDate?: Date;
  endDate?: Date;
  onSelect: (assetId: string) => void;
}) {
  return (
    <Card 
      className={cn(
        "overflow-hidden",
        available ? "hover-elevate cursor-pointer" : "opacity-60"
      )}
      onClick={() => available && onSelect(asset.asset_id)}
      data-testid={`card-asset-${asset.asset_id}`}
    >
      <div className="aspect-video bg-muted relative">
        {asset.thumbnail_url ? (
          <img 
            src={asset.thumbnail_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <MapPin className="h-12 w-12" />
          </div>
        )}
        <Badge 
          variant={available ? "default" : "secondary"} 
          className="absolute top-2 right-2"
        >
          {available ? "Available" : "Booked"}
        </Badge>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{asset.name}</CardTitle>
        {asset.description && (
          <CardDescription className="line-clamp-2">
            {asset.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {available && startDate && endDate && (
          <Button className="w-full" data-testid={`button-select-${asset.asset_id}`}>
            Select
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ReservationForm({
  portalSlug,
  assetId,
  assetName,
  startDate,
  endDate,
  onBack,
  onSuccess
}: {
  portalSlug: string;
  assetId: string;
  assetName: string;
  startDate: Date;
  endDate: Date;
  onBack: () => void;
  onSuccess: (confirmationNumber: string) => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    notes: ''
  });
  
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/public/portals/${portalSlug}/reservations`, {
        asset_id: assetId,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        customer: {
          name: formData.name,
          email: formData.email,
          telephone: formData.telephone || undefined
        },
        notes: formData.notes || undefined
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        onSuccess(data.confirmation_number);
      } else {
        toast({
          title: "Reservation Failed",
          description: data.message || data.error,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reservation",
        variant: "destructive"
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast({
        title: "Required Fields",
        description: "Please fill in your name and email",
        variant: "destructive"
      });
      return;
    }
    mutation.mutate();
  };
  
  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <Button variant="ghost" className="w-fit mb-2" onClick={onBack} data-testid="button-back-form">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <CardTitle>Complete Your Reservation</CardTitle>
        <CardDescription>
          {assetName} - {format(startDate, "MMM d")} to {format(endDate, "MMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="John Smith"
              required
              data-testid="input-name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="john@example.com"
              required
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="telephone">Phone (optional)</Label>
            <Input
              id="telephone"
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
              placeholder="250-555-1234"
              data-testid="input-telephone"
            />
          </div>
          <div>
            <Label htmlFor="notes">Special Requests (optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special requests..."
              data-testid="input-notes"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={mutation.isPending}
            data-testid="button-submit-reservation"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirm Reservation
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ConfirmationView({
  confirmationNumber,
  portalSlug
}: {
  confirmationNumber: string;
  portalSlug: string;
}) {
  return (
    <Card className="max-w-lg mx-auto text-center">
      <CardHeader>
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">Reservation Confirmed!</CardTitle>
        <CardDescription>
          Your confirmation number is:
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted p-4 rounded-md mb-6">
          <p className="text-2xl font-mono font-bold" data-testid="text-confirmation-number">
            {confirmationNumber}
          </p>
        </div>
        <p className="text-muted-foreground mb-6">
          A confirmation email will be sent shortly with full details.
        </p>
        <Link to={`/p/${portalSlug}`}>
          <Button variant="outline" data-testid="button-back-home">
            Back to Home
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function PortalReservePage() {
  const params = useParams();
  const portalSlug = params.portalSlug as string;
  const assetIdParam = params.assetId as string | undefined;
  
  const [startDate, setStartDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 2));
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(assetIdParam);
  const [selectedAssetName, setSelectedAssetName] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);
  
  const { data: availability, isLoading } = useQuery<AvailabilityResult>({
    queryKey: ['/api/public/portals', portalSlug, 'availability', { 
      start: startDate?.toISOString().split('T')[0], 
      end: endDate?.toISOString().split('T')[0] 
    }],
    enabled: !!portalSlug && !!startDate && !!endDate,
  });
  
  const handleAssetSelect = (assetId: string) => {
    const asset = availability?.assets.find(a => a.asset_id === assetId);
    if (asset) {
      setSelectedAssetId(assetId);
      setSelectedAssetName(asset.name);
      setShowForm(true);
    }
  };
  
  if (confirmationNumber) {
    return (
      <div className="min-h-screen bg-background py-16 px-4" data-testid="page-confirmation">
        <ConfirmationView 
          confirmationNumber={confirmationNumber} 
          portalSlug={portalSlug} 
        />
      </div>
    );
  }
  
  if (showForm && selectedAssetId && startDate && endDate) {
    return (
      <div className="min-h-screen bg-background py-16 px-4" data-testid="page-reservation-form">
        <ReservationForm
          portalSlug={portalSlug}
          assetId={selectedAssetId}
          assetName={selectedAssetName}
          startDate={startDate}
          endDate={endDate}
          onBack={() => setShowForm(false)}
          onSuccess={setConfirmationNumber}
        />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background" data-testid="page-portal-reserve">
      <div className="bg-muted/30 py-8 px-4 border-b">
        <div className="max-w-6xl mx-auto">
          <Link to={`/p/${portalSlug}`}>
            <Button variant="ghost" className="mb-4" data-testid="button-back-reserve">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-6">Check Availability</h1>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto py-8 px-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : availability?.assets.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Options Available</h2>
            <p className="text-muted-foreground">
              Try selecting different dates.
            </p>
          </div>
        ) : (
          <>
            {availability && (
              <div className="mb-6">
                <Badge variant="outline" className="text-sm">
                  {availability.summary.available} of {availability.summary.total} available
                </Badge>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availability?.assets.map((asset) => (
                <AssetCard
                  key={asset.asset_id}
                  asset={asset}
                  available={asset.available}
                  portalSlug={portalSlug}
                  startDate={startDate}
                  endDate={endDate}
                  onSelect={handleAssetSelect}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
