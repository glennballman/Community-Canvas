import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lock, Unlock, Image, MapPin, Mountain, Users, Settings, Package, Wrench, UserCircle } from 'lucide-react';

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

interface DisclosureSelection {
  contractorPersonId: string | null;
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
  value: DisclosureSelection;
  onChange: (selection: DisclosureSelection) => void;
}

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

export function WorkDisclosureSelector({ 
  propertyId, 
  portalId,
  value, 
  onChange 
}: WorkDisclosureSelectorProps) {
  
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

  // Fetch contractors (people with person_type = 'contractor')
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

  const isLoading = loadingAreas || loadingMedia || loadingCommunity || loadingSubsystems || loadingResources || loadingContractors;

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
          What do you want to share?
        </CardTitle>
        <CardDescription>
          Select information to disclose to contractors. Items are NOT shared unless explicitly selected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Share-with Contractor Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserCircle className="h-4 w-4" />
            Share With
          </div>
          <Select
            value={value.contractorPersonId || ''}
            onValueChange={(val) => onChange({ ...value, contractorPersonId: val || null })}
          >
            <SelectTrigger className="w-full" data-testid="select-contractor">
              <SelectValue placeholder="Select a contractor..." />
            </SelectTrigger>
            <SelectContent>
              {contractors.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No contractors found. Add people with contractor type first.
                </div>
              ) : (
                contractors.map((person) => (
                  <SelectItem key={person.id} value={person.id} data-testid={`select-contractor-${person.id}`}>
                    {person.displayName}
                    {person.email && <span className="text-muted-foreground ml-1">({person.email})</span>}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!value.contractorPersonId && (
            <p className="text-xs text-amber-600">Select a contractor to enable disclosure</p>
          )}
        </div>

        <Separator />

        {!hasAnything ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No work catalog items available. Set up your Work Catalog first.
          </p>
        ) : !value.contractorPersonId ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select a contractor above to configure disclosure items.
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
                    data-testid="checkbox-disclose-access-constraints"
                  />
                  <Label htmlFor="access-constraints" className="text-sm">
                    Property access constraints
                  </Label>
                  <Badge variant="secondary" className="text-xs">Suggested</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="property-notes"
                    checked={value.propertyNotes}
                    onCheckedChange={(checked) => onChange({ ...value, propertyNotes: !!checked })}
                    data-testid="checkbox-disclose-property-notes"
                  />
                  <Label htmlFor="property-notes" className="text-sm">
                    Property reference notes
                  </Label>
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
                      return (
                        <div key={area.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`area-${area.id}`}
                              checked={value.workAreas.includes(area.id)}
                              onCheckedChange={() => toggleWorkArea(area.id)}
                              data-testid={`checkbox-disclose-area-${area.id}`}
                            />
                            <Label htmlFor={`area-${area.id}`} className="text-sm">
                              {area.title} notes
                            </Label>
                            {area.tags.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                          {areaMedia.length > 0 && (
                            <div className="pl-6 space-y-1">
                              {areaMedia.map((media) => (
                                <div key={media.id} className="flex items-center gap-2">
                                  <Checkbox 
                                    id={`media-${media.id}`}
                                    checked={value.workMedia.includes(media.id)}
                                    onCheckedChange={() => toggleWorkMedia(media.id)}
                                    data-testid={`checkbox-disclose-media-${media.id}`}
                                  />
                                  <Image className="h-3 w-3 text-muted-foreground" />
                                  <Label htmlFor={`media-${media.id}`} className="text-sm text-muted-foreground">
                                    {media.title || 'Photo/Document'}
                                  </Label>
                                </div>
                              ))}
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
                    {disclosableSubsystems.map((subsystem) => (
                      <div key={subsystem.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`subsystem-${subsystem.id}`}
                          checked={value.subsystems.includes(subsystem.id)}
                          onCheckedChange={() => toggleSubsystem(subsystem.id)}
                          data-testid={`checkbox-disclose-subsystem-${subsystem.id}`}
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
                      </div>
                    ))}
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
                        {tools.map((resource) => (
                          <div key={resource.id} className="flex items-center gap-2">
                            <Checkbox 
                              id={`resource-${resource.id}`}
                              checked={value.onSiteResources.includes(resource.id)}
                              onCheckedChange={() => toggleResource(resource.id)}
                              data-testid={`checkbox-disclose-resource-${resource.id}`}
                            />
                            <Label htmlFor={`resource-${resource.id}`} className="text-sm">
                              {resource.name}
                            </Label>
                            <Badge variant={resource.sharePolicy === 'offerable' ? 'default' : 'outline'} className="text-xs">
                              {resource.sharePolicy === 'offerable' ? 'For Rent' : 'Shareable'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {materials.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          Materials
                        </div>
                        {materials.map((resource) => (
                          <div key={resource.id} className="flex items-center gap-2">
                            <Checkbox 
                              id={`resource-${resource.id}`}
                              checked={value.onSiteResources.includes(resource.id)}
                              onCheckedChange={() => toggleResource(resource.id)}
                              data-testid={`checkbox-disclose-resource-${resource.id}`}
                            />
                            <Label htmlFor={`resource-${resource.id}`} className="text-sm">
                              {resource.name}
                            </Label>
                            <Badge variant={resource.sharePolicy === 'offerable' ? 'default' : 'outline'} className="text-xs">
                              {resource.sharePolicy === 'offerable' ? 'For Rent' : 'Shareable'}
                            </Badge>
                          </div>
                        ))}
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
                  {communityMedia.map((media) => (
                    <div key={media.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`community-${media.id}`}
                        checked={value.communityMedia.includes(media.id)}
                        onCheckedChange={() => toggleCommunityMedia(media.id)}
                        data-testid={`checkbox-disclose-community-${media.id}`}
                      />
                      <Image className="h-3 w-3 text-muted-foreground" />
                      <Label htmlFor={`community-${media.id}`} className="text-sm">
                        {media.title || 'Community photo/document'}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-2 text-xs text-muted-foreground flex items-center gap-1">
          <Unlock className="h-3 w-3" />
          You can revoke disclosure at any time
        </div>
      </CardContent>
    </Card>
  );
}

export type { DisclosureSelection };
