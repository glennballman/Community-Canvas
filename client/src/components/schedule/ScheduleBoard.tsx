import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Home,
  Car,
  Truck,
  Wrench,
  Package,
  AlertCircle,
  Search,
  LocateFixed,
  Anchor,
  Users
} from 'lucide-react';
import {
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  format,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
} from 'date-fns';

export type ZoomLevel = '15m' | '1h' | 'day' | 'week' | 'month' | 'season' | 'year';

export interface ScheduleEvent {
  id: string;
  resource_id: string;
  event_type: 'booked' | 'hold' | 'maintenance' | 'buffer' | 'reservation';
  start_date: string;
  end_date: string;
  status: string;
  title: string;
  notes?: string;
  resource_name?: string;
  resource_type?: string;
  is_reservation?: boolean;
}

export interface Resource {
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

export interface ScheduleBoardProps {
  resources: Resource[];
  groupedResources: Record<string, Resource[]>;
  assetTypes: string[];
  events: ScheduleEvent[];
  isLoading: boolean;
  error?: Error | null;
  onSlotClick?: (resourceId: string, slotStart: Date) => void;
  onEventClick?: (event: ScheduleEvent) => void;
  onRangeChange?: (from: Date, to: Date, zoom: ZoomLevel) => void;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  showSearch?: boolean;
  showTypeFilter?: boolean;
  showInactiveToggle?: boolean;
  onSearchChange?: (query: string) => void;
  onTypeFilterChange?: (types: string[]) => void;
  onInactiveToggle?: (include: boolean) => void;
  searchQuery?: string;
  typeFilter?: string[];
  includeInactive?: boolean;
  initialZoom?: ZoomLevel;
  allowedZoomLevels?: ZoomLevel[];
  emptyStateAction?: React.ReactNode;
  emptyStateMessage?: string;
}

export const ZOOM_CONFIGS: Record<ZoomLevel, { label: string; slotMinutes: number; getRange: (date: Date) => { from: Date; to: Date }; getSlotCount: (from: Date, to: Date) => number }> = {
  '15m': {
    label: '15 min',
    slotMinutes: 15,
    getRange: (date: Date) => {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return { from, to };
    },
    getSlotCount: () => 96,
  },
  '1h': {
    label: '1 hour',
    slotMinutes: 60,
    getRange: (date: Date) => {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return { from, to };
    },
    getSlotCount: () => 24,
  },
  'day': {
    label: 'Day',
    slotMinutes: 1440,
    getRange: (date: Date) => {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return { from, to };
    },
    getSlotCount: () => 7,
  },
  'week': {
    label: 'Week',
    slotMinutes: 1440,
    getRange: (date: Date) => {
      const from = startOfWeek(date, { weekStartsOn: 1 });
      const to = addDays(from, 7);
      return { from, to };
    },
    getSlotCount: () => 7,
  },
  'month': {
    label: 'Month',
    slotMinutes: 1440,
    getRange: (date: Date) => {
      const from = startOfMonth(date);
      const to = endOfMonth(date);
      to.setDate(to.getDate() + 1);
      return { from, to };
    },
    getSlotCount: (from, to) => differenceInDays(to, from),
  },
  'season': {
    label: 'Season',
    slotMinutes: 10080,
    getRange: (date: Date) => {
      const from = startOfMonth(date);
      const to = addMonths(from, 3);
      return { from, to };
    },
    getSlotCount: (from, to) => differenceInWeeks(to, from),
  },
  'year': {
    label: 'Year',
    slotMinutes: 43200,
    getRange: (date: Date) => {
      const from = new Date(date.getFullYear(), 0, 1);
      const to = new Date(date.getFullYear() + 1, 0, 1);
      return { from, to };
    },
    getSlotCount: () => 12,
  },
};

const EVENT_COLORS: Record<string, string> = {
  booked: 'bg-blue-500/90 border-blue-600',
  reservation: 'bg-blue-500/90 border-blue-600',
  hold: 'bg-amber-500/90 border-amber-600',
  maintenance: 'bg-red-500/90 border-red-600',
  buffer: 'bg-purple-500/90 border-purple-600',
  pending: 'bg-amber-500/90 border-amber-600',
  confirmed: 'bg-blue-500/90 border-blue-600',
  completed: 'bg-green-500/90 border-green-600',
  cancelled: 'bg-gray-500/90 border-gray-600',
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

function formatSlotHeader(date: Date, zoom: ZoomLevel): string {
  switch (zoom) {
    case '15m':
    case '1h':
      return formatTime(date);
    case 'day':
    case 'week':
    case 'month':
      return format(date, 'EEE d');
    case 'season':
      return format(date, 'MMM d');
    case 'year':
      return format(date, 'MMM');
  }
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function snapTo15Min(date: Date): Date {
  const snapped = new Date(date);
  const minutes = Math.floor(snapped.getMinutes() / 15) * 15;
  snapped.setMinutes(minutes, 0, 0);
  return snapped;
}

export default function ScheduleBoard({
  resources,
  groupedResources,
  assetTypes,
  events,
  isLoading,
  error,
  onSlotClick,
  onEventClick,
  onRangeChange,
  title = 'Schedule',
  subtitle,
  headerActions,
  showSearch = true,
  showTypeFilter = true,
  showInactiveToggle = true,
  onSearchChange,
  onTypeFilterChange,
  onInactiveToggle,
  searchQuery = '',
  typeFilter = [],
  includeInactive = false,
  initialZoom = '1h',
  allowedZoomLevels = ['15m', '1h', 'day', 'week', 'month', 'season', 'year'],
  emptyStateAction,
  emptyStateMessage = 'No resources found',
}: ScheduleBoardProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(initialZoom);

  const gridRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timeHeaderRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const isScrollingVertical = useRef(false);
  const isScrollingHorizontal = useRef(false);

  useEffect(() => {
    const grid = gridRef.current;
    const sidebar = sidebarRef.current;
    const timeHeader = timeHeaderRef.current;
    if (!grid || !sidebar) return;

    const syncGridToSidebar = () => {
      if (isScrollingVertical.current) return;
      isScrollingVertical.current = true;
      sidebar.scrollTop = grid.scrollTop;
      requestAnimationFrame(() => { isScrollingVertical.current = false; });
    };

    const syncSidebarToGrid = () => {
      if (isScrollingVertical.current) return;
      isScrollingVertical.current = true;
      grid.scrollTop = sidebar.scrollTop;
      requestAnimationFrame(() => { isScrollingVertical.current = false; });
    };

    const syncGridToTimeHeader = () => {
      if (isScrollingHorizontal.current || !timeHeader) return;
      isScrollingHorizontal.current = true;
      timeHeader.scrollLeft = grid.scrollLeft;
      requestAnimationFrame(() => { isScrollingHorizontal.current = false; });
    };

    const syncTimeHeaderToGrid = () => {
      if (isScrollingHorizontal.current || !timeHeader) return;
      isScrollingHorizontal.current = true;
      grid.scrollLeft = timeHeader.scrollLeft;
      requestAnimationFrame(() => { isScrollingHorizontal.current = false; });
    };

    grid.addEventListener('scroll', syncGridToSidebar);
    grid.addEventListener('scroll', syncGridToTimeHeader);
    sidebar.addEventListener('scroll', syncSidebarToGrid);
    if (timeHeader) {
      timeHeader.addEventListener('scroll', syncTimeHeaderToGrid);
    }

    return () => {
      grid.removeEventListener('scroll', syncGridToSidebar);
      grid.removeEventListener('scroll', syncGridToTimeHeader);
      sidebar.removeEventListener('scroll', syncSidebarToGrid);
      if (timeHeader) {
        timeHeader.removeEventListener('scroll', syncTimeHeaderToGrid);
      }
    };
  }, []);

  const config = ZOOM_CONFIGS[zoomLevel];
  const { from, to } = config.getRange(currentDate);

  useEffect(() => {
    if (onRangeChange) {
      onRangeChange(from, to, zoomLevel);
    }
  }, [from.getTime(), to.getTime(), zoomLevel, onRangeChange]);

  const generateTimeSlots = useCallback((): Date[] => {
    const slots: Date[] = [];
    const current = new Date(from);
    const cfg = ZOOM_CONFIGS[zoomLevel];

    if (zoomLevel === 'year') {
      for (let m = 0; m < 12; m++) {
        slots.push(new Date(from.getFullYear(), m, 1));
      }
    } else if (zoomLevel === 'season') {
      let c = new Date(from);
      while (c < to) {
        slots.push(new Date(c));
        c = addWeeks(c, 1);
      }
    } else {
      while (current < to) {
        slots.push(new Date(current));
        current.setMinutes(current.getMinutes() + cfg.slotMinutes);
      }
    }

    return slots;
  }, [from, to, zoomLevel]);

  const timeSlots = useMemo(() => generateTimeSlots(), [generateTimeSlots]);

  const getEventsForResource = useCallback((resourceId: string): ScheduleEvent[] => {
    return events.filter(e => e.resource_id === resourceId);
  }, [events]);

  const getEventPosition = useCallback((event: ScheduleEvent, slotStart: Date, slotEnd: Date): { left: number; width: number } | null => {
    const eventStart = new Date(event.start_date);
    const eventEnd = new Date(event.end_date);

    if (eventEnd <= slotStart || eventStart >= slotEnd) {
      return null;
    }

    const slotDuration = slotEnd.getTime() - slotStart.getTime();
    const visibleStart = Math.max(eventStart.getTime(), slotStart.getTime());
    const visibleEnd = Math.min(eventEnd.getTime(), slotEnd.getTime());

    const left = ((visibleStart - slotStart.getTime()) / slotDuration) * 100;
    const width = ((visibleEnd - visibleStart) / slotDuration) * 100;

    return { left, width };
  }, []);

  const getNowPosition = useCallback((): number | null => {
    const now = new Date();
    if (now < from || now >= to) return null;

    const totalDuration = to.getTime() - from.getTime();
    const elapsed = now.getTime() - from.getTime();
    return (elapsed / totalDuration) * 100;
  }, [from, to]);

  function handlePrevious() {
    const newDate = new Date(currentDate);
    switch (zoomLevel) {
      case '15m':
      case '1h':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'day':
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'season':
        newDate.setMonth(newDate.getMonth() - 3);
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() - 1);
        break;
    }
    setCurrentDate(newDate);
  }

  function handleNext() {
    const newDate = new Date(currentDate);
    switch (zoomLevel) {
      case '15m':
      case '1h':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'day':
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'season':
        newDate.setMonth(newDate.getMonth() + 3);
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
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

  function handleSlotClick(resourceId: string, slotStart: Date) {
    if (onSlotClick) {
      const snapped = snapTo15Min(slotStart);
      onSlotClick(resourceId, snapped);
    }
  }

  function getDateRangeLabel(): string {
    switch (zoomLevel) {
      case '15m':
      case '1h':
        return formatDate(currentDate);
      case 'day':
      case 'week':
        return `${formatDate(from)} - ${formatDate(new Date(to.getTime() - 86400000))}`;
      case 'month':
        return format(from, 'MMMM yyyy');
      case 'season':
        return `${format(from, 'MMM')} - ${format(addMonths(from, 2), 'MMM yyyy')}`;
      case 'year':
        return format(from, 'yyyy');
    }
  }

  const slotWidth = zoomLevel === 'day' || zoomLevel === 'week' ? 120 : (zoomLevel === '15m' ? 60 : (zoomLevel === 'month' ? 40 : (zoomLevel === 'season' ? 80 : (zoomLevel === 'year' ? 80 : 100))));
  const nowPosition = getNowPosition();
  const showingToday = isToday(currentDate);

  if (isLoading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="schedule-board-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="schedule-board">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 mx-4 mt-4 rounded-md flex items-start gap-2" data-testid="error-banner">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Failed to load data</p>
            <p className="text-destructive/80">{error.message}</p>
          </div>
        </div>
      )}

      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          </div>
          {headerActions}
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
            {showingToday && (zoomLevel === '15m' || zoomLevel === '1h') && (
              <Button variant="ghost" size="sm" onClick={handleBackToNow} data-testid="button-back-to-now">
                <LocateFixed className="h-4 w-4 mr-1" />
                Now
              </Button>
            )}
            <span className="font-medium ml-2" data-testid="text-current-date">
              {getDateRangeLabel()}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Zoom:</span>
            {allowedZoomLevels.map((level) => (
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

      {resources.length === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-empty-state">{emptyStateMessage}</h2>
            {emptyStateAction}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {(showSearch || showTypeFilter || showInactiveToggle) && (
            <div className="p-2 border-b space-y-2 flex-shrink-0 bg-muted/30">
              <div className="flex items-center gap-4 flex-wrap">
                {showSearch && onSearchChange && (
                  <div className="relative w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-8 h-8"
                      data-testid="input-search-resources"
                    />
                  </div>
                )}
                {showTypeFilter && onTypeFilterChange && assetTypes.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {assetTypes.map(type => (
                      <Badge
                        key={type}
                        variant={typeFilter.includes(type) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          const newFilter = typeFilter.includes(type)
                            ? typeFilter.filter(t => t !== type)
                            : [...typeFilter, type];
                          onTypeFilterChange(newFilter);
                        }}
                        data-testid={`filter-type-${type}`}
                      >
                        {ASSET_TYPE_LABELS[type] || type}
                      </Badge>
                    ))}
                  </div>
                )}
                {showInactiveToggle && onInactiveToggle && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-inactive"
                      checked={includeInactive}
                      onCheckedChange={(checked) => onInactiveToggle(!!checked)}
                      data-testid="checkbox-include-inactive"
                    />
                    <label htmlFor="include-inactive" className="text-xs text-muted-foreground cursor-pointer">
                      Include inactive
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex h-10 border-b flex-shrink-0">
            <div className="w-56 flex-shrink-0 border-r bg-muted/30 flex items-center px-3">
              <span className="text-sm font-medium text-muted-foreground">Resources</span>
            </div>
            <div ref={timeHeaderRef} className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', overflowY: 'hidden' }}>
              <div className="flex h-full" style={{ minWidth: timeSlots.length * slotWidth }}>
                {timeSlots.map((slot, idx) => {
                  const isTodaySlot = isToday(slot);
                  return (
                    <div
                      key={idx}
                      style={{ width: slotWidth, minWidth: slotWidth }}
                      className={`flex-shrink-0 border-r px-1 flex items-center justify-center text-xs font-medium ${isTodaySlot ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                    >
                      {formatSlotHeader(slot, zoomLevel)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div ref={sidebarRef} className="w-56 flex-shrink-0 border-r bg-muted/30 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {Object.entries(groupedResources).map(([assetType, groupResources]) => (
                <div key={assetType}>
                  <div className="h-6 px-3 flex items-center bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {ASSET_TYPE_LABELS[assetType] || assetType}
                  </div>
                  {groupResources.map((resource) => {
                    const Icon = resource.is_capability_unit ? Wrench : getResourceIcon(resource.asset_type);
                    const isCapability = resource.is_capability_unit;
                    const statusBadge = isCapability && resource.capability_status !== 'operational'
                      ? resource.capability_status
                      : (resource.is_under_maintenance ? 'maint' : null);
                    const hasImage = !!resource.thumbnail_url;
                    
                    const resourceContent = (
                      <div
                        className={`h-12 flex items-center gap-2 px-3 border-b text-sm ${isCapability ? 'pl-6 bg-muted/20' : ''}`}
                        data-testid={`resource-row-${resource.id}`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isCapability ? 'text-muted-foreground' : 'text-foreground'}`} />
                        <span className={`truncate flex-1 ${isCapability ? 'text-muted-foreground text-xs' : ''} ${hasImage ? 'cursor-help' : ''}`}>
                          {resource.name}
                        </span>
                        {statusBadge && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {statusBadge}
                          </Badge>
                        )}
                      </div>
                    );
                    
                    return hasImage ? (
                      <HoverCard key={resource.id} openDelay={200} closeDelay={0}>
                        <HoverCardTrigger asChild>
                          {resourceContent}
                        </HoverCardTrigger>
                        <HoverCardContent side="right" align="start" className="w-52 p-2">
                          <img 
                            src={resource.thumbnail_url}
                            alt={resource.name}
                            className="w-full h-32 object-cover rounded-md mb-2"
                          />
                          <p className="text-sm font-medium">{resource.name}</p>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <div key={resource.id}>
                        {resourceContent}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-auto" ref={gridRef}>
              <div style={{ minWidth: timeSlots.length * slotWidth }}>
                <div className="relative">
                  {nowPosition !== null && (zoomLevel === '15m' || zoomLevel === '1h') && (
                    <div
                      ref={nowLineRef}
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                      style={{ left: `${nowPosition}%` }}
                      data-testid="now-line"
                    />
                  )}

                  {Object.entries(groupedResources).map(([assetType, groupResources]) => (
                    <div key={assetType}>
                      <div className="h-6 bg-muted/50" />
                      {groupResources.map((resource) => {
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

                              return (
                                <div
                                  key={idx}
                                  style={{ width: slotWidth, minWidth: slotWidth }}
                                  className="flex-shrink-0 border-r relative hover-elevate cursor-pointer"
                                  onClick={() => handleSlotClick(resource.id, slot)}
                                  data-testid={`schedule-slot-${resource.id}-${format(slot, 'yyyy-MM-dd-HHmm')}`}
                                >
                                  {resourceEvents.map((event) => {
                                    const pos = getEventPosition(event, slot, slotEnd);
                                    if (!pos) return null;
                                    const colorClass = EVENT_COLORS[event.event_type] || EVENT_COLORS[event.status] || EVENT_COLORS.booked;
                                    return (
                                      <div
                                        key={`${event.id}-${idx}`}
                                        className={`absolute top-1 bottom-1 rounded border text-white text-xs px-1 truncate cursor-pointer ${colorClass}`}
                                        style={{
                                          left: `${pos.left}%`,
                                          width: `${Math.max(pos.width, 5)}%`,
                                          zIndex: 10,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEventClick?.(event);
                                        }}
                                        title={`${event.title} (${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')})`}
                                        data-testid={`schedule-event-${event.id}`}
                                      >
                                        {pos.width > 20 && event.title}
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
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
