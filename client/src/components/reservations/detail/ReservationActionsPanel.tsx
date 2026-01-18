import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { LogIn, LogOut, MessageSquarePlus, Edit, XCircle } from "lucide-react";
import { AddInternalNoteModal } from "./AddInternalNoteModal";
import { RequestChangeModal } from "./RequestChangeModal";
import { RequestCancelModal } from "./RequestCancelModal";

interface ReservationActionsPanelProps {
  isLoading?: boolean;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onAddNote?: (message: string) => Promise<any>;
  onRequestChange?: (message: string) => Promise<any>;
  onRequestCancel?: (message: string) => Promise<any>;
  checkInPending?: boolean;
  checkOutPending?: boolean;
  addNotePending?: boolean;
  requestChangePending?: boolean;
  requestCancelPending?: boolean;
  notesAvailable?: boolean;
  changeRequestAvailable?: boolean;
  cancelRequestAvailable?: boolean;
}

export function ReservationActionsPanel({
  isLoading,
  canCheckIn,
  canCheckOut,
  onCheckIn,
  onCheckOut,
  onAddNote,
  onRequestChange,
  onRequestCancel,
  checkInPending,
  checkOutPending,
  addNotePending,
  requestChangePending,
  requestCancelPending,
  notesAvailable = true,
  changeRequestAvailable = true,
  cancelRequestAvailable = true,
}: ReservationActionsPanelProps) {
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  if (isLoading) {
    return (
      <Card data-testid="reservation-actions-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card data-testid="reservation-actions">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!canCheckIn || checkInPending}
                  onClick={onCheckIn}
                  data-testid="button-action-checkin"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Check in
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canCheckIn ? "Check in guest" : "Status must be confirmed"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!canCheckOut || checkOutPending}
                  onClick={onCheckOut}
                  data-testid="button-action-checkout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Check out
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canCheckOut ? "Check out guest" : "Status must be checked in"}
            </TooltipContent>
          </Tooltip>

          <div className="border-t pt-2 mt-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!notesAvailable || addNotePending}
                  onClick={() => setNoteModalOpen(true)}
                  data-testid="reservation-add-note"
                >
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Add internal note
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {notesAvailable ? "Add an internal note" : "Not available"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!changeRequestAvailable || requestChangePending}
                  onClick={() => setChangeModalOpen(true)}
                  data-testid="button-action-request-change"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Request change
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {changeRequestAvailable ? "Request a change" : "Not available"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  disabled={!cancelRequestAvailable || requestCancelPending}
                  onClick={() => setCancelModalOpen(true)}
                  data-testid="button-action-request-cancel"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Request cancellation
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {cancelRequestAvailable ? "Request cancellation" : "Not available"}
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      <AddInternalNoteModal
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        onSubmit={onAddNote}
        isPending={addNotePending}
      />

      <RequestChangeModal
        open={changeModalOpen}
        onOpenChange={setChangeModalOpen}
        onSubmit={onRequestChange}
        isPending={requestChangePending}
      />

      <RequestCancelModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        onSubmit={onRequestCancel}
        isPending={requestCancelPending}
      />
    </TooltipProvider>
  );
}
