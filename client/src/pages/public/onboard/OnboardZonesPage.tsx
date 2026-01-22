/**
 * RES-ONB-01: Onboard Zones Page
 * 
 * Allows residents to define work zones on their place.
 * Stores zone definitions as onboarding items with item_type='zone_definition'.
 * 
 * Route: /onboard/w/:token/zones
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowLeft,
  ArrowRight,
  Plus,
  MapPin,
  X,
  Check,
  Home,
  Trees,
  Car,
  Warehouse,
  Droplet,
  Fence,
  Building
} from 'lucide-react';

interface Workspace {
  id: string;
  token: string;
  status: string;
  displayName: string | null;
  modeHints: { intent?: string; entry?: string; portalSlug?: string };
}

interface ZoneItem {
  id: string;
  itemType: string;
  payload: {
    zoneType: string;
    name: string;
    notes?: string;
  };
  createdAt: string;
}

const ZONE_TYPES = [
  { type: 'interior', icon: Home, label: 'Interior', description: 'Inside the building' },
  { type: 'exterior', icon: Trees, label: 'Exterior', description: 'Outside areas' },
  { type: 'garage', icon: Car, label: 'Garage / Parking', description: 'Vehicle storage' },
  { type: 'storage', icon: Warehouse, label: 'Storage', description: 'Storage areas' },
  { type: 'plumbing', icon: Droplet, label: 'Plumbing', description: 'Water systems' },
  { type: 'yard', icon: Fence, label: 'Yard / Garden', description: 'Landscaping areas' },
  { type: 'structure', icon: Building, label: 'Structure', description: 'Building/foundation' },
];

export default function OnboardZonesPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [adding, setAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneNotes, setZoneNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, [token]);

  const loadWorkspace = async () => {
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}`);
      const data = await res.json();
      
      if (!data.ok) {
        setError(data.error || 'Workspace not found');
        setLoading(false);
        return;
      }
      
      setWorkspace(data.workspace);
      
      const zoneItems = (data.items || []).filter(
        (item: ZoneItem) => item.itemType === 'zone_definition'
      );
      setZones(zoneItems);
      setLoading(false);
    } catch (err) {
      setError('Failed to load workspace');
      setLoading(false);
    }
  };

  const handleAddZone = async () => {
    if (!selectedType) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'zone_definition',
          payload: {
            zoneType: selectedType,
            name: zoneName.trim() || ZONE_TYPES.find(z => z.type === selectedType)?.label || selectedType,
            notes: zoneNotes.trim() || undefined
          }
        })
      });
      
      const data = await res.json();
      if (data.ok) {
        setZones([data.item, ...zones]);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to save zone:', err);
    }
    setSaving(false);
  };

  const resetForm = () => {
    setAdding(false);
    setSelectedType(null);
    setZoneName('');
    setZoneNotes('');
  };

  const handleRemoveZone = async (zoneId: string) => {
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}/items/${zoneId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setZones(zones.filter(z => z.id !== zoneId));
      }
    } catch (err) {
      console.error('Failed to remove zone:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loader-zones">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="error-zones">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate('/onboard')} data-testid="button-start-new">
              Start New Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-zones">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={`/onboard/w/${token}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold" data-testid="heading-zones">
              Define work zones
            </h1>
            <p className="text-sm text-muted-foreground">
              Where does work need to happen?
            </p>
          </div>
        </div>

        {/* Existing Zones */}
        {zones.length > 0 && (
          <Card data-testid="card-zones-list">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Your zones
                <Badge variant="secondary">{zones.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {zones.map((zone) => {
                const typeInfo = ZONE_TYPES.find(t => t.type === zone.payload.zoneType);
                const Icon = typeInfo?.icon || MapPin;
                
                return (
                  <div 
                    key={zone.id} 
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`zone-item-${zone.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{zone.payload.name}</p>
                        {zone.payload.notes && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{zone.payload.notes}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveZone(zone.id)}
                      data-testid={`button-remove-zone-${zone.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Add Zone */}
        {adding ? (
          <Card data-testid="card-add-zone">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add a zone</CardTitle>
              <CardDescription>Select a zone type and optionally add details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Zone Type Selection */}
              <div className="grid grid-cols-2 gap-2">
                {ZONE_TYPES.map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? 'default' : 'outline'}
                    className="justify-start gap-2 h-auto py-3"
                    onClick={() => setSelectedType(type)}
                    data-testid={`button-zone-type-${type}`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Button>
                ))}
              </div>
              
              {selectedType && (
                <>
                  <Input
                    placeholder="Zone name (optional)"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    data-testid="input-zone-name"
                  />
                  <Textarea
                    placeholder="Notes about this zone (optional)"
                    value={zoneNotes}
                    onChange={(e) => setZoneNotes(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-zone-notes"
                  />
                </>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={handleAddZone}
                  disabled={!selectedType || saving}
                  data-testid="button-save-zone"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Add zone
                </Button>
                <Button variant="ghost" onClick={resetForm} data-testid="button-cancel-zone">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setAdding(true)}
            data-testid="button-add-zone"
          >
            <Plus className="h-5 w-5" />
            Add a zone
          </Button>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link to={`/onboard/w/${token}`} className="flex-1">
            <Button variant="outline" className="w-full" data-testid="button-back-workspace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Link to={`/onboard/w/${token}/review`} className="flex-1">
            <Button className="w-full" data-testid="button-continue-review">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Skip option */}
        <div className="text-center">
          <Link 
            to={`/onboard/w/${token}/review`}
            className="text-sm text-muted-foreground hover:underline"
            data-testid="link-skip-zones"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
