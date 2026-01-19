import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Home, DoorOpen, Bed, Armchair, UserSquare, Plug, ChevronRight, ImageOff, Accessibility } from 'lucide-react';
import type { ProposalAllocation, ProposalParticipant } from '@/lib/api/proposals';

interface AllocationDrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: ProposalParticipant | null;
  allocation: ProposalAllocation | null;
}

function getUnitIcon(unitType: string) {
  const type = unitType?.toLowerCase() || '';
  if (type.includes('sleep') || type.includes('bed')) {
    return <Bed className="w-4 h-4" />;
  } else if (type.includes('sit') || type.includes('seat')) {
    return <Armchair className="w-4 h-4" />;
  } else if (type.includes('stand')) {
    return <UserSquare className="w-4 h-4" />;
  } else if (type.includes('utility') || type.includes('power')) {
    return <Plug className="w-4 h-4" />;
  }
  return <DoorOpen className="w-4 h-4" />;
}

function formatUnitType(unitType: string): string {
  if (!unitType) return 'Unknown';
  
  const type = unitType.toLowerCase();
  if (type.includes('sleep')) return 'Sleep Spot';
  if (type.includes('sit') || type.includes('seat')) return 'Seat';
  if (type.includes('stand')) return 'Standing Spot';
  if (type.includes('utility') || type.includes('power')) return 'Power Endpoint';
  
  return unitType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ContainerPath({ path }: { path: string[] }) {
  if (!path || path.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
      <Home className="w-3 h-3" />
      {path.map((segment, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="w-3 h-3" />}
          <span>{segment}</span>
        </span>
      ))}
    </div>
  );
}

export function AllocationDrilldownDrawer({ 
  open, 
  onOpenChange, 
  participant,
  allocation 
}: AllocationDrilldownDrawerProps) {
  const hasUnits = allocation?.claims?.some(c => c.units.length > 0);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg" data-testid="allocation-drilldown-drawer">
        <SheetHeader>
          <SheetTitle data-testid="drilldown-participant-name">
            {participant?.display_name || 'Participant'}
          </SheetTitle>
          <SheetDescription>
            Allocated units and resources
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          {!hasUnits ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-units-message">
              <DoorOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No assigned units yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {allocation?.claims?.map((claim, claimIndex) => (
                <div key={claim.claim_id} data-testid={`claim-${claimIndex}`}>
                  <ContainerPath path={claim.container_path} />
                  
                  <div className="mt-2 space-y-2">
                    {claim.units.map((unit, unitIndex) => (
                      <div 
                        key={unit.unit_id}
                        className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30"
                        data-testid={`unit-${claimIndex}-${unitIndex}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 p-2 rounded-md bg-background">
                            {getUnitIcon(unit.unit_type)}
                          </div>
                          <div>
                            <div className="font-medium" data-testid={`unit-label-${claimIndex}-${unitIndex}`}>
                              {unit.unit_label || `Unit ${unitIndex + 1}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatUnitType(unit.unit_type)}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {claim.claim_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  {claimIndex < (allocation?.claims?.length || 0) - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
              
              <Separator className="my-4" />
              
              <div className="p-4 rounded-lg border bg-muted/30" data-testid="photos-placeholder">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <ImageOff className="w-4 h-4" />
                  <span>Photos</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Photos coming soon
                </p>
              </div>
              
              <div className="p-4 rounded-lg border bg-muted/30" data-testid="accessibility-info">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Accessibility className="w-4 h-4" />
                  <span>Accessibility</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accessibility information available upon request
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
