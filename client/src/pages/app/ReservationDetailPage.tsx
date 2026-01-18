import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useReservationDetail } from "@/hooks/useReservationDetail";
import { ReservationHeader } from "@/components/reservations/detail/ReservationHeader";
import { ReservationInfoGrid } from "@/components/reservations/detail/ReservationInfoGrid";
import { ReservationTimeline } from "@/components/reservations/detail/ReservationTimeline";
import { ReservationActionsPanel } from "@/components/reservations/detail/ReservationActionsPanel";

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const {
    reservation,
    timeline,
    checkInDate,
    checkOutDate,
    unitLabel,
    partySize,
    isLoading,
    isError,
    notFound,
    refetch,
    checkIn,
    checkOut,
    addNote,
    requestChange,
    requestCancel,
    canCheckIn,
    canCheckOut,
  } = useReservationDetail(id);

  async function handleCheckIn() {
    try {
      await checkIn.mutateAsync();
      toast({
        title: "Checked in",
        description: "Guest has been checked in successfully.",
      });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to check in",
        variant: "destructive",
      });
    }
  }

  async function handleCheckOut() {
    try {
      await checkOut.mutateAsync();
      toast({
        title: "Checked out",
        description: "Guest has been checked out successfully.",
      });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to check out",
        variant: "destructive",
      });
    }
  }

  async function handleAddNote(message: string) {
    return addNote.mutateAsync(message);
  }

  async function handleRequestChange(message: string) {
    return requestChange.mutateAsync(message);
  }

  async function handleRequestCancel(message: string) {
    return requestCancel.mutateAsync(message);
  }

  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[400px] gap-4"
        data-testid="reservation-not-found"
      >
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Reservation Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The reservation you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button asChild>
          <Link to="/app/reservations">Back to Reservations</Link>
        </Button>
      </div>
    );
  }

  if (isError && !isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[400px] gap-4"
        data-testid="reservation-error"
      >
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Reservation</h2>
        <p className="text-muted-foreground text-center max-w-md">
          There was a problem loading this reservation. Please try again.
        </p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="reservation-detail">
      <ReservationHeader
        confirmationNumber={reservation?.confirmation_number}
        status={reservation?.status}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        unitLabel={unitLabel}
        isLoading={isLoading}
        canCheckIn={canCheckIn}
        canCheckOut={canCheckOut}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        checkInPending={checkIn.isPending}
        checkOutPending={checkOut.isPending}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ReservationInfoGrid
            reservation={reservation}
            unitLabel={unitLabel}
            partySize={partySize}
            isLoading={isLoading}
          />
          <ReservationTimeline timeline={timeline} isLoading={isLoading} />
        </div>

        <div className="space-y-6">
          <ReservationActionsPanel
            isLoading={isLoading}
            canCheckIn={canCheckIn}
            canCheckOut={canCheckOut}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onAddNote={handleAddNote}
            onRequestChange={handleRequestChange}
            onRequestCancel={handleRequestCancel}
            checkInPending={checkIn.isPending}
            checkOutPending={checkOut.isPending}
            addNotePending={addNote.isPending}
            requestChangePending={requestChange.isPending}
            requestCancelPending={requestCancel.isPending}
            notesAvailable={true}
            changeRequestAvailable={true}
            cancelRequestAvailable={true}
          />
        </div>
      </div>
    </div>
  );
}
