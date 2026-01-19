import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText } from 'lucide-react';
import { getProposal, type ProposalParticipant, type ProposalAllocation } from '@/lib/api/proposals';
import {
  ProposalHeaderCard,
  ParticipantList,
  AllocationDrilldownDrawer,
  FolioSummaryCard,
  PayYourSharePanel,
} from '@/components/proposals';

export default function PublicProposalPage() {
  const { proposalId, token } = useParams<{ proposalId: string; token?: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromQuery = token || searchParams.get('token');
  
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/p2/app/proposals', proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: !!proposalId,
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="proposal-loading">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error || !data?.ok) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="proposal-error">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">Reservation Not Found</h2>
          <p className="text-sm text-muted-foreground">
            {data?.error || 'Unable to load this reservation. Please check your link.'}
          </p>
        </div>
      </div>
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
  
  return (
    <div className="min-h-screen bg-background" data-testid="public-proposal-page">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <ProposalHeaderCard 
          proposal={proposal} 
          participantCount={participants.length}
          isAuthenticated={false}
        />
        
        <Separator className="my-6" />
        
        <ParticipantList
          participants={participants}
          allocations={allocations}
          onViewAllocation={handleViewAllocation}
        />
        
        <Separator className="my-6" />
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Folio Summaries</h3>
          {participants.map((participant, index) => (
            <div key={participant.id} className="p-4 rounded-lg border bg-card" data-testid={`folio-card-${index}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">{participant.display_name}</span>
              </div>
              <FolioSummaryCard participant={participant} compact />
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
  );
}
