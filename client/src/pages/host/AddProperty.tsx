import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

const propertyTypes = [
  { value: 'rv_park', label: 'RV Park' },
  { value: 'campground', label: 'Campground' },
  { value: 'truck_stop', label: 'Truck Stop' },
  { value: 'equestrian', label: 'Equestrian Facility' },
  { value: 'boondocking', label: 'Boondocking Site' },
  { value: 'farm_stay', label: 'Farm Stay' },
  { value: 'work_staging', label: 'Work Crew Staging' }
];

const regions = [
  'Vancouver Metro', 'Vancouver Island', 'Okanagan', 'Kootenays',
  'Thompson-Nicola', 'Cariboo', 'Northern BC', 'Sunshine Coast',
  'Sea to Sky', 'Fraser Valley', 'Peace Region', 'Skeena'
];

function AddPropertyContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  
  const [form, setForm] = useState({
    name: '',
    propertyType: '',
    description: '',
    region: '',
    city: '',
    address: '',
    postalCode: '',
    totalSpots: '',
    hasWifi: false,
    hasShowers: false,
    hasBathrooms: false,
    hasLaundry: false,
    hasShorePower: false,
    hasWaterHookup: false,
    hasSewerHookup: false,
    hasDumpStation: false,
    petsAllowed: false,
    isHorseFriendly: false,
    acceptsSemiTrucks: false
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/host/properties', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create property');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Property created!' });
      setLocation(`/host/properties/${data.property.id}`);
    },
    onError: () => {
      toast({ title: 'Failed to create property', variant: 'destructive' });
    }
  });

  const handleSubmit = () => {
    createMutation.mutate({
      ...form,
      totalSpots: form.totalSpots ? parseInt(form.totalSpots) : null,
      status: 'draft'
    });
  };

  const canProceed = () => {
    if (step === 0) return form.name && form.propertyType;
    if (step === 1) return form.region;
    return true;
  };

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Link href="/host/properties">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Properties
          </Button>
        </Link>

        <h1 className="text-2xl font-bold mb-6" data-testid="text-add-property-title">Add New Property</h1>

        <div className="flex items-center gap-2 mb-8">
          {['Basics', 'Location', 'Amenities'].map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
              `}>
                {i + 1}
              </div>
              <span className={`ml-2 text-sm ${i <= step ? '' : 'text-muted-foreground'}`}>{label}</span>
              {i < 2 && <div className={`w-8 h-0.5 mx-2 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Property Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Riverside RV Park"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Property Type *</Label>
                  <Select value={form.propertyType} onValueChange={(v) => setForm({ ...form, propertyType: v })}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Tell guests about your property..."
                    rows={4}
                    data-testid="textarea-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Spots</Label>
                  <Input
                    type="number"
                    value={form.totalSpots}
                    onChange={(e) => setForm({ ...form, totalSpots: e.target.value })}
                    placeholder="Number of spots available"
                    data-testid="input-spots"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Region *</Label>
                  <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                    <SelectTrigger data-testid="select-region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City/Town</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="City or town name"
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Main Street"
                    data-testid="input-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="V0N 1A0"
                    data-testid="input-postal"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Hookups</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'hasShorePower', label: 'Shore Power' },
                      { key: 'hasWaterHookup', label: 'Water Hookup' },
                      { key: 'hasSewerHookup', label: 'Sewer Hookup' },
                      { key: 'hasDumpStation', label: 'Dump Station' }
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-2">
                        <Checkbox
                          checked={(form as any)[item.key]}
                          onCheckedChange={(c) => setForm({ ...form, [item.key]: c === true })}
                        />
                        <Label className="font-normal">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Facilities</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'hasWifi', label: 'WiFi' },
                      { key: 'hasShowers', label: 'Showers' },
                      { key: 'hasBathrooms', label: 'Bathrooms' },
                      { key: 'hasLaundry', label: 'Laundry' }
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-2">
                        <Checkbox
                          checked={(form as any)[item.key]}
                          onCheckedChange={(c) => setForm({ ...form, [item.key]: c === true })}
                        />
                        <Label className="font-normal">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Special Features</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'petsAllowed', label: 'Pets Allowed' },
                      { key: 'isHorseFriendly', label: 'Horse Friendly' },
                      { key: 'acceptsSemiTrucks', label: 'Accepts Semi Trucks' }
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-2">
                        <Checkbox
                          checked={(form as any)[item.key]}
                          onCheckedChange={(c) => setForm({ ...form, [item.key]: c === true })}
                        />
                        <Label className="font-normal">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            data-testid="button-prev"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          
          {step < 2 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Property
            </Button>
          )}
        </div>
      </div>
    </HostLayout>
  );
}

export default function AddProperty() {
  return (
    <ProtectedHostRoute>
      <AddPropertyContent />
    </ProtectedHostRoute>
  );
}
