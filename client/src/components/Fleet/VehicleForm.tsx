import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Car, 
  Truck, 
  Bus,
  Bike,
  Ruler,
  Link2,
  Camera,
  X,
  Check,
  AlertTriangle,
  Info,
  Package,
  Zap,
  Droplets,
  Home,
  Thermometer
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

const vehicleFormSchema = z.object({
  nickname: z.string().optional(),
  fleet_number: z.string().optional(),
  year: z.coerce.number().min(1900).max(2030).optional().nullable(),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  color: z.string().optional(),
  license_plate: z.string().optional(),
  vin: z.string().max(17).optional(),
  vehicle_class: z.string().default('pickup_fullsize'),
  drive_type: z.string().default('4wd'),
  fuel_type: z.string().default('gas'),
  ground_clearance_inches: z.coerce.number().optional().nullable(),
  length_feet: z.coerce.number().optional().nullable(),
  height_feet: z.coerce.number().optional().nullable(),
  passenger_capacity: z.coerce.number().optional().nullable(),
  fleet_status: z.string().default('available'),
  
  cargo_length_inches: z.coerce.number().optional().nullable(),
  cargo_width_inches: z.coerce.number().optional().nullable(),
  cargo_height_inches: z.coerce.number().optional().nullable(),
  cargo_volume_cubic_feet: z.coerce.number().optional().nullable(),
  payload_capacity_lbs: z.coerce.number().optional().nullable(),
  gvwr_lbs: z.coerce.number().optional().nullable(),
  
  rear_door_type: z.string().default('none'),
  rear_door_width_inches: z.coerce.number().optional().nullable(),
  rear_door_height_inches: z.coerce.number().optional().nullable(),
  has_side_door: z.boolean().default(false),
  side_door_type: z.string().optional(),
  
  liftgate_type: z.string().default('none'),
  liftgate_capacity_lbs: z.coerce.number().optional().nullable(),
  liftgate_platform_width_inches: z.coerce.number().optional().nullable(),
  liftgate_platform_depth_inches: z.coerce.number().optional().nullable(),
  
  has_loading_ramp: z.boolean().default(false),
  ramp_type: z.string().optional(),
  ramp_capacity_lbs: z.coerce.number().optional().nullable(),
  
  bed_length: z.string().optional(),
  bed_length_inches: z.coerce.number().optional().nullable(),
  has_bed_liner: z.boolean().default(false),
  bed_liner_type: z.string().optional(),
  has_tonneau_cover: z.boolean().default(false),
  tonneau_type: z.string().optional(),
  has_truck_cap: z.boolean().default(false),
  
  towing_capacity_lbs: z.coerce.number().optional().nullable(),
  has_hitch: z.boolean().default(false),
  primary_hitch_type: z.string().default('none'),
  receiver_size_inches: z.coerce.number().optional().nullable(),
  hitch_class_type: z.string().default('none'),
  ball_size: z.string().default('none'),
  max_tongue_weight_lbs: z.coerce.number().optional().nullable(),
  
  has_gooseneck_hitch: z.boolean().default(false),
  gooseneck_ball_size: z.string().default('none'),
  has_fifth_wheel_hitch: z.boolean().default(false),
  fifth_wheel_rail_type: z.string().optional(),
  fifth_wheel_hitch_brand: z.string().optional(),
  
  has_brake_controller: z.boolean().default(false),
  brake_controller_type: z.string().optional(),
  brake_controller_brand: z.string().optional(),
  max_trailer_brakes: z.coerce.number().optional().nullable(),
  
  trailer_wiring_type: z.string().default('none'),
  has_aux_12v_circuit: z.boolean().default(false),
  
  is_rv: z.boolean().default(false),
  rv_sleep_capacity: z.coerce.number().optional().nullable(),
  rv_seatbelt_positions: z.coerce.number().optional().nullable(),
  
  fresh_water_gallons: z.coerce.number().optional().nullable(),
  gray_water_gallons: z.coerce.number().optional().nullable(),
  black_water_gallons: z.coerce.number().optional().nullable(),
  propane_tank_count: z.coerce.number().optional().nullable(),
  propane_capacity_lbs: z.coerce.number().optional().nullable(),
  fuel_tank_gallons: z.coerce.number().optional().nullable(),
  
  generator_type: z.string().optional(),
  generator_watts: z.coerce.number().optional().nullable(),
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
});

type VehicleFormData = z.infer<typeof vehicleFormSchema>;

const VEHICLE_CLASSES = [
  { value: 'sedan', label: 'Sedan', icon: Car },
  { value: 'suv_compact', label: 'SUV Compact', icon: Car },
  { value: 'suv_midsize', label: 'SUV Midsize', icon: Car },
  { value: 'suv_fullsize', label: 'SUV Full', icon: Car },
  { value: 'pickup_midsize', label: 'Pickup Mid', icon: Truck },
  { value: 'pickup_fullsize', label: 'Pickup Full', icon: Truck },
  { value: 'pickup_heavy_duty', label: 'Heavy Duty', icon: Truck },
  { value: 'cargo_van', label: 'Cargo Van', icon: Bus },
  { value: 'cargo_van_high_roof', label: 'High Roof Van', icon: Bus },
  { value: 'cube_van', label: 'Cube Van', icon: Truck },
  { value: 'box_truck', label: 'Box Truck', icon: Truck },
  { value: 'rv_class_a', label: 'RV Class A', icon: Bus },
  { value: 'rv_class_b', label: 'RV Class B', icon: Bus },
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

const HITCH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'bumper_pull', label: 'Bumper Pull' },
  { value: 'gooseneck', label: 'Gooseneck' },
  { value: 'fifth_wheel', label: 'Fifth Wheel' },
  { value: 'pintle', label: 'Pintle Hook' },
  { value: 'weight_distribution', label: 'Weight Distribution' },
];

const HITCH_CLASSES = [
  { value: 'none', label: 'None' },
  { value: 'class_i', label: 'Class I (2,000 lbs)' },
  { value: 'class_ii', label: 'Class II (3,500 lbs)' },
  { value: 'class_iii', label: 'Class III (8,000 lbs)' },
  { value: 'class_iv', label: 'Class IV (10,000 lbs)' },
  { value: 'class_v', label: 'Class V (17,000 lbs)' },
];

const BALL_SIZES = [
  { value: 'none', label: 'None / Unknown' },
  { value: '1_7_8', label: '1-7/8" (Light)' },
  { value: '2', label: '2" (Common)' },
  { value: '2_5_16', label: '2-5/16" (Heavy)' },
  { value: '3', label: '3" (Extra Heavy)' },
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

const LIFTGATE_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'tuck_under', label: 'Tuck Under' },
  { value: 'rail_gate', label: 'Rail Gate' },
  { value: 'cantilever', label: 'Cantilever' },
  { value: 'column_lift', label: 'Column Lift' },
  { value: 'side_loader', label: 'Side Loader' },
];

const BED_LENGTHS = [
  { value: 'na', label: 'N/A' },
  { value: 'short', label: 'Short (5.5-6\')' },
  { value: 'standard', label: 'Standard (6.5-7\')' },
  { value: 'long', label: 'Long (8\'+)' },
];

const BRAKE_CONTROLLER_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'proportional', label: 'Proportional' },
  { value: 'time_delayed', label: 'Time Delayed' },
  { value: 'integrated', label: 'Integrated (OEM)' },
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

  const vehicleQuery = useQuery<{ vehicle: VehicleFormData }>({
    queryKey: ['/api/v1/fleet/vehicles', vehicleId],
    enabled: !!vehicleId,
  });

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
      vehicle_class: initialData?.vehicle_class || 'pickup_fullsize',
      drive_type: initialData?.drive_type || '4wd',
      fuel_type: initialData?.fuel_type || 'gas',
      ground_clearance_inches: initialData?.ground_clearance_inches || undefined,
      length_feet: initialData?.length_feet || undefined,
      height_feet: initialData?.height_feet || undefined,
      passenger_capacity: initialData?.passenger_capacity || undefined,
      fleet_status: initialData?.fleet_status || 'available',
      cargo_length_inches: undefined,
      cargo_width_inches: undefined,
      cargo_height_inches: undefined,
      cargo_volume_cubic_feet: undefined,
      payload_capacity_lbs: undefined,
      gvwr_lbs: undefined,
      rear_door_type: 'none',
      rear_door_width_inches: undefined,
      rear_door_height_inches: undefined,
      has_side_door: false,
      side_door_type: '',
      liftgate_type: 'none',
      liftgate_capacity_lbs: undefined,
      liftgate_platform_width_inches: undefined,
      liftgate_platform_depth_inches: undefined,
      has_loading_ramp: false,
      ramp_type: '',
      ramp_capacity_lbs: undefined,
      bed_length: '',
      bed_length_inches: undefined,
      has_bed_liner: false,
      bed_liner_type: '',
      has_tonneau_cover: false,
      tonneau_type: '',
      has_truck_cap: false,
      towing_capacity_lbs: undefined,
      has_hitch: false,
      primary_hitch_type: 'none',
      receiver_size_inches: undefined,
      hitch_class_type: 'none',
      ball_size: 'none',
      max_tongue_weight_lbs: undefined,
      has_gooseneck_hitch: false,
      gooseneck_ball_size: 'none',
      has_fifth_wheel_hitch: false,
      fifth_wheel_rail_type: '',
      fifth_wheel_hitch_brand: '',
      has_brake_controller: false,
      brake_controller_type: '',
      brake_controller_brand: '',
      max_trailer_brakes: undefined,
      trailer_wiring_type: 'none',
      has_aux_12v_circuit: false,
      is_rv: false,
      rv_sleep_capacity: undefined,
      rv_seatbelt_positions: undefined,
      fresh_water_gallons: undefined,
      gray_water_gallons: undefined,
      black_water_gallons: undefined,
      propane_tank_count: undefined,
      propane_capacity_lbs: undefined,
      fuel_tank_gallons: undefined,
      generator_type: '',
      generator_watts: undefined,
      shore_power_amps: undefined,
      has_solar: false,
      solar_watts: undefined,
      battery_type: '',
      battery_amp_hours: undefined,
      has_inverter: false,
      inverter_watts: undefined,
      slideout_count: 0,
      slideout_type: '',
      ac_type: '',
      ac_btu: undefined,
      heat_type: '',
      heat_btu: undefined,
    },
  });

  useEffect(() => {
    if (vehicleQuery.data?.vehicle) {
      const v = vehicleQuery.data.vehicle;
      form.reset({
        nickname: v.nickname || '',
        fleet_number: v.fleet_number || '',
        year: v.year || undefined,
        make: v.make || '',
        model: v.model || '',
        color: v.color || '',
        license_plate: v.license_plate || '',
        vin: v.vin || '',
        vehicle_class: v.vehicle_class || 'pickup_fullsize',
        drive_type: v.drive_type || '4wd',
        fuel_type: v.fuel_type || 'gas',
        ground_clearance_inches: v.ground_clearance_inches || undefined,
        length_feet: v.length_feet || undefined,
        height_feet: v.height_feet || undefined,
        passenger_capacity: v.passenger_capacity || undefined,
        fleet_status: v.fleet_status || 'available',
        cargo_length_inches: v.cargo_length_inches || undefined,
        cargo_width_inches: v.cargo_width_inches || undefined,
        cargo_height_inches: v.cargo_height_inches || undefined,
        cargo_volume_cubic_feet: v.cargo_volume_cubic_feet || undefined,
        payload_capacity_lbs: v.payload_capacity_lbs || undefined,
        gvwr_lbs: v.gvwr_lbs || undefined,
        rear_door_type: v.rear_door_type || 'none',
        rear_door_width_inches: v.rear_door_width_inches || undefined,
        rear_door_height_inches: v.rear_door_height_inches || undefined,
        has_side_door: v.has_side_door || false,
        side_door_type: v.side_door_type || '',
        liftgate_type: v.liftgate_type || 'none',
        liftgate_capacity_lbs: v.liftgate_capacity_lbs || undefined,
        liftgate_platform_width_inches: v.liftgate_platform_width_inches || undefined,
        liftgate_platform_depth_inches: v.liftgate_platform_depth_inches || undefined,
        has_loading_ramp: v.has_loading_ramp || false,
        ramp_type: v.ramp_type || '',
        ramp_capacity_lbs: v.ramp_capacity_lbs || undefined,
        bed_length: v.bed_length || '',
        bed_length_inches: v.bed_length_inches || undefined,
        has_bed_liner: v.has_bed_liner || false,
        bed_liner_type: v.bed_liner_type || '',
        has_tonneau_cover: v.has_tonneau_cover || false,
        tonneau_type: v.tonneau_type || '',
        has_truck_cap: v.has_truck_cap || false,
        towing_capacity_lbs: v.towing_capacity_lbs || undefined,
        has_hitch: v.has_hitch || false,
        primary_hitch_type: v.primary_hitch_type || 'none',
        receiver_size_inches: v.receiver_size_inches || undefined,
        hitch_class_type: v.hitch_class_type || 'none',
        ball_size: v.ball_size || 'none',
        max_tongue_weight_lbs: v.max_tongue_weight_lbs || undefined,
        has_gooseneck_hitch: v.has_gooseneck_hitch || false,
        gooseneck_ball_size: v.gooseneck_ball_size || 'none',
        has_fifth_wheel_hitch: v.has_fifth_wheel_hitch || false,
        fifth_wheel_rail_type: v.fifth_wheel_rail_type || '',
        fifth_wheel_hitch_brand: v.fifth_wheel_hitch_brand || '',
        has_brake_controller: v.has_brake_controller || false,
        brake_controller_type: v.brake_controller_type || '',
        brake_controller_brand: v.brake_controller_brand || '',
        max_trailer_brakes: v.max_trailer_brakes || undefined,
        trailer_wiring_type: v.trailer_wiring_type || 'none',
        has_aux_12v_circuit: v.has_aux_12v_circuit || false,
        is_rv: v.is_rv || false,
        rv_sleep_capacity: v.rv_sleep_capacity || undefined,
        rv_seatbelt_positions: v.rv_seatbelt_positions || undefined,
        fresh_water_gallons: v.fresh_water_gallons || undefined,
        gray_water_gallons: v.gray_water_gallons || undefined,
        black_water_gallons: v.black_water_gallons || undefined,
        propane_tank_count: v.propane_tank_count || undefined,
        propane_capacity_lbs: v.propane_capacity_lbs || undefined,
        fuel_tank_gallons: v.fuel_tank_gallons || undefined,
        generator_type: v.generator_type || '',
        generator_watts: v.generator_watts || undefined,
        shore_power_amps: v.shore_power_amps || undefined,
        has_solar: v.has_solar || false,
        solar_watts: v.solar_watts || undefined,
        battery_type: v.battery_type || '',
        battery_amp_hours: v.battery_amp_hours || undefined,
        has_inverter: v.has_inverter || false,
        inverter_watts: v.inverter_watts || undefined,
        slideout_count: v.slideout_count || 0,
        slideout_type: v.slideout_type || '',
        ac_type: v.ac_type || '',
        ac_btu: v.ac_btu || undefined,
        heat_type: v.heat_type || '',
        heat_btu: v.heat_btu || undefined,
      });
    }
  }, [vehicleQuery.data, form]);

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

  function onError(errors: any) {
    console.error('VehicleForm validation errors:', errors);
  }

  const watchedFuelType = form.watch('fuel_type');
  const watchedHasHitch = form.watch('has_hitch');
  const watchedVehicleClass = form.watch('vehicle_class');
  const watchedIsRv = form.watch('is_rv');
  const watchedHasGooseneck = form.watch('has_gooseneck_hitch');
  const watchedHasFifthWheel = form.watch('has_fifth_wheel_hitch');
  const watchedHasBrakeController = form.watch('has_brake_controller');
  const watchedHasSolar = form.watch('has_solar');
  const watchedHasInverter = form.watch('has_inverter');

  const isCommercialType = ['cargo_van', 'cargo_van_high_roof', 'cube_van', 'box_truck', 'flatbed_truck'].includes(watchedVehicleClass);
  const isTruckType = ['pickup_midsize', 'pickup_fullsize', 'pickup_heavy_duty'].includes(watchedVehicleClass);
  const isRvType = ['rv_class_a', 'rv_class_b', 'rv_class_c'].includes(watchedVehicleClass);

  return (
    <Card className="max-h-[85vh] overflow-hidden flex flex-col">
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
              onClick={form.handleSubmit(onSubmit, onError)} 
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
            <TabsList className="mx-4 justify-start flex-shrink-0 flex-wrap h-auto gap-1">
              <TabsTrigger value="basic" data-testid="tab-basic">
                <Car className="w-4 h-4 mr-1.5" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="specs" data-testid="tab-specs">
                <Ruler className="w-4 h-4 mr-1.5" />
                Specs
              </TabsTrigger>
              {(isCommercialType || isTruckType) && (
                <TabsTrigger value="cargo" data-testid="tab-cargo">
                  <Package className="w-4 h-4 mr-1.5" />
                  Cargo
                </TabsTrigger>
              )}
              <TabsTrigger value="towing" data-testid="tab-towing">
                <Link2 className="w-4 h-4 mr-1.5" />
                Towing
              </TabsTrigger>
              {(isRvType || watchedIsRv) && (
                <TabsTrigger value="rv" data-testid="tab-rv">
                  <Home className="w-4 h-4 mr-1.5" />
                  RV Systems
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
                          <Input placeholder='e.g., "Big Blue"' {...field} data-testid="input-nickname" />
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
                          <Input placeholder="e.g., V-001" {...field} data-testid="input-fleet-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <Input placeholder="Ford" {...field} data-testid="input-make" />
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
                          <Input placeholder="F-350" {...field} data-testid="input-model" />
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
                          <Input placeholder="White" {...field} data-testid="input-color" />
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
                      <FormLabel>Vehicle Class</FormLabel>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {VEHICLE_CLASSES.map(vc => {
                          const Icon = vc.icon;
                          return (
                            <Button
                              key={vc.value}
                              type="button"
                              variant={field.value === vc.value ? 'default' : 'outline'}
                              className="flex flex-col h-auto py-2"
                              onClick={() => field.onChange(vc.value)}
                              data-testid={`button-class-${vc.value}`}
                            >
                              <Icon className="w-5 h-5 mb-1" />
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

                {!isRvType && (
                  <FormField
                    control={form.control}
                    name="is_rv"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">This is an RV / Camper</FormLabel>
                          <FormDescription>Enable RV-specific features like tanks and power systems</FormDescription>
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
                <p className="text-muted-foreground text-sm">
                  These specs help determine route suitability and ferry pricing.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="ground_clearance_inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ground Clearance (in)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="8.5" {...field} value={field.value || ''} data-testid="input-clearance" />
                        </FormControl>
                        <FormDescription>8"+ for gravel roads</FormDescription>
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
                        <FormDescription>7'+ = overheight</FormDescription>
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

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="gvwr_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GVWR (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="10000" {...field} value={field.value || ''} data-testid="input-gvwr" />
                        </FormControl>
                        <FormDescription>Gross Vehicle Weight Rating</FormDescription>
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
                          <Input type="number" placeholder="3000" {...field} value={field.value || ''} data-testid="input-payload" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fuel_tank_gallons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Tank (gal)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="36" {...field} value={field.value || ''} data-testid="input-fuel-tank" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="cargo" className="mt-0 space-y-6">
                <p className="text-muted-foreground text-sm">
                  Cargo dimensions and loading features for commercial vehicles and trucks.
                </p>

                {isTruckType && (
                  <>
                    <h4 className="font-medium text-sm">Truck Bed Configuration</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="bed_length"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bed Length</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-bed-length">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BED_LENGTHS.map(bl => (
                                  <SelectItem key={bl.value} value={bl.value}>{bl.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bed_length_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bed Length (in)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="78" {...field} value={field.value || ''} data-testid="input-bed-length-in" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="has_bed_liner"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Bed Liner</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_tonneau_cover"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Tonneau Cover</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="has_truck_cap"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Truck Cap/Shell</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {isCommercialType && (
                  <>
                    <h4 className="font-medium text-sm">Cargo Area Dimensions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="cargo_length_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cargo Length (in)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="144" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cargo_width_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cargo Width (in)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="70" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cargo_height_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cargo Height (in)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="72" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cargo_volume_cubic_feet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Volume (cu ft)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="400" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <h4 className="font-medium text-sm">Door Configuration</h4>
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

                    <h4 className="font-medium text-sm">Liftgate</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="liftgate_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Liftgate Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {LIFTGATE_TYPES.map(lt => (
                                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="liftgate_capacity_lbs"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacity (lbs)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="2500" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
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
                        <FormLabel className="text-base">Has Trailer Hitch</FormLabel>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="primary_hitch_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hitch Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
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
                      <FormField
                        control={form.control}
                        name="hitch_class_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hitch Class</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
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
                        name="ball_size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ball Size</FormLabel>
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
                        name="receiver_size_inches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receiver Size (in)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.25" placeholder="2" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="max_tongue_weight_lbs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Tongue Weight (lbs)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1000" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <h4 className="font-medium text-sm">Trailer Wiring</h4>
                    <div className="grid grid-cols-2 gap-4">
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
                        name="has_aux_12v_circuit"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Aux 12V Circuit</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <h4 className="font-medium text-sm">Brake Controller</h4>
                    <FormField
                      control={form.control}
                      name="has_brake_controller"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Brake Controller</FormLabel>
                            <FormDescription>Electric trailer brake controller</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {watchedHasBrakeController && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="brake_controller_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Controller Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {BRAKE_CONTROLLER_TYPES.map(bc => (
                                    <SelectItem key={bc.value} value={bc.value}>{bc.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="brake_controller_brand"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Brand</FormLabel>
                              <FormControl>
                                <Input placeholder="Tekonsha, Curt..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="max_trailer_brakes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Axles</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="2" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <h4 className="font-medium text-sm">Heavy Duty Hitches</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="has_gooseneck_hitch"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Gooseneck Hitch</FormLabel>
                              <FormDescription>Ball in truck bed</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                              <FormDescription>Kingpin/jaw system</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {watchedHasGooseneck && (
                      <FormField
                        control={form.control}
                        name="gooseneck_ball_size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gooseneck Ball Size</FormLabel>
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
                    )}

                    {watchedHasFifthWheel && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fifth_wheel_rail_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rail Type</FormLabel>
                              <FormControl>
                                <Input placeholder="Standard, OEM, Custom..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fifth_wheel_hitch_brand"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hitch Brand</FormLabel>
                              <FormControl>
                                <Input placeholder="B&W, Reese, Curt..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="rv" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 gap-4">
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
                    name="rv_seatbelt_positions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seatbelt Positions</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4" {...field} value={field.value || ''} />
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
                        <FormLabel>Shore Power (amps)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="30" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="generator_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Generator</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENERATOR_TYPES.map(gt => (
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
                    name="generator_watts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gen Watts</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4000" {...field} value={field.value || ''} />
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
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

export default VehicleForm;
