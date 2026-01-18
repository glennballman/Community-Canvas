import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, LogIn, LogOut } from "lucide-react";
import { ReservationStatusBadge } from "./ReservationStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReservationRow } from "@/hooks/useReservationsIndex";

interface ReservationsTableProps {
  reservations: ReservationRow[];
  isLoading: boolean;
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
  checkInAvailable?: boolean;
  checkOutAvailable?: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function ReservationsTable({
  reservations,
  isLoading,
  onCheckIn,
  onCheckOut,
  checkInAvailable = true,
  checkOutAvailable = true,
}: ReservationsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="loading-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-testid="reservations-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Unit / Asset</TableHead>
            <TableHead>Confirmation</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((res) => {
            const canCheckIn = res.status === "confirmed";
            const canCheckOut = res.status === "checked_in";

            return (
              <TableRow key={res.id} data-testid={`row-reservation-${res.id}`}>
                <TableCell>
                  <ReservationStatusBadge status={res.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(res.checkIn)} → {formatDate(res.checkOut)}
                </TableCell>
                <TableCell>{res.guestName}</TableCell>
                <TableCell>{res.unitName}</TableCell>
                <TableCell className="font-mono text-sm">
                  {res.confirmationNumber || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      data-testid={`button-view-${res.id}`}
                    >
                      <Link to={`/app/reservations/${res.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canCheckIn || !checkInAvailable}
                            onClick={() => onCheckIn?.(res.id)}
                            data-testid={`button-checkin-${res.id}`}
                          >
                            <LogIn className="h-4 w-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!checkInAvailable
                          ? "Not available"
                          : !canCheckIn
                          ? "Status must be confirmed"
                          : "Check in"}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canCheckOut || !checkOutAvailable}
                            onClick={() => onCheckOut?.(res.id)}
                            data-testid={`button-checkout-${res.id}`}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!checkOutAvailable
                          ? "Not available"
                          : !canCheckOut
                          ? "Status must be checked in"
                          : "Check out"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
