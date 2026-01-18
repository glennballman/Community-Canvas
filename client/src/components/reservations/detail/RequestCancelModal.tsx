import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestCancelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (message: string) => Promise<any>;
  isPending?: boolean;
}

export function RequestCancelModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: RequestCancelModalProps) {
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();

  const isValid = message.trim().length >= 3 && confirmed;

  async function handleSubmit() {
    if (!isValid || !onSubmit) return;

    try {
      const result = await onSubmit(message.trim());
      if (result?.ok === false) {
        toast({
          title: "Error",
          description: result.error?.message || "Failed to submit request",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Request submitted",
        description: "Your cancellation request has been submitted.",
      });
      setMessage("");
      setConfirmed(false);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to submit request",
        variant: "destructive",
      });
    }
  }

  function handleClose() {
    setMessage("");
    setConfirmed(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="modal-request-cancel">
        <DialogHeader>
          <DialogTitle>Request Cancellation</DialogTitle>
          <DialogDescription>
            Submit a cancellation request for this reservation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200">
            This is a request only. It does not cancel the reservation automatically.
          </p>
        </div>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-message">Reason for cancellation</Label>
          <Textarea
            id="cancel-message"
            placeholder="Why is this reservation being cancelled?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            data-testid="input-cancel-message"
          />
          {message.length > 0 && message.trim().length < 3 && (
            <p className="text-xs text-destructive">Reason must be at least 3 characters</p>
          )}
        </div>

        <div className="flex items-start space-x-2 py-2">
          <Checkbox
            id="cancel-confirm"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
            data-testid="checkbox-cancel-confirm"
          />
          <Label htmlFor="cancel-confirm" className="text-sm leading-tight cursor-pointer">
            I understand this is a request, not an automatic cancellation.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-modal-cancel">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            data-testid="button-cancel-submit"
          >
            {isPending ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
