import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Settings, Calendar, ClipboardList, DollarSign, ChevronDown, Info } from 'lucide-react';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ResolvedPolicy {
  negotiationType: string;
  maxTurns: number;
  allowCounter: boolean;
  closeOnAccept: boolean;
  closeOnDecline: boolean;
  providerCanInitiate: boolean;
  stakeholderCanInitiate: boolean;
  allowProposalContext: boolean;
}

interface PoliciesListItem {
  negotiation_type: string;
  resolved: ResolvedPolicy;
  has_overrides: boolean;
}

interface PoliciesListResponse {
  ok: boolean;
  policies: PoliciesListItem[];
}

interface PolicyDetailResponse {
  ok: boolean;
  negotiation_type: string;
  resolved: ResolvedPolicy;
  platform_defaults: {
    max_turns: number;
    allow_counter: boolean;
    close_on_accept: boolean;
    close_on_decline: boolean;
    provider_can_initiate: boolean;
    stakeholder_can_initiate: boolean;
    allow_proposal_context: boolean;
  };
  tenant_overrides: {
    max_turns: number | null;
    allow_counter: boolean | null;
    close_on_accept: boolean | null;
    close_on_decline: boolean | null;
    provider_can_initiate: boolean | null;
    stakeholder_can_initiate: boolean | null;
    allow_proposal_context: boolean | null;
  };
}

const NEGOTIATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  schedule: <Calendar className="w-4 h-4" />,
  scope: <ClipboardList className="w-4 h-4" />,
  pricing: <DollarSign className="w-4 h-4" />,
};

const NEGOTIATION_TYPE_LABELS: Record<string, string> = {
  schedule: 'Schedule Proposals',
  scope: 'Scope Changes',
  pricing: 'Pricing Adjustments',
};

function PolicyTypeCard({ item, onExpand }: { item: PoliciesListItem; onExpand: (type: string) => void }) {
  const { resolve } = useCopy({ entryPoint: 'service' });

  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`card-policy-${item.negotiation_type}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            {NEGOTIATION_TYPE_ICONS[item.negotiation_type]}
            {NEGOTIATION_TYPE_LABELS[item.negotiation_type] || item.negotiation_type}
          </CardTitle>
          {item.has_overrides && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-has-overrides-${item.negotiation_type}`}>
              Custom
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Max turns</div>
          <div className="font-medium">{item.resolved.maxTurns}</div>
          <div className="text-muted-foreground">Allow counter</div>
          <div className="font-medium">{item.resolved.allowCounter ? 'Yes' : 'No'}</div>
          <div className="text-muted-foreground">Provider initiates</div>
          <div className="font-medium">{item.resolved.providerCanInitiate ? 'Yes' : 'No'}</div>
          <div className="text-muted-foreground">Stakeholder initiates</div>
          <div className="font-medium">{item.resolved.stakeholderCanInitiate ? 'Yes' : 'No'}</div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-2"
          onClick={() => onExpand(item.negotiation_type)}
          data-testid={`button-edit-policy-${item.negotiation_type}`}
        >
          <Settings className="w-4 h-4 mr-2" />
          {resolve('settings.negotiation.edit_policy') || 'Edit Policy'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PolicyDetailEditor({ negotiationType, onClose }: { negotiationType: string; onClose: () => void }) {
  const { resolve } = useCopy({ entryPoint: 'service' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<PolicyDetailResponse>({
    queryKey: ['/api/tenant/negotiation-policies', negotiationType],
    queryFn: async () => {
      const res = await fetch(`/api/tenant/negotiation-policies/${negotiationType}`);
      if (!res.ok) throw new Error('Failed to load policy');
      return res.json();
    },
  });

  const [localOverrides, setLocalOverrides] = useState<{
    max_turns?: number | null;
    allow_counter?: boolean | null;
    close_on_accept?: boolean | null;
    close_on_decline?: boolean | null;
    provider_can_initiate?: boolean | null;
    stakeholder_can_initiate?: boolean | null;
    allow_proposal_context?: boolean | null;
  }>({});

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      return apiRequest('PATCH', `/api/tenant/negotiation-policies/${negotiationType}`, updates);
    },
    onSuccess: () => {
      toast({ title: 'Policy updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/negotiation-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/negotiation-policies', negotiationType] });
    },
    onError: () => {
      toast({ title: 'Failed to update policy', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/tenant/negotiation-policies/${negotiationType}`, {});
    },
    onSuccess: () => {
      toast({ title: 'Policy reset to platform defaults' });
      setLocalOverrides({});
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/negotiation-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/negotiation-policies', negotiationType] });
    },
    onError: () => {
      toast({ title: 'Failed to reset policy', variant: 'destructive' });
    },
  });

  const getEffectiveValue = <T,>(key: keyof typeof localOverrides, defaultValue: T): T => {
    if (localOverrides[key] !== undefined) {
      return localOverrides[key] as T;
    }
    if (data?.tenant_overrides?.[key as keyof typeof data.tenant_overrides] !== null) {
      return data?.tenant_overrides?.[key as keyof typeof data.tenant_overrides] as T;
    }
    return data?.platform_defaults?.[key as keyof typeof data.platform_defaults] as T ?? defaultValue;
  };

  const handleSave = () => {
    if (Object.keys(localOverrides).length > 0) {
      updateMutation.mutate(localOverrides);
    }
  };

  const handleOverrideChange = (key: string, value: unknown) => {
    setLocalOverrides(prev => ({ ...prev, [key]: value }));
  };

  const hasChanges = Object.keys(localOverrides).length > 0;

  if (isLoading) {
    return (
      <Card data-testid={`card-policy-detail-${negotiationType}`}>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card data-testid={`card-policy-detail-${negotiationType}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {NEGOTIATION_TYPE_ICONS[negotiationType]}
            {NEGOTIATION_TYPE_LABELS[negotiationType]} Settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-policy-detail">
            Close
          </Button>
        </div>
        <CardDescription>
          {resolve('settings.negotiation.description') || 'Override platform defaults for this negotiation type. Set a value to null to inherit from platform.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="max-turns" className="flex items-center gap-2">
                {resolve('settings.negotiation.max_turns') || 'Maximum Turns'}
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px]">
                      {resolve('settings.negotiation.max_turns_help') || 'Maximum number of proposals allowed before negotiation closes. Platform default:'} {data.platform_defaults.max_turns}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <p className="text-xs text-muted-foreground">
                Current: {getEffectiveValue('max_turns', 3)}
              </p>
            </div>
            <Input
              id="max-turns"
              type="number"
              min={1}
              max={20}
              className="w-20"
              value={localOverrides.max_turns ?? data.tenant_overrides.max_turns ?? ''}
              placeholder={String(data.platform_defaults.max_turns)}
              onChange={(e) => handleOverrideChange('max_turns', e.target.value ? parseInt(e.target.value) : null)}
              data-testid="input-max-turns"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="allow-counter" className="flex items-center gap-2">
                {resolve('settings.negotiation.allow_counter') || 'Allow Counter Proposals'}
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px]">
                      {resolve('settings.negotiation.allow_counter_help') || 'Whether stakeholders can counter proposals instead of just accepting/declining.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <p className="text-xs text-muted-foreground">
                Platform: {data.platform_defaults.allow_counter ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Switch
              id="allow-counter"
              checked={getEffectiveValue('allow_counter', true)}
              onCheckedChange={(v) => handleOverrideChange('allow_counter', v)}
              data-testid="switch-allow-counter"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="provider-initiates" className="flex items-center gap-2">
                {resolve('settings.negotiation.provider_can_initiate') || 'Provider Can Initiate'}
              </Label>
              <p className="text-xs text-muted-foreground">
                Platform: {data.platform_defaults.provider_can_initiate ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Switch
              id="provider-initiates"
              checked={getEffectiveValue('provider_can_initiate', true)}
              onCheckedChange={(v) => handleOverrideChange('provider_can_initiate', v)}
              data-testid="switch-provider-can-initiate"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="stakeholder-initiates" className="flex items-center gap-2">
                {resolve('settings.negotiation.stakeholder_can_initiate') || 'Stakeholder Can Initiate'}
              </Label>
              <p className="text-xs text-muted-foreground">
                Platform: {data.platform_defaults.stakeholder_can_initiate ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Switch
              id="stakeholder-initiates"
              checked={getEffectiveValue('stakeholder_can_initiate', true)}
              onCheckedChange={(v) => handleOverrideChange('stakeholder_can_initiate', v)}
              data-testid="switch-stakeholder-can-initiate"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="allow-context" className="flex items-center gap-2">
                {resolve('settings.negotiation.allow_proposal_context') || 'Allow Proposal Attachments'}
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px]">
                      {resolve('settings.negotiation.allow_proposal_context_help') || 'Allow providers to attach quote/estimate/bid references to proposals.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <p className="text-xs text-muted-foreground">
                Platform: {data.platform_defaults.allow_proposal_context ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Switch
              id="allow-context"
              checked={getEffectiveValue('allow_proposal_context', true)}
              onCheckedChange={(v) => handleOverrideChange('allow_proposal_context', v)}
              data-testid="switch-allow-proposal-context"
            />
          </div>

          <Separator />

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Advanced Options
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="close-on-accept">Close on Accept</Label>
                  <p className="text-xs text-muted-foreground">
                    Platform: {data.platform_defaults.close_on_accept ? 'Yes' : 'No'}
                  </p>
                </div>
                <Switch
                  id="close-on-accept"
                  checked={getEffectiveValue('close_on_accept', true)}
                  onCheckedChange={(v) => handleOverrideChange('close_on_accept', v)}
                  data-testid="switch-close-on-accept"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="close-on-decline">Close on Decline</Label>
                  <p className="text-xs text-muted-foreground">
                    Platform: {data.platform_defaults.close_on_decline ? 'Yes' : 'No'}
                  </p>
                </div>
                <Switch
                  id="close-on-decline"
                  checked={getEffectiveValue('close_on_decline', true)}
                  onCheckedChange={(v) => handleOverrideChange('close_on_decline', v)}
                  data-testid="switch-close-on-decline"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            data-testid="button-reset-policy"
          >
            {resetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            data-testid="button-save-policy"
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NegotiationPolicySettingsPage() {
  const { resolve } = useCopy({ entryPoint: 'service' });
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PoliciesListResponse>({
    queryKey: ['/api/tenant/negotiation-policies'],
    queryFn: async () => {
      const res = await fetch('/api/tenant/negotiation-policies');
      if (!res.ok) throw new Error('Failed to load policies');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6" data-testid="negotiation-policy-settings-loading">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6" data-testid="negotiation-policy-settings-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          {resolve('settings.negotiation.title') || 'Negotiation Policies'}
        </h1>
        <p className="text-muted-foreground">
          {resolve('settings.negotiation.subtitle') || 'Control how schedule, scope, and pricing negotiations work for your business.'}
        </p>
      </div>

      {expandedType ? (
        <PolicyDetailEditor 
          negotiationType={expandedType} 
          onClose={() => setExpandedType(null)} 
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {data?.policies.map((item) => (
            <PolicyTypeCard 
              key={item.negotiation_type} 
              item={item} 
              onExpand={setExpandedType}
            />
          ))}
        </div>
      )}
    </div>
  );
}
