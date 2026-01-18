import { Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SubmitConfirmPanelProps {
  isSubmitting: boolean;
  isDisabled: boolean;
  submitError: string | null;
  onSubmit: () => void;
  itemCount: number;
}

export function SubmitConfirmPanel({
  isSubmitting,
  isDisabled,
  submitError,
  onSubmit,
  itemCount,
}: SubmitConfirmPanelProps) {
  return (
    <Card data-testid="submit-confirm-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Place Your Reservation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You are about to place a reservation for {itemCount}{" "}
          {itemCount === 1 ? "item" : "items"}.
        </p>

        <p className="text-sm text-muted-foreground">
          After submission, you will receive a confirmation email with your
          reservation details.
        </p>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={onSubmit}
          disabled={isDisabled || isSubmitting}
          data-testid="confirm-submit"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Place Reservation
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By placing this reservation, you agree to the operator's terms and
          conditions.
        </p>
      </CardContent>
    </Card>
  );
}
