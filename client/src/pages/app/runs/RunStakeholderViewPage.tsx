import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { 
  ArrowLeft, Clock, MapPin, Calendar, CheckCircle, AlertCircle, Loader2,
  Bell, Building2, User, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCopy } from '@/copy/useCopy';

interface StakeholderRunView {
  id: string;
  name: string;
  market_mode: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_end_time: string | null;
  run_date: string | null;
  status: string | null;
  publishing_state: string | null;
  zone_name: string | null;
  tenant_name: string | null;
}

interface AccessInfo {
  type: 'stakeholder' | 'tenant_owner';
  stakeholder_role: string | null;
  granted_at: string | null;
}

interface StakeholderViewResponse {
  ok: boolean;
  run: StakeholderRunView;
  access: AccessInfo;
  error?: string;
}

function formatRole(role: string | null): string {
  if (!role) return 'Stakeholder';
  return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'completed':
      return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200" data-testid="badge-status-completed"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
    case 'cancelled':
      return <Badge variant="destructive" data-testid="badge-status-cancelled">Cancelled</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200" data-testid="badge-status-in-progress"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-default">{status || 'Scheduled'}</Badge>;
  }
}

export default function RunStakeholderViewPage() {
  const { id } = useParams<{ id: string }>();
  const { resolve } = useCopy({ entryPoint: 'service' });

  const { data, isLoading, error } = useQuery<StakeholderViewResponse>({
    queryKey: [`/api/runs/${id}/view`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-stakeholder-view">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" data-testid="error-stakeholder-view">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have access to this service run. The invitation may have been revoked or expired.
        </p>
        <Button variant="outline" asChild data-testid="button-back-notifications">
          <Link href="/app/notifications">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Notifications
          </Link>
        </Button>
      </div>
    );
  }

  const { run, access } = data;

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4" data-testid="stakeholder-run-view">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild data-testid="button-back">
          <Link href="/app/notifications">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="run-name">{run.name}</h1>
          <p className="text-muted-foreground text-sm" data-testid="run-tenant">
            <Building2 className="w-3 h-3 inline mr-1" />
            {run.tenant_name || 'Service Provider'}
          </p>
        </div>
        {getStatusBadge(run.status)}
      </div>

      <Card className="mb-6" data-testid="card-access-info">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Your Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm" data-testid="access-role">
                You have access as: <strong>{formatRole(access.stakeholder_role)}</strong>
              </span>
            </div>
            {access.granted_at && (
              <Badge variant="outline" className="text-xs" data-testid="access-granted-date">
                Granted {new Date(access.granted_at).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6" data-testid="card-run-details">
        <CardHeader>
          <CardTitle className="text-base">Service Run Details</CardTitle>
          <CardDescription>
            Information about this scheduled service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {run.scheduled_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Scheduled Date</p>
                  <p className="text-sm text-muted-foreground" data-testid="scheduled-date">
                    {new Date(run.scheduled_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            
            {run.scheduled_time && (
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-sm text-muted-foreground" data-testid="scheduled-time">
                    {run.scheduled_time}
                    {run.scheduled_end_time && ` - ${run.scheduled_end_time}`}
                  </p>
                </div>
              </div>
            )}

            {run.zone_name && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground" data-testid="zone-name">
                    {run.zone_name}
                  </p>
                </div>
              </div>
            )}

            {run.market_mode && (
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Type</p>
                  <Badge variant="outline" className="mt-1" data-testid="market-mode">
                    {run.market_mode.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {run.publishing_state && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Publishing Status:</span>
                <Badge variant="secondary" data-testid="publishing-state">
                  {run.publishing_state}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" asChild data-testid="button-back-notifications-bottom">
          <Link href="/app/notifications">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Notifications
          </Link>
        </Button>
      </div>
    </div>
  );
}
