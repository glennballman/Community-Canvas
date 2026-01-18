import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Calendar, X, MapPin, Users, Clock, Truck } from "lucide-react";
import { ServiceRunsCalendar } from "@/components/service-runs/ServiceRunsCalendar";
import { ServiceRunsFilters } from "@/components/service-runs/ServiceRunsFilters";
import {
  useServiceRuns,
  useServiceRunFilters,
  useServiceRunsCalendarFilters,
  type ServiceRun,
} from "@/hooks/useServiceRuns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function ServiceRunsCalendarPage() {
  const [selectedRun, setSelectedRun] = useState<ServiceRun | null>(null);

  const {
    currentMonth,
    startDate,
    endDate,
    status,
    serviceType,
    search,
    nextMonth,
    prevMonth,
    setStatus,
    setServiceType,
    setSearch,
    clearFilters,
    hasActiveFilters,
  } = useServiceRunsCalendarFilters();

  const { serviceRuns, isLoading, isError, refetch } = useServiceRuns({
    startDate,
    endDate,
    status,
    serviceType,
    search,
  });

  const { serviceTypes, statuses } = useServiceRunFilters();

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[400px] gap-4"
        data-testid="service-runs-error"
      >
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Service Runs</h2>
        <p className="text-muted-foreground text-center max-w-md">
          There was a problem loading service runs. Please try again.
        </p>
        <Button onClick={() => refetch()} data-testid="button-retry">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="service-runs-calendar-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Service Runs
          </h1>
          <p className="text-muted-foreground mt-1">52-week operational calendar</p>
        </div>

        <ServiceRunsFilters
          serviceTypes={serviceTypes}
          statuses={statuses}
          selectedServiceTypes={serviceType}
          selectedStatuses={status}
          search={search}
          onServiceTypeChange={setServiceType}
          onStatusChange={setStatus}
          onSearchChange={setSearch}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {status.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              <button
                onClick={() => setStatus(status.filter((x) => x !== s))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {serviceType.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button
                onClick={() => setServiceType(serviceType.filter((x) => x !== t))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
              <button onClick={() => setSearch("")} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4" data-testid="service-runs-loading">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          <Card className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </Card>
        </div>
      ) : serviceRuns.length === 0 && !hasActiveFilters ? (
        <Card className="p-8" data-testid="service-runs-empty">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">No service runs scheduled</h3>
              <p className="text-muted-foreground mt-1">
                No service runs scheduled for this period.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <ServiceRunsCalendar
          serviceRuns={serviceRuns}
          currentMonth={currentMonth}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onSelectRun={setSelectedRun}
        />
      )}

      <Sheet open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <SheetContent data-testid="service-run-detail-panel">
          <SheetHeader>
            <SheetTitle>Service Run Details</SheetTitle>
            <SheetDescription>Read-only view of service run information</SheetDescription>
          </SheetHeader>

          {selectedRun && (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg">{selectedRun.company_name}</h3>
                <p className="text-muted-foreground">{selectedRun.title}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedRun.service_type}</Badge>
                <Badge variant="outline">{selectedRun.status}</Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Scheduled Date</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRun.scheduled_date
                        ? format(new Date(selectedRun.scheduled_date), "MMMM d, yyyy")
                        : "Not scheduled"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Destination</p>
                    <p className="text-sm text-muted-foreground">{selectedRun.destination_region}</p>
                  </div>
                </div>

                {selectedRun.crew_name && (
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Crew Lead</p>
                      <p className="text-sm text-muted-foreground">{selectedRun.crew_name}</p>
                    </div>
                  </div>
                )}

                {selectedRun.planned_duration_days && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRun.planned_duration_days} day
                        {selectedRun.planned_duration_days !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                )}

                {selectedRun.total_job_slots && (
                  <div className="flex items-center gap-3">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Job Slots</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRun.slots_filled || 0} / {selectedRun.total_job_slots} filled
                      </p>
                    </div>
                  </div>
                )}

                {selectedRun.notes && (
                  <div className="pt-2">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRun.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
