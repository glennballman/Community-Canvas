import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { ServiceRunCardCompact } from "./ServiceRunCard";
import type { ServiceRun } from "@/hooks/useServiceRuns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ServiceRunsCalendarProps {
  serviceRuns: ServiceRun[];
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectRun?: (run: ServiceRun) => void;
}

export function ServiceRunsCalendar({
  serviceRuns,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onSelectRun,
}: ServiceRunsCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const runsByDate = useMemo(() => {
    const map = new Map<string, ServiceRun[]>();
    for (const run of serviceRuns) {
      const dateKey = run.scheduled_date?.split("T")[0];
      if (dateKey) {
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(run);
      }
    }
    return map;
  }, [serviceRuns]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedDayRuns = selectedDay
    ? runsByDate.get(format(selectedDay, "yyyy-MM-dd")) || []
    : [];

  return (
    <div data-testid="service-runs-calendar">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold" data-testid="calendar-month-label">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevMonth}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {weekdays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-muted-foreground bg-muted/30"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayRuns = runsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={dateKey}
                className={`
                  min-h-[100px] border-b border-r p-1
                  ${!isCurrentMonth ? "bg-muted/20" : ""}
                  ${index % 7 === 6 ? "border-r-0" : ""}
                  ${index >= days.length - 7 ? "border-b-0" : ""}
                `}
                data-testid={`calendar-day-${dateKey}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`
                      text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${isCurrentDay ? "bg-primary text-primary-foreground" : ""}
                      ${!isCurrentMonth ? "text-muted-foreground" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </span>
                  {dayRuns.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1 cursor-pointer"
                      onClick={() => setSelectedDay(day)}
                    >
                      {dayRuns.length}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {dayRuns.slice(0, 2).map((run) => (
                    <ServiceRunCardCompact
                      key={run.id}
                      serviceRun={run}
                      onClick={() => onSelectRun?.(run)}
                    />
                  ))}
                  {dayRuns.length > 2 && (
                    <button
                      className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center py-0.5"
                      onClick={() => setSelectedDay(day)}
                    >
                      +{dayRuns.length - 2} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent data-testid="modal-day-runs">
          <DialogHeader>
            <DialogTitle>
              Service Runs - {selectedDay && format(selectedDay, "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-4">
              {selectedDayRuns.length === 0 ? (
                <p className="text-muted-foreground text-sm">No service runs scheduled.</p>
              ) : (
                selectedDayRuns.map((run) => (
                  <Card
                    key={run.id}
                    className="p-3 hover-elevate cursor-pointer"
                    onClick={() => {
                      onSelectRun?.(run);
                      setSelectedDay(null);
                    }}
                    data-testid={`day-run-${run.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm">{run.company_name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {run.service_type} · {run.destination_region}
                        </p>
                        {run.crew_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Crew: {run.crew_name}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {run.status}
                      </Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
