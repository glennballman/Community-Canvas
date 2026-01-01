import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Ruler,
  X,
  Check,
  Camera,
  Package,
  Link2,
  Caravan,
  Zap,
  Droplets,
  Home,
  Thermometer,
  Shield,
  CircleDot
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
  trailer_type: z.string().default('open_utility'),
  trailer_type_class: z.string().optional(),
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
  
  coupler_type: z.string().default('ball_coupler'),
  coupler_height_inches: z.coerce.number().optional().nullable(),
  coupler_adjustable: z.boolean().default(false),
  required_hitch_type: z.string().optional(),
  required_ball_size_type: z.string().default('none'),
  kingpin_weight_lbs: z.coerce.number().optional().nullable(),
  tongue_weight_lbs: z.coerce.number().optional().nullable(),
  
  safety_chain_rating_lbs: z.coerce.number().optional().nullable(),
  breakaway_system: z.boolean().default(false),
  breakaway_battery_type: z.string().optional(),
  
  axle_type: z.string().default('single'),
  axle_count: z.coerce.number().default(1),
  axle_capacity_lbs: z.coerce.number().optional().nullable(),
  suspension_type: z.string().optional(),
  tire_size: z.string().optional(),
  spare_tire_included: z.boolean().default(false),
  
  trailer_brake_type: z.string().default('none'),
  brakes_on_all_axles: z.boolean().default(true),
  abs_brakes: z.boolean().default(false),
  
  trailer_wiring_type: z.string().default('none'),
  has_breakaway_switch: z.boolean().default(false),
  has_aux_battery: z.boolean().default(false),
  has_reverse_lights: z.boolean().default(false),
  
  rear_door_type: z.string().default('none'),
  rear_door_width_inches: z.coerce.number().optional().nullable(),
  rear_door_height_inches: z.coerce.number().optional().nullable(),
  has_side_door: z.boolean().default(false),
  side_door_type_detail: z.string().optional(),
  side_door_width_inches: z.coerce.number().optional().nullable(),
  
  ramp_door_type: z.string().optional(),
  ramp_length_inches: z.coerce.number().optional().nullable(),
  ramp_capacity_lbs: z.coerce.number().optional().nullable(),
  ramp_transition_flap: z.boolean().default(false),
  dovetail_length_inches: z.coerce.number().optional().nullable(),
  
  has_interior_lighting: z.boolean().default(false),
  interior_lighting_type: z.string().optional(),
  has_e_track: z.boolean().default(false),
  e_track_rows: z.coerce.number().optional().nullable(),
  has_d_rings: z.boolean().default(false),
  d_ring_count: z.coerce.number().optional().nullable(),
  floor_type: z.string().optional(),
  wall_type: z.string().optional(),
  
  has_roof_vent: z.boolean().default(false),
  roof_vent_count: z.coerce.number().optional().nullable(),
  has_side_vents: z.boolean().default(false),
  
  exterior_material: z.string().optional(),
  roof_type: z.string().optional(),
  has_roof_rack: z.boolean().default(false),
  has_ladder_rack: z.boolean().default(false),
  has_stone_guard: z.boolean().default(false),
  has_fenders: z.boolean().default(true),
  fender_type: z.string().optional(),
  
  jack_type: z.string().optional(),
  jack_capacity_lbs: z.coerce.number().optional().nullable(),
  rear_stabilizer_jacks: z.boolean().default(false),
  
  is_rv_trailer: z.boolean().default(false),
  rv_sleep_capacity: z.coerce.number().optional().nullable(),
  rv_dry_weight_lbs: z.coerce.number().optional().nullable(),
  
  fresh_water_gallons: z.coerce.number().optional().nullable(),
  gray_water_gallons: z.coerce.number().optional().nullable(),
  black_water_gallons: z.coerce.number().optional().nullable(),
  propane_tank_count: z.coerce.number().optional().nullable(),
  propane_capacity_lbs: z.coerce.number().optional().nullable(),
  
  shore_power_amps: z.coerce.number().optional().nullable(),
  has_solar: z.boolean().default(false),
  solar_watts: z.coerce.number().optional().nullable(),
  battery_type: z.string().optional(),
  battery_amp_hours: z.coerce.number().optional().nullable(),
  has_inverter: z.boolean().default(false),
  inverter_watts: z.coerce.number().optional().nullable(),
  
  slideout_count: z.coerce.number().default(0),
  slideout_type: z.string().optional(),
  
  ac_type: z.string().optional(),
  ac_btu: z.coerce.number().optional().nullable(),
  heat_type: z.string().optional(),
  heat_btu: z.coerce.number().optional().nullable(),
  
  is_toy_hauler: z.boolean().default(false),
  garage_length_feet: z.coerce.number().optional().nullable(),
  garage_width_feet: z.coerce.number().optional().nullable(),
  garage_height_feet: z.coerce.number().optional().nullable(),
  fuel_station_gallons: z.coerce.number().optional().nullable(),
  tie_down_points: z.coerce.number().optional().nullable(),
  
  fleet_status: z.string().default('available'),
});

type TrailerFormData = z.infer<typeof trailerFormSchema>;

const TRAILER_TYPES = [
  { value: 'enclosed_cargo', label: 'Enclosed Cargo' },
  { value: 'open_utility', label: 'Open Utility' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'dump', label: 'Dump' },
  { value: 'car_hauler', label: 'Car Hauler' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'horse', label: 'Horse' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'travel_trailer', label: 'Travel Trailer' },
  { value: 'fifth_wheel_rv', label: 'Fifth Wheel RV' },
  { value: 'toy_hauler', label: 'Toy Hauler' },
  { value: 'popup_camper', label: 'Pop-up Camper' },
  { value: 'teardrop', label: 'Teardrop' },
  { value: 'boat', label: 'Boat' },
  { value: 'pwc', label: 'PWC/Jet Ski' },
  { value: 'pontoon', label: 'Pontoon' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'office', label: 'Office' },
  { value: 'custom', label: 'Custom' },
];

const COUPLER_TYPES = [
  { value: 'ball_coupler', label: 'Ball Coupler' },
  { value: 'gooseneck_coupler', label: 'Gooseneck Coupler' },
  { value: 'fifth_wheel_kingpin', label: 'Fifth Wheel Kingpin' },
  { value: 'pintle_ring', label: 'Pintle Ring' },
  { value: 'adjustable_coupler', label: 'Adjustable Coupler' },
];

const HITCH_TYPES = [
  { value: 'any', label: 'Any' },
  { value: 'bumper_pull', label: 'Bumper Pull' },
  { value: 'gooseneck', label: 'Gooseneck' },
  { value: 'fifth_wheel', label: 'Fifth Wheel' },
  { value: 'pintle', label: 'Pintle' },
];

const BALL_SIZES = [
  { value: 'none', label: 'N/A' },
  { value: '1_7_8', label: '1-7/8" (Light)' },
  { value: '2', label: '2" (Common)' },
  { value: '2_5_16', label: '2-5/16" (Heavy)' },
  { value: '3', label: '3" (Extra Heavy)' },
];

const AXLE_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'tandem', label: 'Tandem (2)' },
  { value: 'triple', label: 'Triple (3)' },
  { value: 'quad', label: 'Quad (4)' },
];

const SUSPENSION_TYPES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'leaf_spring', label: 'Leaf Spring' },
  { value: 'torsion', label: 'Torsion' },
  { value: 'air_ride', label: 'Air Ride' },
];

const BRAKE_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'surge', label: 'Surge (Hydraulic)' },
  { value: 'electric', label: 'Electric' },
  { value: 'electric_hydraulic', label: 'Electric/Hydraulic' },
  { value: 'air', label: 'Air Brakes' },
];

const WIRING_TYPES = [
  { value: 'none', label: 'None' },
  { value: '4_pin_flat', label: '4-Pin Flat' },
  { value: '5_pin_flat', label: '5-Pin Flat' },
  { value: '6_pin_round', label: '6-Pin Round' },
  { value: '7_pin_rv_blade', label: '7-Pin RV Blade' },
  { value: '7_pin_round', label: '7-Pin Round' },
];

const REAR_DOOR_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'swing_doors', label: 'Swing Doors (Barn)' },
  { value: 'roll_up', label: 'Roll-Up' },
  { value: 'ramp_door', label: 'Ramp Door' },
  { value: 'ramp_spring_assist', label: 'Ramp (Spring Assist)' },
  { value: 'lift_gate_door', label: 'Liftgate Door' },
];

const RAMP_TYPES = [
  { value: 'na', label: 'N/A' },
  { value: 'fold_down', label: 'Fold Down' },
  { value: 'spring_assist', label: 'Spring Assist' },
  { value: 'power', label: 'Power' },
  { value: 'stowable', label: 'Stowable' },
];

const FLOOR_TYPES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'wood', label: 'Wood' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'rubber_coin', label: 'Rubber Coin' },
  { value: 'steel_tread', label: 'Steel Tread' },
];

const WALL_TYPES = [
  { value: 'na', label: 'N/A' },
  { value: 'plywood', label: 'Plywood' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'bare_studs', label: 'Bare Studs' },
];

const EXTERIOR_MATERIALS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'steel', label: 'Steel' },
  { value: 'fiberglass', label: 'Fiberglass' },
];

const ROOF_TYPES = [
  { value: 'na', label: 'N/A' },
  { value: 'flat', label: 'Flat' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'peaked', label: 'Peaked' },
];

const JACK_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'manual_crank', label: 'Manual Crank' },
  { value: 'power', label: 'Power' },
  { value: 'stabilizer', label: 'Stabilizer Only' },
];

const GENERATOR_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'gas', label: 'Gas' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'propane', label: 'Propane' },
];

const BATTERY_TYPES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'lead_acid', label: 'Lead Acid' },
  { value: 'agm', label: 'AGM' },
  { value: 'lithium', label: 'Lithium (LiFePO4)' },
];

const AC_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'roof', label: 'Roof Mount' },
  { value: 'basement', label: 'Basement' },
  { value: 'ducted', label: 'Ducted' },
];

const HEAT_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'propane', label: 'Propane Furnace' },
  { value: 'electric', label: 'Electric' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'hydronic', label: 'Hydronic' },
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

  const trailerQuery = useQuery<{ trailer: TrailerFormData }>({
    queryKey: ['/api/v1/fleet/trailers', trailerId],
    enabled: !!trailerId,
  });

  const form = useForm<TrailerFormData>({
    resolver: zodResolver(trailerFormSchema),
    defaultValues: {
      nickname: '',
      fleet_number: '',
      trailer_type: 'open_utility',
      color: '',
      license_plate: '',
      vin: '',
      length_feet: undefined,
      width_feet: undefined,
      height_feet: undefined,
      gvwr_lbs: undefined,
      empty_weight_lbs: undefined,
      payload_capacity_lbs: undefined,
      coupler_type: 'ball_coupler',
      required_ball_size_type: 'none',
      tongue_weight_lbs: undefined,
      axle_type: 'single',
      axle_count: 1,
      trailer_brake_type: 'none',
      trailer_wiring_type: 'none',
      rear_door_type: 'none',
      floor_type: 'unknown',
      fleet_status: 'available',
      is_rv_trailer: false,
      is_toy_hauler: false,
      ...initialData,
    },
  });

  useEffect(() => {
    if (trailerQuery.data?.trailer) {
      const t = trailerQuery.data.trailer;
      form.reset({
        ...t,
        nickname: t.nickname || '',
        fleet_number: t.fleet_number || '',
        trailer_type: t.trailer_type || 'open_utility',
        color: t.color || '',
        license_plate: t.license_plate || '',
        vin: t.vin || '',
        coupler_type: t.coupler_type || 'ball_coupler',
        required_ball_size_type: t.required_ball_size_type || 'none',
        axle_type: t.axle_type || 'single',
        axle_count: t.axle_count || 1,
        trailer_brake_type: t.trailer_brake_type || 'none',
        trailer_wiring_type: t.trailer_wiring_type || 'none',
        rear_door_type: t.rear_door_type || 'none',
        floor_type: t.floor_type || 'unknown',
        fleet_status: t.fleet_status || 'available',
        is_rv_trailer: t.is_rv_trailer || false,
        is_toy_hauler: t.is_toy_hauler || false,
      });
    }
  }, [trailerQuery.data, form]);

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

  function onError(errors: any) {
    console.error('TrailerForm validation errors:', errors);
  }

  const watchedTrailerType = form.watch('trailer_type');
  const watchedIsRvTrailer = form.watch('is_rv_trailer');
  const watchedIsToyHauler = form.watch('is_toy_hauler');
  const watchedHasSolar = form.watch('has_solar');
  const watchedHasInverter = form.watch('has_inverter');
  const watchedCouplerType = form.watch('coupler_type');
  const watchedHasETrack = form.watch('has_e_track');
  const watchedHasDRings = form.watch('has_d_rings');

  const isRvType = ['travel_trailer', 'fifth_wheel_rv', 'toy_hauler', 'popup_camper', 'teardrop'].includes(watchedTrailerType);
  const isEnclosedType = ['enclosed_cargo', 'travel_trailer', 'fifth_wheel_rv', 'toy_hauler', 'food_truck', 'office'].includes(watchedTrailerType);

  return (
    <Card className="max-h-[85vh] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Caravan className="w-5 h-5 text-primary" />
            <CardTitle>{trailerId ? 'Edit Trailer' : 'Add New Trailer'}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-trailer">
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit, onError)} 
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
            <TabsList className="mx-4 justify-start flex-shrink-0 flex-wrap h-auto gap-1">
              <TabsTrigger value="basic" data-testid="tab-basic">
                <Caravan className="w-4 h-4 mr-1.5" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="specs" data-testid="tab-specs">
                <Ruler className="w-4 h-4 mr-1.5" />
                Specs
              </TabsTrigger>
              <TabsTrigger value="hitch" data-testid="tab-hitch">
                <Link2 className="w-4 h-4 mr-1.5" />
                Hitch
              </TabsTrigger>
              <TabsTrigger value="axles" data-testid="tab-axles">
                <CircleDot className="w-4 h-4 mr-1.5" />
                Axles
              </TabsTrigger>
              {isEnclosedType && (
                <TabsTrigger value="cargo" data-testid="tab-cargo">
                  <Package className="w-4 h-4 mr-1.5" />
                  Cargo
                </TabsTrigger>
              )}
              {(isRvType || watchedIsRvTrailer) && (
                <TabsTrigger value="rv" data-testid="tab-rv">
                  <Home className="w-4 h-4 mr-1.5" />
                  RV
                </TabsTrigger>
              )}
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
                          <Input placeholder='e.g., "Big Red"' {...field} data-testid="input-nickname" />
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
                          <Input placeholder="e.g., T-001" {...field} data-testid="input-fleet-number" />
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
                          <SelectTrigger data-testid="select-trailer-type">
                            <SelectValue placeholder="Select type" />
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

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input placeholder="White" {...field} data-testid="input-color" />
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
                            placeholder="1UYFS..." 
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

                {!isRvType && (
                  <FormField
                    control={form.control}
                    name="is_rv_trailer"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">This is an RV Trailer</FormLabel>
                          <FormDescription>Enable RV features like tanks and power systems</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-rv" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </TabsContent>

              <TabsContent value="specs" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Overall Dimensions</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="length_feet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Length (ft)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="16" {...field} value={field.value || ''} />
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
                          <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} />
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
                          <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isEnclosedType && (
                  <>
                    <h4 className="font-medium text-sm">Interior Dimensions</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="interior_length_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interior Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="14" {...field} value={field.value || ''} />
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
                              <Input type="number" step="0.5" placeholder="6" {...field} value={field.value || ''} />
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
                              <Input type="number" step="0.5" placeholder="6" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                <h4 className="font-medium text-sm">Weight Ratings</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="gvwr_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GVWR (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="7000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Gross Vehicle Weight</FormDescription>
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
                          <Input type="number" placeholder="2000" {...field} value={field.value || ''} />
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
                        <FormLabel>Payload (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Exterior</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="exterior_material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXTERIOR_MATERIALS.map(em => (
                              <SelectItem key={em.value} value={em.value}>{em.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roof_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Roof Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROOF_TYPES.map(rt => (
                              <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fender_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fender Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Steel, Aluminum..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_fenders"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Fenders</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_stone_guard"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Stone Guard</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_roof_rack"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Roof Rack</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_ladder_rack"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Ladder Rack</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="hitch" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Coupler Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="coupler_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coupler Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUPLER_TYPES.map(ct => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="required_ball_size_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Ball Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
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
                    name="coupler_height_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coupler Height (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="18" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Ground to coupler</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tongue_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tongue Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="700" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="coupler_adjustable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Adjustable Coupler</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {watchedCouplerType === 'fifth_wheel_kingpin' && (
                  <FormField
                    control={form.control}
                    name="kingpin_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kingpin Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Safety
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="safety_chain_rating_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Safety Chain Rating (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="7000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="breakaway_system"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Breakaway System</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Wiring</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="trailer_wiring_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wiring Connector</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
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
                  <FormField
                    control={form.control}
                    name="has_breakaway_switch"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Breakaway Switch</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_aux_battery"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Aux Battery</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_reverse_lights"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Reverse Lights</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Jack</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="jack_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jack Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {JACK_TYPES.map(jt => (
                              <SelectItem key={jt.value} value={jt.value}>{jt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jack_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jack Capacity (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_stabilizer_jacks"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Rear Stabilizers</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="axles" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Axle Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="axle_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Axle Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AXLE_TYPES.map(at => (
                              <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="axle_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Axle Count</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="4" placeholder="2" {...field} value={field.value || 1} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="axle_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Axle Capacity (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="3500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Per axle</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="suspension_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suspension</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUSPENSION_TYPES.map(st => (
                              <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tire_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tire Size</FormLabel>
                        <FormControl>
                          <Input placeholder="ST225/75R15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="spare_tire_included"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Spare Tire Included</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Brakes</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="trailer_brake_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brake Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
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
                    name="brakes_on_all_axles"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>All Axles</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="abs_brakes"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>ABS</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="cargo" className="mt-0 space-y-6">
                <h4 className="font-medium text-sm">Doors</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rear_door_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rear Door Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REAR_DOOR_TYPES.map(rd => (
                              <SelectItem key={rd.value} value={rd.value}>{rd.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_door_width_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Door Width (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="60" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rear_door_height_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Door Height (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="72" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="has_side_door"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel>Has Side Door</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <h4 className="font-medium text-sm">Ramp Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="ramp_door_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ramp Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RAMP_TYPES.map(rt => (
                              <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ramp_length_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ramp Length (in)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="48" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ramp_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ramp Capacity (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Interior Features</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="floor_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
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
                  <FormField
                    control={form.control}
                    name="wall_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wall Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WALL_TYPES.map(wt => (
                              <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interior_lighting_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interior Lighting</FormLabel>
                        <FormControl>
                          <Input placeholder="LED, Fluorescent..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm">Tie-Down Systems</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_e_track"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>E-Track</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasETrack && (
                    <FormField
                      control={form.control}
                      name="e_track_rows"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Track Rows</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="has_d_rings"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>D-Rings</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasDRings && (
                    <FormField
                      control={form.control}
                      name="d_ring_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>D-Ring Count</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="8" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <h4 className="font-medium text-sm">Ventilation</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="has_roof_vent"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Roof Vents</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roof_vent_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vent Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="has_side_vents"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Side Vents</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="rv" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rv_sleep_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sleep Capacity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rv_dry_weight_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dry Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Tanks
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="fresh_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fresh (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gray_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gray (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="black_water_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Black (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propane_tank_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propane Tanks</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propane_capacity_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propane (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Power Systems
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="shore_power_amps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shore Power (A)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="battery_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Battery Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BATTERY_TYPES.map(bt => (
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
                    name="battery_amp_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Battery (Ah)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="200" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="has_solar"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Solar</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasSolar && (
                    <FormField
                      control={form.control}
                      name="solar_watts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Solar (W)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="400" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="has_inverter"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Inverter</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedHasInverter && (
                    <FormField
                      control={form.control}
                      name="inverter_watts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inverter (W)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2000" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Slideouts
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="slideout_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Slideouts</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slideout_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slideout Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Electric, Hydraulic..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Climate Control
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="ac_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AC Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AC_TYPES.map(at => (
                              <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ac_btu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AC BTU</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="15000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="heat_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heat Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HEAT_TYPES.map(ht => (
                              <SelectItem key={ht.value} value={ht.value}>{ht.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="heat_btu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heat BTU</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(watchedTrailerType === 'toy_hauler' || watchedIsToyHauler) && (
                  <>
                    <h4 className="font-medium text-sm">Toy Hauler Garage</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="garage_length_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Garage Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="12" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="garage_width_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Garage Width (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="8" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="garage_height_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Garage Height (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.5" placeholder="7" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fuel_station_gallons"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fuel Station (gal)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
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
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </form>
      </Form>
    </Card>
  );
}

export default TrailerForm;
