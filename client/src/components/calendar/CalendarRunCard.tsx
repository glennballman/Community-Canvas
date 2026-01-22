import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { CalendarRunDTO } from "@shared/schema";

interface CalendarRunCardProps {
  run: CalendarRunDTO;
  variant?: 'contractor' | 'resident' | 'portal';
  onClick?: () => void;
}

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    variant: 'secondary' as const,
    icon: AlertCircle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  scheduled: {
    label: 'Scheduled',
    variant: 'default' as const,
    icon: CalendarDays,
    className: 'text-blue-600 dark:text-blue-400',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default' as const,
    icon: Loader2,
    className: 'text-green-600 dark:text-green-400',
  },
  completed: {
    label: 'Completed',
    variant: 'outline' as const,
    icon: CheckCircle2,
    className: 'text-muted-foreground',
  },
};

export function CalendarRunCard({ run, variant = 'contractor', onClick }: CalendarRunCardProps) {
  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = statusConfig.icon;
  
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Card 
      className={`hover-elevate cursor-pointer ${run.status === 'draft' ? 'border-amber-500/50' : ''}`}
      onClick={onClick}
      data-testid={`calendar-run-card-${run.runId}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" data-testid="calendar-run-title">
              {run.title}
            </p>
            {run.startAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>{formatDate(run.startAt)}</span>
                {formatTime(run.startAt) && (
                  <span>at {formatTime(run.startAt)}</span>
                )}
              </div>
            )}
          </div>
          <Badge 
            variant={statusConfig.variant}
            className={`shrink-0 ${statusConfig.className}`}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {run.zoneLabel && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {run.zoneLabel}
            </Badge>
          )}
          {variant === 'contractor' && run.portalLabel && (
            <Badge variant="secondary" className="text-xs">
              {run.portalLabel}
            </Badge>
          )}
          {run.evidenceStatus && run.evidenceStatus !== 'none' && (
            <Badge 
              variant={run.evidenceStatus === 'complete' ? 'default' : 'secondary'}
              className="text-xs"
            >
              Evidence: {run.evidenceStatus}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RunStatusBadge({ status }: { status: CalendarRunDTO['status'] }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function ZoneBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="text-xs">
      <MapPin className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}
