import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Portal } from "@/hooks/useJobsIndex";

interface JobFiltersProps {
  status: string;
  q: string;
  portalId: string;
  portals: Portal[];
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onPortalChange: (value: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function JobFilters({
  status,
  q,
  portalId,
  portals,
  onStatusChange,
  onSearchChange,
  onPortalChange,
  onClear,
  hasActiveFilters,
}: JobFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search jobs..."
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-search-jobs"
        />
      </div>

      <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
        <SelectTrigger className="w-[140px]" data-testid="select-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="filled">Filled</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
        </SelectContent>
      </Select>

      {portals.length > 0 && (
        <Select value={portalId || "all"} onValueChange={(v) => onPortalChange(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]" data-testid="select-portal">
            <SelectValue placeholder="Portal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Portals</SelectItem>
            {portals.map((portal) => (
              <SelectItem key={portal.id} value={portal.id}>
                {portal.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-filters">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
