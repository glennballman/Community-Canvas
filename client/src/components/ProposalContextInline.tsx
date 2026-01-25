import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, ChevronDown, ChevronUp, FileText, Calculator, Briefcase, MapPin, Tag } from 'lucide-react';
import { useCopy } from '@/copy/useCopy';

interface ProposalContext {
  quote_draft_id?: string | null;
  estimate_id?: string | null;
  bid_id?: string | null;
  trip_id?: string | null;
  selected_scope_option?: string | null;
}

interface ProposalContextInlineProps {
  mode: 'provider' | 'stakeholder';
  allow: boolean;
  proposalContext: ProposalContext | null;
  density?: 'compact' | 'regular';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function maskUUID(uuid: string): string {
  if (!uuid) return '********';
  return `${uuid.substring(0, 8)}…`;
}

const UUID_FIELDS = ['quote_draft_id', 'estimate_id', 'bid_id', 'trip_id'] as const;

const FIELD_ICONS: Record<string, typeof FileText> = {
  quote_draft_id: FileText,
  estimate_id: Calculator,
  bid_id: Briefcase,
  trip_id: MapPin,
};

export function ProposalContextInline({ 
  mode, 
  allow, 
  proposalContext, 
  density = 'regular' 
}: ProposalContextInlineProps) {
  const [showIds, setShowIds] = useState(false);
  const { toast } = useToast();
  const { resolve } = useCopy();
  
  const ns = `${mode}.schedule_proposals.proposal_context`;
  
  if (!allow || !proposalContext) {
    return null;
  }
  
  const hasQuoteDraft = !!proposalContext.quote_draft_id;
  const hasEstimate = !!proposalContext.estimate_id;
  const hasBid = !!proposalContext.bid_id;
  const hasTrip = !!proposalContext.trip_id;
  const hasScopeOption = !!proposalContext.selected_scope_option;
  
  const hasAnyContext = hasQuoteDraft || hasEstimate || hasBid || hasTrip || hasScopeOption;
  
  if (!hasAnyContext) {
    return null;
  }
  
  const hasValidQuoteDraft = !!proposalContext.quote_draft_id && isValidUUID(proposalContext.quote_draft_id);
  const hasValidEstimate = !!proposalContext.estimate_id && isValidUUID(proposalContext.estimate_id);
  const hasValidBid = !!proposalContext.bid_id && isValidUUID(proposalContext.bid_id);
  const hasValidTrip = !!proposalContext.trip_id && isValidUUID(proposalContext.trip_id);
  const hasUuidFields = hasValidQuoteDraft || hasValidEstimate || hasValidBid || hasValidTrip;
  
  const handleCopyId = async (id: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast({
        title: resolve(`${ns}.action.copied`) || 'Copied',
        description: `${fieldName} copied to clipboard`,
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
  
  const isCompact = density === 'compact';
  
  return (
    <div 
      className={`rounded-md border bg-muted/30 ${isCompact ? 'p-2' : 'p-3'}`}
      data-testid="proposal-context-inline"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {resolve(`${ns}.label.context_attached`) || 'Context attached'}
        </span>
        
        <div className="flex items-center gap-1 flex-wrap">
          {hasQuoteDraft && (
            <Badge variant="secondary" className={isCompact ? 'text-xs px-1.5 py-0' : ''}>
              <FileText className="w-3 h-3 mr-1" />
              {resolve(`${ns}.chip.quote_draft`) || 'Quote Draft'}
            </Badge>
          )}
          {hasEstimate && (
            <Badge variant="secondary" className={isCompact ? 'text-xs px-1.5 py-0' : ''}>
              <Calculator className="w-3 h-3 mr-1" />
              {resolve(`${ns}.chip.estimate`) || 'Estimate'}
            </Badge>
          )}
          {hasBid && (
            <Badge variant="secondary" className={isCompact ? 'text-xs px-1.5 py-0' : ''}>
              <Briefcase className="w-3 h-3 mr-1" />
              {resolve(`${ns}.chip.bid`) || 'Bid'}
            </Badge>
          )}
          {hasTrip && (
            <Badge variant="secondary" className={isCompact ? 'text-xs px-1.5 py-0' : ''}>
              <MapPin className="w-3 h-3 mr-1" />
              {resolve(`${ns}.chip.trip`) || 'Reservation'}
            </Badge>
          )}
          {hasScopeOption && (
            <Badge variant="outline" className={isCompact ? 'text-xs px-1.5 py-0' : ''}>
              <Tag className="w-3 h-3 mr-1" />
              {proposalContext.selected_scope_option}
            </Badge>
          )}
        </div>
      </div>
      
      {hasUuidFields && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-muted-foreground"
            onClick={() => setShowIds(!showIds)}
            data-testid="button-toggle-proposal-ids"
          >
            {showIds ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                {resolve(`${ns}.action.hide_ids`) || 'Hide IDs'}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                {resolve(`${ns}.action.show_ids`) || 'Show IDs'}
              </>
            )}
          </Button>
          
          {showIds && (
            <div className={`mt-2 space-y-1 ${isCompact ? 'text-xs' : 'text-sm'}`}>
              {UUID_FIELDS.map((field) => {
                const value = proposalContext[field];
                if (!value || !isValidUUID(value)) return null;
                
                const Icon = FIELD_ICONS[field] || FileText;
                const fieldLabel = resolve(`${ns}.field.${field}`) || field.replace(/_/g, ' ');
                
                return (
                  <div 
                    key={field} 
                    className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">{fieldLabel}:</span>
                      <code className="font-mono text-xs truncate">{maskUUID(value)}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopyId(value, fieldLabel)}
                      data-testid={`button-copy-${field}`}
                    >
                      <Copy className="w-3 h-3" />
                      <span className="sr-only">{resolve(`${ns}.action.copy_id`) || 'Copy ID'}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProposalContextInline;
