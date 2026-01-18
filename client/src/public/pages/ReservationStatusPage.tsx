import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";

interface ReservationStatus {
  id: string;
  status: string;
  reference_number: string | null;
  created_at: string;
  updated_at: string;
}

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  confirmed: CheckCircle,
  cancelled: XCircle,
  expired: AlertCircle,
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  expired: "outline",
};

export default function ReservationStatusPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["reservation-status", token],
    queryFn: async (): Promise<{ ok: boolean; reservation?: ReservationStatus; error?: { message: string } }> => {
      const res = await fetch(`/api/public/reserve/status/${token}`);
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicLoadingState message={publicCopy.loading.default} />
      </PublicLayout>
    );
  }

  if (error || !data?.ok) {
    return (
      <PublicLayout>
        <PublicErrorState
          title={publicCopy.errors.invalidToken}
          message={data?.error?.message || publicCopy.errors.notFound}
          showBack={false}
        />
      </PublicLayout>
    );
  }

  const reservation = data.reservation;
  const status = reservation?.status || "pending";
  const StatusIcon = statusIcons[status] || Clock;
  const statusVariant = statusVariants[status] || "secondary";
  const statusLabel = publicCopy.status[status as keyof typeof publicCopy.status] || status;

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto" data-testid="reservation-status-page">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-status-title">
              {publicCopy.titles.reservationStatus}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center py-6">
              <div className="flex flex-col items-center gap-3">
                <StatusIcon className="h-12 w-12 text-muted-foreground" />
                <Badge variant={statusVariant} data-testid="badge-status">
                  {statusLabel}
                </Badge>
              </div>
            </div>

            {reservation?.reference_number && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{publicCopy.confirmation.referenceLabel}</p>
                <p className="font-mono text-lg" data-testid="text-reference">
                  {reservation.reference_number}
                </p>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground" data-testid="text-status-placeholder">
              <p>Additional status details will be shown here.</p>
              <p className="mt-2">Token: {token?.slice(0, 8)}...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
