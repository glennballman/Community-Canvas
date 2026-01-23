import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Globe, Users } from 'lucide-react';

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

  const { data: portalsData, isLoading: portalsLoading } = useQuery<{ ok: boolean; portals: Portal[] }>({
    queryKey: ['/api/provider/portals'],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      const publishedIds = currentPublications.map(p => p.portal_id);
      setSelectedPortals(publishedIds);
      setMarketMode(currentMarketMode || 'INVITE_ONLY');
    }
  }, [open, currentPublications, currentMarketMode]);

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
    if (checked) {
      setSelectedPortals(prev => [...prev, portalId]);
    } else {
      setSelectedPortals(prev => prev.filter(id => id !== portalId));
    }
  };

  const portals = portalsData?.portals || [];
  const canSubmit = selectedPortals.length > 0 && !publishMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-publish-run">
        <DialogHeader>
          <DialogTitle data-testid="text-publish-modal-title">
            {resolve('provider.run.publish.modal_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          <Separator />

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
    </Dialog>
  );
}
