import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle, XCircle, MessageSquare, Edit, AlertCircle } from "lucide-react";
import type { TimelineEntry } from "@/hooks/useReservationDetail";

interface ReservationTimelineProps {
  timeline: TimelineEntry[];
  isLoading?: boolean;
}

function getIconForType(type: string) {
  switch (type) {
    case "created":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "confirmed":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "check_in":
    case "checked_in":
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    case "check_out":
    case "checked_out":
      return <CheckCircle className="h-4 w-4 text-purple-600" />;
    case "cancelled":
    case "canceled":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "note":
    case "internal_note":
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    case "change_request":
    case "cancel_request":
      return <Edit className="h-4 w-4 text-amber-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function ReservationTimeline({ timeline, isLoading }: ReservationTimelineProps) {
  if (isLoading) {
    return (
      <Card data-testid="reservation-timeline-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <Card data-testid="reservation-timeline">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedTimeline.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4" data-testid="timeline-empty">
            Timeline not available yet.
          </p>
        ) : (
          <div className="space-y-4">
            {sortedTimeline.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3"
                data-testid={`timeline-entry-${entry.id}`}
              >
                <div className="mt-0.5">{getIconForType(entry.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.title}</p>
                  {entry.detail && (
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">
                      {entry.detail}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(entry.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
