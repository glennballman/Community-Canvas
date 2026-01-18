import { LayoutGrid, Map } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Props {
  zones: string[];
  filters: { zoneCode: string; status: string };
  onChange: (filters: { zoneCode: string; status: string }) => void;
  viewMode: "grid" | "layout";
  onViewModeChange: (mode: "grid" | "layout") => void;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
];

export function ParkingFilters({ zones, filters, onChange, viewMode, onViewModeChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4" data-testid="parking-filters">
      <Select
        value={filters.zoneCode}
        onValueChange={(value) => onChange({ ...filters, zoneCode: value })}
      >
        <SelectTrigger data-testid="select-zone">
          <SelectValue placeholder="All Zones" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="option-zone-all">All Zones</SelectItem>
          {zones.map((zone) => (
            <SelectItem key={zone} value={zone} data-testid={`option-zone-${zone}`}>
              Zone {zone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) => onChange({ ...filters, status: value })}
      >
        <SelectTrigger data-testid="select-status">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} data-testid={`option-status-${opt.value}`}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          if (value) onViewModeChange(value as "grid" | "layout");
        }}
        className="ml-auto"
      >
        <ToggleGroupItem value="grid" aria-label="Grid view" data-testid="toggle-view-grid">
          <LayoutGrid className="h-4 w-4 mr-1" />
          Grid
        </ToggleGroupItem>
        <ToggleGroupItem value="layout" aria-label="Layout view" data-testid="toggle-view-layout">
          <Map className="h-4 w-4 mr-1" />
          Layout
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
