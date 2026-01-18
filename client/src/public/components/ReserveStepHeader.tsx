import { AlertCircle, Clock, CheckCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { publicCopy } from "../publicCopy";
import { ReserveProgress } from "./ReserveProgress";
import { 
  ReservationStep, 
  PublicCartStatus, 
  isLocked, 
  isExpired,
} from "../state/publicReservationMachine";

interface ReserveStepHeaderProps {
  currentStep: ReservationStep;
  status: PublicCartStatus;
  hasItems: boolean;
  portalName?: string;
  offerName?: string;
  onStepClick?: (step: ReservationStep) => void;
}

function StatusBanner({ status }: { status: PublicCartStatus }) {
  if (!isLocked(status)) return null;

  const bannerConfig = {
    submitted: {
      icon: Clock,
      message: publicCopy.banners.submitted,
      variant: "default" as const,
    },
    completed: {
      icon: CheckCircle,
      message: publicCopy.banners.completed,
      variant: "default" as const,
    },
    expired: {
      icon: AlertCircle,
      message: publicCopy.banners.expired,
      variant: "destructive" as const,
    },
    unknown: {
      icon: Lock,
      message: publicCopy.banners.locked,
      variant: "default" as const,
    },
    active: null,
  };

  const config = bannerConfig[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Alert variant={config.variant} data-testid="reserve-status-banner">
      <Icon className="h-4 w-4" />
      <AlertDescription>{config.message}</AlertDescription>
    </Alert>
  );
}

export function ReserveStepHeader({
  currentStep,
  status,
  hasItems,
  portalName,
  offerName,
  onStepClick,
}: ReserveStepHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {portalName && (
            <p className="text-sm text-muted-foreground" data-testid="text-portal-name">
              {portalName}
            </p>
          )}
          {offerName && (
            <h1 className="text-xl font-semibold" data-testid="text-offer-name">
              {offerName}
            </h1>
          )}
        </div>
        <ReserveProgress
          currentStep={currentStep}
          status={status}
          hasItems={hasItems}
          onStepClick={onStepClick}
        />
      </div>
      <StatusBanner status={status} />
    </div>
  );
}
