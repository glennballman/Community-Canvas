// LEGACY (V3.5): replaced by OpsCalendarBoardPage. Remove after QA.
// This iPhone-style calendar has been deprecated in favor of the Operations Timeline Grid
// which uses ScheduleBoard's time spine (ZOOM_CONFIGS, generateTimeSlots, 15m zoom).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, ChevronLeft, ChevronRight, List, Grid3X3 } from "lucide-react";
import { CalendarRunCard } from "./CalendarRunCard";
import type { CalendarRunDTO } from "@shared/schema";

interface CalendarGridProps {
  runs: CalendarRunDTO[];
  variant?: 'contractor' | 'resident' | 'portal';
  onRunClick?: (run: CalendarRunDTO) => void;
  isLoading?: boolean;
}

type ViewMode = 'week' | 'day' | 'list';

export function CalendarGrid({ runs, variant = 'contractor', onRunClick, isLoading }: CalendarGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getRunsForDate = (date: Date) => {
    return runs.filter(run => {
      if (!run.startAt) return false;
      const runDate = new Date(run.startAt);
      return runDate.toDateString() === date.toDateString();
    });
  };

  const groupRunsByDate = () => {
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

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious} data-testid="calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="calendar-today">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext} data-testid="calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2" data-testid="calendar-date-range">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        
        {variant === 'contractor' && (
          <div className="flex items-center gap-1">
            <Button 
              variant={viewMode === 'list' ? 'default' : 'outline'} 
              size="icon"
              onClick={() => setViewMode('list')}
              data-testid="view-list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'} 
              size="icon"
              onClick={() => setViewMode('week')}
              data-testid="view-week"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'} 
              size="icon"
              onClick={() => setViewMode('day')}
              data-testid="view-day"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'list' && (
        <ListView 
          runs={runs} 
          variant={variant}
          onRunClick={onRunClick}
          groupRunsByDate={groupRunsByDate}
          formatDateHeader={formatDateHeader}
        />
      )}

      {viewMode === 'week' && (
        <WeekView 
          days={getWeekDays()} 
          runs={runs}
          variant={variant}
          onRunClick={onRunClick}
          getRunsForDate={getRunsForDate}
        />
      )}

      {viewMode === 'day' && (
        <DayView 
          date={currentDate}
          runs={getRunsForDate(currentDate)}
          variant={variant}
          onRunClick={onRunClick}
          formatDateHeader={formatDateHeader}
        />
      )}
    </div>
  );
}

function ListView({ 
  runs, 
  variant, 
  onRunClick, 
  groupRunsByDate,
  formatDateHeader 
}: {
  runs: CalendarRunDTO[];
  variant: 'contractor' | 'resident' | 'portal';
  onRunClick?: (run: CalendarRunDTO) => void;
  groupRunsByDate: () => Record<string, CalendarRunDTO[]>;
  formatDateHeader: (date: Date) => string;
}) {
  const grouped = groupRunsByDate();
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No service runs in this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sortedKeys.map(dateKey => (
        <div key={dateKey} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
            {dateKey === 'Unscheduled' ? dateKey : formatDateHeader(new Date(dateKey))}
          </h3>
          <div className="space-y-2">
            {grouped[dateKey].map(run => (
              <CalendarRunCard 
                key={run.runId} 
                run={run} 
                variant={variant}
                onClick={() => onRunClick?.(run)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeekView({ 
  days, 
  runs,
  variant,
  onRunClick,
  getRunsForDate 
}: {
  days: Date[];
  runs: CalendarRunDTO[];
  variant: 'contractor' | 'resident' | 'portal';
  onRunClick?: (run: CalendarRunDTO) => void;
  getRunsForDate: (date: Date) => CalendarRunDTO[];
}) {
  const today = new Date().toDateString();

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(day => {
        const dayRuns = getRunsForDate(day);
        const isToday = day.toDateString() === today;
        
        return (
          <Card 
            key={day.toISOString()} 
            className={`min-h-[150px] ${isToday ? 'ring-2 ring-primary' : ''}`}
          >
            <CardHeader className="p-2 pb-0">
              <CardTitle className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                <span className="block">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {day.getDate()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {dayRuns.slice(0, 3).map(run => (
                <div 
                  key={run.runId}
                  className="text-xs p-1 rounded bg-accent/50 hover-elevate cursor-pointer truncate"
                  onClick={() => onRunClick?.(run)}
                >
                  {run.title}
                </div>
              ))}
              {dayRuns.length > 3 && (
                <p className="text-xs text-muted-foreground">+{dayRuns.length - 3} more</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DayView({ 
  date, 
  runs,
  variant,
  onRunClick,
  formatDateHeader 
}: {
  date: Date;
  runs: CalendarRunDTO[];
  variant: 'contractor' | 'resident' | 'portal';
  onRunClick?: (run: CalendarRunDTO) => void;
  formatDateHeader: (date: Date) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{formatDateHeader(date)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No runs scheduled for this day</p>
        ) : (
          runs.map(run => (
            <CalendarRunCard 
              key={run.runId} 
              run={run} 
              variant={variant}
              onClick={() => onRunClick?.(run)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default CalendarGrid;
