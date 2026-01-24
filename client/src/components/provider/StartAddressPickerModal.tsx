import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface StartAddress {
  id: string;
  label: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  is_default: boolean;
}

interface StartAddressPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  currentAddressId: string | null;
}

export function StartAddressPickerModal({
  open,
  onOpenChange,
  runId,
  currentAddressId
}: StartAddressPickerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(currentAddressId);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('select');
  
  const [newAddress, setNewAddress] = useState({
    label: '',
    address_line_1: '',
    city: '',
    region: '',
    postal_code: '',
    notes: '',
    is_default: false,
    latitude: '',
    longitude: ''
  });
  const [creatingNew, setCreatingNew] = useState(false);
  const [coordsError, setCoordsError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ ok: boolean; startAddresses: StartAddress[] }>({
    queryKey: ['/api/provider/start-addresses'],
    queryFn: async () => {
      const response = await fetch('/api/provider/start-addresses');
      if (!response.ok) throw new Error('Failed to load addresses');
      return response.json();
    },
    enabled: open
  });

  const addresses = data?.startAddresses || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiRequest('PATCH', `/api/provider/runs/${runId}/start-address`, {
        startAddressId: selectedId
      });
      const result = await response.json();
      if (result.ok) {
        toast({ title: 'Start address updated' });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId] });
        onOpenChange(false);
      } else {
        toast({ title: 'Error', description: result.message || result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // V3.5 STEP 8: Validate coordinates (both-or-none rule)
  const validateCoordinates = (): boolean => {
    const hasLat = newAddress.latitude.trim() !== '';
    const hasLng = newAddress.longitude.trim() !== '';
    
    if (hasLat !== hasLng) {
      setCoordsError('Enter both latitude and longitude (or leave both blank).');
      return false;
    }
    
    if (hasLat && hasLng) {
      const lat = parseFloat(newAddress.latitude);
      const lng = parseFloat(newAddress.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setCoordsError('Latitude must be between -90 and 90');
        return false;
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        setCoordsError('Longitude must be between -180 and 180');
        return false;
      }
    }
    
    setCoordsError(null);
    return true;
  };

  const handleCreateNew = async () => {
    if (!newAddress.label.trim()) {
      toast({ title: 'Error', description: 'Address name is required', variant: 'destructive' });
      return;
    }

    if (!validateCoordinates()) {
      return;
    }

    setCreatingNew(true);
    try {
      const response = await apiRequest('POST', '/api/provider/start-addresses', {
        label: newAddress.label.trim(),
        address_line_1: newAddress.address_line_1 || null,
        city: newAddress.city || null,
        region: newAddress.region || null,
        postal_code: newAddress.postal_code || null,
        notes: newAddress.notes || null,
        is_default: newAddress.is_default,
        latitude: newAddress.latitude.trim() || null,
        longitude: newAddress.longitude.trim() || null
      });
      const result = await response.json();
      if (result.ok) {
        toast({ title: 'Address saved' });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/start-addresses'] });
        setSelectedId(result.startAddress.id);
        setActiveTab('select');
        setNewAddress({ label: '', address_line_1: '', city: '', region: '', postal_code: '', notes: '', is_default: false, latitude: '', longitude: '' });
        setCoordsError(null);
      } else {
        toast({ title: 'Error', description: result.message || result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setCreatingNew(false);
  };

  const formatAddressSummary = (addr: StartAddress) => {
    const parts = [addr.city, addr.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-start-address-picker">
        <DialogHeader>
          <DialogTitle>Select Start Address</DialogTitle>
          <DialogDescription>
            Choose a departure point for this service run. This is private and helps with planning.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select" data-testid="tab-select">Choose Saved</TabsTrigger>
            <TabsTrigger value="new" data-testid="tab-new">
              <Plus className="w-3 h-3 mr-1" />
              Add New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No saved addresses yet</p>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveTab('new')}
                  data-testid="button-add-first-address"
                >
                  Add your first address
                </Button>
              </div>
            ) : (
              <RadioGroup
                value={selectedId || 'none'}
                onValueChange={(value) => setSelectedId(value === 'none' ? null : value)}
                className="space-y-2"
              >
                <div 
                  className="flex items-center space-x-3 p-3 rounded-md border hover-elevate cursor-pointer"
                  onClick={() => setSelectedId(null)}
                >
                  <RadioGroupItem value="none" id="none" data-testid="radio-none" />
                  <Label htmlFor="none" className="flex-1 cursor-pointer text-muted-foreground">
                    None (clear start address)
                  </Label>
                </div>
                {addresses.map((addr) => (
                  <div 
                    key={addr.id}
                    className="flex items-center space-x-3 p-3 rounded-md border hover-elevate cursor-pointer"
                    onClick={() => setSelectedId(addr.id)}
                    data-testid={`radio-address-${addr.id}`}
                  >
                    <RadioGroupItem value={addr.id} id={addr.id} />
                    <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{addr.label}</span>
                        {addr.is_default && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {formatAddressSummary(addr) && (
                        <p className="text-sm text-muted-foreground">{formatAddressSummary(addr)}</p>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </TabsContent>

          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="label">Address Name *</Label>
                <Input
                  id="label"
                  placeholder="e.g., John's House, South Yard"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                  data-testid="input-label"
                />
              </div>
              <div>
                <Label htmlFor="address_line_1">Street Address</Label>
                <Input
                  id="address_line_1"
                  placeholder="123 Main St"
                  value={newAddress.address_line_1}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, address_line_1: e.target.value }))}
                  data-testid="input-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Victoria"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                    data-testid="input-city"
                  />
                </div>
                <div>
                  <Label htmlFor="region">Province/Region</Label>
                  <Input
                    id="region"
                    placeholder="BC"
                    value={newAddress.region}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, region: e.target.value }))}
                    data-testid="input-region"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  placeholder="V8V 1A1"
                  value={newAddress.postal_code}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, postal_code: e.target.value }))}
                  data-testid="input-postal"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g., Gate code: 1234"
                  value={newAddress.notes}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, notes: e.target.value }))}
                  data-testid="input-notes"
                />
              </div>
              
              {/* V3.5 STEP 8: Coordinates fields */}
              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Optional: add coordinates to enable distance estimates.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="latitude">Latitude (optional)</Label>
                    <Input
                      id="latitude"
                      placeholder="e.g., 48.8330"
                      value={newAddress.latitude}
                      onChange={(e) => {
                        setNewAddress(prev => ({ ...prev, latitude: e.target.value }));
                        setCoordsError(null);
                      }}
                      data-testid="input-latitude"
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude (optional)</Label>
                    <Input
                      id="longitude"
                      placeholder="e.g., -125.1360"
                      value={newAddress.longitude}
                      onChange={(e) => {
                        setNewAddress(prev => ({ ...prev, longitude: e.target.value }));
                        setCoordsError(null);
                      }}
                      data-testid="input-longitude"
                    />
                  </div>
                </div>
                {coordsError && (
                  <p className="text-xs text-destructive mt-1" data-testid="text-coords-error">
                    {coordsError}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_default"
                  checked={newAddress.is_default}
                  onCheckedChange={(checked) => setNewAddress(prev => ({ ...prev, is_default: !!checked }))}
                  data-testid="checkbox-default"
                />
                <Label htmlFor="is_default" className="text-sm cursor-pointer">
                  Set as default address
                </Label>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateNew}
              disabled={creatingNew || !newAddress.label.trim()}
              data-testid="button-create-address"
            >
              {creatingNew ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Address
            </Button>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Start address is private and helps improve future suggestions. You can change this anytime.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
