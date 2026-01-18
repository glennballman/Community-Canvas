import { Badge } from "@/components/ui/badge";

export function MarinaLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm" data-testid="marina-legend">
      <span className="text-muted-foreground">Legend:</span>
      <div className="flex items-center gap-1">
        <Badge variant="default" data-testid="legend-available">Available</Badge>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="destructive" data-testid="legend-occupied">Occupied</Badge>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="secondary" data-testid="legend-reserved">Reserved</Badge>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" data-testid="legend-maintenance">Maintenance</Badge>
      </div>
    </div>
  );
}
