import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";
import { publicApi } from "../api/publicApi";
import { isTokenInvalid } from "../api/publicErrors";
import { getAuthFromToken } from "../state/publicTokenStore";

interface ConfirmationData {
  id: string;
  reference_number: string | null;
  status: string;
  guest_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export default function ConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    const fetchConfirmation = async () => {
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

      // Use status endpoint for confirmation data
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

    fetchConfirmation();
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

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto" data-testid="confirmation-page">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <CardTitle data-testid="text-confirmation-title">
                {publicCopy.confirmation.title}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground" data-testid="text-thank-you">
              {publicCopy.confirmation.thankYou}
            </p>

            {reservation?.reference_number && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {publicCopy.confirmation.referenceLabel}
                </p>
                <p className="font-mono text-xl font-semibold" data-testid="text-reference-number">
                  {reservation.reference_number}
                </p>
              </div>
            )}

            <div className="space-y-3" data-testid="confirmation-details">
              <h3 className="font-medium">{publicCopy.confirmation.detailsLabel}</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                {reservation?.guest_name && (
                  <p>Guest: {reservation.guest_name}</p>
                )}
                {reservation?.starts_at && reservation?.ends_at && (
                  <p>
                    Dates: {new Date(reservation.starts_at).toLocaleDateString()} -{" "}
                    {new Date(reservation.ends_at).toLocaleDateString()}
                  </p>
                )}
                <p className="mt-4">{publicCopy.confirmation.contactInfo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
