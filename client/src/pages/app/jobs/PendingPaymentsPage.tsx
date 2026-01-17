import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, ArrowLeft, Clock, DollarSign, ExternalLink, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface PendingIntent {
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
  portal_name?: string;
}

interface PendingIntentsResponse {
  ok: boolean;
  intents: PendingIntent[];
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

export default function PendingPaymentsPage() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<PendingIntentsResponse>({
    queryKey: ['/api/p2/app/jobs/payments/pending'],
  });

  const intents = data?.intents || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-pending-payments">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/jobs')} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Pending Payments</h1>
        </div>
      </div>

      <p className="text-muted-foreground">
        Job postings awaiting payment confirmation before they can be published.
      </p>

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
            <p className="text-muted-foreground mb-4">
              All your paid job postings have been processed.
            </p>
            <Button onClick={() => navigate('/app/jobs')} data-testid="button-view-jobs">
              View Jobs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {intents.map(intent => (
            <Card key={intent.intent_id} data-testid={`intent-${intent.intent_id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {intent.job_title || 'Untitled Job'}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          Pending Payment
                        </Badge>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatPrice(intent.amount_cents, intent.currency)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Created {new Date(intent.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/app/jobs/${intent.job_id}/destinations`)}
                    data-testid={`button-view-${intent.intent_id}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p>
          <strong>How it works:</strong> Once you submit a job to a paid portal, our team will 
          process your payment and publish your listing. You'll receive a notification when 
          your job goes live.
        </p>
      </div>
    </div>
  );
}
