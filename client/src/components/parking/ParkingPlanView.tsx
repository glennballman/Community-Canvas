import { useMemo } from "react";
import { ParkingStall } from "./ParkingStall";

interface ParkingUnit {
  id: string;
  code: string;
  layout_x: number | null;
  layout_y: number | null;
  layout_rotation: number | null;
  zone_code: string | null;
  accessible: boolean;
  currentStatus: string;
  allocation: any;
}

interface Props {
  units: ParkingUnit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  viewMode: "grid" | "layout";
  isLoading?: boolean;
}

export function ParkingPlanView({ units, selectedId, onSelect, viewMode, isLoading }: Props) {
  const hasLayoutData = units.some((u) => u.layout_x !== null && u.layout_y !== null);

  if (viewMode === "layout" && hasLayoutData) {
    return (
      <PositionedLayout
        units={units}
        selectedId={selectedId}
        onSelect={onSelect}
        isLoading={isLoading}
      />
    );
  }

  return (
    <GridLayout
      units={units}
      selectedId={selectedId}
      onSelect={onSelect}
      isLoading={isLoading}
    />
  );
}

function GridLayout({
  units,
  selectedId,
  onSelect,
  isLoading,
}: Omit<Props, "viewMode">) {
  const byZone = useMemo(() => {
    const groups: Record<string, ParkingUnit[]> = {};
    for (const unit of units) {
      const zone = unit.zone_code || "Unassigned";
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(unit);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [units]);

  return (
    <div className={`space-y-6 ${isLoading ? "opacity-60" : ""}`} data-testid="parking-grid-view">
      {byZone.map(([zone, zoneUnits]) => (
        <div key={zone} className="bg-card border border-border rounded-lg p-4" data-testid={`parking-zone-${zone.toLowerCase().replace(/\s+/g, "-")}`}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3" data-testid={`text-zone-header-${zone.toLowerCase().replace(/\s+/g, "-")}`}>Zone {zone}</h3>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {zoneUnits.map((unit) => (
              <ParkingStall
                key={unit.id}
                unit={unit}
                isSelected={unit.id === selectedId}
                onClick={() => onSelect(unit.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionedLayout({
  units,
  selectedId,
  onSelect,
  isLoading,
}: Omit<Props, "viewMode">) {
  const bounds = useMemo(() => {
    const xs = units.map((u) => u.layout_x || 0);
    const ys = units.map((u) => u.layout_y || 0);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [units]);

  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;

  return (
    <div
      className={`relative w-full h-[500px] bg-muted border border-border rounded-lg overflow-hidden ${
        isLoading ? "opacity-60" : ""
      }`}
      data-testid="parking-layout-view"
    >
      {units.map((unit) => {
        const left = ((unit.layout_x || 0) - bounds.minX) / rangeX * 85 + 5;
        const top = ((unit.layout_y || 0) - bounds.minY) / rangeY * 85 + 5;

        return (
          <div
            key={unit.id}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              transform: `rotate(${unit.layout_rotation || 0}deg)`,
            }}
          >
            <ParkingStall
              unit={unit}
              isSelected={unit.id === selectedId}
              onClick={() => onSelect(unit.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
