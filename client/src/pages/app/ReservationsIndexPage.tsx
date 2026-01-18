import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { ReservationFilters } from "@/components/reservations/ReservationFilters";
import { ReservationsTable } from "@/components/reservations/ReservationsTable";
import { useReservationsIndex, useReservationCheckIn, useReservationCheckOut } from "@/hooks/useReservationsIndex";
import { useToast } from "@/hooks/use-toast";

export default function ReservationsIndexPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [page] = useState(1);

  const { toast } = useToast();

  const { reservations, total, isLoading, error, refetch } = useReservationsIndex({
    q,
    status,
    startDate,
    endDate,
    upcomingOnly,
    page,
    pageSize: 20,
  });

  const checkInMutation = useReservationCheckIn();
  const checkOutMutation = useReservationCheckOut();

  const handleClearFilters = () => {
    setQ("");
    setStatus("all");
    setStartDate("");
    setEndDate("");
    setUpcomingOnly(true);
  };

  const handleCheckIn = async (id: string) => {
    try {
      await checkInMutation.mutateAsync(id);
      toast({ title: "Checked in successfully" });
    } catch (e: any) {
      toast({ title: "Check-in failed", description: e.message, variant: "destructive" });
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await checkOutMutation.mutateAsync(id);
      toast({ title: "Checked out successfully" });
    } catch (e: any) {
      toast({ title: "Check-out failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="reservations-index-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Reservations</h1>
          {!isLoading && (
            <span className="text-muted-foreground" data-testid="text-total-count">
              ({total} total)
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <ReservationFilters
        q={q}
        status={status}
        startDate={startDate}
        endDate={endDate}
        upcomingOnly={upcomingOnly}
        onQChange={setQ}
        onStatusChange={setStatus}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onUpcomingOnlyChange={setUpcomingOnly}
        onClearFilters={handleClearFilters}
      />

      {error ? (
        <Card className="border-destructive" data-testid="error-state">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
            <p className="text-destructive mb-4">
              {error instanceof Error ? error.message : "Failed to load reservations"}
            </p>
            <Button size="sm" onClick={() => refetch()} data-testid="button-retry">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <ReservationsTable reservations={[]} isLoading={true} />
      ) : reservations.length === 0 ? (
        <Card data-testid="empty-state">
          <CardHeader>
            <CardTitle className="text-center text-muted-foreground">
              No reservations match your filters
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={handleClearFilters} data-testid="button-clear-empty">
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ReservationsTable
          reservations={reservations}
          isLoading={false}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          checkInAvailable={true}
          checkOutAvailable={true}
        />
      )}
    </div>
  );
}
