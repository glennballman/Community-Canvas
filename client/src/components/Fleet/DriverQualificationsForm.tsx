import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  IdCard, Shield, Truck, AlertTriangle, CheckCircle2, 
  Calendar, Award, GraduationCap, Save, Loader2, AlertCircle, Globe
} from 'lucide-react';

interface DriverQualificationsFormProps {
  driverId: string;
  onSave?: () => void;
}

// ============================================
// INTERNATIONAL LICENSE SUPPORT
// ============================================

const LICENSE_COUNTRIES = [
  { value: '', label: 'Select Country' },
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'CN', label: 'China' },
  { value: 'IN', label: 'India' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brazil' },
  { value: 'OTHER', label: 'Other Country' },
];

const CANADIAN_PROVINCES = [
  { value: '', label: 'Select Province' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'ON', label: 'Ontario' },
  { value: 'QC', label: 'Quebec' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'YT', label: 'Yukon' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
];

const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

const AUSTRALIAN_STATES = [
  { value: '', label: 'Select State' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

// BC-specific license classes
const BC_LICENSE_CLASSES = [
  { value: '', label: 'No License' },
  { value: '7L', label: 'Class 7L - Learner' },
  { value: '7N', label: 'Class 7N - Novice' },
  { value: '5', label: 'Class 5 - Full License' },
  { value: '4', label: 'Class 4 - Taxi/Ambulance' },
  { value: '3', label: 'Class 3 - Medium Trucks' },
  { value: '2', label: 'Class 2 - Bus' },
  { value: '1', label: 'Class 1 - Semi-Trailer' },
];

// Generic license classes for non-BC jurisdictions
const GENERIC_LICENSE_CLASSES = [
  { value: '', label: 'No License' },
  { value: 'LEARNER', label: 'Learner / Provisional' },
  { value: 'STANDARD', label: 'Standard / Full License' },
  { value: 'COMMERCIAL', label: 'Commercial License' },
];

// Helper function to get subdivision options based on country
function getSubdivisionOptions(country: string) {
  switch (country) {
    case 'CA':
      return { label: 'Province/Territory', options: CANADIAN_PROVINCES };
    case 'US':
      return { label: 'State', options: US_STATES };
    case 'AU':
      return { label: 'State/Territory', options: AUSTRALIAN_STATES };
    default:
      return null;
  }
}

// Helper function to get license class options based on jurisdiction
function getLicenseClassOptions(country: string, subdivision: string) {
  if (country === 'CA' && subdivision === 'BC') {
    return BC_LICENSE_CLASSES;
  }
  return GENERIC_LICENSE_CLASSES;
}

interface DriverQualifications {
  id: string;
  name: string;
  license_class: string | null;
  license_province: string | null;
  license_country: string | null;
  license_expiry: string | null;
  has_air_brake_endorsement: boolean;
  air_brake_endorsement_date: string | null;
  has_house_trailer_endorsement: boolean;
  house_trailer_endorsement_date: string | null;
  has_heavy_trailer_endorsement: boolean;
  heavy_trailer_endorsement_date: string | null;
  heavy_trailer_medical_expiry: string | null;
  max_trailer_weight_certified_kg: number | null;
  max_combination_weight_certified_kg: number | null;
  double_tow_experience: boolean;
  fifth_wheel_experience: boolean;
  gooseneck_experience: boolean;
  heavy_equipment_loading_experience: boolean;
  horse_trailer_experience: boolean;
  livestock_handling_experience: boolean;
  boat_launching_experience: boolean;
  rv_driving_course_completed: boolean;
  rv_course_provider: string | null;
  rv_course_date: string | null;
}

export function DriverQualificationsForm({ driverId, onSave }: DriverQualificationsFormProps) {
  const { toast } = useToast();

  const { data: qualifications, isLoading, error } = useQuery<DriverQualifications>({
    queryKey: ['/api/v1/fleet/driver-qualifications', driverId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/fleet/driver-qualifications/${driverId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch driver qualifications');
      }
      return response.json();
    },
    enabled: !!driverId,
  });

  const form = useForm({
    defaultValues: {
      license_country: 'CA',
      license_province: 'BC',
      license_class: '',
      license_expiry: '',
      has_air_brake_endorsement: false,
      air_brake_endorsement_date: '',
      has_house_trailer_endorsement: false,
      house_trailer_endorsement_date: '',
      has_heavy_trailer_endorsement: false,
      heavy_trailer_endorsement_date: '',
      heavy_trailer_medical_expiry: '',
      max_trailer_weight_certified_kg: 0,
      max_combination_weight_certified_kg: 0,
      double_tow_experience: false,
      fifth_wheel_experience: false,
      gooseneck_experience: false,
      heavy_equipment_loading_experience: false,
      horse_trailer_experience: false,
      livestock_handling_experience: false,
      boat_launching_experience: false,
      rv_driving_course_completed: false,
      rv_course_provider: '',
      rv_course_date: '',
    }
  });

  // Watch country and province for cascading dropdowns
  const watchCountry = form.watch('license_country');
  const watchProvince = form.watch('license_province');
  const watchLicenseClass = form.watch('license_class');
  const watchHasHeavyTrailer = form.watch('has_heavy_trailer_endorsement');
  const watchRvCourse = form.watch('rv_driving_course_completed');

  useEffect(() => {
    if (qualifications) {
      form.reset({
        license_country: qualifications.license_country || 'CA',
        license_province: qualifications.license_province || 'BC',
        license_class: qualifications.license_class || '',
        license_expiry: qualifications.license_expiry || '',
        has_air_brake_endorsement: qualifications.has_air_brake_endorsement || false,
        air_brake_endorsement_date: qualifications.air_brake_endorsement_date || '',
        has_house_trailer_endorsement: qualifications.has_house_trailer_endorsement || false,
        house_trailer_endorsement_date: qualifications.house_trailer_endorsement_date || '',
        has_heavy_trailer_endorsement: qualifications.has_heavy_trailer_endorsement || false,
        heavy_trailer_endorsement_date: qualifications.heavy_trailer_endorsement_date || '',
        heavy_trailer_medical_expiry: qualifications.heavy_trailer_medical_expiry || '',
        max_trailer_weight_certified_kg: qualifications.max_trailer_weight_certified_kg || 0,
        max_combination_weight_certified_kg: qualifications.max_combination_weight_certified_kg || 0,
        double_tow_experience: qualifications.double_tow_experience || false,
        fifth_wheel_experience: qualifications.fifth_wheel_experience || false,
        gooseneck_experience: qualifications.gooseneck_experience || false,
        heavy_equipment_loading_experience: qualifications.heavy_equipment_loading_experience || false,
        horse_trailer_experience: qualifications.horse_trailer_experience || false,
        livestock_handling_experience: qualifications.livestock_handling_experience || false,
        boat_launching_experience: qualifications.boat_launching_experience || false,
        rv_driving_course_completed: qualifications.rv_driving_course_completed || false,
        rv_course_provider: qualifications.rv_course_provider || '',
        rv_course_date: qualifications.rv_course_date || '',
      });
    }
  }, [qualifications, form]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/v1/fleet/driver-qualifications/${driverId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/fleet/driver-qualifications', driverId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/fleet/driver-qualification-summary', driverId] });
      toast({
        title: 'Qualifications Saved',
        description: 'Driver qualifications have been updated successfully.',
      });
      onSave?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save qualifications',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: any) => {
    const cleanedData = {
      ...data,
      license_expiry: data.license_expiry || null,
      air_brake_endorsement_date: data.air_brake_endorsement_date || null,
      house_trailer_endorsement_date: data.house_trailer_endorsement_date || null,
      heavy_trailer_endorsement_date: data.heavy_trailer_endorsement_date || null,
      heavy_trailer_medical_expiry: data.heavy_trailer_medical_expiry || null,
      max_trailer_weight_certified_kg: data.max_trailer_weight_certified_kg || null,
      max_combination_weight_certified_kg: data.max_combination_weight_certified_kg || null,
      rv_course_provider: data.rv_course_provider || null,
      rv_course_date: data.rv_course_date || null,
    };
    mutation.mutate(cleanedData);
  };

  // Get subdivision options based on selected country
  const subdivisionConfig = getSubdivisionOptions(watchCountry);
  const licenseClassOptions = getLicenseClassOptions(watchCountry, watchProvince);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Failed to load driver qualifications</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Driver License Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="w-5 h-5" />
              Driver License
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Country */}
              <FormField
                control={form.control}
                name="license_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country of Issue</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset subdivision and class when country changes
                        form.setValue('license_province', '');
                        form.setValue('license_class', '');
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-license-country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LICENSE_COUNTRIES.filter(c => c.value !== '').map(country => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* State/Province (only for countries with subdivisions) */}
              {subdivisionConfig && (
                <FormField
                  control={form.control}
                  name="license_province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{subdivisionConfig.label}</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset class when province changes (BC has different classes)
                          form.setValue('license_class', '');
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-license-province">
                            <SelectValue placeholder={`Select ${subdivisionConfig.label.toLowerCase()}`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subdivisionConfig.options.filter(o => o.value !== '').map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* License Class */}
              <FormField
                control={form.control}
                name="license_class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Class</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-license-class">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {licenseClassOptions.map(lc => (
                          <SelectItem key={lc.value || 'none'} value={lc.value || 'NONE'}>
                            {lc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* License Expiry */}
              <FormField
                control={form.control}
                name="license_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Expiry</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-license-expiry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* No License Warning */}
            {(!watchLicenseClass || watchLicenseClass === 'NONE') && watchCountry && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-md text-sm text-warning flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No license selected. This participant cannot be assigned as a driver.
              </div>
            )}

            {/* International License Note */}
            {watchCountry && watchCountry !== 'CA' && watchLicenseClass && watchLicenseClass !== 'NONE' && (
              <div className="mt-4 p-3 bg-muted border border-border rounded-md text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <Globe className="h-4 w-4" />
                  International Visitors Note
                </div>
                <p>Visitors to BC can drive with a valid foreign license for up to 6 months. 
                   An International Driving Permit (IDP) is recommended but not required for English-language licenses.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* BC Endorsements Card - Only show for BC license holders */}
        {watchCountry === 'CA' && watchProvince === 'BC' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                BC Endorsements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 p-4 border rounded-lg">
                  <FormField
                    control={form.control}
                    name="has_air_brake_endorsement"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Air Brake Endorsement</FormLabel>
                          <FormDescription className="text-xs">Required for trailers with air brakes</FormDescription>
                        </div>
                        <FormControl>
                          <Switch 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                            data-testid="switch-air-brake"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch('has_air_brake_endorsement') && (
                    <FormField
                      control={form.control}
                      name="air_brake_endorsement_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Date Obtained</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-8" data-testid="input-air-brake-date" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="space-y-3 p-4 border rounded-lg">
                  <FormField
                    control={form.control}
                    name="has_house_trailer_endorsement"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Code 07 - House Trailer</FormLabel>
                          <FormDescription className="text-xs">RV trailers over 4,600 kg</FormDescription>
                        </div>
                        <FormControl>
                          <Switch 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                            data-testid="switch-house-trailer"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch('has_house_trailer_endorsement') && (
                    <FormField
                      control={form.control}
                      name="house_trailer_endorsement_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Date Obtained</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-8" data-testid="input-house-trailer-date" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <FormField
                  control={form.control}
                  name="has_heavy_trailer_endorsement"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Code 20 - Heavy Trailer</FormLabel>
                        <FormDescription className="text-xs">Non-RV trailers over 4,600 kg (requires medical every 3 years)</FormDescription>
                      </div>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                          data-testid="switch-heavy-trailer"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchHasHeavyTrailer && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <FormField
                      control={form.control}
                      name="heavy_trailer_endorsement_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Endorsement Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-8" data-testid="input-heavy-trailer-date" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="heavy_trailer_medical_expiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Medical Expiry</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-8" data-testid="input-medical-expiry" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Towing Experience Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Towing Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="fifth_wheel_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Fifth Wheel</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-fifth-wheel-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gooseneck_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Gooseneck</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-gooseneck-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="double_tow_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Double Tow</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-double-tow-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heavy_equipment_loading_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Heavy Equipment</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-heavy-equip-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground">Specialty Experience</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="horse_trailer_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Horse Trailer</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-horse-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="livestock_handling_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Livestock Handling</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-livestock-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="boat_launching_experience"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                    <FormLabel className="text-sm">Boat Launching</FormLabel>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-boat-exp"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* RV Training Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              RV Training
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="rv_driving_course_completed"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <FormLabel>RV Driving Course Completed</FormLabel>
                    <FormDescription className="text-xs">Professional RV operator training</FormDescription>
                  </div>
                  <FormControl>
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={field.onChange}
                      data-testid="switch-rv-course"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchRvCourse && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rv_course_provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Provider</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., RV Safety Education Foundation" data-testid="input-rv-provider" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rv_course_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Completion Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-rv-date" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-qualifications">
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Qualifications
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
