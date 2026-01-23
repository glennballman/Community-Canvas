import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useLocation } from 'wouter';
import { 
  ArrowLeft, Clock, MapPin, Calendar, Truck, 
  MessageSquare, FileText, Globe, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCopy } from '@/copy/useCopy';
import { useMarketActions } from '@/policy/useMarketActions';
import type { ActionKind } from '@/policy/marketModePolicy';

function getButtonVariant(kind: ActionKind): 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' {
  switch (kind) {
    case 'primary': return 'default';
    case 'secondary': return 'secondary';
    case 'danger': return 'destructive';
    case 'link': return 'ghost';
    default: return 'outline';
  }
}

interface ServiceRun {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  portal_id: string | null;
  portal_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

interface AttachedRequest {
  id: string;
  title: string;
  status: string;
  requester_name: string | null;
}

interface Publication {
  portal_id: string;
  portal_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function ProviderRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { nouns, resolve } = useCopy({ entryPoint: 'service' });

  const { data, isLoading, error } = useQuery<{ 
    ok: boolean; 
    run: ServiceRun; 
    attached_requests: AttachedRequest[];
    publications: Publication[];
  }>({
    queryKey: ['/api/provider/runs', id],
    queryFn: async () => {
      const response = await fetch(`/api/provider/runs/${id}`);
      if (!response.ok) throw new Error('Failed to fetch run');
      return response.json();
    },
    enabled: !!id
  });

  const { primaryAction, secondaryActions } = useMarketActions({
    objectType: 'service_run',
    actorRole: 'provider',
    marketMode: 'TARGETED',
    visibility: 'PRIVATE'
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !data?.run) {
    return (
      <div className="flex-1 p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">{nouns.run} not found</h2>
            <p className="text-muted-foreground mb-4">The requested {nouns.run} could not be loaded.</p>
            <Button variant="outline" onClick={() => setLocation('/app/provider/runs')}>
              Back to {nouns.run}s
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const run = data.run;
  const attachedRequests = data.attached_requests || [];
  const publications = data.publications || [];

  const formatSchedule = () => {
    if (!run.starts_at) return 'Not scheduled';
    const start = new Date(run.starts_at);
    const dateStr = start.toLocaleDateString('en-CA', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const timeStr = start.toLocaleTimeString('en-CA', { 
      hour: '2-digit', minute: '2-digit' 
    });
    
    if (run.ends_at) {
      const end = new Date(run.ends_at);
      const endTimeStr = end.toLocaleTimeString('en-CA', { 
        hour: '2-digit', minute: '2-digit' 
      });
      return `${dateStr} at ${timeStr} - ${endTimeStr}`;
    }
    return `${dateStr} at ${timeStr}`;
  };

  const statusColor = STATUS_COLORS[run.status] || STATUS_COLORS.scheduled;
  const statusLabel = STATUS_LABELS[run.status] || run.status;

  return (
    <div className="flex-1 p-4 space-y-6" data-testid="page-provider-run-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/app/provider/runs')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={statusColor} data-testid="badge-status">
              {statusLabel}
            </Badge>
          </div>
          <h1 className="text-xl font-bold mt-1" data-testid="text-title">
            {run.title || `Untitled ${nouns.run}`}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{nouns.run} Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span data-testid="text-schedule">{formatSchedule()}</span>
              </div>
              
              {run.zone_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-zone">{run.zone_name}</span>
                </div>
              )}

              <Separator />

              {run.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                  <p className="whitespace-pre-wrap" data-testid="text-description">{run.description}</p>
                </div>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span data-testid="text-created">
                  Created {new Date(run.created_at).toLocaleDateString('en-CA', { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attached {nouns.request}s</CardTitle>
              <CardDescription>{nouns.request}s linked to this {nouns.run}</CardDescription>
            </CardHeader>
            <CardContent>
              {attachedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p data-testid="text-no-requests">No {nouns.request}s attached to this {nouns.run} yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachedRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div>
                        <p className="font-medium">{request.title}</p>
                        <p className="text-sm text-muted-foreground">{request.requester_name}</p>
                      </div>
                      <Badge variant="outline">{request.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Publications</CardTitle>
              <CardDescription>Portals where this {nouns.run} is visible</CardDescription>
            </CardHeader>
            <CardContent>
              {publications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p data-testid="text-no-publications">This {nouns.run} is not published to any portals yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {publications.map(pub => (
                    <div key={pub.portal_id} className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span>{pub.portal_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg" data-testid="label-actions">Actions</CardTitle>
              <CardDescription>Manage this {nouns.run}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                disabled
                data-testid="button-publish-stub"
              >
                <Globe className="w-4 h-4 mr-2" />
                Publish to Portals (Coming Soon)
              </Button>
              
              <Button
                className="w-full"
                variant="outline"
                disabled
                data-testid="button-attach-stub"
              >
                <FileText className="w-4 h-4 mr-2" />
                Attach {nouns.request}s (Coming Soon)
              </Button>

              <Separator />

              <Button asChild variant="ghost" className="w-full">
                <Link href="/app/messages" data-testid="link-view-messages">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  View Messages
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
