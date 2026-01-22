import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Route, Ship, Cloud, Zap, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

interface FeedStatus {
  status: 'ok' | 'warning' | 'critical';
  count: number;
  label: string;
}

interface ConditionsResponse {
  ok: boolean;
  portal: { id: string; name: string; slug: string } | null;
  overallStatus: 'ok' | 'risky' | 'blocked';
  statusLabel: string;
  feeds: {
    roads: FeedStatus;
    ferries: FeedStatus;
    weather: FeedStatus;
    power: FeedStatus;
    seismic: FeedStatus;
  };
  lastUpdated: string;
}

interface PortalConditionsBarProps {
  portalSlug: string;
  compact?: boolean;
}

export function PortalConditionsBar({ portalSlug, compact = false }: PortalConditionsBarProps) {
  const { data, isLoading } = useQuery<ConditionsResponse>({
    queryKey: [`/api/public/portal/${portalSlug}/conditions`],
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm text-muted-foreground">
        Loading conditions...
      </div>
    );
  }

  if (!data?.ok || !data?.portal) {
    return null;
  }

  const feedIcons = {
    roads: Route,
    ferries: Ship,
    weather: Cloud,
    power: Zap,
    seismic: Activity,
  };

  function getStatusColor(status: 'ok' | 'warning' | 'critical') {
    switch (status) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  }

  function getOverallBadge(status: 'ok' | 'risky' | 'blocked') {
    switch (status) {
      case 'blocked':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Service Disruptions
          </Badge>
        );
      case 'risky':
        return (
          <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <AlertTriangle className="h-3 w-3" />
            Minor Delays Possible
          </Badge>
        );
      default:
        return (
          <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3" />
            All Systems Normal
          </Badge>
        );
    }
  }

  if (compact) {
    return (
      <div 
        className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b"
        data-testid="portal-conditions-bar"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Community Conditions:</span>
          {getOverallBadge(data.overallStatus)}
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(data.feeds).map(([key, feed]) => {
            const Icon = feedIcons[key as keyof typeof feedIcons];
            return (
              <div 
                key={key} 
                className={`flex items-center gap-1 ${getStatusColor(feed.status)}`}
                title={`${feed.label}: ${feed.count} alerts`}
              >
                <Icon className="h-4 w-4" />
                {feed.count > 0 && (
                  <span className="text-xs font-medium">{feed.count}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="rounded-lg border bg-card p-4"
      data-testid="portal-conditions-card"
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="font-semibold">Community Conditions</h3>
        {getOverallBadge(data.overallStatus)}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(data.feeds).map(([key, feed]) => {
          const Icon = feedIcons[key as keyof typeof feedIcons];
          return (
            <div 
              key={key} 
              className="flex flex-col items-center gap-1 p-2 rounded bg-muted/50"
              data-testid={`condition-${key}`}
            >
              <Icon className={`h-5 w-5 ${getStatusColor(feed.status)}`} />
              <span className="text-xs text-muted-foreground">{feed.label}</span>
              <span className={`text-sm font-medium ${getStatusColor(feed.status)}`}>
                {feed.count === 0 ? 'OK' : `${feed.count} alert${feed.count > 1 ? 's' : ''}`}
              </span>
            </div>
          );
        })}
      </div>
      {data.lastUpdated && (
        <p className="text-xs text-muted-foreground mt-2 text-right">
          Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
