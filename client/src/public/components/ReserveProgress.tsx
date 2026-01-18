import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { publicCopy } from "../publicCopy";
import { 
  ReservationStep, 
  RESERVATION_STEPS, 
  getStepIndex, 
  PublicCartStatus, 
  isLocked,
  canNavigateToStep,
} from "../state/publicReservationMachine";

interface ReserveProgressProps {
  currentStep: ReservationStep;
  status: PublicCartStatus;
  hasItems: boolean;
  onStepClick?: (step: ReservationStep) => void;
}

export function ReserveProgress({
  currentStep,
  status,
  hasItems,
  onStepClick,
}: ReserveProgressProps) {
  const currentIndex = getStepIndex(currentStep);
  const locked = isLocked(status);

  return (
    <nav 
      className="flex items-center gap-2" 
      aria-label="Reservation steps"
      data-testid="reserve-step-nav"
    >
      {RESERVATION_STEPS.map((step, index) => {
        const isActive = step === currentStep;
        const isCompleted = index < currentIndex;
        const canNavigate = canNavigateToStep(step, currentStep, status, hasItems);
        const label = publicCopy.stepLabels[step];

        return (
          <div key={step} className="flex items-center gap-2">
            {index > 0 && (
              <div 
                className={cn(
                  "h-px w-8",
                  isCompleted ? "bg-primary" : "bg-border"
                )} 
              />
            )}
            <button
              type="button"
              disabled={!canNavigate || locked}
              onClick={() => canNavigate && !locked && onStepClick?.(step)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive && "bg-primary text-primary-foreground",
                !isActive && isCompleted && "text-primary",
                !isActive && !isCompleted && "text-muted-foreground",
                canNavigate && !locked && !isActive && "hover-elevate cursor-pointer",
                (!canNavigate || locked) && !isActive && "cursor-not-allowed opacity-50"
              )}
              data-testid={`step-${step}`}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span 
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    isActive ? "bg-primary-foreground text-primary" : "bg-muted"
                  )}
                >
                  {index + 1}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
