import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, Check, Clock, DollarSign, Briefcase, Building2, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { markIntentPaid } from '@/lib/api/jobs';

interface PaidPublicationIntent {
  intent_id: string;
  job_id: string;
  portal_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  job_title: string;
  brand_name_snapshot: string | null;
  tenant_name: string | null;
}

interface PendingIntentsResponse {
  ok: boolean;
  intents: PaidPublicationIntent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

export default function PaidPublicationsModerationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [markPaidModal, setMarkPaidModal] = useState<{ open: boolean; intent?: PaidPublicationIntent }>({ open: false });
  const [pspReference, setPspReference] = useState('');

  const { data, isLoading, error } = useQuery<PendingIntentsResponse>({
    queryKey: ['/api/p2/app/mod/paid-publications/pending'],
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ intentId, pspReference }: { intentId: string; pspReference?: string }) => {
      return markIntentPaid(intentId, 'manual', pspReference);
    },
    onSuccess: () => {
      toast({ title: 'Payment confirmed and job published' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/paid-publications/pending'] });
      setMarkPaidModal({ open: false });
      setPspReference('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleMarkPaid = () => {
    if (markPaidModal.intent) {
      markPaidMutation.mutate({
        intentId: markPaidModal.intent.intent_id,
        pspReference: pspReference || undefined
      });
    }
  };

  const intents = data?.intents || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-paid-publications-moderation">
      <div className="flex items-center gap-3">
        <CreditCard className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Paid Publications</h1>
          <p className="text-sm text-muted-foreground">
            Confirm payments and publish paid job listings
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load pending payments. Please try again.
          </CardContent>
        </Card>
      ) : intents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No pending payments</h3>
            <p className="text-muted-foreground">
              All paid publication requests have been processed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {intents.map(intent => (
            <Card key={intent.intent_id} data-testid={`intent-${intent.intent_id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">{intent.job_title || 'Untitled Job'}</h3>
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending Payment
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {intent.brand_name_snapshot || intent.tenant_name || 'Unknown employer'}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatPrice(intent.amount_cents, intent.currency)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(intent.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setMarkPaidModal({ open: true, intent })}
                    data-testid={`button-mark-paid-${intent.intent_id}`}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark Paid & Publish
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={markPaidModal.open} onOpenChange={(open) => setMarkPaidModal({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Confirm Payment
            </DialogTitle>
            <DialogDescription>
              Confirm that payment has been received for this job posting.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {markPaidModal.intent && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Job</span>
                  <span className="font-medium">{markPaidModal.intent.job_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {formatPrice(markPaidModal.intent.amount_cents, markPaidModal.intent.currency)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference (optional)</Label>
              <Input
                id="reference"
                value={pspReference}
                onChange={e => setPspReference(e.target.value)}
                placeholder="e.g. Transaction ID, receipt number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidModal({ open: false })}>
              Cancel
            </Button>
            <Button 
              onClick={handleMarkPaid}
              disabled={markPaidMutation.isPending}
              data-testid="button-confirm-mark-paid"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
