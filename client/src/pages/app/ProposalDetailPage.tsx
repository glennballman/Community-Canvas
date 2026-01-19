import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Users, Package, Receipt } from 'lucide-react';
import { getProposal, type ProposalParticipant, type ProposalAllocation } from '@/lib/api/proposals';
import {
  ProposalHeaderCard,
  ParticipantList,
  AllocationDrilldownDrawer,
  FolioSummaryCard,
  PayYourSharePanel,
  InvitePanel,
  AssignUnitsPanel,
  OperatorCreditPanel,
} from '@/components/proposals';

export default function ProposalDetailPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('participants');
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/p2/app/proposals', proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: !!proposalId,
  });
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="proposal-loading">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error || !data?.ok) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="proposal-error">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">Reservation Not Found</h2>
          <p className="text-sm text-muted-foreground">
            {data?.error || 'Unable to load this reservation.'}
          </p>
        </div>
      </div>
    );
  }
  
  const { proposal, participants, allocations, unassigned_units } = data;
  
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
  
  return (
    <div className="flex-1 overflow-hidden" data-testid="app-proposal-page">
      <ScrollArea className="h-full">
        <div className="max-w-5xl mx-auto py-6 px-4">
          <ProposalHeaderCard 
            proposal={proposal} 
            participantCount={participants.length}
            isAuthenticated={true}
          />
          
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="participants" className="flex-1" data-testid="tab-participants">
                    <Users className="w-4 h-4 mr-2" />
                    Participants
                  </TabsTrigger>
                  <TabsTrigger value="folios" className="flex-1" data-testid="tab-folios">
                    <Receipt className="w-4 h-4 mr-2" />
                    Folios
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="participants" className="mt-4">
                  <ParticipantList
                    participants={participants}
                    allocations={allocations}
                    onViewAllocation={handleViewAllocation}
                    isPlanner={true}
                  />
                </TabsContent>
                
                <TabsContent value="folios" className="mt-4 space-y-4">
                  {participants.map((participant, index) => (
                    <div key={participant.id} className="p-4 rounded-lg border bg-card" data-testid={`folio-detail-${index}`}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-medium">{participant.display_name}</span>
                      </div>
                      <FolioSummaryCard participant={participant} showDetails />
                      
                      <Separator className="my-4" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PayYourSharePanel 
                          participant={participant}
                          proposalId={proposalId!}
                        />
                        <OperatorCreditPanel
                          participant={participant}
                          proposalId={proposalId!}
                        />
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="space-y-6">
              <InvitePanel 
                proposalId={proposalId!} 
                onInviteSent={() => refetch()}
              />
              
              <AssignUnitsPanel
                proposalId={proposalId!}
                participants={participants}
                unassignedUnits={unassigned_units}
                onAssignmentComplete={() => refetch()}
              />
            </div>
          </div>
          
          <AllocationDrilldownDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            participant={selectedParticipant || null}
            allocation={selectedAllocation || null}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
