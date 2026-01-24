/**
 * STEP 11C: Public Invitation Claim Page
 * 
 * Read-only view for stakeholders to see service run context.
 * Token-based access, no authentication required.
 */

import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, AlertCircle, ExternalLink, Hourglass, Timer } from 'lucide-react';
import { format } from 'date-fns';

interface InvitationResponse {
  ok: boolean;
  error?: string;
  invitation?: {
    status: string;
    invitee_name: string | null;
    invitee_email_masked: string;
    expires_at: string | null;
    message: string | null;
  };
  run?: {
    id: string;
    name: string;
    starts_at: string | null;
    ends_at: string | null;
    market_mode: string | null;
  } | null;
  copy?: {
    title: string;
    disclaimer: string;
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'viewed':
      return <Badge variant="secondary" data-testid="badge-status-viewed"><Eye className="w-3 h-3 mr-1" />Viewed</Badge>;
    case 'claimed':
      return <Badge variant="default" data-testid="badge-status-claimed">Claimed</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-default">{status}</Badge>;
  }
}

export default function InvitationClaimPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<InvitationResponse>({
    queryKey: ['/api/i', token],
    queryFn: async () => {
      const res = await fetch(`/api/i/${token}`);
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="invitation-loading">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="invitation-error">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please contact the service provider to request a new invitation.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/'} data-testid="button-go-home">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation, run, copy } = data;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="invitation-page">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-xl">{copy?.title || 'Service Run Invitation'}</CardTitle>
            <Badge variant="outline" className="text-xs" data-testid="badge-read-only">
              <Eye className="w-3 h-3 mr-1" />
              Read-only
            </Badge>
          </div>
          {copy?.disclaimer && (
            <CardDescription>{copy.disclaimer}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {invitation && (
            <div className="space-y-3" data-testid="invitation-info">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(invitation.status)}
              </div>
              {invitation.invitee_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invited as</span>
                  <span className="text-sm font-medium">{invitation.invitee_name}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-mono">{invitation.invitee_email_masked}</span>
              </div>
              {invitation.expires_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="text-sm">{format(new Date(invitation.expires_at), 'MMM d, yyyy')}</span>
                </div>
              )}
              {invitation.message && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Message from provider:</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{invitation.message}</p>
                </div>
              )}
            </div>
          )}

          {run && (
            <div className="border-t pt-4 space-y-3" data-testid="run-info">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Service Run Details</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{run.name}</span>
                </div>
                {run.starts_at && (
                  <div className="flex items-center gap-2">
                    <Hourglass className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(run.starts_at), 'MMM d, yyyy')}
                      {run.ends_at && run.ends_at !== run.starts_at && (
                        <> - {format(new Date(run.ends_at), 'MMM d, yyyy')}</>
                      )}
                    </span>
                  </div>
                )}
                {run.starts_at && (
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{format(new Date(run.starts_at), 'h:mm a')}</span>
                  </div>
                )}
                {run.market_mode && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{run.market_mode}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
