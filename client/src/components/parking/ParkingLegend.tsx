import { Badge } from "@/components/ui/badge";
import { Accessibility } from "lucide-react";

export function ParkingLegend() {
  return (
    <div className="flex items-center flex-wrap gap-6 text-sm text-muted-foreground" data-testid="parking-legend">
      <span className="font-medium" data-testid="text-legend-label">Legend:</span>
      <div className="flex items-center gap-2" data-testid="legend-available">
        <Badge variant="default">Available</Badge>
      </div>
      <div className="flex items-center gap-2" data-testid="legend-occupied">
        <Badge variant="destructive">Occupied</Badge>
      </div>
      <div className="flex items-center gap-2" data-testid="legend-reserved">
        <Badge variant="secondary">Reserved</Badge>
      </div>
      <div className="flex items-center gap-2" data-testid="legend-maintenance">
        <Badge variant="outline">Maintenance</Badge>
      </div>
      <div className="flex items-center gap-2" data-testid="legend-accessible">
        <Badge variant="outline">
          <Accessibility className="h-3 w-3 mr-1" /> Accessible
        </Badge>
      </div>
    </div>
  );
}
