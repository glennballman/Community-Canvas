import { MarinaSlip } from "./MarinaSlip";

interface MarinaUnit {
  id: string;
  code: string;
  max_length_ft: number | null;
  dock_code: string | null;
  layout_x: number | null;
  layout_y: number | null;
  currentStatus: string;
}

interface Props {
  units: MarinaUnit[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  viewMode: "grid" | "layout";
  isLoading?: boolean;
}

export function MarinaPlanView({ units, selectedId, onSelect, viewMode, isLoading }: Props) {
  const hasLayoutData = units.some((u) => u.layout_x !== null && u.layout_y !== null);
  const useLayoutMode = viewMode === "layout" && hasLayoutData;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6" data-testid="marina-plan-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (useLayoutMode) {
    const maxX = Math.max(...units.map((u) => Number(u.layout_x) || 0));
    const maxY = Math.max(...units.map((u) => Number(u.layout_y) || 0));
    const scale = 80;

    return (
      <div
        className="bg-card border border-border rounded-lg p-6 relative overflow-auto"
        style={{ minHeight: (maxY + 2) * scale }}
        data-testid="marina-plan-view"
      >
        {units.map((unit) => (
          <div
            key={unit.id}
            className="absolute"
            style={{
              left: (Number(unit.layout_x) || 0) * scale + 24,
              top: (Number(unit.layout_y) || 0) * scale + 24,
            }}
          >
            <MarinaSlip
              unit={unit}
              isSelected={selectedId === unit.id}
              onClick={() => onSelect(selectedId === unit.id ? null : unit.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  const groupedByDock = units.reduce<Record<string, MarinaUnit[]>>((acc, unit) => {
    const dock = unit.dock_code || "Unassigned";
    if (!acc[dock]) acc[dock] = [];
    acc[dock].push(unit);
    return acc;
  }, {});

  const sortedDocks = Object.keys(groupedByDock).sort();

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6" data-testid="marina-plan-view">
      {sortedDocks.map((dock) => (
        <div key={dock}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3" data-testid={`dock-heading-${dock}`}>
            Dock {dock}
          </h3>
          <div className="flex flex-wrap gap-2">
            {groupedByDock[dock].map((unit) => (
              <MarinaSlip
                key={unit.id}
                unit={unit}
                isSelected={selectedId === unit.id}
                onClick={() => onSelect(selectedId === unit.id ? null : unit.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
