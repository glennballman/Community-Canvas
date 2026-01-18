import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Car } from "lucide-react";
import { useParkingUnits } from "@/hooks/useParkingUnits";
import { useParkingAvailability } from "@/hooks/useParkingAvailability";
import { useParkingProperties } from "@/hooks/useParkingProperties";
import { ParkingPlanView } from "@/components/parking/ParkingPlanView";
import { ParkingDetailPanel } from "@/components/parking/ParkingDetailPanel";
import { ParkingFilters } from "@/components/parking/ParkingFilters";
import { ParkingLegend } from "@/components/parking/ParkingLegend";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function ParkingPlanPage() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ zoneCode: "all", status: "all" });
  const [viewMode, setViewMode] = useState<"grid" | "layout">("grid");

  const { data: propertiesData, isLoading: propertiesLoading } = useParkingProperties();
  const { data: unitsData, isLoading: unitsLoading, error: unitsError } = useParkingUnits(propertyId, filters.zoneCode);
  const { data: availData, isLoading: availLoading } = useParkingAvailability(propertyId, selectedDate);

  const unitsWithStatus = useMemo(() => {
    if (!unitsData?.units) return [];

    const allocMap = new Map(
      (availData?.allocations || []).map((a) => [a.unit_id, a])
    );

    return unitsData.units
      .map((unit) => {
        const alloc = allocMap.get(unit.id);
        return {
          ...unit,
          currentStatus: alloc?.status || (unit.status === "maintenance" ? "maintenance" : "available"),
          allocation: alloc || null,
        };
      })
      .filter((unit) => {
        if (filters.status === "all") return true;
        return unit.currentStatus === filters.status;
      });
  }, [unitsData, availData, filters.status]);

  const selectedUnit = useMemo(() => {
    return unitsWithStatus.find((u) => u.id === selectedUnitId) || null;
  }, [unitsWithStatus, selectedUnitId]);

  const zones = useMemo(() => {
    if (!unitsData?.units) return [];
    const zoneSet = new Set(unitsData.units.map((u) => u.zone_code).filter(Boolean) as string[]);
    return Array.from(zoneSet).sort();
  }, [unitsData]);

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  if (unitsLoading && propertyId && !unitsData) {
    return (
      <div className="p-6" data-testid="parking-plan">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (unitsError) {
    return (
      <div className="p-6" data-testid="parking-plan">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <h3 className="text-destructive font-medium" data-testid="text-error-title">Unable to load parking plan</h3>
          <p className="text-destructive/80 text-sm mt-1" data-testid="text-error-message">{(unitsError as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="p-6 space-y-6" data-testid="parking-plan">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Parking Plan</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">Visual layout of parking stalls with real-time status</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-muted-foreground mb-4" data-testid="text-empty-state">Select a property to view parking plan</p>
          
          {propertiesLoading ? (
            <div className="animate-pulse h-10 bg-muted rounded w-64 mx-auto"></div>
          ) : propertiesData?.properties && propertiesData.properties.length > 0 ? (
            <div className="flex justify-center">
              <Select onValueChange={(value) => setPropertyId(value)}>
                <SelectTrigger data-testid="select-property">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {propertiesData.properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id} data-testid={`option-property-${prop.id}`}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-properties">No properties with parking stalls found</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="parking-plan">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Parking Plan</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-property-name">
            {unitsData?.property?.name || "Property"} - {unitsWithStatus.length} stalls
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(-1)}
            data-testid="button-date-prev"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Input
            type="date"
            value={format(selectedDate, "yyyy-MM-dd")}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="text-center"
            data-testid="input-date"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(1)}
            data-testid="button-date-next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSelectedDate(new Date())}
            data-testid="button-date-today"
          >
            Today
          </Button>
        </div>
      </div>

      <ParkingFilters
        zones={zones}
        filters={filters}
        onChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {unitsWithStatus.length === 0 ? (
            <div className="bg-muted border border-border rounded-lg p-12 text-center">
              <p className="text-muted-foreground" data-testid="text-no-stalls">No parking stalls found</p>
              {filters.zoneCode !== "all" || filters.status !== "all" ? (
                <Button
                  variant="ghost"
                  onClick={() => setFilters({ zoneCode: "all", status: "all" })}
                  className="mt-2"
                  data-testid="button-clear-filters"
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <ParkingPlanView
              units={unitsWithStatus}
              selectedId={selectedUnitId}
              onSelect={setSelectedUnitId}
              viewMode={viewMode}
              isLoading={availLoading}
            />
          )}
        </div>

        <div className="lg:col-span-1">
          <ParkingDetailPanel
            unit={selectedUnit}
            onClose={() => setSelectedUnitId(null)}
          />
        </div>
      </div>

      <ParkingLegend />
    </div>
  );
}
