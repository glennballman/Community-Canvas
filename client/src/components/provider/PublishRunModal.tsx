import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Globe, Users, MapPin, Lightbulb, AlertCircle, Navigation, Eye } from 'lucide-react';
import { StartAddressPickerModal } from './StartAddressPickerModal';

interface Portal {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface Publication {
  portal_id: string;
  portal_name: string;
  published_at?: string;
}

interface Suggestion {
  zone_id: string;
  zone_name: string;
  zone_key: string;
  portal_id: string;
  portal_name: string;
  portal_slug: string;
  distance_meters: number | null;
  distance_label: string | null;
  distance_confidence: 'ok' | 'unknown' | 'no_origin' | 'no_origin_coords';
}

interface SuggestionsResponse {
  ok: boolean;
  run_id: string;
  origin: {
    start_address_id: string | null;
    origin_lat: number | null;
    origin_lng: number | null;
    origin_state: 'no_address' | 'has_address_no_coords' | 'has_coords';
  };
  suggestions: Suggestion[];
}

interface EffectivePortal {
  portal_id: string;
  portal_name: string;
  visibility_source: 'direct' | 'rollup';
  via_type: 'portal' | 'zone' | null;
  via_id: string | null;
  via_name: string | null;
  depth: number;
}

interface VisibilityPreviewResponse {
  ok: boolean;
  run_id: string;
  selected_portal_ids: string[];
  zone_id: string | null;
  effective_portals: EffectivePortal[];
}

interface PublishRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  currentMarketMode: string;
  currentPublications: Publication[];
}

export function PublishRunModal({
  open,
  onOpenChange,
  runId,
  currentMarketMode,
  currentPublications
}: PublishRunModalProps) {
  const { resolve } = useCopy({ entryPoint: 'service' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPortals, setSelectedPortals] = useState<string[]>([]);
  const [marketMode, setMarketMode] = useState<string>(currentMarketMode || 'INVITE_ONLY');
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const { data: portalsData, isLoading: portalsLoading } = useQuery<{ ok: boolean; portals: Portal[] }>({
    queryKey: ['/api/provider/portals'],
    enabled: open,
  });

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery<SuggestionsResponse>({
    queryKey: ['/api/provider/runs', runId, 'publish-suggestions'],
    enabled: open && !!runId,
  });

  // V3.5 STEP 11A: Visibility preview state
  const [visibilityPreview, setVisibilityPreview] = useState<VisibilityPreviewResponse | null>(null);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [visibilityError, setVisibilityError] = useState(false);

  // Fetch visibility preview when selection changes
  const fetchVisibilityPreview = useCallback(async (portalIds: string[]) => {
    if (!runId) return;
    
    setVisibilityLoading(true);
    setVisibilityError(false);
    
    try {
      const res = await apiRequest('POST', `/api/provider/runs/${runId}/visibility-preview`, {
        selected_portal_ids: portalIds
      });
      const data = await res.json();
      if (data.ok) {
        setVisibilityPreview(data);
      } else {
        setVisibilityError(true);
      }
    } catch {
      setVisibilityError(true);
    } finally {
      setVisibilityLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (open) {
      const publishedIds = currentPublications.map(p => p.portal_id);
      setSelectedPortals(publishedIds);
      setMarketMode(currentMarketMode || 'INVITE_ONLY');
      // Initial visibility preview fetch
      fetchVisibilityPreview(publishedIds);
    } else {
      // Reset preview when modal closes
      setVisibilityPreview(null);
      setVisibilityError(false);
    }
  }, [open, currentPublications, currentMarketMode, fetchVisibilityPreview]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/provider/runs/${runId}/publish`, {
        portalIds: selectedPortals,
        marketMode
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: resolve('provider.run.publish.success'),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId] });
        onOpenChange(false);
      } else {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to publish run',
        variant: 'destructive',
      });
    },
  });

  const handlePortalToggle = (portalId: string, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedPortals, portalId]
      : selectedPortals.filter(id => id !== portalId);
    setSelectedPortals(newSelection);
    // Trigger visibility preview update
    fetchVisibilityPreview(newSelection);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (!selectedPortals.includes(suggestion.portal_id)) {
      const newSelection = [...selectedPortals, suggestion.portal_id];
      setSelectedPortals(newSelection);
      // Trigger visibility preview update
      fetchVisibilityPreview(newSelection);
    }
  };

  const portals = portalsData?.portals || [];
  const suggestions = suggestionsData?.suggestions || [];
  const canSubmit = selectedPortals.length > 0 && !publishMutation.isPending;

  const getDistanceDisplay = (suggestion: Suggestion) => {
    if (suggestion.distance_confidence === 'ok' && suggestion.distance_label) {
      return resolve('provider.publish.suggestions.distance_format').replace('{distance}', suggestion.distance_label.replace('~', ''));
    }
    if (suggestion.distance_confidence === 'unknown') {
      return resolve('provider.publish.suggestions.distance_unknown');
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" data-testid="dialog-publish-run">
        <DialogHeader>
          <DialogTitle data-testid="text-publish-modal-title">
            {resolve('provider.run.publish.modal_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* V3.5 STEP 8: Origin Readiness Preflight Banner */}
          {suggestionsData && suggestionsData.origin.origin_state !== 'has_coords' && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" data-testid="alert-origin-readiness">
              <Navigation className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="flex flex-col gap-2">
                <span className="text-sm" data-testid="text-origin-banner-message">
                  {suggestionsData.origin.origin_state === 'no_address'
                    ? resolve('provider.publish.suggestions.no_origin')
                    : resolve('provider.publish.suggestions.no_origin_coords')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddressModalOpen(true)}
                  className="w-fit"
                  data-testid="button-origin-cta"
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  {suggestionsData.origin.origin_state === 'no_address'
                    ? resolve('provider.publish.preflight.set_address')
                    : resolve('provider.publish.preflight.add_coords')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Suggestions Section (STEP 7) */}
          {suggestions.length > 0 && (
            <div className="space-y-3" data-testid="section-suggestions">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <Label className="text-sm font-medium" data-testid="text-suggestions-title">
                  {resolve('provider.publish.suggestions.title')}
                </Label>
              </div>

              <div className="space-y-2">
                {suggestions.map((suggestion) => {
                  const isAlreadySelected = selectedPortals.includes(suggestion.portal_id);
                  const distanceDisplay = getDistanceDisplay(suggestion);
                  
                  return (
                    <button
                      key={suggestion.zone_id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isAlreadySelected}
                      className={`w-full text-left p-2 rounded-md border transition-colors ${
                        isAlreadySelected 
                          ? 'bg-muted/50 border-muted cursor-default opacity-60' 
                          : 'hover-elevate border-border cursor-pointer'
                      }`}
                      data-testid={`button-suggestion-${suggestion.zone_id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-sm block truncate" data-testid={`text-zone-name-${suggestion.zone_id}`}>
                            {suggestion.zone_name}
                          </span>
                          <span className="text-xs text-muted-foreground block truncate">
                            {resolve('provider.publish.suggestions.in_portal').replace('{portalName}', suggestion.portal_name)}
                          </span>
                        </div>
                        {distanceDisplay && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-distance-${suggestion.zone_id}`}>
                            {distanceDisplay}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {suggestions.length === 0 && !suggestionsLoading && open && (
            <div className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-suggestions">
              {resolve('provider.publish.suggestions.empty')}
            </div>
          )}

          {suggestionsLoading && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}

          <Separator />

          {/* Portal Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium" data-testid="text-visibility-label">
                {resolve('provider.run.publish.visibility_label')}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-visibility-helper">
              {resolve('provider.run.publish.visibility_helper')}
            </p>

            {portalsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : portals.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-portals">
                {resolve('provider.run.publish.no_portals')}
              </p>
            ) : (
              <div className="space-y-2">
                {portals.map((portal) => (
                  <div key={portal.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`portal-${portal.id}`}
                      checked={selectedPortals.includes(portal.id)}
                      onCheckedChange={(checked) => handlePortalToggle(portal.id, checked === true)}
                      data-testid={`checkbox-portal-${portal.id}`}
                    />
                    <Label 
                      htmlFor={`portal-${portal.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {portal.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* V3.5 STEP 11A: Also Visible In Preview Section */}
          <div className="space-y-3" data-testid="section-visibility-preview">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium" data-testid="text-preview-title">
                {resolve('provider.publish.preview.title')}
              </Label>
            </div>

            {visibilityLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span data-testid="text-preview-loading">
                  {resolve('provider.publish.preview.loading')}
                </span>
              </div>
            ) : visibilityError ? (
              <div className="text-sm text-destructive" data-testid="text-preview-error">
                {resolve('provider.publish.preview.error')}
              </div>
            ) : visibilityPreview?.effective_portals && visibilityPreview.effective_portals.length > 0 ? (
              <div className="space-y-2">
                {visibilityPreview.effective_portals.map((portal) => (
                  <div 
                    key={portal.portal_id} 
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                    data-testid={`preview-portal-${portal.portal_id}`}
                  >
                    <span className="text-sm font-medium truncate" data-testid={`text-portal-name-${portal.portal_id}`}>
                      {portal.portal_name}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {portal.visibility_source === 'direct' ? (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-direct-${portal.portal_id}`}>
                          {resolve('provider.publish.preview.direct_badge')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-rollup-${portal.portal_id}`}>
                          {portal.via_name 
                            ? resolve('provider.publish.preview.via_format').replace('{name}', portal.via_name)
                            : resolve('provider.publish.preview.rollup_badge')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-2" data-testid="text-preview-empty">
                {resolve('provider.publish.preview.empty')}
              </div>
            )}
          </div>

          <Separator />

          {/* Market Mode Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium" data-testid="text-competition-label">
                {resolve('provider.run.publish.competition_label')}
              </Label>
            </div>

            <RadioGroup value={marketMode} onValueChange={setMarketMode} className="space-y-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem 
                  value="OPEN" 
                  id="market-open" 
                  data-testid="radio-market-open"
                />
                <div className="grid gap-1">
                  <Label htmlFor="market-open" className="text-sm font-normal cursor-pointer">
                    {resolve('provider.run.publish.market_mode_open')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {resolve('provider.run.publish.market_mode_open_helper')}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem 
                  value="INVITE_ONLY" 
                  id="market-invite" 
                  data-testid="radio-market-invite"
                />
                <div className="grid gap-1">
                  <Label htmlFor="market-invite" className="text-sm font-normal cursor-pointer">
                    {resolve('provider.run.publish.market_mode_invite_only')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {resolve('provider.run.publish.market_mode_invite_only_helper')}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-publish-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={() => publishMutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-publish-confirm"
          >
            {publishMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              resolve('provider.run.publish.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* V3.5 STEP 8: StartAddressPickerModal for origin setup */}
      <StartAddressPickerModal
        open={addressModalOpen}
        onOpenChange={(isOpen) => {
          setAddressModalOpen(isOpen);
          if (!isOpen) {
            // Refresh suggestions when address modal closes
            queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId, 'publish-suggestions'] });
          }
        }}
        runId={runId}
        currentAddressId={suggestionsData?.origin.start_address_id || null}
      />
    </Dialog>
  );
}
