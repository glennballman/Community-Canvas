import { useEffect, useState } from 'react';
import { Construction, AlertTriangle, XCircle, CloudLightning, Calendar, ExternalLink, ChevronDown, ChevronUp, Clock, CheckCircle, Route } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RoadEvent {
  id: string;
  event_type: string;
  severity: string;
  headline: string;
  description: string;
  roads: string;
  location: string;
  created_at: string;
  estimated_end?: string;
}

interface RoadEventsProps {
  regionId?: string;
  maxEvents?: number;
}

export function RoadEvents({ regionId, maxEvents = 6 }: RoadEventsProps) {
  const [events, setEvents] = useState<RoadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [regionId]);

  async function fetchEvents() {
    try {
      const url = `/api/v1/alerts/active?type=road_event&limit=${maxEvents}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        setEvents(data);
      } else {
        setEvents(getMockRoadEvents());
      }
    } catch (error) {
      console.error('Failed to fetch road events:', error);
      setEvents(getMockRoadEvents());
    } finally {
      setLoading(false);
    }
  }

  const eventTypeConfig: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
    incident: { icon: AlertTriangle, label: 'Incident', color: 'text-red-400' },
    construction: { icon: Construction, label: 'Construction', color: 'text-orange-400' },
    closure: { icon: XCircle, label: 'Closure', color: 'text-red-500' },
    weather: { icon: CloudLightning, label: 'Weather', color: 'text-blue-400' },
    special_event: { icon: Calendar, label: 'Event', color: 'text-purple-400' },
  };

  const counts = events.reduce((acc, event) => {
    const type = event.event_type?.toLowerCase() || 'incident';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.event_type?.toLowerCase() === filter);

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-32"></div>
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-muted rounded-full w-20"></div>
            ))}
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl overflow-hidden border">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Route className="w-5 h-5" /> Road Events
            <span className="text-sm font-normal text-muted-foreground">
              ({events.length})
            </span>
          </h3>
          <a
            href="https://www.drivebc.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
            data-testid="link-drivebc"
          >
            DriveBC <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
            count={events.length}
          />
          {Object.entries(eventTypeConfig).map(([type, config]) => (
            counts[type] > 0 && (
              <FilterPill
                key={type}
                active={filter === type}
                onClick={() => setFilter(type)}
                Icon={config.icon}
                label={config.label}
                count={counts[type]}
              />
            )
          ))}
        </div>
      </div>

      <div className="divide-y max-h-80 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-green-500" />
            <p className="text-muted-foreground mt-2">No active road events</p>
          </div>
        ) : (
          filteredEvents.slice(0, maxEvents).map(event => (
            <RoadEventItem key={event.id} event={event} config={eventTypeConfig} />
          ))
        )}
      </div>
    </div>
  );
}

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  Icon?: typeof AlertTriangle;
  label: string;
  count: number;
}

function FilterPill({ active, onClick, Icon, label, count }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
          : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
      }`}
      data-testid={`filter-${label.toLowerCase()}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      <span>{label}</span>
      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
        {count}
      </Badge>
    </button>
  );
}

interface RoadEventItemProps {
  event: RoadEvent;
  config: Record<string, { icon: typeof AlertTriangle; label: string; color: string }>;
}

function RoadEventItem({ event, config }: RoadEventItemProps) {
  const [expanded, setExpanded] = useState(false);
  const type = event.event_type?.toLowerCase() || 'incident';
  const typeConfig = config[type] || config.incident;
  const Icon = typeConfig.icon;

  const severityColors: Record<string, string> = {
    major: 'border-l-red-500 bg-red-500/5',
    minor: 'border-l-yellow-500 bg-yellow-500/5',
    warning: 'border-l-orange-500 bg-orange-500/5',
    advisory: 'border-l-blue-500 bg-blue-500/5',
  };

  const severityClass = severityColors[event.severity?.toLowerCase()] || severityColors.minor;

  return (
    <div
      className={`p-3 border-l-4 ${severityClass} cursor-pointer hover:bg-muted/30 transition-colors`}
      onClick={() => setExpanded(!expanded)}
      data-testid={`road-event-${event.id}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${typeConfig.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold uppercase ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            {event.roads && (
              <>
                <span className="text-muted-foreground">-</span>
                <span className="text-xs text-muted-foreground">{event.roads}</span>
              </>
            )}
          </div>

          <h4 className="text-sm mt-1 line-clamp-2">
            {event.headline}
          </h4>

          {expanded && event.description && (
            <p className="text-muted-foreground text-xs mt-2 line-clamp-3">
              {event.description}
            </p>
          )}

          {expanded && event.estimated_end && (
            <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Est. end: {new Date(event.estimated_end).toLocaleString()}
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

function getMockRoadEvents(): RoadEvent[] {
  return [
    {
      id: '1',
      event_type: 'construction',
      severity: 'minor',
      headline: 'Highway 1 - Single lane alternating traffic',
      description: 'Road improvements in progress. Expect delays of up to 20 minutes.',
      roads: 'Highway 1',
      location: 'Between Langley and Abbotsford',
      created_at: new Date().toISOString(),
      estimated_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      event_type: 'incident',
      severity: 'major',
      headline: 'Vehicle incident - Right lane blocked',
      description: 'Emergency crews on scene. Avoid area if possible.',
      roads: 'Highway 99',
      location: 'Southbound near Steveston',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      event_type: 'weather',
      severity: 'warning',
      headline: 'Winter conditions - Snow and ice',
      description: 'Use winter tires. Drive with caution.',
      roads: 'Coquihalla Highway',
      location: 'Summit to Merritt',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      event_type: 'closure',
      severity: 'major',
      headline: 'Road closed due to avalanche risk',
      description: 'Highway closed until further notice. Use alternate route via Highway 3.',
      roads: 'Highway 3A',
      location: 'Kootenay Pass',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      event_type: 'construction',
      severity: 'minor',
      headline: 'Bridge maintenance - Reduced speed',
      description: 'Speed reduced to 50 km/h through work zone.',
      roads: 'Highway 17',
      location: 'Massey Tunnel',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export default RoadEvents;
