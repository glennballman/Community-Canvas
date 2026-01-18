import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReviewLockedBannerProps {
  message?: string;
}

export function ReviewLockedBanner({ message }: ReviewLockedBannerProps) {
  return (
    <Alert variant="destructive" data-testid="review-locked-banner">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {message || "This reservation is no longer editable. Availability and pricing are shown for reference only."}
      </AlertDescription>
    </Alert>
  );
}
