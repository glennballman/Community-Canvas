import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface ReservationFiltersProps {
  q: string;
  status: string;
  startDate: string;
  endDate: string;
  upcomingOnly: boolean;
  onQChange: (val: string) => void;
  onStatusChange: (val: string) => void;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onUpcomingOnlyChange: (val: boolean) => void;
  onClearFilters: () => void;
}

export function ReservationFilters({
  q,
  status,
  startDate,
  endDate,
  upcomingOnly,
  onQChange,
  onStatusChange,
  onStartDateChange,
  onEndDateChange,
  onUpcomingOnlyChange,
  onClearFilters,
}: ReservationFiltersProps) {
  const hasFilters = q || (status && status !== "all") || startDate || endDate || !upcomingOnly;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border" data-testid="reservation-filters">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search guest or confirmation..."
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[150px]" data-testid="select-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="checked_in">Checked In</SelectItem>
          <SelectItem value="checked_out">Checked Out</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-[140px]"
          data-testid="input-start-date"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-[140px]"
          data-testid="input-end-date"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="upcoming-only"
          checked={upcomingOnly}
          onCheckedChange={onUpcomingOnlyChange}
          data-testid="switch-upcoming-only"
        />
        <Label htmlFor="upcoming-only" className="text-sm">
          Upcoming only
        </Label>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          data-testid="button-clear-filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
