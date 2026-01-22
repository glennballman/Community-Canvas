import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ScheduleBoard, { 
  Resource, 
  ScheduleEvent, 
  ZoomLevel, 
  ZOOM_CONFIGS,
  snapTo15Min 
} from '@/components/schedule/ScheduleBoard';
import type { CalendarRunDTO } from '@shared/schema';

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
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const from = new Date(now);
    const to = new Date(now);
    to.setDate(to.getDate() + 1);
    return { from, to };
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
  }, []);

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

  return (
    <div 
      className="h-full flex flex-col" 
      data-testid={getTestId()}
    >
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
    </div>
  );
}
