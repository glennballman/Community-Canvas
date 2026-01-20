import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Loader2, Lock, Unlock, Image, MapPin, Mountain, Users, Settings, 
  Package, Wrench, UserCircle, AlertTriangle, Eye, Search, Check
} from 'lucide-react';

interface WorkArea {
  id: string;
  title: string;
  tags: string[];
}

interface WorkMedia {
  id: string;
  workAreaId: string | null;
  title: string | null;
}

interface PropertySubsystem {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  isSensitive: boolean;
  tags: string[];
}

interface OnSiteResource {
  id: string;
  name: string;
  resourceType: 'tool' | 'material';
  description: string | null;
  sharePolicy: 'private' | 'disclosable' | 'offerable';
  storageLocation: string | null;
}

interface Person {
  id: string;
  displayName: string;
  email: string | null;
  personType: string;
}

interface ExistingDisclosure {
  id: string;
  itemType: string;
  itemId: string | null;
  visibility: 'private' | 'contractor' | 'specific_contractor';
  specificContractorId: string | null;
}

type VisibilityScope = 'private' | 'contractor' | 'specific_contractor';

interface DisclosureSelection {
  visibilityScope: VisibilityScope;
  specificContractorId: string | null;
  workAreas: string[];
  workMedia: string[];
  accessConstraints: boolean;
  propertyNotes: boolean;
  communityMedia: string[];
  subsystems: string[];
  onSiteResources: string[];
}

interface WorkDisclosureSelectorProps {
  propertyId: string;
  portalId?: string;
  workRequestId?: string;
  value: DisclosureSelection;
  onChange: (selection: DisclosureSelection) => void;
  onPreviewAsContractor?: () => void;
  assignedContractorId?: string | null;
}

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

export function WorkDisclosureSelector({ 
  propertyId, 
  portalId,
  workRequestId,
  value, 
  onChange,
  onPreviewAsContractor,
  assignedContractorId
}: WorkDisclosureSelectorProps) {
  const [contractorSearch, setContractorSearch] = useState('');
  const [existingDisclosures, setExistingDisclosures] = useState<ExistingDisclosure[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch work areas for this property
  const { data: areasData, isLoading: loadingAreas } = useQuery<{ workAreas: WorkArea[] }>({
    queryKey: ['/api/p2/app/properties', propertyId, 'work-areas'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/properties/${propertyId}/work-areas`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { workAreas: [] };
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch work media for property
  const { data: mediaData, isLoading: loadingMedia } = useQuery<{ workMedia: WorkMedia[] }>({
    queryKey: ['/api/p2/app/work-media', 'property', propertyId],
    queryFn: async () => {
      const params = new URLSearchParams({ propertyId });
      const res = await fetch(`/api/p2/app/work-media?${params}`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { workMedia: [] };
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch community media (portal-scoped)
  const { data: communityData, isLoading: loadingCommunity } = useQuery<{ workMedia: WorkMedia[] }>({
    queryKey: ['/api/p2/app/work-media', 'portal', portalId],
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

  // Fetch property subsystems (visibility=contractor only)
  const { data: subsystemsData, isLoading: loadingSubsystems } = useQuery<{ subsystems: PropertySubsystem[] }>({
    queryKey: ['/api/p2/app/properties', propertyId, 'subsystems'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/properties/${propertyId}/subsystems`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { subsystems: [] };
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch on-site resources (sharePolicy != private)
  const { data: resourcesData, isLoading: loadingResources } = useQuery<{ resources: OnSiteResource[] }>({
    queryKey: ['/api/p2/app/properties', propertyId, 'on-site-resources'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/properties/${propertyId}/on-site-resources`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { resources: [] };
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch contractors (people with entity_type = 'contractor')
  const { data: contractorsData, isLoading: loadingContractors } = useQuery<{ people: Person[] }>({
    queryKey: ['/api/p2/people', 'contractor'],
    queryFn: async () => {
      const res = await fetch('/api/p2/people?personType=contractor', { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { people: [] };
      return res.json();
    }
  });

  // Fetch existing disclosures for edit mode
  const { data: disclosuresData, isLoading: loadingDisclosures } = useQuery<{ disclosures: ExistingDisclosure[] }>({
    queryKey: ['/api/p2/app/work-disclosures', workRequestId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/work-disclosures/${workRequestId}`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { disclosures: [] };
      return res.json();
    },
    enabled: !!workRequestId
  });

  // Load existing disclosures into state when editing
  useEffect(() => {
    if (workRequestId && disclosuresData) {
      // Always set edit mode when we have a workRequestId (editing an existing work request)
      setIsEditMode(true);
      
      const disclosures = disclosuresData.disclosures || [];
      setExistingDisclosures(disclosures);
      
      if (disclosures.length > 0) {
        // Determine visibility scope from first disclosure (all should be same)
        const firstDisclosure = disclosures[0];
        const scope = firstDisclosure.visibility || 'private';
        const specificId = firstDisclosure.specificContractorId || null;
        
        // Build selection from disclosures
        const workAreas: string[] = [];
        const workMedia: string[] = [];
        const communityMedia: string[] = [];
        const subsystems: string[] = [];
        const onSiteResources: string[] = [];
        let accessConstraints = false;
        let propertyNotes = false;
        
        disclosures.forEach((d: ExistingDisclosure) => {
          if (d.itemType === 'work_area' && d.itemId) workAreas.push(d.itemId);
          if (d.itemType === 'work_media' && d.itemId) workMedia.push(d.itemId);
          if (d.itemType === 'community_media' && d.itemId) communityMedia.push(d.itemId);
          if (d.itemType === 'subsystem' && d.itemId) subsystems.push(d.itemId);
          if (d.itemType === 'on_site_resource' && d.itemId) onSiteResources.push(d.itemId);
          if (d.itemType === 'access_constraints') accessConstraints = true;
          if (d.itemType === 'property_notes') propertyNotes = true;
        });
        
        onChange({
          visibilityScope: scope,
          specificContractorId: specificId,
          workAreas,
          workMedia,
          accessConstraints,
          propertyNotes,
          communityMedia,
          subsystems,
          onSiteResources
        });
      }
      // If zero disclosures, keep default state (visibilityScope: 'private', nothing selected)
    }
  }, [workRequestId, disclosuresData]);

  const workAreas = areasData?.workAreas || [];
  const workMedia = mediaData?.workMedia || [];
  const communityMedia = communityData?.workMedia || [];
  const contractors = contractorsData?.people || [];
  // Only show subsystems with contractor visibility
  const disclosableSubsystems = (subsystemsData?.subsystems || []).filter(s => s.visibility === 'contractor');
  // Only show resources that are disclosable or offerable
  const disclosableResources = (resourcesData?.resources || []).filter(r => r.sharePolicy !== 'private');
  const tools = disclosableResources.filter(r => r.resourceType === 'tool');
  const materials = disclosableResources.filter(r => r.resourceType === 'material');

  // Filter contractors by search
  const filteredContractors = contractors.filter(c => 
    contractorSearch === '' || 
    c.displayName.toLowerCase().includes(contractorSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(contractorSearch.toLowerCase()))
  );

  const isLoading = loadingAreas || loadingMedia || loadingCommunity || loadingSubsystems || 
    loadingResources || loadingContractors || (workRequestId && loadingDisclosures);

  const toggleWorkArea = (areaId: string) => {
    const newAreas = value.workAreas.includes(areaId)
      ? value.workAreas.filter(id => id !== areaId)
      : [...value.workAreas, areaId];
    onChange({ ...value, workAreas: newAreas });
  };

  const toggleWorkMedia = (mediaId: string) => {
    const newMedia = value.workMedia.includes(mediaId)
      ? value.workMedia.filter(id => id !== mediaId)
      : [...value.workMedia, mediaId];
    onChange({ ...value, workMedia: newMedia });
  };

  const toggleCommunityMedia = (mediaId: string) => {
    const newMedia = value.communityMedia.includes(mediaId)
      ? value.communityMedia.filter(id => id !== mediaId)
      : [...value.communityMedia, mediaId];
    onChange({ ...value, communityMedia: newMedia });
  };

  const toggleSubsystem = (subsystemId: string) => {
    const newSubs = value.subsystems.includes(subsystemId)
      ? value.subsystems.filter(id => id !== subsystemId)
      : [...value.subsystems, subsystemId];
    onChange({ ...value, subsystems: newSubs });
  };

  const toggleResource = (resourceId: string) => {
    const newRes = value.onSiteResources.includes(resourceId)
      ? value.onSiteResources.filter(id => id !== resourceId)
      : [...value.onSiteResources, resourceId];
    onChange({ ...value, onSiteResources: newRes });
  };

  // Check if an item was previously shared (for edit mode visual)
  const wasShared = (itemType: string, itemId: string | null): boolean => {
    return existingDisclosures.some(d => d.itemType === itemType && d.itemId === itemId);
  };

  // Count selected items
  const selectedCount = value.workAreas.length + value.workMedia.length + 
    value.communityMedia.length + value.subsystems.length + value.onSiteResources.length +
    (value.accessConstraints ? 1 : 0) + (value.propertyNotes ? 1 : 0);

  // Visibility scope enabled (not private means something can be shared)
  const isSharingEnabled = value.visibilityScope !== 'private';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasWorkAreas = workAreas.length > 0;
  const hasWorkMedia = workMedia.length > 0;
  const hasCommunityMedia = communityMedia.length > 0;
  const hasSubsystems = disclosableSubsystems.length > 0;
  const hasResources = disclosableResources.length > 0;
  const hasAnything = hasWorkAreas || hasWorkMedia || hasCommunityMedia || hasSubsystems || hasResources;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="h-5 w-5" />
          Share with Contractor
        </CardTitle>
        <CardDescription>
          Select information to share with contractors. Items are NOT shared unless explicitly selected.
        </CardDescription>
        {isEditMode && existingDisclosures.length > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Editing existing disclosures. Unchecking items will revoke access immediately.
            </span>
          </div>
        )}
        {isEditMode && existingDisclosures.length === 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-muted border rounded-md">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Not shared. Select items below to share with contractors.
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visibility Scope Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Who to Share With
          </div>
          <Select
            value={value.visibilityScope}
            onValueChange={(val: VisibilityScope) => {
              // Reset specific contractor when changing scope
              if (val !== 'specific_contractor') {
                onChange({ ...value, visibilityScope: val, specificContractorId: null });
              } else {
                onChange({ ...value, visibilityScope: val });
              }
            }}
          >
            <SelectTrigger className="w-full" data-testid="select-visibility-scope">
              <SelectValue placeholder="Select sharing scope..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private" data-testid="select-visibility-private">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Private (not shared)
                </div>
              </SelectItem>
              <SelectItem value="contractor" data-testid="select-visibility-contractor">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  All invited contractors
                </div>
              </SelectItem>
              <SelectItem value="specific_contractor" data-testid="select-visibility-specific">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-primary" />
                  Specific contractor only
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Specific Contractor Picker */}
          {value.visibilityScope === 'specific_contractor' && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contractors..."
                  value={contractorSearch}
                  onChange={(e) => setContractorSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-contractor-search"
                />
              </div>
              {contractors.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No contractors found. Add people with contractor type first.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredContractors.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onChange({ ...value, specificContractorId: person.id })}
                      className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                        value.specificContractorId === person.id 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'hover:bg-muted'
                      }`}
                      data-testid={`button-select-contractor-${person.id}`}
                    >
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{person.displayName}</span>
                      {person.email && (
                        <span className="text-xs text-muted-foreground">{person.email}</span>
                      )}
                      {value.specificContractorId === person.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!value.specificContractorId && (
                <p className="text-xs text-amber-600">Select a contractor to share with</p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Preview as Contractor button */}
        {assignedContractorId && onPreviewAsContractor && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviewAsContractor}
            className="w-full"
            data-testid="button-preview-contractor"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview as Contractor
          </Button>
        )}

        {/* Sharing status summary */}
        {isSharingEnabled && selectedCount > 0 && (
          <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
            <Unlock className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-400">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} will be shared with{' '}
              {value.visibilityScope === 'contractor' ? 'all contractors' : 'selected contractor'}
            </span>
          </div>
        )}

        {!hasAnything ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No work catalog items available. Set up your Work Catalog first.
          </p>
        ) : !isSharingEnabled ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select a sharing scope above to configure disclosure items.
          </p>
        ) : (value.visibilityScope === 'specific_contractor' && !value.specificContractorId) ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select a specific contractor above to configure disclosure items.
          </p>
        ) : (
          <>
            {/* Property Access Constraints - Always suggested */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mountain className="h-4 w-4" />
                Property
              </div>
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="access-constraints"
                    checked={value.accessConstraints}
                    onCheckedChange={(checked) => onChange({ ...value, accessConstraints: !!checked })}
                    data-testid="checkbox-share-access-constraints"
                  />
                  <Label htmlFor="access-constraints" className="text-sm">
                    Property access constraints
                  </Label>
                  <Badge variant="secondary" className="text-xs">Suggested</Badge>
                  {isEditMode && wasShared('access_constraints', null) && !value.accessConstraints && (
                    <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="property-notes"
                    checked={value.propertyNotes}
                    onCheckedChange={(checked) => onChange({ ...value, propertyNotes: !!checked })}
                    data-testid="checkbox-share-property-notes"
                  />
                  <Label htmlFor="property-notes" className="text-sm">
                    Property reference notes
                  </Label>
                  {isEditMode && wasShared('property_notes', null) && !value.propertyNotes && (
                    <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Work Areas */}
            {hasWorkAreas && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4" />
                    Work Areas
                  </div>
                  <div className="pl-6 space-y-2">
                    {workAreas.map((area) => {
                      const areaMedia = workMedia.filter(m => m.workAreaId === area.id);
                      const wasAreaShared = wasShared('work_area', area.id);
                      return (
                        <div key={area.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`area-${area.id}`}
                              checked={value.workAreas.includes(area.id)}
                              onCheckedChange={() => toggleWorkArea(area.id)}
                              data-testid={`checkbox-share-area-${area.id}`}
                            />
                            <Label htmlFor={`area-${area.id}`} className="text-sm">
                              {area.title} notes
                            </Label>
                            {area.tags.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                            {isEditMode && wasAreaShared && !value.workAreas.includes(area.id) && (
                              <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                            )}
                          </div>
                          {areaMedia.length > 0 && (
                            <div className="pl-6 space-y-1">
                              {areaMedia.map((media) => {
                                const wasMediaShared = wasShared('work_media', media.id);
                                return (
                                  <div key={media.id} className="flex items-center gap-2">
                                    <Checkbox 
                                      id={`media-${media.id}`}
                                      checked={value.workMedia.includes(media.id)}
                                      onCheckedChange={() => toggleWorkMedia(media.id)}
                                      data-testid={`checkbox-share-media-${media.id}`}
                                    />
                                    <Image className="h-3 w-3 text-muted-foreground" />
                                    <Label htmlFor={`media-${media.id}`} className="text-sm text-muted-foreground">
                                      {media.title || 'Photo/Document'}
                                    </Label>
                                    {isEditMode && wasMediaShared && !value.workMedia.includes(media.id) && (
                                      <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Subsystems */}
            {hasSubsystems && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Settings className="h-4 w-4" />
                    Subsystems
                  </div>
                  <div className="pl-6 space-y-2">
                    {disclosableSubsystems.map((subsystem) => {
                      const wasSubShared = wasShared('subsystem', subsystem.id);
                      return (
                        <div key={subsystem.id} className="flex items-center gap-2">
                          <Checkbox 
                            id={`subsystem-${subsystem.id}`}
                            checked={value.subsystems.includes(subsystem.id)}
                            onCheckedChange={() => toggleSubsystem(subsystem.id)}
                            data-testid={`checkbox-share-subsystem-${subsystem.id}`}
                          />
                          <Label htmlFor={`subsystem-${subsystem.id}`} className="text-sm">
                            {subsystem.title}
                          </Label>
                          {subsystem.isSensitive && (
                            <Badge variant="secondary" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Sensitive
                            </Badge>
                          )}
                          {isEditMode && wasSubShared && !value.subsystems.includes(subsystem.id) && (
                            <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* On-Site Resources */}
            {hasResources && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" />
                    On-Site Resources
                  </div>
                  <div className="pl-6 space-y-3">
                    {tools.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wrench className="h-3 w-3" />
                          Tools
                        </div>
                        {tools.map((resource) => {
                          const wasResShared = wasShared('on_site_resource', resource.id);
                          return (
                            <div key={resource.id} className="flex items-center gap-2">
                              <Checkbox 
                                id={`resource-${resource.id}`}
                                checked={value.onSiteResources.includes(resource.id)}
                                onCheckedChange={() => toggleResource(resource.id)}
                                data-testid={`checkbox-share-resource-${resource.id}`}
                              />
                              <Label htmlFor={`resource-${resource.id}`} className="text-sm">
                                {resource.name}
                              </Label>
                              <Badge variant={resource.sharePolicy === 'offerable' ? 'default' : 'outline'} className="text-xs">
                                {resource.sharePolicy === 'offerable' ? 'For Rent' : 'Shareable'}
                              </Badge>
                              {isEditMode && wasResShared && !value.onSiteResources.includes(resource.id) && (
                                <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {materials.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          Materials
                        </div>
                        {materials.map((resource) => {
                          const wasResShared = wasShared('on_site_resource', resource.id);
                          return (
                            <div key={resource.id} className="flex items-center gap-2">
                              <Checkbox 
                                id={`resource-${resource.id}`}
                                checked={value.onSiteResources.includes(resource.id)}
                                onCheckedChange={() => toggleResource(resource.id)}
                                data-testid={`checkbox-share-resource-${resource.id}`}
                              />
                              <Label htmlFor={`resource-${resource.id}`} className="text-sm">
                                {resource.name}
                              </Label>
                              <Badge variant={resource.sharePolicy === 'offerable' ? 'default' : 'outline'} className="text-xs">
                                {resource.sharePolicy === 'offerable' ? 'For Rent' : 'Shareable'}
                              </Badge>
                              {isEditMode && wasResShared && !value.onSiteResources.includes(resource.id) && (
                                <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Community Media */}
            {hasCommunityMedia && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Community
                </div>
                <div className="pl-6 space-y-2">
                  {communityMedia.map((media) => {
                    const wasCommShared = wasShared('community_media', media.id);
                    return (
                      <div key={media.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`community-${media.id}`}
                          checked={value.communityMedia.includes(media.id)}
                          onCheckedChange={() => toggleCommunityMedia(media.id)}
                          data-testid={`checkbox-share-community-${media.id}`}
                        />
                        <Image className="h-3 w-3 text-muted-foreground" />
                        <Label htmlFor={`community-${media.id}`} className="text-sm">
                          {media.title || 'Community photo/document'}
                        </Label>
                        {isEditMode && wasCommShared && !value.communityMedia.includes(media.id) && (
                          <Badge variant="destructive" className="text-xs">Will revoke</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-2 text-xs text-muted-foreground flex items-center gap-1">
          <Unlock className="h-3 w-3" />
          You can revoke access at any time
        </div>
      </CardContent>
    </Card>
  );
}

// Default initial value for disclosure selection
export function getDefaultDisclosureSelection(): DisclosureSelection {
  return {
    visibilityScope: 'private',
    specificContractorId: null,
    workAreas: [],
    workMedia: [],
    accessConstraints: false,
    propertyNotes: false,
    communityMedia: [],
    subsystems: [],
    onSiteResources: []
  };
}

export type { DisclosureSelection, VisibilityScope };
