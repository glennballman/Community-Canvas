import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bed, Armchair, UserSquare, Plug, Loader2, Check, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assignUnits, type ProposalParticipant, type ProposalResponse } from '@/lib/api/proposals';

interface AssignUnitsPanelProps {
  proposalId: string;
  participants: ProposalParticipant[];
  unassignedUnits?: ProposalResponse['unassigned_units'];
  onAssignmentComplete?: () => void;
}

interface UnassignedUnit {
  claim_id: string;
  unit_id: string;
  unit_type: string;
  unit_label: string | null;
  container_path: string[];
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
  return <Package className="w-4 h-4" />;
}

function formatUnitType(unitType: string): string {
  if (!unitType) return 'Unknown';
  const type = unitType.toLowerCase();
  if (type.includes('sleep')) return 'Sleep';
  if (type.includes('sit') || type.includes('seat')) return 'Seat';
  if (type.includes('stand')) return 'Stand';
  if (type.includes('utility') || type.includes('power')) return 'Utility';
  return unitType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function flattenUnassignedUnits(claims?: ProposalResponse['unassigned_units']): UnassignedUnit[] {
  if (!claims) return [];
  
  const units: UnassignedUnit[] = [];
  for (const claim of claims) {
    for (const unit of claim.units) {
      units.push({
        claim_id: claim.claim_id,
        unit_id: unit.unit_id,
        unit_type: unit.unit_type,
        unit_label: unit.unit_label,
        container_path: claim.container_path,
      });
    }
  }
  return units;
}

export function AssignUnitsPanel({ 
  proposalId, 
  participants,
  unassignedUnits: rawUnassigned,
  onAssignmentComplete 
}: AssignUnitsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const unassignedUnits = flattenUnassignedUnits(rawUnassigned);
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  
  const assignMutation = useMutation({
    mutationFn: async () => {
      return assignUnits(proposalId, {
        participant_id: selectedParticipant,
        unit_ids: selectedUnitIds,
      });
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: 'Units assigned',
          description: `${selectedUnitIds.length} unit(s) assigned successfully`,
        });
        setSelectedUnitIds([]);
        queryClient.invalidateQueries({ queryKey: ['/api/p2/app/proposals', proposalId] });
        onAssignmentComplete?.();
      } else {
        toast({
          title: 'Assignment failed',
          description: data.error || 'Unable to assign units',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });
  
  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };
  
  const isValid = selectedParticipant && selectedUnitIds.length > 0;
  
  if (unassignedUnits.length === 0) {
    return (
      <Card data-testid="assign-units-panel-empty">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Assign Units
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            All units have been assigned
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const groupedByType = unassignedUnits.reduce((acc, unit) => {
    const type = formatUnitType(unit.unit_type);
    if (!acc[type]) acc[type] = [];
    acc[type].push(unit);
    return acc;
  }, {} as Record<string, UnassignedUnit[]>);
  
  return (
    <Card data-testid="assign-units-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" />
          Assign Units ({unassignedUnits.length} unassigned)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="participant-select">Assign to Participant</Label>
          <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
            <SelectTrigger id="participant-select" data-testid="assign-participant-select">
              <SelectValue placeholder="Select a participant" />
            </SelectTrigger>
            <SelectContent>
              {participants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Select Units</Label>
          <ScrollArea className="h-48 border rounded-lg p-2">
            {Object.entries(groupedByType).map(([type, units]) => (
              <div key={type} className="mb-3">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  {getUnitIcon(units[0].unit_type)}
                  {type} ({units.length})
                </div>
                <div className="space-y-1">
                  {units.map((unit) => (
                    <div
                      key={unit.unit_id}
                      className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                      onClick={() => toggleUnit(unit.unit_id)}
                      data-testid={`unit-checkbox-${unit.unit_id}`}
                    >
                      <Checkbox
                        checked={selectedUnitIds.includes(unit.unit_id)}
                        onCheckedChange={() => toggleUnit(unit.unit_id)}
                      />
                      <span className="text-sm flex-1">
                        {unit.unit_label || 'Unnamed Unit'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {unit.container_path.slice(-1)[0] || 'Root'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
        
        {selectedUnitIds.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {selectedUnitIds.length} unit(s) selected
          </div>
        )}
        
        <Button
          className="w-full"
          disabled={!isValid || assignMutation.isPending}
          onClick={() => assignMutation.mutate()}
          data-testid="assign-button"
        >
          {assignMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Assign Selected Units
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
