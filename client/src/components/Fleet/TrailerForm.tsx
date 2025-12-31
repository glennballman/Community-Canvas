import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { 
  Truck, 
  Ruler,
  X,
  Check,
  Camera,
  Package,
  Link2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const trailerFormSchema = z.object({
  nickname: z.string().optional(),
  fleet_number: z.string().optional(),
  trailer_type: z.string().default('utility'),
  color: z.string().optional(),
  license_plate: z.string().optional(),
  vin: z.string().max(17).optional(),
  length_feet: z.coerce.number().optional().nullable(),
  width_feet: z.coerce.number().optional().nullable(),
  height_feet: z.coerce.number().optional().nullable(),
  interior_length_feet: z.coerce.number().optional().nullable(),
  interior_width_feet: z.coerce.number().optional().nullable(),
  interior_height_feet: z.coerce.number().optional().nullable(),
  gvwr_lbs: z.coerce.number().optional().nullable(),
  empty_weight_lbs: z.coerce.number().optional().nullable(),
  payload_capacity_lbs: z.coerce.number().optional().nullable(),
  hitch_type: z.string().default('ball'),
  required_ball_size: z.string().optional(),
  tongue_weight_lbs: z.coerce.number().optional().nullable(),
  brake_type: z.string().optional(),
  wiring_type: z.string().optional(),
  gate_type: z.string().optional(),
  has_side_door: z.boolean().default(false),
  has_roof_rack: z.boolean().default(false),
  has_tie_downs: z.boolean().default(true),
  tie_down_count: z.coerce.number().optional().nullable(),
  has_interior_lighting: z.boolean().default(false),
  has_electrical_outlets: z.boolean().default(false),
  has_ventilation: z.boolean().default(false),
  floor_type: z.string().optional(),
  fleet_status: z.string().default('available'),
  notes: z.string().optional(),
});

type TrailerFormData = z.infer<typeof trailerFormSchema>;

const TRAILER_TYPES = [
  { value: 'utility', label: 'Utility' },
  { value: 'enclosed_cargo', label: 'Enclosed Cargo' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'dump', label: 'Dump' },
  { value: 'car_hauler', label: 'Car Hauler' },
  { value: 'boat', label: 'Boat Trailer' },
  { value: 'kayak', label: 'Kayak/Canoe' },
  { value: 'horse', label: 'Horse/Livestock' },
  { value: 'travel', label: 'Travel/RV' },
  { value: 'equipment', label: 'Equipment' },
];

const HITCH_TYPES = [
  { value: 'ball', label: 'Ball Hitch' },
  { value: 'gooseneck', label: 'Gooseneck' },
  { value: 'fifth_wheel', label: 'Fifth Wheel' },
  { value: 'pintle', label: 'Pintle' },
];

const BALL_SIZES = [
  { value: '', label: 'N/A' },
  { value: '1_7_8', label: '1-7/8"' },
  { value: '2', label: '2"' },
  { value: '2_5_16', label: '2-5/16"' },
];

const BRAKE_TYPES = [
  { value: '', label: 'None' },
  { value: 'electric', label: 'Electric' },
  { value: 'surge', label: 'Surge/Hydraulic' },
  { value: 'air', label: 'Air Brakes' },
];

const WIRING_TYPES = [
  { value: '', label: 'None' },
  { value: '4_pin', label: '4-Pin (Flat)' },
  { value: '5_pin', label: '5-Pin' },
  { value: '7_pin', label: '7-Pin (RV Style)' },
];

const GATE_TYPES = [
  { value: '', label: 'None' },
  { value: 'ramp', label: 'Ramp Gate' },
  { value: 'barn_doors', label: 'Barn Doors' },
  { value: 'roll_up', label: 'Roll-up Door' },
];

const FLOOR_TYPES = [
  { value: '', label: 'Not Specified' },
  { value: 'wood', label: 'Wood' },
  { value: 'steel', label: 'Steel' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'treated_wood', label: 'Treated Wood' },
];

const FLEET_STATUSES = [
  { value: 'available', label: 'Available', variant: 'default' as const },
  { value: 'in_use', label: 'In Use', variant: 'secondary' as const },
  { value: 'maintenance', label: 'Maintenance', variant: 'destructive' as const },
];

interface TrailerFormProps {
  trailerId?: string;
  initialData?: Partial<TrailerFormData>;
  onSave: () => void;
  onCancel: () => void;
}

export function TrailerForm({ trailerId, initialData, onSave, onCancel }: TrailerFormProps) {
  const [activeTab, setActiveTab] = useState('basic');

  const form = useForm<TrailerFormData>({
    resolver: zodResolver(trailerFormSchema),
    defaultValues: {
      nickname: initialData?.nickname || '',
      fleet_number: initialData?.fleet_number || '',
      trailer_type: initialData?.trailer_type || 'utility',
      color: initialData?.color || '',
      license_plate: initialData?.license_plate || '',
      vin: initialData?.vin || '',
      length_feet: initialData?.length_feet || undefined,
      width_feet: initialData?.width_feet || undefined,
      height_feet: initialData?.height_feet || undefined,
      interior_length_feet: initialData?.interior_length_feet || undefined,
      interior_width_feet: initialData?.interior_width_feet || undefined,
      interior_height_feet: initialData?.interior_height_feet || undefined,
      gvwr_lbs: initialData?.gvwr_lbs || undefined,
      empty_weight_lbs: initialData?.empty_weight_lbs || undefined,
      payload_capacity_lbs: initialData?.payload_capacity_lbs || undefined,
      hitch_type: initialData?.hitch_type || 'ball',
      required_ball_size: initialData?.required_ball_size || '',
      tongue_weight_lbs: initialData?.tongue_weight_lbs || undefined,
      brake_type: initialData?.brake_type || '',
      wiring_type: initialData?.wiring_type || '',
      gate_type: initialData?.gate_type || '',
      has_side_door: initialData?.has_side_door || false,
      has_roof_rack: initialData?.has_roof_rack || false,
      has_tie_downs: initialData?.has_tie_downs ?? true,
      tie_down_count: initialData?.tie_down_count || undefined,
      has_interior_lighting: initialData?.has_interior_lighting || false,
      has_electrical_outlets: initialData?.has_electrical_outlets || false,
      has_ventilation: initialData?.has_ventilation || false,
      floor_type: initialData?.floor_type || '',
      fleet_status: initialData?.fleet_status || 'available',
      notes: initialData?.notes || '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TrailerFormData) => {
      const res = await apiRequest('POST', '/api/v1/fleet/trailers', data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to create trailer' }));
        throw new Error(error.message || 'Failed to create trailer');
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
    mutationFn: async (data: TrailerFormData) => {
      const res = await apiRequest('PATCH', `/api/v1/fleet/trailers/${trailerId}`, data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to update trailer' }));
        throw new Error(error.message || 'Failed to update trailer');
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

  function onSubmit(data: TrailerFormData) {
    if (trailerId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const watchedHitchType = form.watch('hitch_type');
  const watchedTrailerType = form.watch('trailer_type');

  return (
    <Card className="max-h-[80vh] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-primary" />
            <CardTitle>{trailerId ? 'Edit Trailer' : 'Add New Trailer'}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-trailer">
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={isPending}
              data-testid="button-save-trailer"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {isPending ? 'Saving...' : 'Save Trailer'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-4 justify-start flex-shrink-0">
              <TabsTrigger value="basic" data-testid="trailer-tab-basic">
                <Truck className="w-4 h-4 mr-1.5" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="dimensions" data-testid="trailer-tab-dimensions">
                <Ruler className="w-4 h-4 mr-1.5" />
                Dimensions
              </TabsTrigger>
              <TabsTrigger value="hitch" data-testid="trailer-tab-hitch">
                <Link2 className="w-4 h-4 mr-1.5" />
                Hitch & Brakes
              </TabsTrigger>
              <TabsTrigger value="features" data-testid="trailer-tab-features">
                <Package className="w-4 h-4 mr-1.5" />
                Features
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
                          <Input placeholder='e.g., "The Box", "Big Flatty"' {...field} data-testid="trailer-input-nickname" />
                        </FormControl>
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
                          <Input placeholder="e.g., T-001" {...field} data-testid="trailer-input-fleet-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="trailer_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trailer Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="trailer-select-type">
                            <SelectValue placeholder="Select trailer type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRAILER_TYPES.map(tt => (
                            <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input placeholder="White, Black..." {...field} data-testid="trailer-input-color" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            data-testid="trailer-input-license"
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
                            data-testid={`trailer-status-${status.value}`}
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

              <TabsContent value="dimensions" className="mt-0 space-y-6">
                <p className="text-muted-foreground text-sm">
                  Exterior and interior dimensions for cargo planning and ferry pricing.
                </p>

                <div className="space-y-4">
                  <h4 className="font-medium">Exterior Dimensions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="length_feet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Length (ft)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.5" placeholder="16" {...field} value={field.value || ''} data-testid="trailer-input-length" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="width_feet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Width (ft)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} data-testid="trailer-input-width" />
                          </FormControl>
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
                            <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} data-testid="trailer-input-height" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {(watchedTrailerType === 'enclosed_cargo' || watchedTrailerType === 'travel') && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Interior Dimensions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="interior_length_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="15" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="interior_width_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Width (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="6.5" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="interior_height_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Height (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="6.5" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-medium">Weight Ratings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="gvwr_lbs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GVWR (lbs)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="7000" {...field} value={field.value || ''} data-testid="trailer-input-gvwr" />
                          </FormControl>
                          <FormDescription>Gross Vehicle Weight Rating</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="empty_weight_lbs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empty Weight (lbs)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1800" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payload_capacity_lbs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payload Capacity (lbs)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="5200" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="hitch" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hitch_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hitch Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="trailer-select-hitch">
                              <SelectValue placeholder="Select hitch type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HITCH_TYPES.map(ht => (
                              <SelectItem key={ht.value} value={ht.value}>{ht.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedHitchType === 'ball' && (
                    <FormField
                      control={form.control}
                      name="required_ball_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Required Ball Size</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="trailer-select-ball">
                                <SelectValue placeholder="Select ball size" />
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
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="tongue_weight_lbs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tongue Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="700" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>Weight on the hitch when loaded</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brake_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brake Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="trailer-select-brake">
                              <SelectValue placeholder="Select brake type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BRAKE_TYPES.map(bt => (
                              <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wiring_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wiring Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="trailer-select-wiring">
                              <SelectValue placeholder="Select wiring type" />
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
              </TabsContent>

              <TabsContent value="features" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gate_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gate/Door Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="trailer-select-gate">
                              <SelectValue placeholder="Select gate type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GATE_TYPES.map(gt => (
                              <SelectItem key={gt.value} value={gt.value}>{gt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="floor_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="trailer-select-floor">
                              <SelectValue placeholder="Select floor type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FLOOR_TYPES.map(ft => (
                              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Features</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="has_side_door"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <FormLabel className="text-base">Side Door</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-side-door" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_roof_rack"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <FormLabel className="text-base">Roof Rack</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-roof-rack" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_tie_downs"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <FormLabel className="text-base">Tie-Downs</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-tie-downs" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tie_down_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tie-Down Count</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="8" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_interior_lighting"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <FormLabel className="text-base">Interior Lighting</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-interior-lighting" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_electrical_outlets"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <FormLabel className="text-base">Electrical Outlets</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-electrical-outlets" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional notes about this trailer..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </form>
      </Form>
    </Card>
  );
}

export default TrailerForm;
