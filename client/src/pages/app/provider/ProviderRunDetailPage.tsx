import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useLocation } from 'wouter';
import { 
  ArrowLeft, Clock, MapPin, Calendar, Truck, 
  MessageSquare, FileText, Globe, AlertCircle, Loader2, Plus, Edit2, Reply,
  Check, X, AlertTriangle, MoreHorizontal, CalendarClock, ChevronDown, Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCopy } from '@/copy/useCopy';
import { useToast } from '@/hooks/use-toast';
import { useMarketActions } from '@/policy/useMarketActions';
import { ProposalContextInline } from '@/components/ProposalContextInline';
import type { ActionKind } from '@/policy/marketModePolicy';
import { PublishRunModal } from '@/components/provider/PublishRunModal';
import { AddRequestsModal } from '@/components/provider/AddRequestsModal';
import { StartAddressPickerModal } from '@/components/provider/StartAddressPickerModal';
import { NotifyStakeholdersModal, type PrefillInvitee } from '@/components/provider/NotifyStakeholdersModal';
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

interface StakeholderResponse {
  id: string;
  response_type: 'confirm' | 'request_change' | 'question';
  message: string | null;
  responded_at: string;
  stakeholder_individual_id: string;
  stakeholder_name: string | null;
  stakeholder_email: string | null;
}

interface Resolution {
  id: string;
  response_id: string;
  resolution_type: 'acknowledged' | 'accepted' | 'declined' | 'proposed_change';
  message: string | null;
  resolved_at: string;
  resolver_name: string | null;
}

interface ProposalContext {
  quote_draft_id?: string;
  estimate_id?: string;
  bid_id?: string;
  trip_id?: string;
  selected_scope_option?: string;
}

interface ScheduleProposalEvent {
  id: string;
  run_id: string;
  actor_individual_id: string;
  actor_role: 'tenant' | 'stakeholder';
  event_type: 'proposed' | 'countered' | 'accepted' | 'declined';
  proposed_start: string | null;
  proposed_end: string | null;
  note: string | null;
  proposal_context: ProposalContext | null;
  created_at: string;
  actor_name: string | null;
}

interface ScheduleProposalsPolicy {
  allow_counter: boolean;
  provider_can_initiate: boolean;
  stakeholder_can_initiate: boolean;
  allow_proposal_context: boolean;
}

interface ScheduleProposalsData {
  ok: boolean;
  turn_cap: number;
  policy: ScheduleProposalsPolicy;
  turns_used: number;
  turns_remaining: number;
  is_closed: boolean;
  latest: ScheduleProposalEvent | null;
  events: ScheduleProposalEvent[];
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 ? local[0] + '***' + local.slice(-1) : '***';
  return `${maskedLocal}@${domain}`;
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
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyPrefillInvitees, setNotifyPrefillInvitees] = useState<PrefillInvitee[] | undefined>();
  const [notifyPrefillMessage, setNotifyPrefillMessage] = useState<string | undefined>();
  
  // Schedule Proposal state
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [proposalResponseId, setProposalResponseId] = useState<string | null>(null);
  const [proposedStart, setProposedStart] = useState('');
  const [proposedEnd, setProposedEnd] = useState('');
  const [proposalNote, setProposalNote] = useState('');
  // Proposal context fields (Phase 2C-4)
  const [contextExpanded, setContextExpanded] = useState(false);
  const [contextQuoteDraftId, setContextQuoteDraftId] = useState('');
  const [contextEstimateId, setContextEstimateId] = useState('');
  const [contextBidId, setContextBidId] = useState('');
  const [contextTripId, setContextTripId] = useState('');
  const [contextScopeOption, setContextScopeOption] = useState('');

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

  const { data: responsesData, isLoading: responsesLoading } = useQuery<{
    ok: boolean;
    responses: StakeholderResponse[];
  }>({
    queryKey: ['/api/runs', id, 'responses'],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${id}/responses`);
      if (!res.ok) return { ok: false, responses: [] };
      return res.json();
    },
    enabled: !!id
  });

  const { data: resolutionsData } = useQuery<{
    ok: boolean;
    resolutions: Resolution[];
  }>({
    queryKey: ['/api/runs', id, 'resolutions'],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${id}/resolutions`);
      if (!res.ok) return { ok: false, resolutions: [] };
      return res.json();
    },
    enabled: !!id
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ responseId, resolutionType, message }: { 
      responseId: string; 
      resolutionType: string; 
      message?: string 
    }) => {
      const res = await fetch(`/api/runs/${id}/responses/${responseId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolution_type: resolutionType, message })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resolve');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/runs', id, 'resolutions'] });
      toast({ title: 'Response resolved', description: 'The stakeholder has been notified.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Schedule Proposals query and mutation
  const { data: proposalsData } = useQuery<ScheduleProposalsData>({
    queryKey: ['/api/runs', id, 'schedule-proposals'],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${id}/schedule-proposals`);
      if (!res.ok) return { ok: false, turn_cap: 3, turns_used: 0, turns_remaining: 3, is_closed: false, latest: null, events: [] };
      return res.json();
    },
    enabled: !!id
  });

  const proposalMutation = useMutation({
    mutationFn: async ({ eventType, start, end, note, responseId, proposalContext }: { 
      eventType: 'proposed' | 'countered' | 'accepted' | 'declined';
      start?: string;
      end?: string;
      note?: string;
      responseId?: string;
      proposalContext?: ProposalContext;
    }) => {
      const res = await apiRequest('POST', `/api/runs/${id}/schedule-proposals`, { 
        event_type: eventType, 
        proposed_start: start,
        proposed_end: end,
        note,
        response_id: responseId,
        proposal_context: proposalContext
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/runs', id, 'schedule-proposals'] });
      setProposalDialogOpen(false);
      setProposedStart('');
      setProposedEnd('');
      setProposalNote('');
      setProposalResponseId(null);
      // Reset context fields (Phase 2C-4)
      setContextExpanded(false);
      setContextQuoteDraftId('');
      setContextEstimateId('');
      setContextBidId('');
      setContextTripId('');
      setContextScopeOption('');
      toast({ title: resolve('provider.schedule_proposal.proposed'), description: 'The stakeholder has been notified.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const handleOpenProposalDialog = (responseId: string) => {
    setProposalResponseId(responseId);
    // Set default times (next day, 2-hour window)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const endTime = new Date(tomorrow);
    endTime.setHours(12, 0, 0, 0);
    setProposedStart(tomorrow.toISOString().slice(0, 16));
    setProposedEnd(endTime.toISOString().slice(0, 16));
    setProposalNote('');
    // Reset context fields (Phase 2C-4)
    setContextExpanded(false);
    setContextQuoteDraftId('');
    setContextEstimateId('');
    setContextBidId('');
    setContextTripId('');
    setContextScopeOption('');
    setProposalDialogOpen(true);
  };

  // Build proposal context object if any fields are filled (Phase 2C-4)
  const buildProposalContext = (): ProposalContext | undefined => {
    const context: ProposalContext = {};
    if (contextQuoteDraftId.trim()) context.quote_draft_id = contextQuoteDraftId.trim();
    if (contextEstimateId.trim()) context.estimate_id = contextEstimateId.trim();
    if (contextBidId.trim()) context.bid_id = contextBidId.trim();
    if (contextTripId.trim()) context.trip_id = contextTripId.trim();
    if (contextScopeOption.trim()) context.selected_scope_option = contextScopeOption.trim();
    return Object.keys(context).length > 0 ? context : undefined;
  };

  const handleSubmitProposal = () => {
    if (!proposedStart || !proposedEnd) {
      toast({ title: 'Error', description: 'Please enter start and end times', variant: 'destructive' });
      return;
    }
    proposalMutation.mutate({
      eventType: 'proposed',
      start: proposedStart,
      end: proposedEnd,
      note: proposalNote || undefined,
      responseId: proposalResponseId || undefined,
      proposalContext: buildProposalContext()
    });
  };

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
  const responses = responsesData?.responses || [];
  const resolutions = resolutionsData?.resolutions || [];
  
  // Helper to get resolutions for a specific response
  const getResolutionsForResponse = (responseId: string) => 
    resolutions.filter(r => r.response_id === responseId);
  
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

          <Card data-testid="card-stakeholder-responses">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {resolve('provider.run.responses.title')}
                {responses.length > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-responses-count">
                    {responses.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Feedback from notified stakeholders</CardDescription>
            </CardHeader>
            <CardContent>
              {responsesLoading ? (
                <div className="text-center py-6 text-muted-foreground" data-testid="text-responses-loading">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                  <p>{resolve('provider.run.responses.loading')}</p>
                </div>
              ) : responses.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p data-testid="text-no-responses">{resolve('provider.run.responses.empty')}</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="list-stakeholder-responses">
                  {responses.slice(0, 10).map(resp => {
                    const displayName = resp.stakeholder_name 
                      ? resp.stakeholder_name 
                      : resp.stakeholder_email 
                        ? maskEmail(resp.stakeholder_email)
                        : resolve('provider.run.responses.identity.fallback');
                    
                    const badgeLabel = resp.response_type === 'confirm' 
                      ? resolve('provider.run.responses.badge.confirm')
                      : resp.response_type === 'request_change'
                        ? resolve('provider.run.responses.badge.request_change')
                        : resolve('provider.run.responses.badge.question');
                    
                    const badgeVariant = resp.response_type === 'confirm' 
                      ? 'default' 
                      : resp.response_type === 'question' 
                        ? 'secondary' 
                        : 'outline';
                    
                    const handleReply = () => {
                      if (!resp.stakeholder_email) return;
                      const prefillMsg = resp.response_type === 'confirm'
                        ? resolve('provider.run.responses.reply.prefill.confirm')
                        : resp.response_type === 'request_change'
                          ? resolve('provider.run.responses.reply.prefill.request_change')
                          : resolve('provider.run.responses.reply.prefill.question');
                      setNotifyPrefillInvitees([{ 
                        email: resp.stakeholder_email, 
                        name: resp.stakeholder_name 
                      }]);
                      setNotifyPrefillMessage(prefillMsg);
                      setNotifyModalOpen(true);
                    };
                    
                    const responseResolutions = getResolutionsForResponse(resp.id);
                    const latestResolution = responseResolutions.length > 0 ? responseResolutions[0] : null;
                    
                    const getResolutionBadge = (type: string) => {
                      switch (type) {
                        case 'accepted':
                          return { variant: 'default' as const, className: 'bg-green-500/20 text-green-400', label: resolve('stakeholder_resolution.accepted') };
                        case 'acknowledged':
                          return { variant: 'secondary' as const, className: 'bg-blue-500/20 text-blue-400', label: resolve('stakeholder_resolution.acknowledged') };
                        case 'declined':
                          return { variant: 'destructive' as const, className: 'bg-red-500/20 text-red-400', label: resolve('stakeholder_resolution.declined') };
                        case 'proposed_change':
                          return { variant: 'outline' as const, className: 'bg-orange-500/20 text-orange-400', label: resolve('stakeholder_resolution.proposed_change') };
                        default:
                          return { variant: 'secondary' as const, className: '', label: type };
                      }
                    };
                    
                    return (
                      <div key={resp.id} className="p-3 rounded-md bg-muted/50 space-y-2" data-testid={`response-item-${resp.id}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm" data-testid="text-response-identity">{displayName}</span>
                            <Badge variant={badgeVariant as 'default' | 'secondary' | 'outline'} className="text-xs" data-testid="badge-response-type">
                              {badgeLabel}
                            </Badge>
                            {latestResolution && (
                              <Badge className={`text-xs ${getResolutionBadge(latestResolution.resolution_type).className}`} data-testid="badge-resolution">
                                {getResolutionBadge(latestResolution.resolution_type).label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground" data-testid="text-response-time">
                              {new Date(resp.responded_at).toLocaleDateString('en-CA', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                            {resp.stakeholder_email && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={handleReply}
                                data-testid={`button-reply-${resp.id}`}
                              >
                                <Reply className="w-3 h-3 mr-1" />
                                {resolve('provider.run.responses.reply')}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  disabled={resolveMutation.isPending}
                                  data-testid={`button-resolve-${resp.id}`}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{resolve('stakeholder_resolution.resolve_cta')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => resolveMutation.mutate({ responseId: resp.id, resolutionType: 'accepted' })}
                                  data-testid={`menu-resolve-accept-${resp.id}`}
                                >
                                  <Check className="w-4 h-4 mr-2 text-green-500" />
                                  {resolve('stakeholder_resolution.accepted')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => resolveMutation.mutate({ responseId: resp.id, resolutionType: 'acknowledged' })}
                                  data-testid={`menu-resolve-acknowledge-${resp.id}`}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
                                  {resolve('stakeholder_resolution.acknowledged')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => resolveMutation.mutate({ responseId: resp.id, resolutionType: 'declined' })}
                                  data-testid={`menu-resolve-decline-${resp.id}`}
                                >
                                  <X className="w-4 h-4 mr-2 text-red-500" />
                                  {resolve('stakeholder_resolution.declined')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    resolveMutation.mutate({ responseId: resp.id, resolutionType: 'proposed_change' });
                                    handleOpenProposalDialog(resp.id);
                                  }}
                                  disabled={proposalsData?.is_closed || proposalsData?.turns_remaining === 0}
                                  data-testid={`menu-resolve-propose-change-${resp.id}`}
                                >
                                  <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                                  {resolve('stakeholder_resolution.proposed_change')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {resp.message && (
                          <p className="text-sm text-muted-foreground" data-testid="text-response-message">
                            {resp.message}
                          </p>
                        )}
                        {latestResolution && latestResolution.message && (
                          <div className="text-xs text-muted-foreground mt-1 border-l-2 border-muted pl-2" data-testid="text-resolution-message">
                            <span className="font-medium">{resolve('stakeholder_resolution.resolved_by')}: </span>
                            {latestResolution.resolver_name || 'Provider'}
                            {' — '}{latestResolution.message}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setNotifyModalOpen(true)}
                data-testid="button-notify-stakeholders"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {resolve('provider.run.notify.button')}
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

      <NotifyStakeholdersModal
        open={notifyModalOpen}
        onOpenChange={(v) => {
          setNotifyModalOpen(v);
          if (!v) {
            setNotifyPrefillInvitees(undefined);
            setNotifyPrefillMessage(undefined);
          }
        }}
        runId={id || ''}
        runName={run.title}
        prefillInvitees={notifyPrefillInvitees}
        prefillMessage={notifyPrefillMessage}
      />

      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{resolve('provider.schedule_proposal.title')}</DialogTitle>
            <DialogDescription>
              {proposalsData?.turns_remaining === 0 
                ? resolve('provider.schedule_proposal.turn_cap')
                : proposalsData?.is_closed 
                  ? resolve('provider.schedule_proposal.closed')
                  : `${proposalsData?.turns_remaining || 3} ${proposalsData?.turns_remaining === 1 ? 'proposal' : 'proposals'} remaining`
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Show latest proposal context if present (Phase 2C-5) */}
          {proposalsData?.latest && (
            <div className="mb-4">
              <ProposalContextInline
                mode="provider"
                allow={proposalsData?.policy?.allow_proposal_context ?? false}
                proposalContext={proposalsData.latest.proposal_context}
                density="compact"
              />
            </div>
          )}
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proposed-start">{resolve('provider.schedule_proposal.start_label')}</Label>
              <Input
                id="proposed-start"
                type="datetime-local"
                value={proposedStart}
                onChange={(e) => setProposedStart(e.target.value)}
                data-testid="input-proposal-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposed-end">{resolve('provider.schedule_proposal.end_label')}</Label>
              <Input
                id="proposed-end"
                type="datetime-local"
                value={proposedEnd}
                onChange={(e) => setProposedEnd(e.target.value)}
                data-testid="input-proposal-end"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-note">{resolve('provider.schedule_proposal.note_label')}</Label>
              <Textarea
                id="proposal-note"
                value={proposalNote}
                onChange={(e) => setProposalNote(e.target.value)}
                placeholder="Any additional details..."
                className="resize-none"
                data-testid="input-proposal-note"
              />
            </div>
            
            {/* Proposal Context Section (Phase 2C-4) */}
            {proposalsData?.policy?.allow_proposal_context && (
              <Collapsible open={contextExpanded} onOpenChange={setContextExpanded}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-between gap-2"
                    data-testid="button-toggle-context"
                  >
                    <span className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      {resolve('provider.schedule_proposals.proposal_context.title')}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${contextExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">
                    {resolve('provider.schedule_proposals.proposal_context.help')}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="context-quote-draft" className="text-xs">
                      {resolve('provider.schedule_proposals.proposal_context.quote_draft_id')}
                    </Label>
                    <Input
                      id="context-quote-draft"
                      value={contextQuoteDraftId}
                      onChange={(e) => setContextQuoteDraftId(e.target.value)}
                      placeholder="Optional UUID"
                      className="text-sm"
                      data-testid="input-context-quote-draft-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context-estimate" className="text-xs">
                      {resolve('provider.schedule_proposals.proposal_context.estimate_id')}
                    </Label>
                    <Input
                      id="context-estimate"
                      value={contextEstimateId}
                      onChange={(e) => setContextEstimateId(e.target.value)}
                      placeholder="Optional UUID"
                      className="text-sm"
                      data-testid="input-context-estimate-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context-bid" className="text-xs">
                      {resolve('provider.schedule_proposals.proposal_context.bid_id')}
                    </Label>
                    <Input
                      id="context-bid"
                      value={contextBidId}
                      onChange={(e) => setContextBidId(e.target.value)}
                      placeholder="Optional UUID"
                      className="text-sm"
                      data-testid="input-context-bid-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context-trip" className="text-xs">
                      {resolve('provider.schedule_proposals.proposal_context.trip_id')}
                    </Label>
                    <Input
                      id="context-trip"
                      value={contextTripId}
                      onChange={(e) => setContextTripId(e.target.value)}
                      placeholder="Optional UUID"
                      className="text-sm"
                      data-testid="input-context-trip-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context-scope" className="text-xs">
                      {resolve('provider.schedule_proposals.proposal_context.selected_scope_option')}
                    </Label>
                    <Input
                      id="context-scope"
                      value={contextScopeOption}
                      onChange={(e) => setContextScopeOption(e.target.value)}
                      placeholder="e.g., hybrid, outsourced"
                      className="text-sm"
                      maxLength={64}
                      data-testid="input-context-scope-option"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setProposalDialogOpen(false)}
              data-testid="button-cancel-proposal"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitProposal}
              disabled={proposalMutation.isPending || !proposedStart || !proposedEnd}
              data-testid="button-submit-proposal"
            >
              {proposalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CalendarClock className="w-4 h-4 mr-2" />
              )}
              {resolve('provider.schedule_proposal.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
