import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useLocation } from 'wouter';
import { 
  ArrowLeft, Clock, MapPin, Calendar, Truck, 
  MessageSquare, FileText, Globe, AlertCircle, Loader2, Plus, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCopy } from '@/copy/useCopy';
import { useToast } from '@/hooks/use-toast';
import { useMarketActions } from '@/policy/useMarketActions';
import type { ActionKind } from '@/policy/marketModePolicy';
import { PublishRunModal } from '@/components/provider/PublishRunModal';
import { AddRequestsModal } from '@/components/provider/AddRequestsModal';
import { StartAddressPickerModal } from '@/components/provider/StartAddressPickerModal';
import { apiRequest } from '@/lib/queryClient';

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
  market_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  portal_id: string | null;
  portal_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  start_address_id: string | null;
  start_address_label: string | null;
  start_address_city: string | null;
  start_address_region: string | null;
}

interface AttachedRequest {
  attachment_id: string;
  request_id: string;
  status: 'HELD' | 'COMMITTED';
  held_at: string | null;
  committed_at: string | null;
  released_at: string | null;
  request_summary: {
    summary: string | null;
    description: string | null;
    category: string | null;
    priority: string;
    status: string;
    location_text: string | null;
    created_at: string;
  };
}

interface Publication {
  portal_id: string;
  portal_name: string;
  published_at?: string;
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

function AttachmentItem({ 
  attachment, 
  runId, 
  nouns, 
  resolve 
}: { 
  attachment: AttachedRequest; 
  runId: string; 
  nouns: any; 
  resolve: (key: string) => string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<'commit' | 'release' | null>(null);

  const handleCommit = async () => {
    setLoading('commit');
    try {
      const response = await apiRequest('POST', `/api/provider/runs/${runId}/attachments/commit`, { 
        requestId: attachment.request_id 
      });
      const data = await response.json();
      if (data.ok) {
        toast({ title: resolve('provider.run.attachments.commit_success') });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId] });
      } else {
        toast({ title: 'Error', description: data.message || data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleRelease = async () => {
    setLoading('release');
    try {
      const response = await apiRequest('POST', `/api/provider/runs/${runId}/attachments/release`, { 
        requestId: attachment.request_id 
      });
      const data = await response.json();
      if (data.ok) {
        toast({ title: resolve('provider.run.attachments.release_success') });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId] });
      } else {
        toast({ title: 'Error', description: data.message || data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setLoading(null);
  };

  const summary = attachment.request_summary;
  const isHeld = attachment.status === 'HELD';

  return (
    <div 
      className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
      data-testid={`attachment-${attachment.attachment_id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {summary.summary || `Untitled ${nouns.request}`}
        </p>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          {summary.category && (
            <Badge variant="outline" className="text-xs">{summary.category}</Badge>
          )}
          {summary.location_text && (
            <span className="flex items-center gap-1 text-xs">
              <MapPin className="w-3 h-3" />
              {summary.location_text}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isHeld && (
          <>
            <Button
              size="sm"
              variant="default"
              onClick={handleCommit}
              disabled={loading !== null}
              data-testid={`button-commit-${attachment.request_id}`}
            >
              {loading === 'commit' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                resolve('provider.run.attachments.commit_cta')
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRelease}
              disabled={loading !== null}
              data-testid={`button-release-${attachment.request_id}`}
            >
              {loading === 'release' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                resolve('provider.run.attachments.release_cta')
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProviderRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { nouns, resolve } = useCopy({ entryPoint: 'service' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [addRequestsModalOpen, setAddRequestsModalOpen] = useState(false);
  const [startAddressModalOpen, setStartAddressModalOpen] = useState(false);

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
  
  const heldRequests = attachedRequests.filter(a => a.status === 'HELD');
  const committedRequests = attachedRequests.filter(a => a.status === 'COMMITTED');

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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">Start Location: </span>
                    {run.start_address_label ? (
                      <span data-testid="text-start-address">
                        {run.start_address_label}
                        {run.start_address_city && ` (${run.start_address_city}${run.start_address_region ? `, ${run.start_address_region}` : ''})`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic" data-testid="text-start-address-not-set">Not set</span>
                    )}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setStartAddressModalOpen(true)}
                  data-testid="button-edit-start-address"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Start address is private and helps improve future suggestions.
              </p>

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
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{resolve('provider.run.attachments.title')}</CardTitle>
                <CardDescription>{nouns.request}s linked to this {nouns.run}</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddRequestsModalOpen(true)}
                data-testid="button-add-requests"
              >
                <Plus className="w-4 h-4 mr-1" />
                {resolve('provider.run.attachments.add_cta')}
              </Button>
            </CardHeader>
            <CardContent>
              {attachedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p data-testid="text-no-requests">{resolve('provider.run.attachments.empty')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {heldRequests.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Badge variant="secondary">{resolve('provider.run.attachments.held')}</Badge>
                        <span className="text-xs">({heldRequests.length})</span>
                      </h4>
                      {heldRequests.map(attachment => (
                        <AttachmentItem
                          key={attachment.attachment_id}
                          attachment={attachment}
                          runId={id || ''}
                          nouns={nouns}
                          resolve={resolve}
                        />
                      ))}
                    </div>
                  )}
                  {committedRequests.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Badge variant="default">{resolve('provider.run.attachments.committed')}</Badge>
                        <span className="text-xs">({committedRequests.length})</span>
                      </h4>
                      {committedRequests.map(attachment => (
                        <AttachmentItem
                          key={attachment.attachment_id}
                          attachment={attachment}
                          runId={id || ''}
                          nouns={nouns}
                          resolve={resolve}
                        />
                      ))}
                    </div>
                  )}
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
                onClick={() => setPublishModalOpen(true)}
                data-testid="button-publish"
              >
                <Globe className="w-4 h-4 mr-2" />
                {resolve('provider.run.publish.cta')}
              </Button>
              
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setAddRequestsModalOpen(true)}
                data-testid="button-attach-requests"
              >
                <FileText className="w-4 h-4 mr-2" />
                {resolve('provider.run.attachments.add_cta')}
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

      <PublishRunModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        runId={id || ''}
        currentMarketMode={run.market_mode}
        currentPublications={publications}
      />

      <AddRequestsModal
        open={addRequestsModalOpen}
        onOpenChange={setAddRequestsModalOpen}
        runId={id || ''}
      />

      <StartAddressPickerModal
        open={startAddressModalOpen}
        onOpenChange={setStartAddressModalOpen}
        runId={id || ''}
        currentAddressId={run.start_address_id}
      />
    </div>
  );
}
