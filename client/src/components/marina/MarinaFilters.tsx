import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, Map } from "lucide-react";

interface Filters {
  dockCode: string;
  status: string;
}

interface Props {
  docks: string[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  viewMode: "grid" | "layout";
  onViewModeChange: (mode: "grid" | "layout") => void;
}

export function MarinaFilters({ docks, filters, onChange, viewMode, onViewModeChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="marina-filters">
      <Select
        value={filters.dockCode}
        onValueChange={(value) => onChange({ ...filters, dockCode: value })}
      >
        <SelectTrigger data-testid="select-dock">
          <SelectValue placeholder="All Docks" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="option-dock-all">All Docks</SelectItem>
          {docks.map((dock) => (
            <SelectItem key={dock} value={dock} data-testid={`option-dock-${dock}`}>
              Dock {dock}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) => onChange({ ...filters, status: value })}
      >
        <SelectTrigger data-testid="select-status">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="option-status-all">All Status</SelectItem>
          <SelectItem value="available" data-testid="option-status-available">Available</SelectItem>
          <SelectItem value="occupied" data-testid="option-status-occupied">Occupied</SelectItem>
          <SelectItem value="reserved" data-testid="option-status-reserved">Reserved</SelectItem>
          <SelectItem value="maintenance" data-testid="option-status-maintenance">Maintenance</SelectItem>
        </SelectContent>
      </Select>

      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          if (value) onViewModeChange(value as "grid" | "layout");
        }}
      >
        <ToggleGroupItem value="grid" aria-label="Grid view" data-testid="toggle-view-grid">
          <LayoutGrid className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="layout" aria-label="Layout view" data-testid="toggle-view-layout">
          <Map className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
