import { useState, useMemo, useCallback } from 'react';
import { Link } from 'wouter';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import ScheduleBoard, { Resource, ScheduleEvent, ZoomLevel, ZOOM_CONFIGS } from '@/components/schedule/ScheduleBoard';

interface ConflictBlock {
  id: string;
  type: string;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

function snapTo15MinUp(date: Date): Date {
  const snapped = new Date(date);
  const minutes = Math.ceil(snapped.getMinutes() / 15) * 15;
  snapped.setMinutes(minutes, 0, 0);
  if (minutes >= 60) {
    snapped.setHours(snapped.getHours() + 1);
    snapped.setMinutes(0, 0, 0);
  }
  return snapped;
}

function snapTo15Min(date: Date): Date {
  const snapped = new Date(date);
  const minutes = Math.floor(snapped.getMinutes() / 15) * 15;
  snapped.setMinutes(minutes, 0, 0);
  return snapped;
}

export default function OperationsBoard() {
  const { currentTenant, impersonation, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

  console.log('[OPS] Tenant state', {
    tenantLoading,
    currentTenant: currentTenant?.tenant_id,
    tenantName: currentTenant?.tenant_name,
    isImpersonating: impersonation?.is_impersonating,
    impersonatedTenantId: impersonation?.tenant_id,
    queryEnabled: !!currentTenant?.tenant_id,
  });

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [conflictError, setConflictError] = useState<{ message: string; conflicts: ConflictBlock[] } | null>(null);
  const [lastUsedResource, setLastUsedResource] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const from = new Date(now);
    const to = new Date(now);
    to.setDate(to.getDate() + 1);
    return { from, to };
  });

  const [eventForm, setEventForm] = useState({
    resource_id: '',
    event_type: 'hold' as 'hold' | 'maintenance' | 'buffer',
    starts_at: '',
    ends_at: '',
    title: '',
    notes: '',
  });

  const resourceQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (typeFilter.length > 0) params.append('type', typeFilter.join(','));
    if (includeInactive) params.append('includeInactive', 'true');
    params.append('includeCapabilities', 'true');
    return params.toString();
  }, [searchQuery, typeFilter, includeInactive]);

  const resourcesUrl = resourceQueryParams
    ? `/api/schedule/resources?${resourceQueryParams}`
    : '/api/schedule/resources';

  const { data: resourcesData, isLoading: loadingResources, error: resourcesError } = useQuery<{
    success: boolean;
    resources: Resource[];
    grouped: Record<string, Resource[]>;
    asset_types: string[];
  }>({
    queryKey: ['schedule-resources', currentTenant?.tenant_id, resourceQueryParams],
    queryFn: async () => {
      console.log('[OPS] Fetching resources...', { url: resourcesUrl, ts: new Date().toISOString() });
      const token = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(resourcesUrl, { credentials: 'include', headers });
      if (!response.ok) {
        const text = await response.text();
        console.error('[OPS] Resources fetch failed', { status: response.status, text });
        throw new Error(`Failed to fetch resources: ${response.status} - ${text}`);
      }
      const data = await response.json();
      console.log('[OPS] Resources loaded', { count: data.resources?.length || 0, sample: data.resources?.slice(0, 3) });
      return data;
    },
    enabled: !!currentTenant?.tenant_id,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    refetchOnMount: 'always',
  });

  const scheduleUrl = `/api/schedule?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`;

  const { data: scheduleData, isLoading: loadingSchedule, error: scheduleError } = useQuery<{ success: boolean; events: ScheduleEvent[] }>({
    queryKey: ['schedule-events', currentTenant?.tenant_id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      console.log('[OPS] Fetching schedule...', { url: scheduleUrl, ts: new Date().toISOString() });
      const token = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(scheduleUrl, { credentials: 'include', headers });
      if (!response.ok) {
        const text = await response.text();
        console.error('[OPS] Schedule fetch failed', { status: response.status, text });
        throw new Error(`Failed to fetch schedule: ${response.status} - ${text}`);
      }
      const data = await response.json();
      console.log('[OPS] Schedule loaded', { count: data.events?.length || 0 });
      return data;
    },
    enabled: !!currentTenant?.tenant_id,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    refetchOnMount: 'always',
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      return apiRequest('POST', '/api/schedule/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (key.startsWith('schedule-') || key.startsWith('/api/schedule'));
        }
      });
      setShowEventDialog(false);
      setConflictError(null);
      setLastUsedResource(eventForm.resource_id);
      resetEventForm();
      toast({ title: 'Block created', description: 'Schedule block has been added.' });
    },
    onError: async (error: any) => {
      try {
        const data = await error.json?.() || error;
        if (data.code === 'RESOURCE_TIME_CONFLICT') {
          setConflictError({
            message: data.error || 'That time is already booked out.',
            conflicts: data.conflict_with || [],
          });
        } else {
          toast({ title: 'Error', description: data.error || 'Failed to create block', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to create block', variant: 'destructive' });
      }
    },
  });

  const resources: Resource[] = resourcesData?.resources || [];
  const rawGrouped = resourcesData?.grouped || {};
  const assetTypes = resourcesData?.asset_types || [];

  const groupedResources = useMemo(() => {
    const flattened: Record<string, Resource[]> = {};
    for (const [assetType, groupResources] of Object.entries(rawGrouped)) {
      const flatList: Resource[] = [];
      for (const resource of groupResources as any[]) {
        flatList.push(resource);
        if (resource.capability_units && resource.capability_units.length > 0) {
          for (const cap of resource.capability_units) {
            flatList.push({
              ...cap,
              is_capability_unit: true,
              indent_level: 1,
            });
          }
        }
      }
      flattened[assetType] = flatList;
    }
    return flattened;
  }, [rawGrouped]);

  const events: ScheduleEvent[] = scheduleData?.events || [];

  function resetEventForm() {
    const now = snapTo15MinUp(new Date());
    const end = new Date(now);
    end.setHours(end.getHours() + 1);

    setEventForm({
      resource_id: lastUsedResource || '',
      event_type: 'hold',
      starts_at: format(now, "yyyy-MM-dd'T'HH:mm"),
      ends_at: format(end, "yyyy-MM-dd'T'HH:mm"),
      title: '',
      notes: '',
    });
    setConflictError(null);
  }

  function getDefaultDuration(assetType: string): number {
    switch (assetType) {
      case 'accommodation':
      case 'property':
        return 24 * 60;
      case 'equipment':
      case 'rental':
      case 'charter':
      case 'watercraft':
        return 4 * 60;
      case 'parking':
      case 'spot':
      case 'moorage':
        return 24 * 60;
      case 'table':
        return 2 * 60;
      default:
        return 60;
    }
  }

  function handleSlotClick(resourceId: string, slotStart: Date) {
    const snappedStart = snapTo15Min(slotStart);
    const resource = resources.find(r => r.id === resourceId);
    const durationMinutes = getDefaultDuration(resource?.asset_type || '');
    const snappedEnd = new Date(snappedStart);
    snappedEnd.setMinutes(snappedEnd.getMinutes() + durationMinutes);

    setEventForm({
      resource_id: resourceId,
      event_type: 'hold',
      starts_at: format(snappedStart, "yyyy-MM-dd'T'HH:mm"),
      ends_at: format(snappedEnd, "yyyy-MM-dd'T'HH:mm"),
      title: '',
      notes: '',
    });
    setConflictError(null);
    setShowEventDialog(true);
  }

  function handleOpenAddBlock() {
    resetEventForm();
    setShowEventDialog(true);
  }

  function handleTimeChange(field: 'starts_at' | 'ends_at', value: string) {
    const date = new Date(value);
    const snapped = snapTo15Min(date);
    setEventForm(prev => ({ ...prev, [field]: format(snapped, "yyyy-MM-dd'T'HH:mm") }));
    setConflictError(null);
  }

  function handleCreateEvent() {
    if (!eventForm.resource_id || !eventForm.starts_at || !eventForm.ends_at) {
      return;
    }

    setConflictError(null);
    createEventMutation.mutate({
      ...eventForm,
      starts_at: new Date(eventForm.starts_at).toISOString(),
      ends_at: new Date(eventForm.ends_at).toISOString(),
      title: eventForm.title || eventForm.event_type,
    });
  }

  const isLoading = loadingResources || loadingSchedule;

  const handleRangeChange = useCallback((from: Date, to: Date, zoom: ZoomLevel) => {
    setDateRange({ from, to });
  }, []);

  return (
    <>
      <ScheduleBoard
        resources={resources}
        groupedResources={groupedResources}
        assetTypes={assetTypes}
        events={events}
        isLoading={isLoading}
        error={resourcesError || scheduleError || null}
        onSlotClick={handleSlotClick}
        onRangeChange={handleRangeChange}
        title="Operations Board"
        subtitle="Rooms, parking, equipment, crews. 15-minute precision."
        headerActions={
          <Button onClick={handleOpenAddBlock} data-testid="button-add-block">
            <Plus className="h-4 w-4 mr-2" />
            Add Block
          </Button>
        }
        showSearch={true}
        showTypeFilter={true}
        showInactiveToggle={true}
        onSearchChange={setSearchQuery}
        onTypeFilterChange={setTypeFilter}
        onInactiveToggle={setIncludeInactive}
        searchQuery={searchQuery}
        typeFilter={typeFilter}
        includeInactive={includeInactive}
        initialZoom="1h"
        allowedZoomLevels={['15m', '1h', 'day', 'week', 'month', 'season', 'year']}
        emptyStateMessage={currentTenant?.tenant_name
          ? `No assets found for ${currentTenant.tenant_name} yet.`
          : 'No assets found for this business yet.'}
        emptyStateAction={
          <Link href="/app/assets">
            <Button variant="outline" data-testid="link-add-assets">
              <Plus className="h-4 w-4 mr-2" />
              Add Assets
            </Button>
          </Link>
        }
      />

      <Dialog open={showEventDialog} onOpenChange={(open) => { setShowEventDialog(open); if (!open) setConflictError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Schedule Block</DialogTitle>
          </DialogHeader>

          {conflictError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">{conflictError.message}</p>
                  {conflictError.conflicts.length > 0 && (
                    <ul className="mt-2 space-y-1 text-destructive/80">
                      {conflictError.conflicts.map((c) => (
                        <li key={c.id}>
                          {c.title} ({c.event_type}): {format(new Date(c.starts_at), 'MMM d HH:mm')} - {format(new Date(c.ends_at), 'HH:mm')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resource</Label>
              <Select
                value={eventForm.resource_id}
                onValueChange={(v) => setEventForm(prev => ({ ...prev, resource_id: v }))}
              >
                <SelectTrigger data-testid="select-resource">
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {resources.filter(r => !r.is_capability_unit).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Block Type</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={(v: 'hold' | 'maintenance' | 'buffer') => setEventForm(prev => ({ ...prev, event_type: v }))}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hold">Hold</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="buffer">Buffer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.starts_at}
                  onChange={(e) => handleTimeChange('starts_at', e.target.value)}
                  data-testid="input-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.ends_at}
                  onChange={(e) => handleTimeChange('ends_at', e.target.value)}
                  data-testid="input-end-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={eventForm.event_type}
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={eventForm.notes}
                onChange={(e) => setEventForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={createEventMutation.isPending || !eventForm.resource_id}
              data-testid="button-create-event"
            >
              {createEventMutation.isPending ? 'Creating...' : 'Create Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
