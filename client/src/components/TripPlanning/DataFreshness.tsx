import { RefreshCw } from 'lucide-react';

interface DataFreshnessProps {
  timestamp: string | null;
  source: string;
  onRefresh?: () => void;
}

export function formatFreshness(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function DataFreshness({ timestamp, source, onRefresh }: DataFreshnessProps) {
  if (!timestamp) return null;
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{source}: {formatFreshness(timestamp)}</span>
      {onRefresh && (
        <button 
          onClick={onRefresh}
          className="p-0.5 hover:bg-muted rounded"
          title="Refresh"
          data-testid={`button-refresh-${source.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface LiveDataStatusProps {
  lastRefresh: Date;
  alertCount?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function LiveDataStatus({ lastRefresh, alertCount = 0, isLoading, onRefresh }: LiveDataStatusProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
        <span>Live Data</span>
      </div>
      <span className="opacity-60">Webcams: 5 min</span>
      <span className="opacity-60">Weather: 30 min</span>
      <span className="opacity-60">Alerts: 5 min</span>
      {alertCount > 0 && (
        <span className="text-orange-400">{alertCount} active alert{alertCount !== 1 ? 's' : ''}</span>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <span>Last refresh: {formatFreshness(lastRefresh.toISOString())}</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 hover:bg-muted rounded disabled:opacity-50"
            title="Refresh all data"
            data-testid="button-refresh-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}
