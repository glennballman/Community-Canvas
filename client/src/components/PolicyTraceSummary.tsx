import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, ChevronDown, ChevronUp, Shield, Clock, Hash, FileKey } from 'lucide-react';
import { useCopy } from '@/copy/useCopy';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PolicyTrace {
  negotiation_type: string;
  effective_source: 'platform' | 'tenant_override';
  platform_policy_id: string | null;
  tenant_policy_id: string | null;
  effective_policy_id: string;
  effective_policy_updated_at: string;
  effective_policy_hash: string;
}

interface PolicyTraceSummaryProps {
  trace: PolicyTrace | null | undefined;
  compact?: boolean;
  title?: string;
}

function maskId(id: string): string {
  if (!id) return '********';
  if (id.length <= 8) return id;
  return `${id.substring(0, 8)}…`;
}

function maskHash(hash: string): string {
  if (!hash) return '********';
  if (hash.length <= 12) return hash;
  return `${hash.substring(0, 8)}…${hash.substring(hash.length - 4)}`;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

export function PolicyTraceSummary({ 
  trace, 
  compact = false,
  title
}: PolicyTraceSummaryProps) {
  const [showIds, setShowIds] = useState(false);
  const { toast } = useToast();
  const { resolve } = useCopy();
  
  if (!trace) {
    return null;
  }
  
  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: resolve('policy.negotiation_audit.action.copied') || 'Copied',
        description: `${label} copied to clipboard`,
        duration: 1500,
      });
    } catch {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
        duration: 1500,
      });
    }
  };
  
  const effectiveSourceLabel = trace.effective_source === 'platform' 
    ? 'Platform' 
    : 'Tenant Override';
  
  const effectiveSourceVariant = trace.effective_source === 'platform' 
    ? 'secondary' as const
    : 'outline' as const;
  
  if (compact) {
    return (
      <div 
        className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground"
        data-testid="policy-trace-summary-compact"
      >
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          <span>Policy:</span>
          <Badge variant={effectiveSourceVariant} className="text-xs px-1.5 py-0">
            {effectiveSourceLabel}
          </Badge>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-help">
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(trace.effective_policy_updated_at)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{new Date(trace.effective_policy_updated_at).toLocaleString()}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-xs"
              onClick={() => handleCopy(trace.effective_policy_hash, 'Policy hash')}
              data-testid="button-copy-hash-compact"
            >
              <Hash className="w-3 h-3 mr-1" />
              {maskHash(trace.effective_policy_hash)}
              <Copy className="w-3 h-3 ml-1" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to copy full policy hash</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
  
  return (
    <Card className="bg-muted/30" data-testid="policy-trace-summary">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Shield className="w-4 h-4" />
          {title || resolve('policy.negotiation_audit.trace.title') || 'Policy Trace'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {resolve('policy.negotiation_audit.trace.effective_source') || 'Effective Source'}
            </div>
            <Badge variant={effectiveSourceVariant} data-testid="badge-effective-source">
              {effectiveSourceLabel}
            </Badge>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {resolve('policy.negotiation_audit.trace.updated_at') || 'Policy Updated'}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help" data-testid="text-updated-at">
                  {formatRelativeTime(trace.effective_policy_updated_at)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{new Date(trace.effective_policy_updated_at).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {resolve('policy.negotiation_audit.trace.policy_hash') || 'Policy Hash'}
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded" data-testid="text-policy-hash">
              {maskHash(trace.effective_policy_hash)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCopy(trace.effective_policy_hash, 'Policy hash')}
              data-testid="button-copy-hash"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowIds(!showIds)}
            data-testid="button-toggle-ids"
          >
            <FileKey className="w-3 h-3 mr-1" />
            {showIds 
              ? (resolve('policy.negotiation_audit.action.hide_ids') || 'Hide IDs')
              : (resolve('policy.negotiation_audit.action.show_ids') || 'Show IDs')
            }
            {showIds ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
          
          {showIds && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {resolve('policy.negotiation_audit.trace.effective_policy_id') || 'Effective Policy ID'}:
                </span>
                <div className="flex items-center gap-1">
                  <code className="bg-muted px-1.5 py-0.5 rounded" data-testid="text-effective-policy-id">
                    {maskId(trace.effective_policy_id)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleCopy(trace.effective_policy_id, 'Effective policy ID')}
                    data-testid="button-copy-effective-policy-id"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {trace.platform_policy_id && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {resolve('policy.negotiation_audit.trace.platform_policy_id') || 'Platform Policy ID'}:
                  </span>
                  <div className="flex items-center gap-1">
                    <code className="bg-muted px-1.5 py-0.5 rounded" data-testid="text-platform-policy-id">
                      {maskId(trace.platform_policy_id)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleCopy(trace.platform_policy_id!, 'Platform policy ID')}
                      data-testid="button-copy-platform-policy-id"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {trace.tenant_policy_id && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {resolve('policy.negotiation_audit.trace.tenant_policy_id') || 'Tenant Policy ID'}:
                  </span>
                  <div className="flex items-center gap-1">
                    <code className="bg-muted px-1.5 py-0.5 rounded" data-testid="text-tenant-policy-id">
                      {maskId(trace.tenant_policy_id)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleCopy(trace.tenant_policy_id!, 'Tenant policy ID')}
                      data-testid="button-copy-tenant-policy-id"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
