import { AvailabilityResultCard, AvailabilityResult } from "./AvailabilityResultCard";
import { publicCopy } from "../publicCopy";

interface AvailabilityResultsProps {
  results: AvailabilityResult[];
  disabled?: boolean;
  onAdd: (result: AvailabilityResult) => void;
  addingId?: string | null;
}

export function AvailabilityResults({
  results,
  disabled = false,
  onAdd,
  addingId = null,
}: AvailabilityResultsProps) {
  if (results.length === 0) {
    return (
      <div 
        className="py-12 text-center text-muted-foreground"
        data-testid="availability-empty"
      >
        <p>{publicCopy.availability.noResults}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="availability-results">
      {results.map((result) => (
        <AvailabilityResultCard
          key={result.id}
          result={result}
          disabled={disabled}
          onAdd={onAdd}
          isAdding={addingId === result.id}
        />
      ))}
    </div>
  );
}
