// LEGACY (V3.5): replaced by OpsCalendarBoardPage. Remove after QA.
// Replaced by shared/OpsCalendarBoardPage using ScheduleBoard time spine.

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, CalendarDays, MessageSquare, Eye } from "lucide-react";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import type { CalendarRunDTO } from "@shared/schema";
import { useNavigate } from "react-router-dom";

interface CalendarResponse {
  runs: CalendarRunDTO[];
  meta: {
    count: number;
    startDate: string;
    endDate: string;
  };
}

export default function ResidentCalendarPage() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<CalendarResponse>({
    queryKey: ['/api/resident/calendar'],
  });

  const runs = data?.runs || [];
  
  const upcomingRuns = runs.filter(r => r.status === 'scheduled' || r.status === 'in_progress');
  const completedRuns = runs.filter(r => r.status === 'completed');

  const handleRunClick = (run: CalendarRunDTO) => {
    navigate(`/app/my-place/requests/${run.runId}`);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6" data-testid="page-resident-calendar">
      <div className="flex items-center gap-3">
        <Home className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-resident-calendar">
            Your Schedule
          </h1>
          <p className="text-muted-foreground text-sm">
            Track service work at your property
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive">
            Unable to load your schedule. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && runs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No scheduled work</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You don't have any service work scheduled yet.
            </p>
            <Button onClick={() => navigate('/onboard/place')} data-testid="button-request-service">
              Request Service
            </Button>
          </CardContent>
        </Card>
      )}

      {upcomingRuns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming Work
          </h2>
          <div className="space-y-2">
            {upcomingRuns.map(run => (
              <Card key={run.runId} className="hover-elevate cursor-pointer" onClick={() => handleRunClick(run)}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{run.title}</p>
                    {run.startAt && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(run.startAt).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {run.zoneLabel && (
                      <p className="text-xs text-muted-foreground mt-1">{run.zoneLabel}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" data-testid={`button-view-${run.runId}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      View details
                    </Button>
                    <Button variant="ghost" size="icon" data-testid={`button-message-${run.runId}`}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completedRuns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-muted-foreground">
            Completed Work
          </h2>
          <div className="space-y-2">
            {completedRuns.slice(0, 5).map(run => (
              <Card key={run.runId} className="opacity-75 hover-elevate cursor-pointer" onClick={() => handleRunClick(run)}>
                <CardContent className="p-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm">{run.title}</p>
                    {run.startAt && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.startAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
