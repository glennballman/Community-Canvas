import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Plus, Trash2, Edit, Save, X, Image, FileText, 
  Loader2, Mountain, Wind, Sun, Footprints, Building, Users,
  ChevronRight, Upload, Camera
} from 'lucide-react';

interface WorkArea {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
}

interface WorkMedia {
  id: string;
  workAreaId: string | null;
  portalId: string | null;
  mediaId: string;
  title: string | null;
  notes: string | null;
  tags: string[];
  url?: string;
}

interface AccessConstraints {
  lastMileDistanceM?: number;
  lastMileElevationM?: number;
  lastMileSurface?: string;
  verticalAccessType?: string;
  stairsCount?: number;
  elevatorAvailable?: boolean;
  loadLimitKg?: number;
  rollingAllowed?: boolean;
  daylightRequired?: boolean;
  windThresholdKts?: number;
}

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

interface WorkCatalogPageProps {
  propertyId: string;
  portalId?: string;
  onBack?: () => void;
}

export default function WorkCatalogPage({ propertyId, portalId, onBack }: WorkCatalogPageProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('access');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showCommunityMediaModal, setShowCommunityMediaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<WorkArea | null>(null);
  
  const [areaForm, setAreaForm] = useState({ title: '', description: '', tags: '' });
  const [mediaForm, setMediaForm] = useState({ url: '', title: '', notes: '', tags: '' });
  const [communityMediaForm, setCommunityMediaForm] = useState({ url: '', title: '', notes: '', tags: '' });
  const [constraints, setConstraints] = useState<AccessConstraints>({});
  const [constraintsDirty, setConstraintsDirty] = useState(false);

  // Fetch access constraints
  const { data: constraintsData, isLoading: loadingConstraints } = useQuery({
    queryKey: ['/api/p2/app/access-constraints', 'property', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/access-constraints/property/${propertyId}`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) {
        if (res.status === 404) return { access: {} };
        throw new Error('Failed to load constraints');
      }
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch work areas
  const { data: areasData, isLoading: loadingAreas } = useQuery<{ workAreas: WorkArea[] }>({
    queryKey: ['/api/p2/app/properties', propertyId, 'work-areas'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/properties/${propertyId}/work-areas`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error('Failed to load work areas');
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch work media for selected area
  const { data: mediaData, isLoading: loadingMedia } = useQuery<{ workMedia: WorkMedia[] }>({
    queryKey: ['/api/p2/app/work-media', selectedAreaId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAreaId) params.set('workAreaId', selectedAreaId);
      else params.set('propertyId', propertyId);
      const res = await fetch(`/api/p2/app/work-media?${params}`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error('Failed to load media');
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch community media (portal-scoped, work_area_id = NULL)
  const { data: communityMediaData, isLoading: loadingCommunityMedia } = useQuery<{ workMedia: WorkMedia[] }>({
    queryKey: ['/api/p2/app/work-media', 'community', portalId],
    queryFn: async () => {
      if (!portalId) return { workMedia: [] };
      const params = new URLSearchParams({ portalId });
      const res = await fetch(`/api/p2/app/work-media?${params}`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { workMedia: [] };
      return res.json();
    },
    enabled: !!portalId
  });

  // Mutations
  const saveConstraintsMutation = useMutation({
    mutationFn: async (access: AccessConstraints) => {
      const res = await fetch(`/api/p2/app/access-constraints/property/${propertyId}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ access })
      });
      if (!res.ok) throw new Error('Failed to save constraints');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/access-constraints', 'property', propertyId] });
      setConstraintsDirty(false);
      toast({ title: 'Access constraints saved' });
    }
  });

  const createAreaMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; tags: string[] }) => {
      const res = await fetch(`/api/p2/app/properties/${propertyId}/work-areas`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create work area');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/properties', propertyId, 'work-areas'] });
      setShowAreaModal(false);
      resetAreaForm();
      toast({ title: 'Work area created' });
    }
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title: string; description: string; tags: string[] }) => {
      const res = await fetch(`/api/p2/app/work-areas/${id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update work area');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/properties', propertyId, 'work-areas'] });
      setShowAreaModal(false);
      setEditingArea(null);
      resetAreaForm();
      toast({ title: 'Work area updated' });
    }
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/p2/app/work-areas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete work area');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/properties', propertyId, 'work-areas'] });
      if (selectedAreaId) setSelectedAreaId(null);
      toast({ title: 'Work area deleted' });
    }
  });

  const createMediaMutation = useMutation({
    mutationFn: async (data: { workAreaId?: string; url: string; title: string; notes: string; tags: string[] }) => {
      const res = await fetch(`/api/p2/app/work-media`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...data,
          propertyId,
          mediaId: crypto.randomUUID()
        })
      });
      if (!res.ok) throw new Error('Failed to add media');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/work-media', selectedAreaId] });
      setShowMediaModal(false);
      resetMediaForm();
      toast({ title: 'Media added' });
    }
  });

  const deleteMediaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/p2/app/work-media/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete media');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/work-media', selectedAreaId] });
      toast({ title: 'Media removed' });
    }
  });

  // Create community media (portal-scoped, no work area)
  const createCommunityMediaMutation = useMutation({
    mutationFn: async (data: { url: string; title: string; notes: string; tags: string[] }) => {
      const res = await fetch(`/api/p2/app/work-media`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...data,
          portalId,
          workAreaId: null,
          propertyId: null,
          mediaId: crypto.randomUUID()
        })
      });
      if (!res.ok) throw new Error('Failed to add community media');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/work-media', 'community', portalId] });
      setShowCommunityMediaModal(false);
      resetCommunityMediaForm();
      toast({ title: 'Community media added' });
    }
  });

  // Delete community media
  const deleteCommunityMediaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/p2/app/work-media/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete media');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/work-media', 'community', portalId] });
      toast({ title: 'Community media removed' });
    }
  });

  const resetAreaForm = () => {
    setAreaForm({ title: '', description: '', tags: '' });
    setEditingArea(null);
  };

  const resetCommunityMediaForm = () => {
    setCommunityMediaForm({ url: '', title: '', notes: '', tags: '' });
  };

  const handleSaveCommunityMedia = () => {
    createCommunityMediaMutation.mutate({
      url: communityMediaForm.url,
      title: communityMediaForm.title,
      notes: communityMediaForm.notes,
      tags: communityMediaForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  const resetMediaForm = () => {
    setMediaForm({ url: '', title: '', notes: '', tags: '' });
  };

  const handleSaveArea = () => {
    const data = {
      title: areaForm.title,
      description: areaForm.description,
      tags: areaForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    };
    if (editingArea) {
      updateAreaMutation.mutate({ id: editingArea.id, ...data });
    } else {
      createAreaMutation.mutate(data);
    }
  };

  const handleEditArea = (area: WorkArea) => {
    setEditingArea(area);
    setAreaForm({
      title: area.title,
      description: area.description || '',
      tags: area.tags.join(', ')
    });
    setShowAreaModal(true);
  };

  const handleSaveMedia = () => {
    createMediaMutation.mutate({
      workAreaId: selectedAreaId || undefined,
      url: mediaForm.url,
      title: mediaForm.title,
      notes: mediaForm.notes,
      tags: mediaForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  const handleConstraintChange = (field: keyof AccessConstraints, value: any) => {
    setConstraints(prev => ({ ...prev, [field]: value }));
    setConstraintsDirty(true);
  };

  // Initialize constraints from data using useEffect to avoid state updates during render
  useEffect(() => {
    if (!constraintsDirty) {
      // Handle both response shapes: { constraint: { access: {...} } } and { access: {...} }
      const accessData = constraintsData?.constraint?.access || constraintsData?.access;
      if (accessData && typeof accessData === 'object') {
        setConstraints(accessData);
      }
    }
  }, [constraintsData, constraintsDirty]);

  const workAreas = areasData?.workAreas || [];
  const workMedia = mediaData?.workMedia || [];
  const communityMedia = communityMediaData?.workMedia || [];
  const selectedArea = workAreas.find(a => a.id === selectedAreaId);

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-work-catalog">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-work-catalog-title">Work Catalog</h2>
          <p className="text-muted-foreground">Reference information for contractors and maintenance work</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="access" data-testid="tab-access">Access Constraints</TabsTrigger>
          <TabsTrigger value="areas" data-testid="tab-areas">Work Areas</TabsTrigger>
          <TabsTrigger value="community" data-testid="tab-community">Community Use</TabsTrigger>
        </TabsList>

        {/* Access Constraints Tab */}
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5" />
                Property Access Constraints
              </CardTitle>
              <CardDescription>
                Define physical access requirements for this property. These help contractors prepare appropriately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingConstraints ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Last-mile Access */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Footprints className="h-4 w-4" /> Last-Mile Access
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Distance from vehicle (meters)</Label>
                        <Input
                          type="number"
                          value={constraints.lastMileDistanceM || ''}
                          onChange={(e) => handleConstraintChange('lastMileDistanceM', parseInt(e.target.value) || undefined)}
                          placeholder="e.g., 300"
                          data-testid="input-last-mile-distance"
                        />
                      </div>
                      <div>
                        <Label>Elevation change (meters)</Label>
                        <Input
                          type="number"
                          value={constraints.lastMileElevationM || ''}
                          onChange={(e) => handleConstraintChange('lastMileElevationM', parseInt(e.target.value) || undefined)}
                          placeholder="e.g., 50"
                          data-testid="input-last-mile-elevation"
                        />
                      </div>
                      <div>
                        <Label>Surface type</Label>
                        <Input
                          value={constraints.lastMileSurface || ''}
                          onChange={(e) => handleConstraintChange('lastMileSurface', e.target.value)}
                          placeholder="e.g., gravel, stairs, dock"
                          data-testid="input-last-mile-surface"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Vertical Access */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Building className="h-4 w-4" /> Vertical Access
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Access type</Label>
                        <Input
                          value={constraints.verticalAccessType || ''}
                          onChange={(e) => handleConstraintChange('verticalAccessType', e.target.value)}
                          placeholder="e.g., stairs, elevator, ramp"
                          data-testid="input-vertical-access-type"
                        />
                      </div>
                      <div>
                        <Label>Number of stairs</Label>
                        <Input
                          type="number"
                          value={constraints.stairsCount || ''}
                          onChange={(e) => handleConstraintChange('stairsCount', parseInt(e.target.value) || undefined)}
                          placeholder="e.g., 45"
                          data-testid="input-stairs-count"
                        />
                      </div>
                      <div>
                        <Label>Load limit (kg)</Label>
                        <Input
                          type="number"
                          value={constraints.loadLimitKg || ''}
                          onChange={(e) => handleConstraintChange('loadLimitKg', parseInt(e.target.value) || undefined)}
                          placeholder="e.g., 200"
                          data-testid="input-load-limit"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="elevator"
                          checked={constraints.elevatorAvailable || false}
                          onCheckedChange={(c) => handleConstraintChange('elevatorAvailable', !!c)}
                          data-testid="checkbox-elevator"
                        />
                        <Label htmlFor="elevator">Elevator available</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="rolling"
                          checked={constraints.rollingAllowed || false}
                          onCheckedChange={(c) => handleConstraintChange('rollingAllowed', !!c)}
                          data-testid="checkbox-rolling"
                        />
                        <Label htmlFor="rolling">Rolling equipment allowed</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Environmental */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Sun className="h-4 w-4" /> Environmental
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="daylight"
                          checked={constraints.daylightRequired || false}
                          onCheckedChange={(c) => handleConstraintChange('daylightRequired', !!c)}
                          data-testid="checkbox-daylight"
                        />
                        <Label htmlFor="daylight">Daylight required (auto sunrise/sunset)</Label>
                      </div>
                      <div>
                        <Label className="flex items-center gap-1">
                          <Wind className="h-4 w-4" /> Wind threshold (knots)
                        </Label>
                        <Input
                          type="number"
                          value={constraints.windThresholdKts || ''}
                          onChange={(e) => handleConstraintChange('windThresholdKts', parseInt(e.target.value) || undefined)}
                          placeholder="e.g., 25"
                          data-testid="input-wind-threshold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={() => saveConstraintsMutation.mutate(constraints)}
                      disabled={!constraintsDirty || saveConstraintsMutation.isPending}
                      data-testid="button-save-constraints"
                    >
                      {saveConstraintsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Save className="h-4 w-4 mr-2" />
                      Save Constraints
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Work Areas Tab */}
        <TabsContent value="areas">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Pane - Work Areas List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Work Areas</CardTitle>
                  <Button size="sm" onClick={() => { resetAreaForm(); setShowAreaModal(true); }} data-testid="button-add-area">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAreas ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : workAreas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No work areas defined. Add areas like "Kitchen", "Exterior Deck", or "Boat House".
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {workAreas.map((area) => (
                        <div
                          key={area.id}
                          onClick={() => setSelectedAreaId(area.id)}
                          className={`p-3 rounded-md cursor-pointer hover-elevate ${
                            selectedAreaId === area.id ? 'bg-accent' : 'bg-muted/50'
                          }`}
                          data-testid={`area-item-${area.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{area.title}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {area.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {area.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Right Pane - Selected Area Detail */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {selectedArea ? selectedArea.title : 'Select a Work Area'}
                  </CardTitle>
                  {selectedArea && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditArea(selectedArea)} data-testid="button-edit-area">
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => deleteAreaMutation.mutate(selectedArea.id)}
                        data-testid="button-delete-area"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedArea ? (
                  <p className="text-muted-foreground py-8 text-center">
                    Select a work area from the list to view details and media
                  </p>
                ) : (
                  <div className="space-y-4">
                    {selectedArea.description && (
                      <div>
                        <Label className="text-muted-foreground">Reference Notes</Label>
                        <p className="mt-1">{selectedArea.description}</p>
                      </div>
                    )}
                    
                    {selectedArea.tags.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Tags</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedArea.tags.map((tag, i) => (
                            <Badge key={i} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Media Grid */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-muted-foreground">Photos & Documents</Label>
                        <Button size="sm" variant="outline" onClick={() => setShowMediaModal(true)} data-testid="button-add-media">
                          <Camera className="h-4 w-4 mr-1" /> Add Media
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Recommend 5-6 photos. Add captions like "300m steep walk from dock"
                      </p>
                      
                      {loadingMedia ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : workMedia.length === 0 ? (
                        <div className="border-2 border-dashed rounded-md p-8 text-center text-muted-foreground">
                          <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No media added yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {workMedia.map((media) => (
                            <div key={media.id} className="relative group">
                              <div className="aspect-square rounded-md bg-muted flex items-center justify-center overflow-hidden">
                                {media.url ? (
                                  <img src={media.url} alt={media.title || ''} className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                )}
                              </div>
                              {media.title && (
                                <p className="text-xs mt-1 truncate">{media.title}</p>
                              )}
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteMediaMutation.mutate(media.id)}
                                data-testid={`button-delete-media-${media.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Community Use Tab */}
        <TabsContent value="community">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Community Use
                  </CardTitle>
                  <CardDescription>
                    Shared infrastructure photos and notes (boat launch, docks, water taxi, etc.)
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => setShowCommunityMediaModal(true)}
                  disabled={!portalId}
                  data-testid="button-add-community-media"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Media
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!portalId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Portal ID required for community media</p>
                </div>
              ) : loadingCommunityMedia ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : communityMedia.length === 0 ? (
                <div className="border-2 border-dashed rounded-md p-8 text-center text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No community media added yet</p>
                  <p className="text-xs mt-1">Add photos of shared infrastructure like boat launches, docks, water taxi stops</p>
                  <p className="text-xs mt-1 text-amber-600">Not automatically shared — disclosure controlled in work requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-amber-600">
                    Not automatically shared — disclosure controlled in work requests
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {communityMedia.map((media) => (
                      <div key={media.id} className="relative group">
                        <div className="aspect-square rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {media.url ? (
                            <img src={media.url} alt={media.title || ''} className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        {media.title && (
                          <p className="text-xs mt-1 truncate">{media.title}</p>
                        )}
                        {media.notes && (
                          <p className="text-xs text-muted-foreground truncate">{media.notes}</p>
                        )}
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteCommunityMediaMutation.mutate(media.id)}
                          data-testid={`button-delete-community-media-${media.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Work Area Modal */}
      <Dialog open={showAreaModal} onOpenChange={setShowAreaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? 'Edit Work Area' : 'Add Work Area'}</DialogTitle>
            <DialogDescription>
              Define a work area like "Kitchen", "Exterior Deck", or "Boat House"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={areaForm.title}
                onChange={(e) => setAreaForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Kitchen, Exterior Deck"
                data-testid="input-area-title"
              />
            </div>
            <div>
              <Label>Description / Reference Notes</Label>
              <Textarea
                value={areaForm.description}
                onChange={(e) => setAreaForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Notes for contractors..."
                rows={3}
                data-testid="input-area-description"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={areaForm.tags}
                onChange={(e) => setAreaForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g., plumbing, electrical, exterior"
                data-testid="input-area-tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAreaModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveArea} 
              disabled={!areaForm.title || createAreaMutation.isPending || updateAreaMutation.isPending}
              data-testid="button-save-area"
            >
              {(createAreaMutation.isPending || updateAreaMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Modal */}
      <Dialog open={showMediaModal} onOpenChange={setShowMediaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Media</DialogTitle>
            <DialogDescription>
              Add a photo or document to this work area
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Media URL</Label>
              <Input
                value={mediaForm.url}
                onChange={(e) => setMediaForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                data-testid="input-media-url"
              />
            </div>
            <div>
              <Label>Caption / Title</Label>
              <Input
                value={mediaForm.title}
                onChange={(e) => setMediaForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., 300m steep walk from dock"
                data-testid="input-media-title"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={mediaForm.notes}
                onChange={(e) => setMediaForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
                data-testid="input-media-notes"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={mediaForm.tags}
                onChange={(e) => setMediaForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g., photo, diagram"
                data-testid="input-media-tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMediaModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveMedia} 
              disabled={!mediaForm.url || createMediaMutation.isPending}
              data-testid="button-save-media"
            >
              {createMediaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Community Media Modal */}
      <Dialog open={showCommunityMediaModal} onOpenChange={setShowCommunityMediaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Community Media</DialogTitle>
            <DialogDescription>
              Add photos of shared infrastructure (boat launch, docks, water taxi, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Media URL</Label>
              <Input
                value={communityMediaForm.url}
                onChange={(e) => setCommunityMediaForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                data-testid="input-community-media-url"
              />
            </div>
            <div>
              <Label>Title / Caption</Label>
              <Input
                value={communityMediaForm.title}
                onChange={(e) => setCommunityMediaForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Boat launch at Lucky Lander"
                data-testid="input-community-media-title"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={communityMediaForm.notes}
                onChange={(e) => setCommunityMediaForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
                data-testid="input-community-media-notes"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={communityMediaForm.tags}
                onChange={(e) => setCommunityMediaForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g., dock, boat, launch"
                data-testid="input-community-media-tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommunityMediaModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveCommunityMedia} 
              disabled={!communityMediaForm.url || createCommunityMediaMutation.isPending}
              data-testid="button-save-community-media"
            >
              {createCommunityMediaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
