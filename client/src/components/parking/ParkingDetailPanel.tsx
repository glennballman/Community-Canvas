import { format } from "date-fns";
import { X, Car, Accessibility, Zap, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  unit: {
    id: string;
    code: string;
    name: string;
    zone_code: string | null;
    size_class: string | null;
    covered: boolean;
    accessible: boolean;
    ev_charging: boolean;
    currentStatus: string;
    allocation: {
      guest_name: string | null;
      starts_at: string | null;
      ends_at: string | null;
      reservation_id: string | null;
    } | null;
  } | null;
  onClose: () => void;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  occupied: "destructive",
  reserved: "secondary",
  maintenance: "outline",
};

const statusLabels: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  maintenance: "Maintenance",
};

export function ParkingDetailPanel({ unit, onClose }: Props) {
  if (!unit) {
    return (
      <div
        className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground"
        data-testid="parking-detail-panel"
      >
        <Car className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <p data-testid="text-empty-state">Select a stall to view details</p>
      </div>
    );
  }

  const statusVariant = statusVariants[unit.currentStatus] || "default";
  const statusLabel = statusLabels[unit.currentStatus] || unit.currentStatus;

  return (
    <div
      className="bg-card border border-border rounded-lg p-6 space-y-4"
      data-testid="parking-detail-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold" data-testid="text-stall-code">Stall {unit.code}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-panel"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div>
        <Badge variant={statusVariant} data-testid="badge-status">
          {statusLabel}
        </Badge>
      </div>

      <div className="space-y-3 text-sm">
        {unit.zone_code && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground" data-testid="label-zone">Zone</span>
            <span className="font-medium" data-testid="text-zone">{unit.zone_code}</span>
          </div>
        )}
        {unit.size_class && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground" data-testid="label-size">Size</span>
            <span className="font-medium" data-testid="text-size">{unit.size_class}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {unit.covered && (
          <Badge variant="outline" data-testid="badge-covered">
            <Home className="h-3 w-3 mr-1" /> Covered
          </Badge>
        )}
        {unit.accessible && (
          <Badge variant="outline" data-testid="badge-accessible">
            <Accessibility className="h-3 w-3 mr-1" /> Accessible
          </Badge>
        )}
        {unit.ev_charging && (
          <Badge variant="outline" data-testid="badge-ev">
            <Zap className="h-3 w-3 mr-1" /> EV Charging
          </Badge>
        )}
      </div>

      {unit.allocation && unit.currentStatus !== "available" && (
        <div className="border-t border-border pt-4 space-y-3">
          <h4 className="text-sm font-medium" data-testid="text-reservation-heading">Current Reservation</h4>

          {unit.allocation.guest_name && (
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground" data-testid="label-guest">Guest</span>
              <span className="font-medium" data-testid="text-guest">{unit.allocation.guest_name}</span>
            </div>
          )}

          {unit.allocation.starts_at && unit.allocation.ends_at && (
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground" data-testid="label-dates">Dates</span>
              <span className="font-medium" data-testid="text-dates">
                {format(new Date(unit.allocation.starts_at), "MMM d")} -{" "}
                {format(new Date(unit.allocation.ends_at), "MMM d")}
              </span>
            </div>
          )}

          {unit.allocation.reservation_id && (
            <div className="mt-2">
              <Link to={`/app/reservations/${unit.allocation.reservation_id}`} className="block">
                <Button 
                  variant="outline"
                  data-testid="button-view-reservation"
                >
                  View Reservation
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
