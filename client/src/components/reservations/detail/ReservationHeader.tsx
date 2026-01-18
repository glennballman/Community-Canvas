import { Link } from "react-router-dom";
import { ArrowLeft, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReservationStatusBadge } from "../ReservationStatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ReservationHeaderProps {
  confirmationNumber?: string | null;
  status?: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  unitLabel?: string;
  isLoading?: boolean;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  checkInPending?: boolean;
  checkOutPending?: boolean;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ReservationHeader({
  confirmationNumber,
  status,
  checkInDate,
  checkOutDate,
  unitLabel,
  isLoading,
  canCheckIn,
  canCheckOut,
  onCheckIn,
  onCheckOut,
  checkInPending,
  checkOutPending,
}: ReservationHeaderProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="reservation-header-loading">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4" data-testid="reservation-header">
        <Link
          to="/app/reservations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-back-reservations"
        >
          <ArrowLeft className="h-4 w-4" />
          All reservations
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold" data-testid="text-confirmation">
                Reservation {confirmationNumber || "—"}
              </h1>
              {status && <ReservationStatusBadge status={status} />}
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-dates-unit">
              {formatDate(checkInDate)} → {formatDate(checkOutDate)} · {unitLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canCheckIn || checkInPending}
                    onClick={onCheckIn}
                    data-testid="button-header-checkin"
                  >
                    <LogIn className="mr-1 h-4 w-4" />
                    Check in
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {canCheckIn ? "Check in guest" : "Status must be confirmed"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canCheckOut || checkOutPending}
                    onClick={onCheckOut}
                    data-testid="button-header-checkout"
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    Check out
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {canCheckOut ? "Check out guest" : "Status must be checked in"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
