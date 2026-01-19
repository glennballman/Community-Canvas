import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { payFolio } from '@/lib/api/folios';
import type { ProposalParticipant } from '@/lib/api/proposals';

interface PayYourSharePanelProps {
  participant: ProposalParticipant;
  proposalId: string;
  onPaymentComplete?: () => void;
}

function formatCurrency(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

export function PayYourSharePanel({ participant, proposalId, onPaymentComplete }: PayYourSharePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const folio = participant.folio;
  const outstandingBalance = folio?.summary?.netBalance || 0;
  
  const [amount, setAmount] = useState((outstandingBalance / 100).toFixed(2));
  
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!folio?.folio_id) throw new Error('No folio ID');
      const amountCents = Math.round(parseFloat(amount) * 100);
      return payFolio(folio.folio_id, { amount_cents: amountCents });
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: 'Payment successful',
          description: `Payment of ${formatCurrency(Math.round(parseFloat(amount) * 100))} processed`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/p2/app/proposals', proposalId] });
        onPaymentComplete?.();
      } else {
        toast({
          title: 'Payment failed',
          description: data.error || 'Unable to process payment',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Payment error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });
  
  if (!folio || outstandingBalance <= 0) {
    return null;
  }
  
  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const isValidAmount = amountCents > 0 && amountCents <= outstandingBalance;
  
  return (
    <Card data-testid="pay-your-share-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Pay Your Share
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Outstanding Balance</span>
            <span className="font-medium" data-testid="pay-outstanding-balance">
              {formatCurrency(outstandingBalance)}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="payment-amount">Payment Amount ($CAD)</Label>
          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            min="0"
            max={(outstandingBalance / 100).toFixed(2)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            data-testid="payment-amount-input"
          />
        </div>
        
        <Button
          className="w-full"
          disabled={!isValidAmount || payMutation.isPending}
          onClick={() => payMutation.mutate()}
          data-testid="pay-now-button"
        >
          {payMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Pay Now (Test)
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground text-center">
          This is a test payment. No real charges will be made.
        </p>
      </CardContent>
    </Card>
  );
}
