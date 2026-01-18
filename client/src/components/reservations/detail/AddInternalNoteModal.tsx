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
import { useToast } from "@/hooks/use-toast";

interface AddInternalNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (message: string) => Promise<any>;
  isPending?: boolean;
}

export function AddInternalNoteModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: AddInternalNoteModalProps) {
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
          description: result.error?.message || "Failed to add note",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Note added",
        description: "Internal note has been saved.",
      });
      setMessage("");
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to add note",
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
      <DialogContent data-testid="modal-add-note">
        <DialogHeader>
          <DialogTitle>Add Internal Note</DialogTitle>
          <DialogDescription>
            Add a private note visible only to staff. This will not be shared with the guest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="note-message">Note</Label>
          <Textarea
            id="note-message"
            placeholder="Enter your note..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            data-testid="input-note-message"
          />
          {message.length > 0 && message.trim().length < 3 && (
            <p className="text-xs text-destructive">Note must be at least 3 characters</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-note-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            data-testid="button-note-save"
          >
            {isPending ? "Saving..." : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
