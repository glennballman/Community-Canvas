import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X, Search } from "lucide-react";
import { useState } from "react";

interface ServiceRunsFiltersProps {
  serviceTypes: string[];
  statuses: string[];
  selectedServiceTypes: string[];
  selectedStatuses: string[];
  search: string;
  onServiceTypeChange: (values: string[]) => void;
  onStatusChange: (values: string[]) => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function ServiceRunsFilters({
  serviceTypes,
  statuses,
  selectedServiceTypes,
  selectedStatuses,
  search,
  onServiceTypeChange,
  onStatusChange,
  onSearchChange,
  onClearFilters,
  hasActiveFilters,
}: ServiceRunsFiltersProps) {
  const [open, setOpen] = useState(false);

  function toggleServiceType(type: string) {
    if (selectedServiceTypes.includes(type)) {
      onServiceTypeChange(selectedServiceTypes.filter(t => t !== type));
    } else {
      onServiceTypeChange([...selectedServiceTypes, type]);
    }
  }

  function toggleStatus(status: string) {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  }

  const activeCount = selectedServiceTypes.length + selectedStatuses.length + (search ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search service runs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2" data-testid="button-filters">
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="filters-panel">
          <SheetHeader>
            <SheetTitle>Filter Service Runs</SheetTitle>
            <SheetDescription>
              Narrow down service runs by type, status, or search term.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {statuses.length > 0 && (
              <div className="space-y-3">
                <Label>Status</Label>
                <div className="space-y-2">
                  {statuses.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                        data-testid={`checkbox-status-${status}`}
                      />
                      <label
                        htmlFor={`status-${status}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {serviceTypes.length > 0 && (
              <div className="space-y-3">
                <Label>Service Type</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {serviceTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={selectedServiceTypes.includes(type)}
                        onCheckedChange={() => toggleServiceType(type)}
                        data-testid={`checkbox-type-${type}`}
                      />
                      <label
                        htmlFor={`type-${type}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasActiveFilters && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  onClearFilters();
                  setOpen(false);
                }}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4" />
                Clear All Filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
