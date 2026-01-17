import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, AlertTriangle, Clock, RefreshCw, 
  CheckCircle2, XCircle, User, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface RoutingSummaryContact {
  label: string;
  state: 'contacted' | 'responded' | 'declined' | 'unknown';
  contactedAt: string;
}

interface EmergencyRequestResponse {
  ok: boolean;
  error?: string;
  request: {
    id: string;
    status: 'open' | 'triaging' | 'filled' | 'cancelled';
    role_title_snapshot: string;
    urgency: 'now' | 'today' | 'this_week';
    notes: string | null;
    created_at: string;
    updated_at: string;
    portal_id: string;
    portal_name: string;
    job_title: string | null;
  };
  routingSummary: {
    contactedCount: number;
    contacted: RoutingSummaryContact[];
  };
}

const STATUS_CONFIG = {
  open: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: Clock,
    description: 'Your request is being reviewed by the coordinator.'
  },
  triaging: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: RefreshCw,
    description: 'A coordinator is actively finding candidates.'
  },
  filled: {
    label: 'Filled',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: CheckCircle2,
    description: 'A replacement has been assigned.'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    icon: XCircle,
    description: 'This request was cancelled.'
  }
};

const URGENCY_LABELS = {
  now: 'Immediate',
  today: 'Today',
  this_week: 'This Week'
};

export default function JobEmergencyConfirmationPage() {
  const { jobId, requestId } = useParams<{ jobId: string; requestId: string }>();

  const { data, isLoading, error, refetch } = useQuery<EmergencyRequestResponse>({
    queryKey: ['/api/p2/app/jobs', jobId, 'emergency-replacement-request', requestId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/jobs/${jobId}/emergency-replacement-request/${requestId}`);
      if (!res.ok) throw new Error('Failed to fetch request');
      return res.json();
    },
    enabled: !!jobId && !!requestId,
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="page-emergency-confirmation-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="p-6" data-testid="page-emergency-confirmation-error">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Failed to load request. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const request = data.request;
  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto" data-testid="page-emergency-confirmation">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild data-testid="button-back-to-applications">
          <Link to={`/app/jobs/${jobId}/applications`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Applications
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold">Emergency Replacement Request</h1>
          <p className="text-sm text-muted-foreground">
            {request.role_title_snapshot}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusIcon className="h-6 w-6" />
              <div>
                <CardTitle className="text-lg">Request Status</CardTitle>
                <CardDescription>{statusConfig.description}</CardDescription>
              </div>
            </div>
            <Badge className={statusConfig.color} data-testid="badge-request-status">
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Urgency</p>
              <p className="font-medium" data-testid="text-urgency">{URGENCY_LABELS[request.urgency]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Portal</p>
              <p className="font-medium flex items-center gap-1 flex-wrap" data-testid="text-portal">
                <Building2 className="h-3 w-3" />
                {request.portal_name}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Submitted</p>
              <p className="font-medium" data-testid="text-submitted">
                {new Date(request.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium" data-testid="text-updated">
                {new Date(request.updated_at).toLocaleString()}
              </p>
            </div>
          </div>

          {request.notes && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm mb-1">Notes</p>
                <p className="text-sm">{request.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {data.routingSummary && data.routingSummary.contactedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              <User className="h-5 w-5" />
              Candidates Contacted ({data.routingSummary.contactedCount})
            </CardTitle>
            <CardDescription>
              Candidate details are managed by the portal coordinator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.routingSummary.contacted.map((contact, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 flex-wrap"
                  data-testid={`row-routing-${idx}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" data-testid={`text-candidate-${idx}`}>{contact.label}</span>
                    <Badge 
                      variant={contact.state === 'responded' ? 'default' : contact.state === 'declined' ? 'destructive' : 'secondary'}
                      data-testid={`badge-state-${idx}`}
                    >
                      {contact.state}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(contact.contactedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            A coordinator will respond quickly. This page refreshes automatically every 30 seconds.
          </p>
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-refresh-status"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
