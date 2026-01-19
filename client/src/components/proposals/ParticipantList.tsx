import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bed, Armchair, UserSquare, Plug, ChevronRight, Users } from 'lucide-react';
import type { ProposalParticipant, ProposalAllocation } from '@/lib/api/proposals';

interface ParticipantListProps {
  participants: ProposalParticipant[];
  allocations: ProposalAllocation[];
  onViewAllocation?: (participantId: string) => void;
  isPlanner?: boolean;
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'primary':
    case 'co_planner':
      return 'default';
    case 'adult':
    case 'party_member':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface UnitCounts {
  sleep: number;
  sit: number;
  stand: number;
  utility: number;
}

function countUnitsByType(allocation: ProposalAllocation | undefined): UnitCounts {
  const counts: UnitCounts = { sleep: 0, sit: 0, stand: 0, utility: 0 };
  
  if (!allocation?.claims) return counts;
  
  for (const claim of allocation.claims) {
    for (const unit of claim.units) {
      const type = unit.unit_type?.toLowerCase() || '';
      if (type.includes('sleep') || type.includes('bed')) {
        counts.sleep++;
      } else if (type.includes('sit') || type.includes('seat')) {
        counts.sit++;
      } else if (type.includes('stand')) {
        counts.stand++;
      } else if (type.includes('utility') || type.includes('power')) {
        counts.utility++;
      }
    }
  }
  
  return counts;
}

export function ParticipantList({ 
  participants, 
  allocations, 
  onViewAllocation,
  isPlanner = false 
}: ParticipantListProps) {
  const allocationMap = new Map(allocations.map(a => [a.participant_id, a]));
  
  if (participants.length === 0) {
    return (
      <Card data-testid="participant-list-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            No participants added yet
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid="participant-list">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" />
          Participants ({participants.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {participants.map((participant, index) => {
          const allocation = allocationMap.get(participant.id);
          const counts = countUnitsByType(allocation);
          const hasUnits = counts.sleep > 0 || counts.sit > 0 || counts.stand > 0 || counts.utility > 0;
          
          return (
            <div
              key={participant.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card hover-elevate"
              data-testid={`participant-row-${index}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate" data-testid={`participant-name-${index}`}>
                    {participant.display_name}
                  </span>
                  <Badge variant={getRoleBadgeVariant(participant.role)} className="text-xs">
                    {formatRole(participant.role)}
                  </Badge>
                </div>
                
                {hasUnits ? (
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {counts.sleep > 0 && (
                      <span className="flex items-center gap-1" title="Sleep spots">
                        <Bed className="w-3 h-3" />
                        {counts.sleep}
                      </span>
                    )}
                    {counts.sit > 0 && (
                      <span className="flex items-center gap-1" title="Seats">
                        <Armchair className="w-3 h-3" />
                        {counts.sit}
                      </span>
                    )}
                    {counts.stand > 0 && (
                      <span className="flex items-center gap-1" title="Standing spots">
                        <UserSquare className="w-3 h-3" />
                        {counts.stand}
                      </span>
                    )}
                    {counts.utility > 0 && (
                      <span className="flex items-center gap-1" title="Power endpoints">
                        <Plug className="w-3 h-3" />
                        {counts.utility}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">
                    No assigned units yet
                  </div>
                )}
              </div>
              
              {onViewAllocation && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onViewAllocation(participant.id)}
                  data-testid={`view-allocation-${index}`}
                >
                  View
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
