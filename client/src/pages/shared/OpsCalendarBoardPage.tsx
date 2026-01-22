import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import ScheduleBoard, { 
  Resource, 
  ScheduleEvent, 
  ZoomLevel, 
  ZOOM_CONFIGS,
  snapTo15Min 
} from '@/components/schedule/ScheduleBoard';
import type { CalendarRunDTO } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { MessageCircle, Camera, ExternalLink, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { PortalConditionsBar } from '@/components/portal/PortalConditionsBar';
import { useToast } from '@/hooks/use-toast';

export type OpsCalendarMode = 'contractor' | 'resident' | 'portal';

interface OpsCalendarBoardPageProps {
  mode: OpsCalendarMode;
}

interface OpsCalendarResponse {
  resources: Resource[];
  events: ScheduleEvent[];
  meta: {
    count: number;
    startDate: string;
    endDate: string;
  };
}

interface LegacyCalendarResponse {
  runs: CalendarRunDTO[];
  portal?: { id: string; name: string };
  meta: {
    count: number;
    startDate: string;
    endDate: string;
  };
}

function adaptRunsToScheduleBoard(runs: CalendarRunDTO[]): { resources: Resource[]; events: ScheduleEvent[] } {
  const resourceMap = new Map<string, Resource>();
  const events: ScheduleEvent[] = [];
  
  runs.forEach((run, index) => {
    const resourceId = `run-${run.runId}`;
    
    if (!resourceMap.has(resourceId)) {
      resourceMap.set(resourceId, {
        id: resourceId,
        name: run.title,
        asset_type: 'service_run',
        status: run.status,
      });
    }
    
    if (run.startAt) {
      events.push({
        id: `event-${run.runId}-${index}`,
        resource_id: resourceId,
        event_type: run.status === 'completed' ? 'reservation' : 
                   run.status === 'in_progress' ? 'hold' : 
                   run.status === 'draft' ? 'buffer' : 'reserved',
        start_date: run.startAt,
        end_date: run.endAt || new Date(new Date(run.startAt).getTime() + 3600000).toISOString(),
        status: run.status,
        title: run.title,
        is_reservation: true,
      });
    }
  });
  
  return {
    resources: Array.from(resourceMap.values()),
    events,
  };
}

function groupResourcesByType(resources: Resource[]): Record<string, Resource[]> {
  const grouped: Record<string, Resource[]> = {};
  
  resources.forEach(resource => {
    const type = resource.asset_type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(resource);
  });
  
  return grouped;
}

export default function OpsCalendarBoardPage({ mode }: OpsCalendarBoardPageProps) {
  const { portalSlug } = useParams<{ portalSlug: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const from = new Date(now);
    const to = new Date(now);
    to.setDate(to.getDate() + 1);
    return { from, to };
  });
  
  // Selected event for detail panel
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  
  // Mutation to create/get thread for a run
  const ensureThreadMutation = useMutation({
    mutationFn: async (runId: string) => {
      const response = await apiRequest('POST', `/api/contractor/n3/runs/${runId}/ensure-thread`);
      return response.json();
    },
    onSuccess: (data: { ok: boolean; threadId: string }) => {
      if (data.ok && data.threadId) {
        toast({
          title: "Thread opened",
          description: "Navigating to conversation...",
        });
        setLocation(`/app/messages/${data.threadId}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to open thread",
        description: error.message || "Could not create conversation thread",
        variant: "destructive",
      });
    },
  });

  const { data: portalData } = useQuery<{ id: string; name: string; slug: string }>({
    queryKey: ['/api/public/portal', portalSlug],
    enabled: mode === 'portal' && !!portalSlug,
  });

  const getApiEndpoint = useCallback(() => {
    const fromStr = dateRange.from.toISOString();
    const toStr = dateRange.to.toISOString();
    
    switch (mode) {
      case 'contractor':
        return `/api/contractor/ops-calendar?startDate=${fromStr}&endDate=${toStr}`;
      case 'resident':
        return `/api/resident/ops-calendar?startDate=${fromStr}&endDate=${toStr}`;
      case 'portal':
        if (!portalData?.id) return null;
        return `/api/portal/${portalData.id}/ops-calendar?startDate=${fromStr}&endDate=${toStr}`;
      default:
        return null;
    }
  }, [mode, dateRange, portalData?.id]);

  const getLegacyApiEndpoint = useCallback(() => {
    const fromStr = dateRange.from.toISOString();
    const toStr = dateRange.to.toISOString();
    
    switch (mode) {
      case 'contractor':
        return `/api/contractor/calendar?startDate=${fromStr}&endDate=${toStr}`;
      case 'resident':
        return `/api/resident/calendar?startDate=${fromStr}&endDate=${toStr}`;
      case 'portal':
        if (!portalData?.id) return null;
        return `/api/portal/${portalData.id}/calendar?startDate=${fromStr}&endDate=${toStr}`;
      default:
        return null;
    }
  }, [mode, dateRange, portalData?.id]);

  const apiEndpoint = getApiEndpoint();
  const legacyApiEndpoint = getLegacyApiEndpoint();

  const { data: opsData, isLoading: opsLoading, error: opsError } = useQuery<OpsCalendarResponse>({
    queryKey: [apiEndpoint],
    enabled: !!apiEndpoint,
    retry: false,
  });

  const { data: legacyData, isLoading: legacyLoading, error: legacyError } = useQuery<LegacyCalendarResponse>({
    queryKey: [legacyApiEndpoint, 'legacy'],
    enabled: !!legacyApiEndpoint && !opsData && !!opsError,
    retry: false,
  });

  const { resources, events, isLoading, error } = useMemo(() => {
    if (opsData) {
      return {
        resources: opsData.resources,
        events: opsData.events,
        isLoading: opsLoading,
        error: opsError,
      };
    }
    
    if (legacyData?.runs) {
      const adapted = adaptRunsToScheduleBoard(legacyData.runs);
      return {
        resources: adapted.resources,
        events: adapted.events,
        isLoading: legacyLoading,
        error: legacyError,
      };
    }
    
    return {
      resources: [] as Resource[],
      events: [] as ScheduleEvent[],
      isLoading: opsLoading || legacyLoading,
      error: opsError || legacyError,
    };
  }, [opsData, legacyData, opsLoading, legacyLoading, opsError, legacyError]);

  const groupedResources = useMemo(() => groupResourcesByType(resources), [resources]);
  const assetTypes = useMemo(() => Object.keys(groupedResources), [groupedResources]);

  const handleRangeChange = useCallback((from: Date, to: Date, zoom: ZoomLevel) => {
    setDateRange({ from, to });
  }, []);

  const handleEventClick = useCallback((event: ScheduleEvent) => {
    console.log('[OpsCalendar] Event clicked:', event);
    setSelectedEvent(event);
  }, []);
  
  // Extract run ID from event - check meta.runId first, then fall back to ID parsing
  const getRunIdFromEvent = (event: ScheduleEvent): string | null => {
    // Prefer explicit runId from meta (most reliable)
    const meta = (event as any).meta;
    if (meta?.runId) return meta.runId;
    
    // Fall back to resource_id parsing (run-{runId} format)
    if (event.resource_id?.startsWith('run-')) {
      return event.resource_id.slice(4);
    }
    
    // Last resort: parse event ID (event-{runId}-{index} format from legacy adapter)
    const match = event.id.match(/^event-([a-f0-9-]+)-\d+$/);
    return match ? match[1] : null;
  };
  
  // Handle opening thread for a run event
  const handleOpenThread = useCallback((event: ScheduleEvent) => {
    const runId = getRunIdFromEvent(event);
    if (runId) {
      ensureThreadMutation.mutate(runId);
    }
  }, [ensureThreadMutation]);
  
  // Handle navigating to run details
  const handleViewRunDetails = useCallback((event: ScheduleEvent) => {
    const runId = getRunIdFromEvent(event);
    if (runId) {
      setLocation(`/app/n3/runs/${runId}`);
    }
  }, [setLocation]);
  
  // Get evidence status from event meta
  const getEvidenceStatus = (event: ScheduleEvent): 'none' | 'partial' | 'complete' | 'confirmed' => {
    return (event as any).meta?.evidence?.status || 'none';
  };
  
  // Get feasibility status from event meta
  const getFeasibilityStatus = (event: ScheduleEvent): 'ok' | 'risky' | 'blocked' => {
    return (event as any).meta?.feasibility?.status || 'ok';
  };

  const getTitle = () => {
    switch (mode) {
      case 'contractor':
        return 'Service Calendar';
      case 'resident':
        return 'Your Schedule';
      case 'portal':
        return portalData?.name ? `${portalData.name} Schedule` : 'Community Schedule';
      default:
        return 'Schedule';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'contractor':
        return 'Service runs, resources, and dependencies';
      case 'resident':
        return 'Upcoming work at your property';
      case 'portal':
        return 'Community service schedule';
      default:
        return undefined;
    }
  };

  const getTestId = () => {
    switch (mode) {
      case 'contractor':
        return 'page-contractor-ops-calendar';
      case 'resident':
        return 'page-resident-ops-calendar';
      case 'portal':
        return 'page-portal-ops-calendar';
      default:
        return 'page-ops-calendar';
    }
  };

  const getAllowedZoomLevels = (): ZoomLevel[] => {
    switch (mode) {
      case 'contractor':
        return ['15m', '1h', 'day', 'week', 'month'];
      case 'resident':
        return ['1h', 'day', 'week'];
      case 'portal':
        return ['day', 'week', 'month'];
      default:
        return ['15m', '1h', 'day', 'week'];
    }
  };

  const getInitialZoom = (): ZoomLevel => {
    switch (mode) {
      case 'contractor':
        return '15m';
      case 'resident':
        return 'day';
      case 'portal':
        return 'day';
      default:
        return '15m';
    }
  };

  // Render evidence badge
  const renderEvidenceBadge = (status: 'none' | 'partial' | 'complete' | 'confirmed') => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Confirmed</Badge>;
      case 'complete':
        return <Badge variant="secondary" className="gap-1"><Camera className="h-3 w-3" /> Complete</Badge>;
      case 'partial':
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><Camera className="h-3 w-3" /> Partial</Badge>;
      case 'none':
      default:
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> No Evidence</Badge>;
    }
  };
  
  // Render feasibility badge
  const renderFeasibilityBadge = (status: 'ok' | 'risky' | 'blocked') => {
    switch (status) {
      case 'blocked':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Blocked</Badge>;
      case 'risky':
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><AlertTriangle className="h-3 w-3" /> Risky</Badge>;
      case 'ok':
      default:
        return null;
    }
  };

  return (
    <div 
      className="h-full flex flex-col" 
      data-testid={getTestId()}
    >
      {mode === 'portal' && portalSlug && (
        <PortalConditionsBar portalSlug={portalSlug} compact />
      )}
      <ScheduleBoard
        resources={resources}
        groupedResources={groupedResources}
        assetTypes={assetTypes}
        events={events}
        isLoading={isLoading}
        error={error as Error | null}
        onRangeChange={handleRangeChange}
        onEventClick={handleEventClick}
        title={getTitle()}
        subtitle={getSubtitle()}
        showSearch={mode === 'contractor'}
        showTypeFilter={mode === 'contractor'}
        showInactiveToggle={false}
        initialZoom={getInitialZoom()}
        allowedZoomLevels={getAllowedZoomLevels()}
        emptyStateMessage={
          mode === 'resident' 
            ? 'No scheduled work at your property' 
            : mode === 'portal'
            ? 'No scheduled community work'
            : 'No scheduled service runs'
        }
      />
      
      {/* Event Detail Panel - shows when an event is selected */}
      {selectedEvent && mode === 'contractor' && (
        <div 
          className="fixed bottom-4 right-4 w-80 bg-card border rounded-lg shadow-lg p-4 z-50"
          data-testid="panel-event-detail"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate" data-testid="text-event-title">
                {selectedEvent.title || 'Service Run'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {new Date(selectedEvent.start_date).toLocaleString()}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 shrink-0"
              onClick={() => setSelectedEvent(null)}
              data-testid="button-close-event-detail"
            >
              <span className="sr-only">Close</span>
              ×
            </Button>
          </div>
          
          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {renderEvidenceBadge(getEvidenceStatus(selectedEvent))}
            {renderFeasibilityBadge(getFeasibilityStatus(selectedEvent))}
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => handleOpenThread(selectedEvent)}
              disabled={ensureThreadMutation.isPending}
              data-testid="button-open-thread"
            >
              <MessageCircle className="h-4 w-4" />
              {ensureThreadMutation.isPending ? 'Opening...' : 'Open Thread'}
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => handleViewRunDetails(selectedEvent)}
              data-testid="button-view-run-details"
            >
              <ExternalLink className="h-4 w-4" />
              View Run Details
            </Button>
            
            {getEvidenceStatus(selectedEvent) !== 'confirmed' && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  const runId = getRunIdFromEvent(selectedEvent);
                  if (runId) setLocation(`/app/n3/runs/${runId}/evidence`);
                }}
                data-testid="button-add-evidence"
              >
                <Camera className="h-4 w-4" />
                {getEvidenceStatus(selectedEvent) === 'none' ? 'Add Evidence' : 'Complete Evidence'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
