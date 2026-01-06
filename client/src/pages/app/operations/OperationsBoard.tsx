import { useState, useEffect, useRef, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Loader2,
  Home,
  Car,
  Truck,
  Wrench,
  Package,
  ZoomIn,
  ZoomOut,
  Clock,
  AlertCircle
} from 'lucide-react';

type ZoomLevel = '15m' | '30m' | '1h' | 'day';

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
}

const ZOOM_CONFIGS: Record<ZoomLevel, { label: string; slotMinutes: number; slotsPerHour: number }> = {
  '15m': { label: '15 min', slotMinutes: 15, slotsPerHour: 4 },
  '30m': { label: '30 min', slotMinutes: 30, slotsPerHour: 2 },
  '1h': { label: '1 hour', slotMinutes: 60, slotsPerHour: 1 },
  'day': { label: 'Day', slotMinutes: 1440, slotsPerHour: 1/24 },
};

const EVENT_COLORS: Record<string, string> = {
  booked: 'bg-blue-500/80 border-blue-600',
  hold: 'bg-amber-500/80 border-amber-600',
  maintenance: 'bg-red-500/80 border-red-600',
  buffer: 'bg-purple-500/80 border-purple-600',
};

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  property: Home,
  spot: Car,
  vehicle: Truck,
  trailer: Truck,
  equipment: Wrench,
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

function snapTo15Min(date: Date): Date {
  const snapped = new Date(date);
  const minutes = Math.floor(snapped.getMinutes() / 15) * 15;
  snapped.setMinutes(minutes, 0, 0);
  return snapped;
}

export default function OperationsBoard() {
  const { currentTenant } = useTenant();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setHours(6, 0, 0, 0);
    return now;
  });
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('1h');
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventForm, setEventForm] = useState({
    resource_id: '',
    event_type: 'hold' as 'hold' | 'maintenance' | 'buffer',
    starts_at: '',
    ends_at: '',
    title: '',
    notes: '',
  });
  
  const gridRef = useRef<HTMLDivElement>(null);

  const getTimeRange = useCallback(() => {
    const from = new Date(currentDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + (zoomLevel === 'day' ? 7 : 1));
    return { from, to };
  }, [currentDate, zoomLevel]);

  const { from, to } = getTimeRange();

  const { data: resourcesData, isLoading: loadingResources } = useQuery<{ success: boolean; resources: Resource[] }>({
    queryKey: ['/api/schedule/resources'],
    enabled: !!currentTenant?.tenant_id,
  });

  const { data: scheduleData, isLoading: loadingSchedule, refetch: refetchSchedule } = useQuery<{ success: boolean; events: ScheduleEvent[] }>({
    queryKey: ['/api/schedule', `?from=${from.toISOString()}&to=${to.toISOString()}`],
    enabled: !!currentTenant?.tenant_id,
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      return apiRequest('POST', '/api/schedule/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      setShowEventDialog(false);
      resetEventForm();
    },
  });

  const resources: Resource[] = resourcesData?.resources || [];
  const events: ScheduleEvent[] = scheduleData?.events || [];

  function resetEventForm() {
    setEventForm({
      resource_id: '',
      event_type: 'hold',
      starts_at: '',
      ends_at: '',
      title: '',
      notes: '',
    });
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
    now.setHours(6, 0, 0, 0);
    setCurrentDate(now);
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
    setShowEventDialog(true);
  }

  function handleCreateEvent() {
    if (!eventForm.resource_id || !eventForm.starts_at || !eventForm.ends_at) {
      return;
    }
    
    createEventMutation.mutate({
      ...eventForm,
      starts_at: new Date(eventForm.starts_at).toISOString(),
      ends_at: new Date(eventForm.ends_at).toISOString(),
      title: eventForm.title || eventForm.event_type,
    });
  }

  const timeSlots = generateTimeSlots();
  const config = ZOOM_CONFIGS[zoomLevel];
  const slotWidth = zoomLevel === 'day' ? 120 : (zoomLevel === '15m' ? 40 : (zoomLevel === '30m' ? 60 : 80));

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
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Operations Board</h1>
            <p className="text-muted-foreground text-sm">
              Everything with a calendar — rooms, parking, equipment, crews. 15-minute precision when you need it.
            </p>
          </div>
          <Button onClick={() => {
            resetEventForm();
            setShowEventDialog(true);
          }} data-testid="button-create-event">
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

      {resources.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2" data-testid="text-empty-state">No schedule events in this window.</h2>
              <p className="text-muted-foreground">
                Create a hold or switch the date range.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 flex-shrink-0 border-r bg-muted/30">
            <div className="h-10 border-b flex items-center px-3">
              <span className="text-sm font-medium text-muted-foreground">Resources</span>
            </div>
            <ScrollArea className="h-[calc(100%-2.5rem)]">
              {resources.map((resource) => {
                const Icon = getResourceIcon(resource.asset_type);
                return (
                  <div
                    key={resource.id}
                    className={`h-12 flex items-center gap-2 px-3 border-b hover-elevate cursor-pointer ${
                      selectedResource === resource.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedResource(resource.id === selectedResource ? null : resource.id)}
                    data-testid={`resource-row-${resource.id}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{resource.name}</span>
                  </div>
                );
              })}
            </ScrollArea>
          </div>

          <div className="flex-1 overflow-auto" ref={gridRef}>
            <div className="min-w-max">
              <div className="h-10 flex border-b sticky top-0 bg-background z-10">
                {timeSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 border-r flex items-center justify-center text-xs text-muted-foreground"
                    style={{ width: slotWidth }}
                  >
                    {zoomLevel === 'day' 
                      ? formatDate(slot)
                      : formatTime(slot)
                    }
                  </div>
                ))}
              </div>

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
                      
                      const slotEvents = resourceEvents.filter(e => {
                        const pos = getEventPosition(e, slot, slotEnd);
                        return pos !== null;
                      });
                      
                      return (
                        <div
                          key={idx}
                          className="flex-shrink-0 border-r relative hover:bg-accent/30 cursor-pointer"
                          style={{ width: slotWidth }}
                          onClick={() => handleSlotClick(resource.id, slot)}
                          data-testid={`slot-${resource.id}-${idx}`}
                        >
                          {slotEvents.map((event) => {
                            const pos = getEventPosition(event, slot, slotEnd);
                            if (!pos) return null;
                            
                            return (
                              <div
                                key={event.id}
                                className={`absolute top-1 bottom-1 rounded-sm border text-xs text-white px-1 truncate ${EVENT_COLORS[event.event_type]}`}
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

      <div className="p-2 border-t flex items-center gap-4 flex-wrap">
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
            <DialogTitle>Create Schedule Block</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Resource</Label>
              <Select
                value={eventForm.resource_id}
                onValueChange={(value) => setEventForm(prev => ({ ...prev, resource_id: value }))}
              >
                <SelectTrigger data-testid="select-resource">
                  <SelectValue placeholder="Select a resource" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Block Type</Label>
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
                  <SelectItem value="buffer">Buffer (Cleaning/Travel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.starts_at}
                  onChange={(e) => setEventForm(prev => ({ ...prev, starts_at: e.target.value }))}
                  step={900}
                  data-testid="input-starts-at"
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.ends_at}
                  onChange={(e) => setEventForm(prev => ({ ...prev, ends_at: e.target.value }))}
                  step={900}
                  data-testid="input-ends-at"
                />
              </div>
            </div>
            
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Deep cleaning, Owner block"
                data-testid="input-title"
              />
            </div>
            
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={eventForm.notes}
                onChange={(e) => setEventForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details..."
                data-testid="input-notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateEvent} 
              disabled={createEventMutation.isPending || !eventForm.resource_id}
              data-testid="button-save-event"
            >
              {createEventMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Create Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
