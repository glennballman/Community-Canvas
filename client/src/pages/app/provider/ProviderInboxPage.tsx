import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Inbox, Clock, Search, ArrowRight, CheckCircle, 
  AlertCircle, MessageSquare, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  preferred_date: string | null;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  has_active_proposal: boolean;
  created_at: string;
  updated_at: string;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

function RequestActionButtons({ request }: { request: ServiceRequest }) {
  const { primaryAction, secondaryActions, dangerActions } = useMarketActions({
    objectType: 'service_request',
    actorRole: 'provider',
    marketMode: request.market_mode,
    visibility: request.visibility,
    requestStatus: request.status,
    hasTargetProvider: true,
    hasActiveProposal: request.has_active_proposal,
    entryPoint: 'service',
  });

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
      {primaryAction && (
        <Button
          size="sm"
          variant={getButtonVariant(primaryAction.kind)}
          data-testid={`button-${primaryAction.id}-${request.id}`}
        >
          {primaryAction.label}
        </Button>
      )}
      {secondaryActions.slice(0, 1).map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={getButtonVariant(action.kind)}
          data-testid={`button-${action.id}-${request.id}`}
        >
          {action.label}
        </Button>
      ))}
      {dangerActions.slice(0, 1).map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={getButtonVariant(action.kind)}
          data-testid={`button-${action.id}-${request.id}`}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export default function ProviderInboxPage() {
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [search, setSearch] = useState('');
  const { nouns, resolve } = useCopy({ entryPoint: 'service', actorRole: 'provider' });

  const statusLabels = {
    AWAITING_RESPONSE: { label: resolve('ui.status.awaiting'), color: 'bg-yellow-500/20 text-yellow-400', icon: AlertCircle },
    PROPOSED_CHANGE: { label: resolve('ui.status.proposed'), color: 'bg-blue-500/20 text-blue-400', icon: MessageSquare },
    ACCEPTED: { label: resolve('ui.status.accepted'), color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
    DECLINED: { label: resolve('ui.status.declined'), color: 'bg-muted text-muted-foreground', icon: AlertCircle },
    SENT: { label: resolve('ui.status.new'), color: 'bg-purple-500/20 text-purple-400', icon: Inbox },
    UNASSIGNED: { label: resolve('ui.status.unassigned'), color: 'bg-orange-500/20 text-orange-400', icon: AlertCircle },
  } as Record<string, { label: string; color: string; icon: typeof AlertCircle }>;

  const { data, isLoading } = useQuery<{ requests: ServiceRequest[], counts: Record<string, number> }>({
    queryKey: ['/api/provider/inbox', activeTab, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.append('filter', activeTab);
      if (search) params.append('search', search);
      const res = await fetch(`/api/provider/inbox?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const requests = data?.requests || [];
  const counts = data?.counts || {};

  return (
    <div className="flex-1 p-4 space-y-4" data-testid="page-provider-inbox">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            <Inbox className="inline-block w-6 h-6 mr-2 -mt-1" />
            {resolve('ui.inbox.title')}
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="text-page-subtitle">
            {resolve('ui.inbox.subtitle', { request: nouns.request })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={resolve('ui.inbox.search_placeholder', { request: nouns.request })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-container">
        <TabsList className="w-full justify-start flex-wrap gap-1" data-testid="tabs-list">
          <TabsTrigger value="pending" data-testid="tab-pending">
            {resolve('ui.inbox.tab.pending')} {counts.pending ? `(${counts.pending})` : ''}
          </TabsTrigger>
          <TabsTrigger value="proposed" data-testid="tab-proposed">
            {resolve('ui.inbox.tab.proposed')} {counts.proposed ? `(${counts.proposed})` : ''}
          </TabsTrigger>
          <TabsTrigger value="accepted" data-testid="tab-accepted">
            {resolve('ui.inbox.tab.accepted')} {counts.accepted ? `(${counts.accepted})` : ''}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            {resolve('ui.inbox.tab.all')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4" data-testid="tabs-content">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="loading-indicator">
              {resolve('ui.loading')}
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-empty-state">
                  {resolve('ui.inbox.empty', { request: nouns.request })}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2" data-testid="requests-list">
              {requests.map((request) => {
                const statusDisplay = statusLabels[request.status] || statusLabels.SENT;
                const StatusIcon = statusDisplay.icon;
                
                return (
                  <Link key={request.id} to={`/app/provider/requests/${request.id}`} data-testid={`link-request-${request.id}`}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`card-request-${request.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2 rounded-md bg-muted">
                              <StatusIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={statusDisplay.color} data-testid={`badge-status-${request.id}`}>
                                  {statusDisplay.label}
                                </Badge>
                                {request.preferred_date && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-date-${request.id}`}>
                                    <Calendar className="w-3 h-3" />
                                    {new Date(request.preferred_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <p className="font-medium truncate mt-1" data-testid={`text-title-${request.id}`}>
                                {request.title || resolve('ui.untitled', { request: nouns.request })}
                              </p>
                              {request.requester_name && (
                                <p className="text-sm text-muted-foreground truncate" data-testid={`text-requester-${request.id}`}>
                                  {resolve('ui.detail.from')}: {request.requester_name}
                                </p>
                              )}
                              {request.description && (
                                <p className="text-sm text-muted-foreground truncate mt-0.5" data-testid={`text-description-${request.id}`}>
                                  {request.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <RequestActionButtons request={request} />
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span data-testid={`text-time-${request.id}`}>{formatDate(request.created_at)}</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
