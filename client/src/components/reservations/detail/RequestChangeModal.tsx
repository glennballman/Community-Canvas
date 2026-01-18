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
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (message: string) => Promise<any>;
  isPending?: boolean;
}

export function RequestChangeModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: RequestChangeModalProps) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const isValid = message.trim().length >= 3;

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
        description: "Your change request has been submitted.",
      });
      setMessage("");
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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="modal-request-change">
        <DialogHeader>
          <DialogTitle>Request Change</DialogTitle>
          <DialogDescription>
            Describe the changes you need for this reservation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This sends a request. It does not change the reservation automatically.
          </p>
        </div>

        <div className="space-y-2 py-2">
          <Label htmlFor="change-message">Describe the change</Label>
          <Textarea
            id="change-message"
            placeholder="What changes do you need?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            data-testid="input-change-message"
          />
          {message.length > 0 && message.trim().length < 3 && (
            <p className="text-xs text-destructive">Message must be at least 3 characters</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-change-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            data-testid="button-change-submit"
          >
            {isPending ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
