import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReservationDetail } from "@/hooks/useReservationDetail";

interface ReservationInfoGridProps {
  reservation?: ReservationDetail;
  unitLabel?: string;
  partySize?: number | null;
  isLoading?: boolean;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string | null): string {
  if (!timeStr) return "—";
  return timeStr;
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

interface InfoRowProps {
  label: string;
  value?: string | number | null;
  testId?: string;
}

function InfoRow({ label, value, testId }: InfoRowProps) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium" data-testid={testId}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function ReservationInfoGrid({
  reservation,
  unitLabel,
  partySize,
  isLoading,
}: ReservationInfoGridProps) {
  if (isLoading) {
    return (
      <Card data-testid="reservation-info-loading">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reservation) {
    return null;
  }

  const checkInDate = reservation.check_in_date || reservation.start_at;
  const checkOutDate = reservation.check_out_date || reservation.end_at;

  return (
    <div className="space-y-4" data-testid="reservation-info-grid">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Guest Information</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Name" value={reservation.guest_name} testId="text-guest-name" />
          <InfoRow label="Email" value={reservation.guest_email} testId="text-guest-email" />
          <InfoRow label="Phone" value={reservation.guest_phone} testId="text-guest-phone" />
          <InfoRow label="Party size" value={partySize} testId="text-party-size" />
          {reservation.guest_notes && (
            <InfoRow label="Notes" value={reservation.guest_notes} testId="text-guest-notes" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stay Details</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Check-in" value={formatDate(checkInDate)} testId="text-checkin-date" />
          <InfoRow label="Check-out" value={formatDate(checkOutDate)} testId="text-checkout-date" />
          <InfoRow label="Unit / Asset" value={unitLabel} testId="text-unit-label" />
          <InfoRow label="Source" value={reservation.source} testId="text-source" />
          {reservation.expected_arrival_time && (
            <InfoRow 
              label="Expected arrival" 
              value={formatTime(reservation.expected_arrival_time)} 
              testId="text-expected-arrival" 
            />
          )}
          {reservation.actual_arrival_time && (
            <InfoRow 
              label="Actual arrival" 
              value={formatTime(reservation.actual_arrival_time)} 
              testId="text-actual-arrival" 
            />
          )}
        </CardContent>
      </Card>

      {(reservation.vehicle_plate || reservation.vessel_name) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vehicle / Vessel</CardTitle>
          </CardHeader>
          <CardContent>
            {reservation.vehicle_plate && (
              <InfoRow label="License plate" value={reservation.vehicle_plate} testId="text-vehicle-plate" />
            )}
            {reservation.vessel_name && (
              <InfoRow label="Vessel name" value={reservation.vessel_name} testId="text-vessel-name" />
            )}
            {reservation.vessel_length_ft && (
              <InfoRow label="Vessel length" value={`${reservation.vessel_length_ft} ft`} testId="text-vessel-length" />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">System Info</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Created" value={formatDateTime(reservation.created_at)} testId="text-created-at" />
          <InfoRow label="Last updated" value={formatDateTime(reservation.updated_at)} testId="text-updated-at" />
          {reservation.cancellation_reason && (
            <InfoRow label="Cancellation reason" value={reservation.cancellation_reason} testId="text-cancel-reason" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
