import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CalendarRunDTO } from "@shared/schema";

interface PortalCalendarResponse {
  runs: CalendarRunDTO[];
  portal: {
    id: string;
    name: string;
  };
  meta: {
    count: number;
    startDate: string;
    endDate: string;
  };
}

export default function PortalCalendarPage() {
  const { portalSlug } = useParams<{ portalSlug: string }>();

  const { data: portalData } = useQuery<{ id: string; name: string; slug: string }>({
    queryKey: ['/api/public/portal', portalSlug],
    enabled: !!portalSlug,
  });

  const { data, isLoading, error } = useQuery<PortalCalendarResponse>({
    queryKey: ['/api/portal', portalData?.id, 'calendar'],
    queryFn: async () => {
      if (!portalData?.id) throw new Error('Portal not found');
      const res = await fetch(`/api/portal/${portalData.id}/calendar`);
      if (!res.ok) throw new Error('Failed to fetch calendar');
      return res.json();
    },
    enabled: !!portalData?.id,
  });

  const runs = data?.runs || [];

  const groupRunsByDay = () => {
    const grouped: Record<string, CalendarRunDTO[]> = {};
    runs.forEach(run => {
      const dateKey = run.startAt 
        ? new Date(run.startAt).toDateString()
        : 'Unscheduled';
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(run);
    });
    return grouped;
  };

  const formatDateHeader = (dateStr: string) => {
    if (dateStr === 'Unscheduled') return dateStr;
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const groupedRuns = groupRunsByDay();
  const sortedDays = Object.keys(groupedRuns).sort((a, b) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-6" data-testid="page-portal-calendar">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-portal-calendar">
            {portalData?.name || 'Community'} Activity
          </h1>
          <p className="text-muted-foreground text-sm">
            Service activity in your area
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive">
            Unable to load community calendar.
          </CardContent>
        </Card>
      )}

      {!isLoading && runs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              No scheduled service activity in this area.
            </p>
          </CardContent>
        </Card>
      )}

      {sortedDays.map(dateKey => (
        <div key={dateKey} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
            {formatDateHeader(dateKey)}
          </h2>
          <div className="space-y-2">
            {groupedRuns[dateKey].map(run => (
              <Card key={run.runId} data-testid={`portal-run-${run.runId}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{run.title}</p>
                      {run.startAt && (
                        <p className="text-sm text-muted-foreground">
                          {new Date(run.startAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                    {run.zoneLabel && (
                      <Badge variant="outline" className="shrink-0">
                        <MapPin className="h-3 w-3 mr-1" />
                        {run.zoneLabel}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card className="bg-muted/50">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <p>
            This calendar shows scheduled service activity in {portalData?.name || 'this community'}.
            For detailed information, please contact your property manager.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
