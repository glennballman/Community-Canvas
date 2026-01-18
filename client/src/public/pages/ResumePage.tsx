import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";
import { publicApi } from "../api/publicApi";
import { isTokenInvalid } from "../api/publicErrors";
import {
  getToken,
  setToken,
  getReservationContext,
  getAuthFromToken,
  setAuthContext,
} from "../state/publicTokenStore";

export default function ResumePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      // Check for token in URL first
      const urlToken = searchParams.get("token");
      const urlPortalId = searchParams.get("portalId");
      const urlCartId = searchParams.get("cartId");
      const urlAccessToken = searchParams.get("accessToken");

      if (urlToken) {
        setToken(urlToken);
      }

      // Store auth context if provided in URL
      if (urlPortalId && urlCartId && urlAccessToken) {
        setAuthContext({
          portalId: urlPortalId,
          cartId: urlCartId,
          accessToken: urlAccessToken,
        });
      }

      // Try to get auth from token or stored values
      const auth = getAuthFromToken();
      const token = getToken();

      if (!token && !auth) {
        setError(publicCopy.empty.noActiveReservation);
        setLoading(false);
        return;
      }

      // Call resume API
      const query = auth
        ? { portalId: auth.portalId, cartId: auth.cartId, accessToken: auth.accessToken }
        : { token };

      const result = await publicApi.resume(query);

      if (!result.ok) {
        if (isTokenInvalid(result.error.code)) {
          setError(publicCopy.errors.invalidToken);
        } else {
          setError(result.error.message || publicCopy.errors.generic);
        }
      } else {
        setResumeData(result);
      }

      setLoading(false);
    };

    init();
  }, [searchParams]);

  const handleViewStatus = () => {
    const token = getToken();
    if (token) {
      navigate(`/reserve/status/${token}`);
    }
  };

  const handleContinue = () => {
    const context = getReservationContext();
    if (context.portalSlug && context.offerSlug) {
      navigate(`/reserve/${context.portalSlug}/${context.offerSlug}/start`);
    }
  };

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
          title={publicCopy.empty.noActiveReservation}
          message={error}
          showBack={false}
          showRetry={false}
        />
      </PublicLayout>
    );
  }

  const context = getReservationContext();

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto" data-testid="resume-page">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-resume-title">
              {publicCopy.titles.resumeReservation}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground" data-testid="text-resume-message">
              You have an active reservation in progress.
            </p>

            {context.portalSlug && context.offerSlug && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Portal: {context.portalSlug}</p>
                <p>Offer: {context.offerSlug}</p>
              </div>
            )}

            {resumeData && (
              <div className="text-sm text-muted-foreground" data-testid="resume-data">
                <p>Reservation data loaded successfully.</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {context.portalSlug && context.offerSlug && (
                <Button
                  className="w-full"
                  onClick={handleContinue}
                  data-testid="button-continue-reservation"
                >
                  {publicCopy.buttons.continueReservation}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleViewStatus}
                data-testid="button-view-status"
              >
                {publicCopy.buttons.viewStatus}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
