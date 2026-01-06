import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Loader2,
  Home,
  Car,
  Truck,
  Wrench,
  Package,
  AlertCircle,
  Search,
  Filter,
  LocateFixed,
  Anchor,
  Users
} from 'lucide-react';

type ZoomLevel = '15m' | '1h' | 'day';

interface ScheduleEvent {
  id: string;
  resource_id: string;
  event_type: 'booked' | 'hold' | 'maintenance' | 'buffer';
  starts_at: string;
  ends_at: string;
  status: string;
  title: string;
  notes?: string;
  resource_name?: string;
  resource_type?: string;
  is_booking?: boolean;
}

interface Resource {
  id: string;
  name: string;
  asset_type: string;
  status: string;
  thumbnail_url?: string;
  is_accommodation?: boolean;
  is_parkable_spot?: boolean;
  is_equipment?: boolean;
  is_under_maintenance?: boolean;
  is_capability_unit?: boolean;
  parent_asset_id?: string;
  capability_type?: string;
  capability_status?: 'operational' | 'inoperable' | 'maintenance';
  indent_level?: number;
}

interface ConflictBlock {
  id: string;
  type: string;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

const ZOOM_CONFIGS: Record<ZoomLevel, { label: string; slotMinutes: number }> = {
  '15m': { label: '15 min', slotMinutes: 15 },
  '1h': { label: '1 hour', slotMinutes: 60 },
  'day': { label: 'Day', slotMinutes: 1440 },
};

const EVENT_COLORS: Record<string, string> = {
  booked: 'bg-blue-500/90 border-blue-600',
  hold: 'bg-amber-500/90 border-amber-600',
  maintenance: 'bg-red-500/90 border-red-600',
  buffer: 'bg-purple-500/90 border-purple-600',
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  property: 'Rooms',
  spot: 'Parking',
  equipment: 'Equipment',
  vehicle: 'Vehicles',
  watercraft: 'Watercraft',
  trailer: 'Trailers',
  crew: 'Crew',
};

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  property: Home,
  spot: Car,
  vehicle: Truck,
  trailer: Truck,
  equipment: Wrench,
  watercraft: Anchor,
  crew: Users,
  default: Package,
};

function getResourceIcon(type: string): React.ElementType {
  return RESOURCE_ICONS[type] || RESOURCE_ICONS.default;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export default function OperationsBoard() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('1h');
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [conflictError, setConflictError] = useState<{ message: string; conflicts: ConflictBlock[] } | null>(null);
  const [lastUsedResource, setLastUsedResource] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [eventForm, setEventForm] = useState({
    resource_id: '',
    event_type: 'hold' as 'hold' | 'maintenance' | 'buffer',
    starts_at: '',
    ends_at: '',
    title: '',
    notes: '',
  });
  
  const gridRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);

  const getTimeRange = useCallback(() => {
    const from = new Date(currentDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + (zoomLevel === 'day' ? 7 : 1));
    return { from, to };
  }, [currentDate, zoomLevel]);

  const { from, to } = getTimeRange();

  const resourceQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (typeFilter.length > 0) params.append('type', typeFilter.join(','));
    if (includeInactive) params.append('includeInactive', 'true');
    params.append('includeCapabilities', 'true');
    return params.toString();
  }, [searchQuery, typeFilter, includeInactive]);

  const { data: resourcesData, isLoading: loadingResources } = useQuery<{ 
    success: boolean; 
    resources: Resource[]; 
    grouped: Record<string, Resource[]>;
    asset_types: string[];
  }>({
    queryKey: ['/api/schedule/resources', resourceQueryParams ? `?${resourceQueryParams}` : ''],
    enabled: !!currentTenant?.tenant_id,
  });

  const { data: scheduleData, isLoading: loadingSchedule } = useQuery<{ success: boolean; events: ScheduleEvent[] }>({
    queryKey: ['/api/schedule', `?from=${from.toISOString()}&to=${to.toISOString()}`],
    enabled: !!currentTenant?.tenant_id,
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      return apiRequest('POST', '/api/schedule/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule/resources'] });
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
      starts_at: now.toISOString().slice(0, 16),
      ends_at: end.toISOString().slice(0, 16),
      title: '',
      notes: '',
    });
    setConflictError(null);
  }

  function handlePrevious() {
    const newDate = new Date(currentDate);
    if (zoomLevel === 'day') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  }

  function handleNext() {
    const newDate = new Date(currentDate);
    if (zoomLevel === 'day') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  }

  function handleToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setCurrentDate(now);
  }

  function handleBackToNow() {
    handleToday();
    setTimeout(() => {
      if (nowLineRef.current) {
        nowLineRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      }
    }, 100);
  }

  function generateTimeSlots(): Date[] {
    const slots: Date[] = [];
    const config = ZOOM_CONFIGS[zoomLevel];
    const current = new Date(from);
    
    while (current < to) {
      slots.push(new Date(current));
      current.setMinutes(current.getMinutes() + config.slotMinutes);
    }
    
    return slots;
  }

  function getEventsForResource(resourceId: string): ScheduleEvent[] {
    return events.filter(e => e.resource_id === resourceId);
  }

  function getEventPosition(event: ScheduleEvent, slotStart: Date, slotEnd: Date): { left: number; width: number } | null {
    const eventStart = new Date(event.starts_at);
    const eventEnd = new Date(event.ends_at);
    
    if (eventEnd <= slotStart || eventStart >= slotEnd) {
      return null;
    }
    
    const slotDuration = slotEnd.getTime() - slotStart.getTime();
    const visibleStart = Math.max(eventStart.getTime(), slotStart.getTime());
    const visibleEnd = Math.min(eventEnd.getTime(), slotEnd.getTime());
    
    const left = ((visibleStart - slotStart.getTime()) / slotDuration) * 100;
    const width = ((visibleEnd - visibleStart) / slotDuration) * 100;
    
    return { left, width };
  }

  function getNowPosition(): number | null {
    const now = new Date();
    if (now < from || now >= to) return null;
    
    const totalDuration = to.getTime() - from.getTime();
    const elapsed = now.getTime() - from.getTime();
    return (elapsed / totalDuration) * 100;
  }

  function handleSlotClick(resourceId: string, slotStart: Date) {
    const snappedStart = snapTo15Min(slotStart);
    const snappedEnd = new Date(snappedStart);
    snappedEnd.setMinutes(snappedEnd.getMinutes() + 60);
    
    setEventForm({
      resource_id: resourceId,
      event_type: 'hold',
      starts_at: snappedStart.toISOString().slice(0, 16),
      ends_at: snappedEnd.toISOString().slice(0, 16),
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
    setEventForm(prev => ({ ...prev, [field]: snapped.toISOString().slice(0, 16) }));
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

  function toggleTypeFilter(type: string) {
    setTypeFilter(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  }

  const timeSlots = generateTimeSlots();
  const config = ZOOM_CONFIGS[zoomLevel];
  const slotWidth = zoomLevel === 'day' ? 120 : (zoomLevel === '15m' ? 60 : 100);
  const nowPosition = getNowPosition();
  const showingToday = isToday(currentDate);

  const isLoading = loadingResources || loadingSchedule;

  if (isLoading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="operations-board-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="operations-board">
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Operations Board</h1>
            <p className="text-muted-foreground text-sm">
              Rooms, parking, equipment, crews. 15-minute precision.
            </p>
          </div>
          <Button onClick={handleOpenAddBlock} data-testid="button-add-block">
            <Plus className="h-4 w-4 mr-2" />
            Add Block
          </Button>
        </div>
        
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevious} data-testid="button-previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleToday} data-testid="button-today">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext} data-testid="button-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {showingToday && zoomLevel !== 'day' && (
              <Button variant="ghost" size="sm" onClick={handleBackToNow} data-testid="button-back-to-now">
                <LocateFixed className="h-4 w-4 mr-1" />
                Now
              </Button>
            )}
            <span className="font-medium ml-2" data-testid="text-current-date">
              {formatDate(currentDate)}
              {zoomLevel === 'day' && ` - ${formatDate(new Date(to.getTime() - 86400000))}`}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Zoom:</span>
            {(['15m', '1h', 'day'] as ZoomLevel[]).map((level) => (
              <Button
                key={level}
                variant={zoomLevel === level ? 'default' : 'outline'}
                size="sm"
                onClick={() => setZoomLevel(level)}
                data-testid={`button-zoom-${level}`}
              >
                {ZOOM_CONFIGS[level].label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {resources.length === 0 && !loadingResources ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2" data-testid="text-empty-state">No resources found</h2>
              <p className="text-muted-foreground">
                Add inventory items to see them here.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-56 flex-shrink-0 border-r bg-muted/30 flex flex-col">
            <div className="p-2 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                  data-testid="input-search-resources"
                />
              </div>
              {assetTypes.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {assetTypes.map(type => (
                    <Badge
                      key={type}
                      variant={typeFilter.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleTypeFilter(type)}
                      data-testid={`filter-type-${type}`}
                    >
                      {ASSET_TYPE_LABELS[type] || type}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-inactive"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(!!checked)}
                  data-testid="checkbox-include-inactive"
                />
                <label htmlFor="include-inactive" className="text-xs text-muted-foreground cursor-pointer">
                  Include inactive
                </label>
              </div>
            </div>
            
            <div className="h-10 border-b flex items-center px-3 sticky top-0 bg-muted/30 z-10">
              <span className="text-sm font-medium text-muted-foreground">Resources</span>
            </div>
            
            <ScrollArea className="flex-1">
              {Object.entries(groupedResources).map(([assetType, groupResources]) => (
                <div key={assetType}>
                  <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0">
                    {ASSET_TYPE_LABELS[assetType] || assetType}
                  </div>
                  {groupResources.map((resource) => {
                    const Icon = resource.is_capability_unit ? Wrench : getResourceIcon(resource.asset_type);
                    const isCapability = resource.is_capability_unit;
                    const statusBadge = isCapability && resource.capability_status !== 'operational' 
                      ? resource.capability_status 
                      : (resource.is_under_maintenance ? 'maint' : null);
                    return (
                      <div
                        key={resource.id}
                        className={`h-12 flex items-center gap-2 border-b ${isCapability ? 'pl-8 bg-muted/20' : 'px-3'}`}
                        data-testid={`resource-row-${resource.id}`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isCapability ? 'text-muted-foreground/60' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm truncate block ${isCapability ? 'text-muted-foreground' : ''}`}>
                            {isCapability ? `- ${resource.name}` : resource.name}
                          </span>
                          {isCapability && resource.capability_type && (
                            <span className="text-xs text-muted-foreground/60">{resource.capability_type}</span>
                          )}
                        </div>
                        {statusBadge && (
                          <Badge variant="destructive" className="text-xs px-1">
                            {statusBadge === 'maint' ? 'Maint' : statusBadge}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="flex-1 overflow-auto relative" ref={gridRef}>
            <div className="min-w-max relative">
              <div className="h-10 flex border-b sticky top-0 bg-background z-20">
                {timeSlots.map((slot, idx) => {
                  const isHourMark = slot.getMinutes() === 0;
                  return (
                    <div
                      key={idx}
                      className={`flex-shrink-0 flex items-center justify-center text-xs ${
                        isHourMark ? 'border-r-2 border-r-border font-medium' : 'border-r border-r-border/50'
                      }`}
                      style={{ width: slotWidth }}
                    >
                      {zoomLevel === 'day' 
                        ? formatDate(slot)
                        : (isHourMark || zoomLevel === '15m') ? formatTime(slot) : ''
                      }
                    </div>
                  );
                })}
              </div>

              {nowPosition !== null && zoomLevel !== 'day' && (
                <div
                  ref={nowLineRef}
                  className="absolute top-10 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                  style={{ left: `${nowPosition}%` }}
                  data-testid="now-line"
                >
                  <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                </div>
              )}

              {resources.map((resource) => {
                const resourceEvents = getEventsForResource(resource.id);
                
                return (
                  <div 
                    key={resource.id} 
                    className="h-12 flex border-b relative"
                    data-testid={`schedule-row-${resource.id}`}
                  >
                    {timeSlots.map((slot, idx) => {
                      const slotEnd = new Date(slot);
                      slotEnd.setMinutes(slotEnd.getMinutes() + config.slotMinutes);
                      const isHourMark = slot.getMinutes() === 0;
                      
                      const slotEvents = resourceEvents.filter(e => {
                        const pos = getEventPosition(e, slot, slotEnd);
                        return pos !== null;
                      });
                      
                      return (
                        <div
                          key={idx}
                          className={`flex-shrink-0 relative hover:bg-accent/20 cursor-pointer ${
                            isHourMark ? 'border-r-2 border-r-border' : 'border-r border-r-border/30'
                          }`}
                          style={{ 
                            width: slotWidth,
                            backgroundImage: zoomLevel === '15m' ? 'none' : 
                              'repeating-linear-gradient(90deg, transparent, transparent calc(25% - 1px), hsl(var(--border) / 0.2) calc(25% - 1px), hsl(var(--border) / 0.2) 25%)'
                          }}
                          onClick={() => handleSlotClick(resource.id, slot)}
                          data-testid={`slot-${resource.id}-${idx}`}
                        >
                          {slotEvents.map((event) => {
                            const pos = getEventPosition(event, slot, slotEnd);
                            if (!pos) return null;
                            
                            return (
                              <div
                                key={event.id}
                                className={`absolute top-1 bottom-1 rounded-sm border text-xs text-white px-1 truncate ${EVENT_COLORS[event.event_type]} shadow-sm`}
                                style={{
                                  left: `${pos.left}%`,
                                  width: `${pos.width}%`,
                                  minWidth: '4px',
                                }}
                                title={`${event.title || event.event_type} (${new Date(event.starts_at).toLocaleTimeString()} - ${new Date(event.ends_at).toLocaleTimeString()})`}
                                data-testid={`event-${event.id}`}
                              >
                                {pos.width > 30 && (event.title || event.event_type)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="p-2 border-t flex items-center gap-4 flex-wrap flex-shrink-0">
        <span className="text-sm text-muted-foreground">Legend:</span>
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded-sm ${color}`} />
            <span className="text-xs capitalize">{type}</span>
          </div>
        ))}
      </div>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent data-testid="dialog-create-event">
          <DialogHeader>
            <DialogTitle>Add Block</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Resource</Label>
              <Select
                value={eventForm.resource_id}
                onValueChange={(value) => {
                  setEventForm(prev => ({ ...prev, resource_id: value }));
                  setConflictError(null);
                }}
              >
                <SelectTrigger data-testid="select-resource">
                  <SelectValue placeholder="Select a resource" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedResources).map(([assetType, groupResources]) => (
                    <div key={assetType}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        {ASSET_TYPE_LABELS[assetType] || assetType}
                      </div>
                      {groupResources.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Type</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={(value: 'hold' | 'maintenance' | 'buffer') => 
                  setEventForm(prev => ({ ...prev, event_type: value }))
                }
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
              <div>
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.starts_at}
                  onChange={(e) => handleTimeChange('starts_at', e.target.value)}
                  step={900}
                  data-testid="input-starts-at"
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.ends_at}
                  onChange={(e) => handleTimeChange('ends_at', e.target.value)}
                  step={900}
                  data-testid="input-ends-at"
                />
              </div>
            </div>
            
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={eventForm.notes}
                onChange={(e) => setEventForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g., crane broken - load by hand"
                data-testid="input-notes"
              />
            </div>

            {conflictError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md" data-testid="conflict-error">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">{conflictError.message}</p>
                    {conflictError.conflicts.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {conflictError.conflicts.map((c, i) => (
                          <li key={i}>
                            {c.title} ({new Date(c.starts_at).toLocaleTimeString()} - {new Date(c.ends_at).toLocaleTimeString()})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateEvent} 
              disabled={createEventMutation.isPending || !eventForm.resource_id}
              data-testid="button-save-block"
            >
              {createEventMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
