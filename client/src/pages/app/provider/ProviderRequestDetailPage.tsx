import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, MapPin, Calendar, User, Check, 
  X, MessageSquare, AlertTriangle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { useMarketActions } from '@/policy/useMarketActions';
import type { ServiceRequestStatus, MarketMode, VisibilityScope, ActionKind } from '@/policy/marketModePolicy';

function getButtonVariant(kind: ActionKind): 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' {
  switch (kind) {
    case 'primary': return 'default';
    case 'secondary': return 'secondary';
    case 'danger': return 'destructive';
    case 'link': return 'ghost';
    default: return 'outline';
  }
}

interface ServiceRequest {
  id: string;
  status: ServiceRequestStatus;
  market_mode: MarketMode;
  visibility: VisibilityScope;
  title: string;
  description: string | null;
  requester_name: string | null;
  requester_email: string | null;
  preferred_date: string | null;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  location_text: string | null;
  has_active_proposal: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  AWAITING_RESPONSE: 'bg-yellow-500/20 text-yellow-400',
  PROPOSED_CHANGE: 'bg-blue-500/20 text-blue-400',
  ACCEPTED: 'bg-green-500/20 text-green-400',
  DECLINED: 'bg-muted text-muted-foreground',
  SENT: 'bg-purple-500/20 text-purple-400',
  UNASSIGNED: 'bg-orange-500/20 text-orange-400',
};

export default function ProviderRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { nouns, messages, resolve } = useCopy({ entryPoint: 'service', actorRole: 'provider' });

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [proposeDialogOpen, setProposeDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);

  const [proposedDate, setProposedDate] = useState('');
  const [proposedTimeStart, setProposedTimeStart] = useState('');
  const [proposedTimeEnd, setProposedTimeEnd] = useState('');
  const [proposalNote, setProposalNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  const { data: request, isLoading } = useQuery<ServiceRequest>({
    queryKey: ['/api/provider/requests', id],
    queryFn: async () => {
      const res = await fetch(`/api/provider/requests/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return data.request;
    },
    enabled: !!id,
  });

  const { primaryAction, secondaryActions, dangerActions, hasAction, getAction } = useMarketActions({
    objectType: 'service_request',
    actorRole: 'provider',
    marketMode: request?.market_mode ?? 'TARGETED',
    visibility: request?.visibility ?? 'PRIVATE',
    requestStatus: request?.status ?? 'AWAITING_RESPONSE',
    hasTargetProvider: true,
    hasActiveProposal: request?.has_active_proposal ?? false,
    entryPoint: 'service',
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/provider/requests/${id}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider/requests', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider/inbox'] });
      toast({ title: resolve('ui.toast.accepted.title'), description: messages().requestAccepted.body });
      setAcceptDialogOpen(false);
    },
    onError: () => {
      toast({ title: resolve('ui.toast.error.title'), description: resolve('ui.toast.error.accept', { request: nouns.request }), variant: 'destructive' });
    }
  });

  const proposeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/provider/requests/${id}/propose`, {
        proposed_date: proposedDate || null,
        proposed_time_start: proposedTimeStart || null,
        proposed_time_end: proposedTimeEnd || null,
        note: proposalNote || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider/requests', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider/inbox'] });
      toast({ title: resolve('ui.toast.proposal_sent.title'), description: messages().proposalCreated.body });
      setProposeDialogOpen(false);
      setProposedDate('');
      setProposedTimeStart('');
      setProposedTimeEnd('');
      setProposalNote('');
    },
    onError: () => {
      toast({ title: resolve('ui.toast.error.title'), description: resolve('ui.toast.error.propose'), variant: 'destructive' });
    }
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/provider/requests/${id}/decline`, {
        reason: declineReason || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider/requests', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider/inbox'] });
      toast({ title: resolve('ui.toast.declined.title'), description: messages().requestDeclined.body });
      setDeclineDialogOpen(false);
      setDeclineReason('');
      navigate('/app/provider/inbox');
    },
    onError: () => {
      toast({ title: resolve('ui.toast.error.title'), description: resolve('ui.toast.error.decline', { request: nouns.request }), variant: 'destructive' });
    }
  });

  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'accept_request':
        setAcceptDialogOpen(true);
        break;
      case 'propose_change':
        if (request?.preferred_date) setProposedDate(request.preferred_date);
        if (request?.preferred_time_start) setProposedTimeStart(request.preferred_time_start);
        if (request?.preferred_time_end) setProposedTimeEnd(request.preferred_time_end);
        setProposeDialogOpen(true);
        break;
      case 'decline_request':
        setDeclineDialogOpen(true);
        break;
    }
  };

  if (isLoading) {
    return <div className="flex-1 p-4 text-center text-muted-foreground" data-testid="loading">{resolve('ui.loading')}</div>;
  }

  if (!request) {
    return <div className="flex-1 p-4 text-center text-muted-foreground" data-testid="not-found">{resolve('ui.not_found', { request: nouns.request })}</div>;
  }

  const statusLabels: Record<string, string> = {
    AWAITING_RESPONSE: resolve('ui.status.awaiting'),
    PROPOSED_CHANGE: resolve('ui.status.proposed'),
    ACCEPTED: resolve('ui.status.accepted'),
    DECLINED: resolve('ui.status.declined'),
    SENT: resolve('ui.status.new'),
    UNASSIGNED: resolve('ui.status.unassigned'),
  };
  const statusColor = STATUS_COLORS[request.status] || STATUS_COLORS.SENT;
  const statusLabel = statusLabels[request.status] || statusLabels.SENT;

  return (
    <div className="flex-1 p-4 space-y-6" data-testid="page-provider-request-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/provider/inbox')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={statusColor} data-testid="badge-status">
              {statusLabel}
            </Badge>
          </div>
          <h1 className="text-xl font-bold mt-1" data-testid="text-title">
            {request.title || resolve('ui.untitled', { request: nouns.request })}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{nouns.request} Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.requester_name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-requester">{request.requester_name}</span>
                </div>
              )}
              
              {request.preferred_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-date">
                    {new Date(request.preferred_date).toLocaleDateString('en-CA', { 
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    })}
                    {request.preferred_time_start && ` at ${request.preferred_time_start}`}
                    {request.preferred_time_end && ` - ${request.preferred_time_end}`}
                  </span>
                </div>
              )}

              {request.location_text && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-location">{request.location_text}</span>
                </div>
              )}

              <Separator />

              {request.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2" data-testid="label-description">{resolve('ui.detail.description')}</p>
                  <p className="whitespace-pre-wrap" data-testid="text-description">{request.description}</p>
                </div>
              )}

              {request.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2" data-testid="label-notes">{resolve('ui.detail.notes')}</p>
                  <p className="whitespace-pre-wrap" data-testid="text-notes">{request.notes}</p>
                </div>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span data-testid="text-created">
                  Received {new Date(request.created_at).toLocaleDateString('en-CA', { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg" data-testid="label-actions">{resolve('ui.detail.actions')}</CardTitle>
              <CardDescription data-testid="text-respond">{resolve('ui.detail.respond', { request: nouns.request })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {primaryAction && (
                <Button
                  className="w-full"
                  variant={getButtonVariant(primaryAction.kind)}
                  onClick={() => handleActionClick(primaryAction.id)}
                  data-testid="button-accept"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {primaryAction.label}
                </Button>
              )}
              
              {secondaryActions.map((action) => (
                <Button
                  key={action.id}
                  className="w-full"
                  variant={getButtonVariant(action.kind)}
                  onClick={() => handleActionClick(action.id)}
                  data-testid="button-propose-change"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {action.label}
                </Button>
              ))}
              
              {dangerActions.map((action) => (
                <Button
                  key={action.id}
                  className="w-full"
                  variant={getButtonVariant(action.kind)}
                  onClick={() => handleActionClick(action.id)}
                  data-testid="button-decline"
                >
                  <X className="w-4 h-4 mr-2" />
                  {action.label}
                </Button>
              ))}

              {!primaryAction && !secondaryActions.length && !dangerActions.length && (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-actions">
                  {resolve('ui.no_actions', { request: nouns.request })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent data-testid="dialog-accept">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-accept-title">{resolve('ui.modal.accept.title', { request: nouns.request })}</AlertDialogTitle>
            <AlertDialogDescription data-testid="dialog-accept-description">
              {resolve('ui.modal.accept.description', { request: nouns.request })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-accept-cancel">{resolve('ui.button.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => acceptMutation.mutate()} 
              disabled={acceptMutation.isPending}
              data-testid="button-accept-confirm"
            >
              {acceptMutation.isPending ? resolve('ui.button.accepting') : resolve('ui.button.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={proposeDialogOpen} onOpenChange={setProposeDialogOpen}>
        <DialogContent data-testid="dialog-propose">
          <DialogHeader>
            <DialogTitle data-testid="dialog-propose-title">{resolve('ui.modal.propose.title')}</DialogTitle>
            <DialogDescription data-testid="dialog-propose-description">
              {resolve('ui.modal.propose.description', { request: nouns.request })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proposed-date" data-testid="label-proposed-date">{resolve('ui.label.proposed_date')}</Label>
              <Input
                id="proposed-date"
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                data-testid="input-proposed-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proposed-time-start" data-testid="label-time-start">{resolve('ui.label.start_time')}</Label>
                <Input
                  id="proposed-time-start"
                  type="time"
                  value={proposedTimeStart}
                  onChange={(e) => setProposedTimeStart(e.target.value)}
                  data-testid="input-proposed-time-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposed-time-end" data-testid="label-time-end">{resolve('ui.label.end_time')}</Label>
                <Input
                  id="proposed-time-end"
                  type="time"
                  value={proposedTimeEnd}
                  onChange={(e) => setProposedTimeEnd(e.target.value)}
                  data-testid="input-proposed-time-end"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-note" data-testid="label-message">{resolve('ui.label.message')}</Label>
              <Textarea
                id="proposal-note"
                placeholder={resolve('ui.placeholder.propose_reason')}
                value={proposalNote}
                onChange={(e) => setProposalNote(e.target.value)}
                rows={3}
                data-testid="textarea-proposal-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposeDialogOpen(false)} data-testid="button-propose-cancel">
              {resolve('ui.button.cancel')}
            </Button>
            <Button 
              onClick={() => proposeMutation.mutate()} 
              disabled={proposeMutation.isPending || (!proposedDate && !proposedTimeStart)}
              data-testid="button-propose-submit"
            >
              {proposeMutation.isPending ? resolve('ui.button.sending') : resolve('ui.button.send_proposal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent data-testid="dialog-decline">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-decline-title">{resolve('ui.modal.decline.title', { request: nouns.request })}</AlertDialogTitle>
            <AlertDialogDescription data-testid="dialog-decline-description">
              {resolve('ui.modal.decline.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="decline-reason" data-testid="label-decline-reason">{resolve('ui.modal.decline.reason')}</Label>
            <Textarea
              id="decline-reason"
              placeholder={resolve('ui.placeholder.decline_reason')}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="mt-2"
              data-testid="textarea-decline-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-decline-cancel">{resolve('ui.button.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => declineMutation.mutate()} 
              disabled={declineMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-decline-confirm"
            >
              {declineMutation.isPending ? resolve('ui.button.declining') : resolve('cta.request.decline')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
