import { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Ship, 
  Car, 
  Cloud, 
  Zap, 
  Flame,
  Construction,
  Ban,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Alert {
  id: number;
  alert_type: string;
  severity: string;
  title: string;
  summary: string;
  region_name: string;
  source_id: string;
  created_at: string;
  effective_until: string | null;
  details: Record<string, any>;
}

interface AlertsFeedProps {
  regionId?: string;
  maxAlerts?: number;
  compact?: boolean;
  onViewAll?: () => void;
}

export function AlertsFeed({ regionId, maxAlerts = 10, compact = false, onViewAll }: AlertsFeedProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [regionId]);

  async function fetchAlerts() {
    try {
      const url = regionId && regionId !== 'bc'
        ? `/api/v1/alerts/active?region=${regionId}&limit=${maxAlerts}`
        : `/api/v1/alerts/active?limit=${maxAlerts}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
        <p className="mt-2 font-medium">No active alerts</p>
        <p className="text-sm text-muted-foreground">All systems operating normally</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Live Alerts
          <Badge variant="secondary" className="ml-1">{alerts.length}</Badge>
        </h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Radio className="w-3 h-3 text-green-500 animate-pulse" />
          Auto-refresh
        </span>
      </div>

      <ScrollArea className={compact ? 'h-80' : 'h-[500px]'}>
        {alerts.map((alert, index) => (
          <AlertItem 
            key={alert.id} 
            alert={alert} 
            compact={compact}
            isLast={index === alerts.length - 1}
          />
        ))}
      </ScrollArea>

      {alerts.length >= maxAlerts && onViewAll && (
        <div className="px-4 py-2 bg-muted/50 border-t text-center">
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all alerts
          </Button>
        </div>
      )}
    </div>
  );
}

interface AlertItemProps {
  alert: Alert;
  compact?: boolean;
  isLast?: boolean;
}

function AlertItem({ alert, compact, isLast }: AlertItemProps) {
  const [expanded, setExpanded] = useState(false);

  const severityConfig: Record<string, { 
    icon: typeof AlertTriangle; 
    bg: string; 
    border: string; 
    text: string;
    badge: string;
  }> = {
    critical: { 
      icon: AlertTriangle, 
      bg: 'bg-red-500/10 dark:bg-red-500/20', 
      border: 'border-l-red-500', 
      text: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    },
    emergency: { 
      icon: AlertTriangle, 
      bg: 'bg-red-500/10 dark:bg-red-500/20', 
      border: 'border-l-red-500', 
      text: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    },
    major: { 
      icon: AlertCircle, 
      bg: 'bg-orange-500/10 dark:bg-orange-500/20', 
      border: 'border-l-orange-500', 
      text: 'text-orange-600 dark:text-orange-400',
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    },
    warning: { 
      icon: AlertCircle, 
      bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', 
      border: 'border-l-yellow-500', 
      text: 'text-yellow-600 dark:text-yellow-400',
      badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    },
    advisory: { 
      icon: Info, 
      bg: 'bg-blue-500/10 dark:bg-blue-500/20', 
      border: 'border-l-blue-500', 
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    },
    minor: { 
      icon: Info, 
      bg: 'bg-slate-500/10 dark:bg-slate-500/20', 
      border: 'border-l-slate-400', 
      text: 'text-slate-600 dark:text-slate-400',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    },
    info: { 
      icon: Info, 
      bg: 'bg-slate-500/10 dark:bg-slate-500/20', 
      border: 'border-l-slate-400', 
      text: 'text-slate-600 dark:text-slate-400',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    },
  };

  const config = severityConfig[alert.severity] || severityConfig.info;
  const SeverityIcon = config.icon;

  const typeIcons: Record<string, typeof Car> = {
    closure: Ban,
    delay: Car,
    cancellation: Ban,
    outage: Zap,
    weather: Cloud,
    hazard: AlertTriangle,
    maintenance: Construction,
    advisory: Info,
  };

  const TypeIcon = typeIcons[alert.alert_type] || AlertCircle;
  const timeAgo = getTimeAgo(new Date(alert.created_at));

  return (
    <div 
      className={`p-4 border-l-4 ${config.bg} ${config.border} ${!isLast ? 'border-b' : ''} cursor-pointer hover:bg-muted/50 transition-colors`}
      onClick={() => setExpanded(!expanded)}
      data-testid={`alert-item-${alert.id}`}
    >
      <div className="flex items-start gap-3">
        <TypeIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.text}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${config.badge}`}>
              {alert.severity}
            </span>
            {alert.region_name && (
              <>
                <span className="text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground">{alert.region_name}</span>
              </>
            )}
            <span className="text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          <h4 className="font-medium mt-1 line-clamp-2">
            {alert.title}
          </h4>

          {(expanded || !compact) && alert.summary && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
              {alert.summary}
            </p>
          )}

          {expanded && alert.details && Object.keys(alert.details).length > 0 && (
            <div className="mt-3 p-2 bg-muted rounded text-xs text-muted-foreground space-y-1">
              {alert.details.roads && Array.isArray(alert.details.roads) && (
                <p className="flex items-center gap-1">
                  <Car className="w-3 h-3" /> Roads: {alert.details.roads.map((r: any) => r.name || r).join(', ')}
                </p>
              )}
              {alert.details.event_type && (
                <p className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Type: {alert.details.event_type}
                </p>
              )}
              {alert.source_id && (
                <p className="flex items-center gap-1">
                  <Radio className="w-3 h-3" /> Source: {alert.source_id}
                </p>
              )}
            </div>
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

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default AlertsFeed;
