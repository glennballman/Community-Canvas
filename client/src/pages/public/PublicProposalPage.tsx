import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText } from 'lucide-react';
import { getProposal, type ProposalParticipant, type ProposalAllocation } from '@/lib/api/proposals';
import {
  ProposalHeaderCard,
  ParticipantList,
  AllocationDrilldownDrawer,
  FolioSummaryCard,
  PayYourSharePanel,
  RiskBanner,
  HoldExpirationBanner,
} from '@/components/proposals';
import { PortalBrandedShell } from './components/PortalBrandedShell';

export default function PublicProposalPage() {
  const { proposalId, token } = useParams<{ proposalId: string; token?: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromQuery = token || searchParams.get('token');
  
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/p2/public/proposals', proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: !!proposalId,
  });
  
  const portalSlug = data?.portal?.slug;
  
  if (isLoading) {
    return (
      <PortalBrandedShell
        portalSlug={undefined}
        backHref={undefined}
        backLabel="Back to Portal"
      >
        <div className="flex items-center justify-center py-20" data-testid="proposal-loading">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PortalBrandedShell>
    );
  }
  
  if (error || !data?.ok) {
    return (
      <PortalBrandedShell
        portalSlug={undefined}
        backHref={undefined}
        backLabel="Back to Portal"
      >
        <div className="flex items-center justify-center py-20" data-testid="proposal-error">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-medium mb-2">Reservation Not Found</h2>
            <p className="text-sm text-muted-foreground">
              {data?.error || 'Unable to load this reservation. Please check your link.'}
            </p>
          </div>
        </div>
      </PortalBrandedShell>
    );
  }
  
  const { proposal, participants, allocations } = data;
  
  const selectedParticipant = selectedParticipantId 
    ? participants.find(p => p.id === selectedParticipantId)
    : null;
  
  const selectedAllocation = selectedParticipantId
    ? allocations.find(a => a.participant_id === selectedParticipantId)
    : null;
  
  const handleViewAllocation = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setDrawerOpen(true);
  };
  
  const tokenParticipant = tokenFromQuery
    ? participants.find(p => p.folio?.folio_id?.includes(tokenFromQuery.slice(0, 8)))
    : null;
  
  const isTokenHolder = (participantId: string): boolean => {
    return tokenParticipant?.id === participantId;
  };
  
  return (
    <PortalBrandedShell
      portalSlug={portalSlug}
      preloadedData={data?.portal ? { portal: data.portal } : undefined}
      backHref={portalSlug ? `/p/${portalSlug}` : undefined}
      backLabel="Back to Portal"
    >
      <div data-testid="public-proposal-page">
        <div className="max-w-3xl mx-auto">
          <ProposalHeaderCard 
            proposal={proposal} 
            participantCount={participants.length}
            isAuthenticated={false}
          />
        
        {proposal.status === 'planning' && (
          <div className="mt-4">
            <HoldExpirationBanner holdCreatedAt={proposal.created_at} holdTtlMinutes={30} />
          </div>
        )}
        
        <div className="mt-4">
          <RiskBanner proposalId={proposalId!} />
        </div>
        
        <Separator className="my-6" />
        
        <ParticipantList
          participants={participants}
          allocations={allocations}
          onViewAllocation={handleViewAllocation}
        />
        
        <Separator className="my-6" />
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Folio Overview</h3>
          {participants.map((participant, index) => (
            <div key={participant.id} className="p-4 rounded-lg border bg-card" data-testid={`folio-card-${index}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">{participant.display_name}</span>
              </div>
              {isTokenHolder(participant.id) ? (
                <FolioSummaryCard participant={participant} compact />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {participant.folio?.summary?.netBalance && participant.folio.summary.netBalance > 0 
                    ? 'Has outstanding balance' 
                    : 'Balance settled'}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {tokenFromQuery && tokenParticipant && (
          <>
            <Separator className="my-6" />
            <PayYourSharePanel 
              participant={tokenParticipant}
              proposalId={proposalId!}
            />
          </>
        )}
        
        <AllocationDrilldownDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          participant={selectedParticipant || null}
          allocation={selectedAllocation || null}
        />
        </div>
      </div>
    </PortalBrandedShell>
  );
}
