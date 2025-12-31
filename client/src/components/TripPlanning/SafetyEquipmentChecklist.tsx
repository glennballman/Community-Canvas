import { useState, useEffect } from 'react';
import {
  Compass, Radio, Car, Wrench, ShieldCheck, Tent,
  ChevronDown, ChevronUp, Check, AlertTriangle,
  Ship, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SafetyEquipmentType {
  id: string;
  name: string;
  category: string;
  description: string;
  required_for_routes: string[] | null;
  recommended_for_routes: string[] | null;
  bc_ferries_allowed: boolean;
  bc_ferries_notes: string | null;
  icon: string;
}

interface VehicleEquipment {
  equipment_type_id: string;
  present: boolean;
  condition: string;
  notes: string;
}

interface SafetyEquipmentChecklistProps {
  vehicleId: string;
  onUpdate?: () => void;
}

const CATEGORY_ORDER = ['navigation', 'communication', 'vehicle_emergency', 'tools', 'personal_safety', 'survival'];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  navigation: <Compass className="w-5 h-5" />,
  communication: <Radio className="w-5 h-5" />,
  vehicle_emergency: <Car className="w-5 h-5" />,
  tools: <Wrench className="w-5 h-5" />,
  personal_safety: <ShieldCheck className="w-5 h-5" />,
  survival: <Tent className="w-5 h-5" />
};

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  communication: 'Communication',
  vehicle_emergency: 'Vehicle Emergency',
  tools: 'Tools',
  personal_safety: 'Personal Safety',
  survival: 'Survival'
};

export function SafetyEquipmentChecklist({ vehicleId, onUpdate }: SafetyEquipmentChecklistProps) {
  const [equipmentTypes, setEquipmentTypes] = useState<SafetyEquipmentType[]>([]);
  const [vehicleEquipment, setVehicleEquipment] = useState<Record<string, VehicleEquipment>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  useEffect(() => {
    loadData();
  }, [vehicleId]);

  async function loadData() {
    setLoading(true);
    try {
      const typesRes = await fetch('/api/v1/planning/safety-equipment-types');
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setEquipmentTypes(typesData.types || []);
      }

      const vehicleRes = await fetch(`/api/v1/planning/vehicles/${vehicleId}/safety-equipment`);
      if (vehicleRes.ok) {
        const vehicleData = await vehicleRes.json();
        const equipmentMap: Record<string, VehicleEquipment> = {};
        for (const item of vehicleData.equipment || []) {
          equipmentMap[item.equipment_type_id] = item;
        }
        setVehicleEquipment(equipmentMap);
      }
    } catch (error) {
      console.error('Error loading safety equipment:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleEquipment(equipmentTypeId: string, present: boolean) {
    setSaving(equipmentTypeId);
    try {
      const response = await fetch(`/api/v1/planning/vehicles/${vehicleId}/safety-equipment/${equipmentTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ present, condition: present ? 'good' : null })
      });

      if (response.ok) {
        setVehicleEquipment(prev => ({
          ...prev,
          [equipmentTypeId]: {
            equipment_type_id: equipmentTypeId,
            present,
            condition: present ? 'good' : '',
            notes: ''
          }
        }));
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error updating equipment:', error);
    } finally {
      setSaving(null);
    }
  }

  async function updateCondition(equipmentTypeId: string, condition: string) {
    try {
      await fetch(`/api/v1/planning/vehicles/${vehicleId}/safety-equipment/${equipmentTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ present: true, condition })
      });

      setVehicleEquipment(prev => ({
        ...prev,
        [equipmentTypeId]: { ...prev[equipmentTypeId], condition }
      }));
    } catch (error) {
      console.error('Error updating condition:', error);
    }
  }

  function toggleCategory(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  const groupedEquipment = CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = equipmentTypes.filter(e => e.category === category);
    return acc;
  }, {} as Record<string, SafetyEquipmentType[]>);

  const totalItems = equipmentTypes.length;
  const presentItems = Object.values(vehicleEquipment).filter(e => e.present).length;
  const recommendedItems = equipmentTypes.filter(e => e.required_for_routes && e.required_for_routes.length > 0);
  const recommendedPresent = recommendedItems.filter(e => vehicleEquipment[e.id]?.present).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading safety checklist...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{presentItems}/{totalItems}</p>
            <p className="text-muted-foreground text-sm">Total Items</p>
          </CardContent>
        </Card>
        <Card className={recommendedPresent === recommendedItems.length ? 'border-green-500/50' : 'border-orange-500/50'}>
          <CardContent className="py-4 text-center">
            <p className={`text-2xl font-bold ${recommendedPresent === recommendedItems.length ? 'text-green-500' : 'text-orange-500'}`}>
              {recommendedPresent}/{recommendedItems.length}
            </p>
            <p className="text-muted-foreground text-sm">Key Items</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/50">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-blue-500">
              {totalItems > 0 ? Math.round((presentItems / totalItems) * 100) : 0}%
            </p>
            <p className="text-muted-foreground text-sm">Prepared</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedCategories(new Set(CATEGORY_ORDER))}
          data-testid="button-expand-all"
        >
          Expand All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedCategories(new Set())}
          data-testid="button-collapse-all"
        >
          Collapse All
        </Button>
      </div>

      <div className="space-y-3">
        {CATEGORY_ORDER.map(category => {
          const items = groupedEquipment[category] || [];
          const categoryPresent = items.filter(e => vehicleEquipment[e.id]?.present).length;
          const isExpanded = expandedCategories.has(category);

          return (
            <Card key={category}>
              <CardHeader className="pb-0">
                <Button
                  variant="ghost"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-0 h-auto"
                  data-testid={`button-toggle-${category}`}
                >
                  <div className="flex items-center gap-3">
                    {CATEGORY_ICONS[category]}
                    <span className="text-lg font-medium">{CATEGORY_LABELS[category]}</span>
                    <Badge variant="secondary">
                      {categoryPresent}/{items.length}
                    </Badge>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </Button>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-4 space-y-2">
                  {items.map(item => {
                    const equipment = vehicleEquipment[item.id];
                    const isPresent = equipment?.present || false;
                    const isRequired = item.required_for_routes && item.required_for_routes.length > 0;
                    const isSaving = saving === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition ${
                          isPresent ? 'bg-green-500/10' : 'bg-muted/30'
                        }`}
                        data-testid={`equipment-item-${item.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Button
                            variant={isPresent ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => toggleEquipment(item.id, !isPresent)}
                            disabled={isSaving}
                            className={isPresent ? 'bg-green-600 hover:bg-green-700' : ''}
                            data-testid={`button-toggle-equipment-${item.id}`}
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isPresent ? (
                              <Check className="w-4 h-4" />
                            ) : null}
                          </Button>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium ${isPresent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {item.name}
                              </span>
                              {isRequired && (
                                <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400">
                                  Highly Recommended
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground text-sm">{item.description}</p>
                            {!item.bc_ferries_allowed && (
                              <p className="text-yellow-500 text-xs mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Not allowed on BC Ferries
                              </p>
                            )}
                            {item.bc_ferries_notes && (
                              <p className="text-blue-500 text-xs mt-1 flex items-center gap-1">
                                <Ship className="w-3 h-3" /> Ferry note: {item.bc_ferries_notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {isPresent && (
                          <Select
                            value={equipment?.condition || 'good'}
                            onValueChange={(v) => updateCondition(item.id, v)}
                          >
                            <SelectTrigger className="w-32" data-testid={`select-condition-${item.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="needs_replacement">Replace Soon</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-blue-500 text-sm flex items-center gap-2">
            <Ship className="w-4 h-4" /> BC Ferries Reminders
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="text-muted-foreground text-sm space-y-1">
            <li>Gas cans must be <strong>empty</strong> when boarding</li>
            <li>Propane tanks must be turned off</li>
            <li>Bear spray should be accessible, not in cargo</li>
            <li>Flares have restrictions - check current policy</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default SafetyEquipmentChecklist;
