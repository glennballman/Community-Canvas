import { Calendar, ArrowRight, Home, Car, Ship, Ticket, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CarryForwardCandidate } from "../state/publicCarryForward";

interface CrossSellCardProps {
  candidate: CarryForwardCandidate;
  disabled?: boolean;
  onCheckAvailability: () => void;
}

function formatDateRange(window: { start: string; end: string } | undefined): string {
  if (!window) return "";
  
  const start = new Date(window.start);
  const end = new Date(window.end);
  
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  
  return `${start.toLocaleDateString(undefined, options)} → ${end.toLocaleDateString(undefined, options)}`;
}

function getTypeIcon(type: string) {
  switch (type) {
    case "marina":
      return Ship;
    case "parking":
      return Car;
    case "equipment":
      return Package;
    case "activity":
      return Ticket;
    default:
      return Home;
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "marina":
      return "Marina Slip";
    case "parking":
      return "Parking";
    case "equipment":
      return "Equipment";
    case "activity":
      return "Activity";
    default:
      return "Lodging";
  }
}

export function CrossSellCard({ 
  candidate, 
  disabled, 
  onCheckAvailability 
}: CrossSellCardProps) {
  const itemType = candidate.itemType || candidate.entryPointType;
  const TypeIcon = getTypeIcon(itemType);
  const displayName = candidate.displayName || getTypeLabel(itemType);
  const whyShown = candidate.whyShown || candidate.hint;
  const dateRange = formatDateRange(candidate.suggestedWindow);
  
  return (
    <Card 
      className={disabled ? "opacity-60" : ""}
      data-testid="cross-sell-card"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {candidate.thumbnail ? (
            <img
              src={candidate.thumbnail}
              alt={displayName}
              className="h-12 w-12 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
              <TypeIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" data-testid="text-cross-sell-name">
              {displayName}
            </p>
            
            {whyShown && (
              <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-cross-sell-reason">
                {whyShown}
              </p>
            )}
            
            {dateRange && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{dateRange}</span>
              </div>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          disabled={disabled}
          onClick={onCheckAvailability}
          data-testid="cross-sell-action"
        >
          Check availability
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
