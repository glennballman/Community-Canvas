import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, AlertTriangle, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import type { CalendarRunDTO } from "@shared/schema";
import { useLocation } from "wouter";

interface CalendarResponse {
  runs: CalendarRunDTO[];
  meta: {
    count: number;
    startDate: string;
    endDate: string;
  };
}

export default function ContractorCalendarPage() {
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<CalendarResponse>({
    queryKey: ['/api/contractor/calendar'],
  });

  const runs = data?.runs || [];
  
  const draftRuns = runs.filter(r => r.status === 'draft');
  const incompleteEvidence = runs.filter(r => r.evidenceStatus === 'partial');

  const handleRunClick = (run: CalendarRunDTO) => {
    setLocation(`/app/n3/runs/${run.runId}`);
  };

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="page-contractor-calendar">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-contractor-calendar">
              Service Calendar
            </h1>
            <p className="text-muted-foreground text-sm">
              View and manage your service runs
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {draftRuns.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {draftRuns.length} draft{draftRuns.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {incompleteEvidence.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Camera className="h-3 w-3" />
              {incompleteEvidence.length} need evidence
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive">
            Failed to load calendar. Please try again.
          </CardContent>
        </Card>
      )}

      <CalendarGrid 
        runs={runs}
        variant="contractor"
        onRunClick={handleRunClick}
        isLoading={isLoading}
      />

      {draftRuns.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              You have {draftRuns.length} draft run{draftRuns.length !== 1 ? 's' : ''} that need scheduling.
            </p>
            {draftRuns.slice(0, 3).map(run => (
              <div 
                key={run.runId}
                className="p-2 rounded bg-amber-500/10 hover-elevate cursor-pointer text-sm"
                onClick={() => handleRunClick(run)}
              >
                {run.title}
                {run.zoneLabel && <span className="text-muted-foreground ml-2">({run.zoneLabel})</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
