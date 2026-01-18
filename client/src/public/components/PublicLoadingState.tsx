import { Loader2 } from "lucide-react";
import { publicCopy } from "../publicCopy";

interface PublicLoadingStateProps {
  message?: string;
}

export function PublicLoadingState({
  message = publicCopy.loading.default,
}: PublicLoadingStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16"
      data-testid="public-loading-state"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground" data-testid="text-loading-message">
        {message}
      </p>
    </div>
  );
}
