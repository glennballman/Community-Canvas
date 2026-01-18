import { format } from "date-fns";
import { X, Anchor, Droplets, Zap, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  unit: {
    id: string;
    code: string;
    name: string;
    dock_code: string | null;
    dock_side: string | null;
    min_length_ft: number | null;
    max_length_ft: number | null;
    max_beam_ft: number | null;
    max_draft_ft: number | null;
    power_service: string | null;
    has_water: boolean;
    has_pump_out: boolean;
    currentStatus: string;
    allocation: {
      guest_name: string | null;
      vessel_name: string | null;
      vessel_length_ft: number | null;
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

export function MarinaDetailPanel({ unit, onClose }: Props) {
  if (!unit) {
    return (
      <div
        className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground"
        data-testid="marina-detail-panel"
      >
        <Anchor className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <p data-testid="text-empty-state">Select a slip to view details</p>
      </div>
    );
  }

  const statusVariant = statusVariants[unit.currentStatus] || "default";
  const statusLabel = statusLabels[unit.currentStatus] || unit.currentStatus;

  return (
    <div
      className="bg-card border border-border rounded-lg p-6 space-y-4"
      data-testid="marina-detail-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold" data-testid="text-slip-code">Slip {unit.code}</h3>
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
        {unit.dock_code && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground" data-testid="label-dock">Dock</span>
            <span className="font-medium" data-testid="text-dock">
              {unit.dock_code}{unit.dock_side ? ` (${unit.dock_side})` : ""}
            </span>
          </div>
        )}
        {unit.max_length_ft && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground" data-testid="label-length">Max Length</span>
            <span className="font-medium" data-testid="text-length">{unit.max_length_ft}ft</span>
          </div>
        )}
        {unit.max_beam_ft && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground" data-testid="label-beam">Beam</span>
            <span className="font-medium" data-testid="text-beam">{unit.max_beam_ft}ft</span>
          </div>
        )}
        {unit.max_draft_ft && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground" data-testid="label-draft">Draft</span>
            <span className="font-medium" data-testid="text-draft">{unit.max_draft_ft}ft</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {unit.power_service && (
          <Badge variant="outline" data-testid="badge-power">
            <Zap className="h-3 w-3 mr-1" /> {unit.power_service}
          </Badge>
        )}
        {unit.has_water && (
          <Badge variant="outline" data-testid="badge-water">
            <Droplets className="h-3 w-3 mr-1" /> Water
          </Badge>
        )}
        {unit.has_pump_out && (
          <Badge variant="outline" data-testid="badge-pumpout">
            <Waves className="h-3 w-3 mr-1" /> Pump Out
          </Badge>
        )}
      </div>

      {unit.allocation && unit.currentStatus !== "available" && (
        <div className="border-t border-border pt-4 space-y-3">
          <h4 className="text-sm font-medium" data-testid="text-reservation-heading">Current Vessel</h4>

          {unit.allocation.vessel_name && (
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground" data-testid="label-vessel">Vessel</span>
              <span className="font-medium" data-testid="text-vessel">{unit.allocation.vessel_name}</span>
            </div>
          )}

          {unit.allocation.vessel_length_ft && (
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground" data-testid="label-vessel-length">Length</span>
              <span className="font-medium" data-testid="text-vessel-length">{unit.allocation.vessel_length_ft}ft</span>
            </div>
          )}

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
