import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicCopy } from "../publicCopy";

interface PublicErrorStateProps {
  title?: string;
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

export function PublicErrorState({
  title = publicCopy.errors.generic,
  message,
  showRetry = false,
  onRetry,
  showBack = true,
  onBack,
}: PublicErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="public-error-state"
    >
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2" data-testid="text-error-title">
        {title}
      </h2>
      {message && (
        <p className="text-muted-foreground mb-6" data-testid="text-error-message">
          {message}
        </p>
      )}
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <Button variant="outline" onClick={onBack} data-testid="button-error-back">
            {publicCopy.buttons.back}
          </Button>
        )}
        {showRetry && onRetry && (
          <Button onClick={onRetry} data-testid="button-error-retry">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
