import { Check } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { publicCopy } from "../publicCopy";

export interface AvailabilityResult {
  id: string;
  unitId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  capacity?: number;
  available: boolean;
  unitPrice?: number;
}

interface AvailabilityResultCardProps {
  result: AvailabilityResult;
  disabled?: boolean;
  onAdd: (result: AvailabilityResult) => void;
  isAdding?: boolean;
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  const startStr = format(start, "MMM d");
  const endStr = format(end, "MMM d, yyyy");
  
  if (startStr === format(end, "MMM d")) {
    return format(start, "MMM d, yyyy");
  }
  
  return `${startStr} - ${endStr}`;
}

export function AvailabilityResultCard({
  result,
  disabled = false,
  onAdd,
  isAdding = false,
}: AvailabilityResultCardProps) {
  const isDisabled = disabled || !result.available || isAdding;

  return (
    <Card data-testid="availability-result-card">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate" data-testid="result-title">
              {result.title}
            </h3>
            {result.available && (
              <Badge variant="secondary" className="shrink-0">
                <Check className="h-3 w-3 mr-1" />
                {publicCopy.availability.available}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground" data-testid="result-dates">
            {formatDateRange(result.startsAt, result.endsAt)}
          </p>
          
          {result.capacity && (
            <p className="text-sm text-muted-foreground">
              {publicCopy.availability.capacity}: {result.capacity}
            </p>
          )}
          
          {result.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {result.description}
            </p>
          )}
        </div>
        
        <Button
          onClick={() => onAdd(result)}
          disabled={isDisabled}
          data-testid="availability-add-button"
        >
          {isAdding ? publicCopy.loading.default : publicCopy.availability.addToReservation}
        </Button>
      </CardContent>
    </Card>
  );
}
