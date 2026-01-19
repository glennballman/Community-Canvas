import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, MinusCircle, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { creditFolio, type FolioCreditPayload } from '@/lib/api/folios';
import type { ProposalParticipant } from '@/lib/api/proposals';

interface OperatorCreditPanelProps {
  participant: ProposalParticipant;
  proposalId: string;
  onCreditIssued?: () => void;
}

const INCIDENT_TYPES: { value: FolioCreditPayload['incident_type']; label: string }[] = [
  { value: 'illness_refund', label: 'Illness Refund' },
  { value: 'staff_damage', label: 'Staff Damage' },
  { value: 'goodwill_refund', label: 'Goodwill Refund' },
  { value: 'injury', label: 'Injury' },
  { value: 'other', label: 'Other' },
];

function formatCurrency(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

export function OperatorCreditPanel({ participant, proposalId, onCreditIssued }: OperatorCreditPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const folio = participant.folio;
  
  const [amount, setAmount] = useState('');
  const [incidentType, setIncidentType] = useState<FolioCreditPayload['incident_type']>('goodwill_refund');
  const [notes, setNotes] = useState('');
  
  const creditMutation = useMutation({
    mutationFn: async () => {
      if (!folio?.folio_id) throw new Error('No folio ID');
      const amountCents = Math.round(parseFloat(amount) * 100);
      const incidentId = `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return creditFolio(folio.folio_id, {
        amount_cents: amountCents,
        incident_id: incidentId,
        incident_type: incidentType,
        notes: notes || undefined,
      });
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: 'Credit issued',
          description: `Credit of ${formatCurrency(Math.round(parseFloat(amount) * 100))} applied`,
        });
        setAmount('');
        setNotes('');
        queryClient.invalidateQueries({ queryKey: ['/api/p2/app/proposals', proposalId] });
        onCreditIssued?.();
      } else {
        toast({
          title: 'Credit failed',
          description: data.error || 'Unable to issue credit',
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
  
  if (!folio) {
    return null;
  }
  
  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const maxCredit = folio.summary?.totalCharges || 0;
  const isValid = amountCents > 0 && amountCents <= maxCredit && incidentType;
  
  return (
    <Card className="border-orange-500/50" data-testid="operator-credit-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <Shield className="w-4 h-4" />
          Operator Credit (Staff Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive" className="bg-orange-500/10 border-orange-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm">Restricted Action</AlertTitle>
          <AlertDescription className="text-xs">
            Credits are recorded in the incident log and cannot be reversed.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label htmlFor="incident-type">Incident Type</Label>
          <Select value={incidentType} onValueChange={(v) => setIncidentType(v as FolioCreditPayload['incident_type'])}>
            <SelectTrigger id="incident-type" data-testid="incident-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCIDENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="credit-amount">Credit Amount ($CAD)</Label>
          <Input
            id="credit-amount"
            type="number"
            step="0.01"
            min="0"
            max={(maxCredit / 100).toFixed(2)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            data-testid="credit-amount-input"
          />
          <p className="text-xs text-muted-foreground">
            Max: {formatCurrency(maxCredit)}
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="credit-notes">Notes</Label>
          <Textarea
            id="credit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the reason for this credit..."
            rows={3}
            data-testid="credit-notes-input"
          />
        </div>
        
        <Button
          className="w-full"
          variant="destructive"
          disabled={!isValid || creditMutation.isPending}
          onClick={() => creditMutation.mutate()}
          data-testid="issue-credit-button"
        >
          {creditMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <MinusCircle className="w-4 h-4 mr-2" />
              Issue Credit
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
