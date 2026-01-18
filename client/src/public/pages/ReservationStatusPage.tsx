import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";
import { publicApi } from "../api/publicApi";
import { isTokenInvalid } from "../api/publicErrors";
import { getAuthFromToken } from "../state/publicTokenStore";

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      // Build query from URL params or stored auth
      const urlPortalId = searchParams.get("portalId");
      const urlCartId = searchParams.get("cartId");
      const urlAccessToken = searchParams.get("accessToken");

      let query: any;

      if (urlPortalId && urlCartId && urlAccessToken) {
        query = {
          portalId: urlPortalId,
          cartId: urlCartId,
          accessToken: urlAccessToken,
        };
      } else {
        const auth = getAuthFromToken();
        if (auth) {
          query = auth;
        } else if (token) {
          query = { token };
        } else {
          setError(publicCopy.errors.invalidToken);
          setLoading(false);
          return;
        }
      }

      const result = await publicApi.status(query);

      if (!result.ok) {
        if (isTokenInvalid(result.error.code)) {
          setError(publicCopy.errors.invalidToken);
        } else {
          setError(result.error.message || publicCopy.errors.notFound);
        }
      } else if (result.reservation) {
        setReservation(result.reservation);
      }

      setLoading(false);
    };

    fetchStatus();
  }, [token, searchParams]);

  if (loading) {
    return (
      <PublicLayout>
        <PublicLoadingState message={publicCopy.loading.default} />
      </PublicLayout>
    );
  }

  if (error) {
    return (
      <PublicLayout>
        <PublicErrorState
          title={publicCopy.errors.invalidToken}
          message={error}
          showBack={false}
        />
      </PublicLayout>
    );
  }

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

            <div className="text-center text-sm text-muted-foreground" data-testid="text-status-info">
              {reservation ? (
                <p>Status retrieved successfully.</p>
              ) : (
                <p>Token: {token?.slice(0, 8)}...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
