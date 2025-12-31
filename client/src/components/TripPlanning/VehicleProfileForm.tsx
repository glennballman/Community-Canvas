import { useState } from 'react';
import { 
  ArrowLeft,
  Car,
  ClipboardCheck,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VehicleProfile, VehicleAssessment, VehicleClass } from '../../types/tripPlanning';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VehicleProfileFormProps {
  vehicle: VehicleProfile | null;
  onSave: (vehicle: VehicleProfile) => void;
  onCancel: () => void;
}

const VEHICLE_CLASSES: { value: VehicleClass; label: string }[] = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Truck' },
  { value: 'van', label: 'Van' },
  { value: 'cube_van', label: 'Cube Van' },
  { value: 'rv_class_a', label: 'RV Class A' },
  { value: 'rv_class_c', label: 'RV Class C' },
  { value: 'motorcycle', label: 'Motorcycle' },
];

export function VehicleProfileForm({ vehicle, onSave, onCancel }: VehicleProfileFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<VehicleProfile>>({
    owner_type: vehicle?.owner_type || 'personal',
    year: vehicle?.year,
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    license_plate: vehicle?.license_plate || '',
    vehicle_class: vehicle?.vehicle_class || 'sedan',
    drive_type: vehicle?.drive_type || '2wd',
    fuel_type: vehicle?.fuel_type || 'gasoline',
    ground_clearance_inches: vehicle?.ground_clearance_inches,
    length_feet: vehicle?.length_feet,
    height_feet: vehicle?.height_feet,
    passenger_capacity: vehicle?.passenger_capacity,
    rough_gravel_suitable: vehicle?.rough_gravel_suitable || false,
    four_x_four_required_suitable: vehicle?.four_x_four_required_suitable || false
  });

  const [assessment, setAssessment] = useState<Partial<VehicleAssessment>>({
    tire_tread_condition: vehicle?.latest_assessment?.tire_tread_condition || 'good',
    tires_winter_rated: vehicle?.latest_assessment?.tires_winter_rated || false,
    chains_available: vehicle?.latest_assessment?.chains_available || false,
    oil_level: vehicle?.latest_assessment?.oil_level || 'full',
    coolant_level: vehicle?.latest_assessment?.coolant_level || 'full',
    brake_condition: vehicle?.latest_assessment?.brake_condition || 'good',
    has_first_aid_kit: vehicle?.latest_assessment?.has_first_aid_kit || false,
    has_fire_extinguisher: vehicle?.latest_assessment?.has_fire_extinguisher || false,
    has_blankets: vehicle?.latest_assessment?.has_blankets || false,
    has_emergency_food: vehicle?.latest_assessment?.has_emergency_food || false,
    has_water: vehicle?.latest_assessment?.has_water || false,
    has_phone_charger: vehicle?.latest_assessment?.has_phone_charger || false,
    has_flashlight: vehicle?.latest_assessment?.has_flashlight || false,
    windshield_washer_full: vehicle?.latest_assessment?.windshield_washer_full || false,
    overall_condition: vehicle?.latest_assessment?.overall_condition || 'good'
  });

  const [activeSection, setActiveSection] = useState<'details' | 'assessment'>('details');
  const [saving, setSaving] = useState(false);

  const suitability = {
    pavedRoads: true,
    goodGravel: formData.vehicle_class !== 'sedan' && formData.vehicle_class !== 'motorcycle',
    roughGravel: (formData.ground_clearance_inches || 0) >= 8 || formData.vehicle_class === 'truck' || formData.vehicle_class === 'suv',
    fourByFourOnly: formData.drive_type === '4wd' || formData.drive_type === 'awd'
  };

  const handleSave = async () => {
    if (!formData.make || !formData.model) {
      toast({
        title: 'Missing Information',
        description: 'Please enter vehicle make and model',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const vehicleData = {
        ...formData,
        rough_gravel_suitable: suitability.roughGravel,
        four_x_four_required_suitable: suitability.fourByFourOnly
      };

      const response = await fetch('/api/v1/planning/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData)
      });
      
      if (!response.ok) throw new Error('Failed to save vehicle');
      
      const savedVehicle = await response.json();

      if (activeSection === 'assessment') {
        await fetch(`/api/v1/planning/vehicles/${savedVehicle.id}/assessments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...assessment,
            assessment_date: new Date().toISOString().split('T')[0]
          })
        });
      }

      const vehicleResponse = await fetch(`/api/v1/planning/vehicles/${savedVehicle.id}`);
      const completeVehicle = await vehicleResponse.json();

      toast({
        title: 'Vehicle Saved',
        description: 'Your vehicle has been saved successfully'
      });
      onSave(completeVehicle);
    } catch (error) {
      console.error('Error saving vehicle:', error);
      toast({
        title: 'Error',
        description: 'Failed to save vehicle. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onCancel} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CardTitle>
                {vehicle ? 'Edit Vehicle' : 'Add Your Vehicle'}
              </CardTitle>
            </div>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-vehicle">
              {saving ? 'Saving...' : 'Save Vehicle'}
            </Button>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant={activeSection === 'details' ? 'default' : 'outline'}
              onClick={() => setActiveSection('details')}
              data-testid="tab-details"
            >
              <Car className="w-4 h-4 mr-2" />
              Vehicle Details
            </Button>
            <Button
              variant={activeSection === 'assessment' ? 'default' : 'outline'}
              onClick={() => setActiveSection('assessment')}
              data-testid="tab-assessment"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Safety Assessment
            </Button>
          </div>
        </CardHeader>
      </Card>

      {activeSection === 'details' && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={formData.year || ''}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || undefined })}
                  placeholder="2024"
                  data-testid="input-year"
                />
              </div>
              <div className="space-y-2">
                <Label>Make *</Label>
                <Input
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="Toyota"
                  data-testid="input-make"
                />
              </div>
              <div className="space-y-2">
                <Label>Model *</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="4Runner"
                  data-testid="input-model"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Class</Label>
                <Select
                  value={formData.vehicle_class}
                  onValueChange={(v) => setFormData({ ...formData, vehicle_class: v as VehicleClass })}
                >
                  <SelectTrigger data-testid="select-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CLASSES.map(vc => (
                      <SelectItem key={vc.value} value={vc.value}>{vc.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Drive Type</Label>
                <Select
                  value={formData.drive_type}
                  onValueChange={(v) => setFormData({ ...formData, drive_type: v as any })}
                >
                  <SelectTrigger data-testid="select-drive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2wd">2WD</SelectItem>
                    <SelectItem value="4wd">4WD</SelectItem>
                    <SelectItem value="awd">AWD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ground Clearance (inches)</Label>
                <Input
                  type="number"
                  value={formData.ground_clearance_inches || ''}
                  onChange={(e) => setFormData({ ...formData, ground_clearance_inches: parseFloat(e.target.value) || undefined })}
                  placeholder="8.5"
                  step="0.5"
                  data-testid="input-clearance"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Passengers</Label>
                <Input
                  type="number"
                  value={formData.passenger_capacity || ''}
                  onChange={(e) => setFormData({ ...formData, passenger_capacity: parseInt(e.target.value) || undefined })}
                  placeholder="5"
                  data-testid="input-passengers"
                />
              </div>
              <div className="space-y-2">
                <Label>Length (feet)</Label>
                <Input
                  type="number"
                  value={formData.length_feet || ''}
                  onChange={(e) => setFormData({ ...formData, length_feet: parseFloat(e.target.value) || undefined })}
                  step="0.5"
                  data-testid="input-length"
                />
              </div>
              <div className="space-y-2">
                <Label>Height (feet)</Label>
                <Input
                  type="number"
                  value={formData.height_feet || ''}
                  onChange={(e) => setFormData({ ...formData, height_feet: parseFloat(e.target.value) || undefined })}
                  step="0.5"
                  data-testid="input-height"
                />
                {(formData.height_feet || 0) > 7 && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Overheight for BC Ferries
                  </p>
                )}
              </div>
            </div>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Route Suitability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-lg text-center ${suitability.pavedRoads ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {suitability.pavedRoads ? <Check className="w-6 h-6 mx-auto text-green-500" /> : <X className="w-6 h-6 mx-auto text-red-500" />}
                    <p className="text-sm text-muted-foreground mt-1">Paved Roads</p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${suitability.goodGravel ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                    {suitability.goodGravel ? <Check className="w-6 h-6 mx-auto text-green-500" /> : <AlertTriangle className="w-6 h-6 mx-auto text-yellow-500" />}
                    <p className="text-sm text-muted-foreground mt-1">Good Gravel</p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${suitability.roughGravel ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {suitability.roughGravel ? <Check className="w-6 h-6 mx-auto text-green-500" /> : <X className="w-6 h-6 mx-auto text-red-500" />}
                    <p className="text-sm text-muted-foreground mt-1">Rough Gravel</p>
                    <p className="text-xs text-muted-foreground">(Bamfield Road)</p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${suitability.fourByFourOnly ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {suitability.fourByFourOnly ? <Check className="w-6 h-6 mx-auto text-green-500" /> : <X className="w-6 h-6 mx-auto text-red-500" />}
                    <p className="text-sm text-muted-foreground mt-1">4x4 Required</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {activeSection === 'assessment' && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Safety Checklist</CardTitle>
            <CardDescription>
              Complete this checklist before remote or challenging trips. Items marked as issues will show warnings in trip planning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tire Tread Condition</Label>
                    <Select
                      value={assessment.tire_tread_condition}
                      onValueChange={(v) => setAssessment({ ...assessment, tire_tread_condition: v as any })}
                    >
                      <SelectTrigger data-testid="select-tread">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New (8mm+)</SelectItem>
                        <SelectItem value="good">Good (5-8mm)</SelectItem>
                        <SelectItem value="fair">Fair (3-5mm)</SelectItem>
                        <SelectItem value="worn">Worn (2-3mm)</SelectItem>
                        <SelectItem value="needs_replacement">Needs Replacement (&lt;2mm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="winter"
                        checked={assessment.tires_winter_rated}
                        onCheckedChange={(c) => setAssessment({ ...assessment, tires_winter_rated: !!c })}
                      />
                      <label htmlFor="winter" className="text-sm cursor-pointer">Winter-rated tires (M+S or Snowflake)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chains"
                        checked={assessment.chains_available}
                        onCheckedChange={(c) => setAssessment({ ...assessment, chains_available: !!c })}
                      />
                      <label htmlFor="chains" className="text-sm cursor-pointer">Tire chains available</label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mechanical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Oil Level</Label>
                    <Select
                      value={assessment.oil_level}
                      onValueChange={(v) => setAssessment({ ...assessment, oil_level: v })}
                    >
                      <SelectTrigger data-testid="select-oil">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="ok">OK</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Coolant Level</Label>
                    <Select
                      value={assessment.coolant_level}
                      onValueChange={(v) => setAssessment({ ...assessment, coolant_level: v })}
                    >
                      <SelectTrigger data-testid="select-coolant">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="ok">OK</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Brake Condition</Label>
                    <Select
                      value={assessment.brake_condition}
                      onValueChange={(v) => setAssessment({ ...assessment, brake_condition: v })}
                    >
                      <SelectTrigger data-testid="select-brakes">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="needs_service">Needs Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Emergency Equipment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'has_first_aid_kit', label: 'First Aid Kit' },
                    { key: 'has_fire_extinguisher', label: 'Fire Extinguisher' },
                    { key: 'has_blankets', label: 'Blankets' },
                    { key: 'has_emergency_food', label: 'Emergency Food' },
                    { key: 'has_water', label: 'Water' },
                    { key: 'has_phone_charger', label: 'Phone Charger' },
                    { key: 'has_flashlight', label: 'Flashlight' },
                    { key: 'windshield_washer_full', label: 'Washer Fluid Full' }
                  ].map(item => (
                    <div key={item.key} className="flex items-center space-x-2 bg-muted/50 rounded-lg p-3">
                      <Checkbox
                        id={item.key}
                        checked={(assessment as any)[item.key]}
                        onCheckedChange={(c) => setAssessment({ ...assessment, [item.key]: !!c })}
                      />
                      <label htmlFor={item.key} className="text-sm cursor-pointer">{item.label}</label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Overall Vehicle Condition</Label>
              <Select
                value={assessment.overall_condition}
                onValueChange={(v) => setAssessment({ ...assessment, overall_condition: v as any })}
              >
                <SelectTrigger data-testid="select-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent - Ready for any trip</SelectItem>
                  <SelectItem value="good">Good - Suitable for most trips</SelectItem>
                  <SelectItem value="fair">Fair - Stick to easy routes</SelectItem>
                  <SelectItem value="poor">Poor - Needs maintenance</SelectItem>
                  <SelectItem value="not_roadworthy">Not Roadworthy - Do not drive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default VehicleProfileForm;
