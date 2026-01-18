import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EntryPointType, getInputFieldConfig } from "../state/publicEntryPoint";
import { publicCopy } from "../publicCopy";

export interface AvailabilityQuery {
  startDate: Date | null;
  endDate: Date | null;
  guests?: number;
  quantity?: number;
  vehicleLength?: string;
  vesselLength?: number;
  power?: string;
}

interface AvailabilityInputsProps {
  entryPointType: EntryPointType;
  disabled?: boolean;
  onSearch: (query: AvailabilityQuery) => void;
  isSearching?: boolean;
}

const VEHICLE_LENGTH_OPTIONS = [
  { value: "compact", label: "Compact (under 15 ft)" },
  { value: "standard", label: "Standard (15-20 ft)" },
  { value: "large", label: "Large (20-25 ft)" },
  { value: "oversized", label: "Oversized (25+ ft)" },
];

const POWER_OPTIONS = [
  { value: "none", label: "No power needed" },
  { value: "15amp", label: "15 Amp" },
  { value: "30amp", label: "30 Amp" },
  { value: "50amp", label: "50 Amp" },
];

export function AvailabilityInputs({
  entryPointType,
  disabled = false,
  onSearch,
  isSearching = false,
}: AvailabilityInputsProps) {
  const config = getInputFieldConfig(entryPointType);
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [vehicleLength, setVehicleLength] = useState<string>("");
  const [vesselLength, setVesselLength] = useState<number>(0);
  const [power, setPower] = useState<string>("none");

  const handleSearch = () => {
    onSearch({
      startDate,
      endDate: config.hasDateRange ? endDate : startDate,
      guests: config.hasGuests ? guests : undefined,
      quantity: config.hasQuantity ? quantity : undefined,
      vehicleLength: config.hasVehicleLength ? vehicleLength : undefined,
      vesselLength: config.hasVesselLength ? vesselLength : undefined,
      power: config.hasPower ? power : undefined,
    });
  };

  const canSearch = startDate !== null && (!config.hasDateRange || endDate !== null);

  return (
    <div className="space-y-4" data-testid="availability-inputs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">
            {config.hasDateRange ? publicCopy.availability.checkIn : publicCopy.availability.date}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
                disabled={disabled}
                data-testid="input-start-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : publicCopy.availability.selectDate}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate || undefined}
                onSelect={(d) => setStartDate(d || null)}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {config.hasDateRange && (
          <div className="space-y-2">
            <Label htmlFor="end-date">{publicCopy.availability.checkOut}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                  disabled={disabled || !startDate}
                  data-testid="input-end-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : publicCopy.availability.selectDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate || undefined}
                  onSelect={(d) => setEndDate(d || null)}
                  disabled={(date) => !startDate || date <= startDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {config.hasGuests && (
        <div className="space-y-2">
          <Label htmlFor="guests">{publicCopy.availability.guests}</Label>
          <Input
            id="guests"
            type="number"
            min={1}
            max={20}
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
            disabled={disabled}
            data-testid="input-guests"
          />
        </div>
      )}

      {config.hasQuantity && (
        <div className="space-y-2">
          <Label htmlFor="quantity">{publicCopy.availability.quantity}</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            disabled={disabled}
            data-testid="input-quantity"
          />
        </div>
      )}

      {config.hasVehicleLength && (
        <div className="space-y-2">
          <Label htmlFor="vehicle-length">{publicCopy.availability.vehicleLength}</Label>
          <Select value={vehicleLength} onValueChange={setVehicleLength} disabled={disabled}>
            <SelectTrigger data-testid="input-vehicle-length">
              <SelectValue placeholder="Select vehicle size" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_LENGTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.hasVesselLength && (
        <div className="space-y-2">
          <Label htmlFor="vessel-length">{publicCopy.availability.vesselLength}</Label>
          <Input
            id="vessel-length"
            type="number"
            min={0}
            max={200}
            value={vesselLength || ""}
            onChange={(e) => setVesselLength(parseInt(e.target.value) || 0)}
            disabled={disabled}
            placeholder="Length in feet"
            data-testid="input-vessel-length"
          />
        </div>
      )}

      {config.hasPower && (
        <div className="space-y-2">
          <Label htmlFor="power">{publicCopy.availability.power}</Label>
          <Select value={power} onValueChange={setPower} disabled={disabled}>
            <SelectTrigger data-testid="input-power">
              <SelectValue placeholder="Select power requirement" />
            </SelectTrigger>
            <SelectContent>
              {POWER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        onClick={handleSearch}
        disabled={disabled || !canSearch || isSearching}
        className="w-full"
        data-testid="button-search-availability"
      >
        {isSearching ? publicCopy.loading.checkingAvailability : publicCopy.availability.searchButton}
      </Button>
    </div>
  );
}
