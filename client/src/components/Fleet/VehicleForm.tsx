import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { 
  Car, 
  Truck, 
  Bus,
  Bike,
  Settings,
  Ruler,
  Link2,
  Camera,
  X,
  Check,
  AlertTriangle,
  Info,
  Fuel,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { apiRequest, queryClient } from '@/lib/queryClient';

const vehicleFormSchema = z.object({
  nickname: z.string().optional(),
  fleet_number: z.string().optional(),
  year: z.coerce.number().min(1900).max(2030).optional().nullable(),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  color: z.string().optional(),
  license_plate: z.string().optional(),
  vin: z.string().max(17).optional(),
  vehicle_class: z.string().default('truck'),
  drive_type: z.string().default('4wd'),
  fuel_type: z.string().default('gas'),
  ground_clearance_inches: z.coerce.number().optional().nullable(),
  length_feet: z.coerce.number().optional().nullable(),
  height_feet: z.coerce.number().optional().nullable(),
  passenger_capacity: z.coerce.number().optional().nullable(),
  towing_capacity_lbs: z.coerce.number().optional().nullable(),
  has_hitch: z.boolean().default(false),
  hitch_class: z.string().optional(),
  hitch_ball_size: z.string().optional(),
  has_brake_controller: z.boolean().default(false),
  trailer_wiring: z.string().optional(),
  has_gooseneck_hitch: z.boolean().default(false),
  has_fifth_wheel_hitch: z.boolean().default(false),
  fleet_status: z.string().default('available'),
  notes: z.string().optional(),
});

type VehicleFormData = z.infer<typeof vehicleFormSchema>;

const VEHICLE_CLASSES = [
  { value: 'sedan', label: 'Sedan', icon: Car },
  { value: 'suv', label: 'SUV', icon: Car },
  { value: 'truck', label: 'Pickup Truck', icon: Truck },
  { value: 'van', label: 'Cargo Van', icon: Bus },
  { value: 'cube_van', label: 'Cube Van', icon: Truck },
  { value: 'flatbed', label: 'Flatbed', icon: Truck },
  { value: 'rv_class_a', label: 'RV Class A', icon: Bus },
  { value: 'rv_class_c', label: 'RV Class C', icon: Bus },
  { value: 'motorcycle', label: 'Motorcycle', icon: Bike },
];

const DRIVE_TYPES = [
  { value: '2wd', label: '2WD (Rear)' },
  { value: 'fwd', label: 'FWD (Front)' },
  { value: 'awd', label: 'AWD (All-Wheel)' },
  { value: '4wd', label: '4WD (Four-Wheel)' },
];

const FUEL_TYPES = [
  { value: 'gas', label: 'Gasoline' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'plug_in_hybrid', label: 'Plug-in Hybrid' },
  { value: 'propane', label: 'Propane' },
];

const HITCH_CLASSES = [
  { value: '', label: 'None' },
  { value: 'I', label: 'Class I (2,000 lbs)' },
  { value: 'II', label: 'Class II (3,500 lbs)' },
  { value: 'III', label: 'Class III (6,000 lbs)' },
  { value: 'IV', label: 'Class IV (10,000 lbs)' },
  { value: 'V', label: 'Class V (12,000+ lbs)' },
];

const BALL_SIZES = [
  { value: '', label: 'None / Unknown' },
  { value: '1_7_8', label: '1-7/8"' },
  { value: '2', label: '2"' },
  { value: '2_5_16', label: '2-5/16"' },
];

const WIRING_TYPES = [
  { value: '', label: 'None' },
  { value: '4_pin', label: '4-Pin (Flat)' },
  { value: '5_pin', label: '5-Pin' },
  { value: '7_pin', label: '7-Pin (RV Style)' },
];

const FLEET_STATUSES = [
  { value: 'available', label: 'Available', variant: 'default' as const },
  { value: 'in_use', label: 'In Use', variant: 'secondary' as const },
  { value: 'maintenance', label: 'Maintenance', variant: 'destructive' as const },
  { value: 'reserved', label: 'Reserved', variant: 'outline' as const },
  { value: 'retired', label: 'Retired', variant: 'outline' as const },
];

interface VehicleFormProps {
  vehicleId?: string;
  initialData?: Partial<VehicleFormData>;
  onSave: () => void;
  onCancel: () => void;
}

export function VehicleForm({ vehicleId, initialData, onSave, onCancel }: VehicleFormProps) {
  const [activeTab, setActiveTab] = useState('basic');

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      nickname: initialData?.nickname || '',
      fleet_number: initialData?.fleet_number || '',
      year: initialData?.year || undefined,
      make: initialData?.make || '',
      model: initialData?.model || '',
      color: initialData?.color || '',
      license_plate: initialData?.license_plate || '',
      vin: initialData?.vin || '',
      vehicle_class: initialData?.vehicle_class || 'truck',
      drive_type: initialData?.drive_type || '4wd',
      fuel_type: initialData?.fuel_type || 'gas',
      ground_clearance_inches: initialData?.ground_clearance_inches || undefined,
      length_feet: initialData?.length_feet || undefined,
      height_feet: initialData?.height_feet || undefined,
      passenger_capacity: initialData?.passenger_capacity || undefined,
      towing_capacity_lbs: initialData?.towing_capacity_lbs || undefined,
      has_hitch: initialData?.has_hitch || false,
      hitch_class: initialData?.hitch_class || '',
      hitch_ball_size: initialData?.hitch_ball_size || '',
      has_brake_controller: initialData?.has_brake_controller || false,
      trailer_wiring: initialData?.trailer_wiring || '',
      has_gooseneck_hitch: initialData?.has_gooseneck_hitch || false,
      has_fifth_wheel_hitch: initialData?.has_fifth_wheel_hitch || false,
      fleet_status: initialData?.fleet_status || 'available',
      notes: initialData?.notes || '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const res = await apiRequest('POST', '/api/v1/fleet/vehicles', data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to create vehicle' }));
        throw new Error(error.message || 'Failed to create vehicle');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet');
        }
      });
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const res = await apiRequest('PATCH', `/api/v1/fleet/vehicles/${vehicleId}`, data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to update vehicle' }));
        throw new Error(error.message || 'Failed to update vehicle');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/v1/fleet');
        }
      });
      onSave();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: VehicleFormData) {
    if (vehicleId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const watchedFuelType = form.watch('fuel_type');
  const watchedHasHitch = form.watch('has_hitch');

  return (
    <Card className="max-h-[80vh] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-primary" />
            <CardTitle>{vehicleId ? 'Edit Vehicle' : 'Add New Vehicle'}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-vehicle">
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={isPending}
              data-testid="button-save-vehicle"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {isPending ? 'Saving...' : 'Save Vehicle'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-4 justify-start flex-shrink-0">
              <TabsTrigger value="basic" data-testid="tab-basic">
                <Car className="w-4 h-4 mr-1.5" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="specs" data-testid="tab-specs">
                <Ruler className="w-4 h-4 mr-1.5" />
                Specs
              </TabsTrigger>
              <TabsTrigger value="towing" data-testid="tab-towing">
                <Link2 className="w-4 h-4 mr-1.5" />
                Towing
              </TabsTrigger>
              <TabsTrigger value="photos" data-testid="tab-photos">
                <Camera className="w-4 h-4 mr-1.5" />
                Photos
              </TabsTrigger>
            </TabsList>

            <CardContent className="flex-1 overflow-y-auto pt-4">
              <TabsContent value="basic" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nickname</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., "Big Blue", "The Beast"' {...field} data-testid="input-nickname" />
                        </FormControl>
                        <FormDescription>How you refer to this vehicle</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fleet_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fleet Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., V-001" {...field} data-testid="input-fleet-number" />
                        </FormControl>
                        <FormDescription>Internal ID</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2024" {...field} value={field.value || ''} data-testid="input-year" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ford, Toyota..." {...field} data-testid="input-make" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model *</FormLabel>
                        <FormControl>
                          <Input placeholder="F-350, 4Runner..." {...field} data-testid="input-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input placeholder="White, Black..." {...field} data-testid="input-color" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vehicle_class"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Type</FormLabel>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {VEHICLE_CLASSES.map(vc => {
                          const Icon = vc.icon;
                          return (
                            <Button
                              key={vc.value}
                              type="button"
                              variant={field.value === vc.value ? 'default' : 'outline'}
                              className="flex flex-col h-auto py-3"
                              onClick={() => field.onChange(vc.value)}
                              data-testid={`button-class-${vc.value}`}
                            >
                              <Icon className="w-6 h-6 mb-1" />
                              <span className="text-xs">{vc.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="drive_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drive Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-drive-type">
                              <SelectValue placeholder="Select drive type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DRIVE_TYPES.map(dt => (
                              <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-fuel-type">
                              <SelectValue placeholder="Select fuel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FUEL_TYPES.map(ft => (
                              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {watchedFuelType === 'electric' && (
                          <div className="flex items-center gap-1.5 text-yellow-500 text-xs mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            EV charging limited in remote BC
                          </div>
                        )}
                        {watchedFuelType === 'diesel' && (
                          <div className="flex items-center gap-1.5 text-blue-500 text-xs mt-1">
                            <Info className="w-3 h-3" />
                            Diesel not at all rural stations
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="license_plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Plate</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ABC 123" 
                            className="font-mono" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-license-plate"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VIN</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="1FTFW1E..." 
                            className="font-mono text-sm"
                            maxLength={17}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-vin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fleet_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fleet Status</FormLabel>
                      <div className="flex gap-2 flex-wrap">
                        {FLEET_STATUSES.map(status => (
                          <Badge
                            key={status.value}
                            variant={field.value === status.value ? status.variant : 'outline'}
                            className={`cursor-pointer ${field.value === status.value ? '' : 'opacity-60'}`}
                            onClick={() => field.onChange(status.value)}
                            data-testid={`status-${status.value}`}
                          >
                            {status.label}
                          </Badge>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="specs" className="mt-0 space-y-6">
                <p className="text-muted-foreground text-sm">
                  These specs help determine route suitability and ferry pricing. Leave blank if unknown.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="ground_clearance_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ground Clearance (in)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="8.5" {...field} value={field.value || ''} data-testid="input-clearance" />
                        </FormControl>
                        <FormDescription>8"+ for Bamfield Road</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="length_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Length (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="20" {...field} value={field.value || ''} data-testid="input-length" />
                        </FormControl>
                        <FormDescription>Affects ferry pricing</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="height_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} data-testid="input-height" />
                        </FormControl>
                        <FormDescription>Over 7' = overheight</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="passenger_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passengers</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5" {...field} value={field.value || ''} data-testid="input-passengers" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional notes about this vehicle..."
                          className="resize-none"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="towing" className="mt-0 space-y-6">
                <FormField
                  control={form.control}
                  name="towing_capacity_lbs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Towing Capacity (lbs)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10000" {...field} value={field.value || ''} data-testid="input-towing-capacity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="has_hitch"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Has Hitch Receiver</FormLabel>
                        <FormDescription>Does this vehicle have a trailer hitch installed?</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-has-hitch" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchedHasHitch && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="hitch_class"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hitch Class</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-hitch-class">
                                  <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {HITCH_CLASSES.map(hc => (
                                  <SelectItem key={hc.value} value={hc.value}>{hc.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hitch_ball_size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ball Size</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-ball-size">
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BALL_SIZES.map(bs => (
                                  <SelectItem key={bs.value} value={bs.value}>{bs.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="trailer_wiring"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Wiring Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-wiring">
                                  <SelectValue placeholder="Select wiring" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {WIRING_TYPES.map(wt => (
                                  <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="has_brake_controller"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Brake Controller</FormLabel>
                            <FormDescription>Has electric trailer brake controller</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-brake-controller" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="has_gooseneck_hitch"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Gooseneck Hitch</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-gooseneck" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_fifth_wheel_hitch"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Fifth Wheel Hitch</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-fifth-wheel" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="photos" className="mt-0 space-y-6">
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Camera className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mt-2">Photo upload coming soon</p>
                  <p className="text-muted-foreground text-sm">For now, photos can be added after creating the vehicle</p>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </form>
      </Form>
    </Card>
  );
}

export default VehicleForm;
