import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";
import { getToken, setToken, getReservationContext } from "../state/publicTokenStore";

export default function ResumePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setLocalToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      setLocalToken(urlToken);
    } else {
      const storedToken = getToken();
      setLocalToken(storedToken);
    }
    setChecked(true);
  }, [searchParams]);

  const handleViewStatus = () => {
    if (token) {
      navigate(`/reserve/status/${token}`);
    }
  };

  if (!checked) {
    return (
      <PublicLayout>
        <div className="py-12 text-center text-muted-foreground">
          Checking for active reservation...
        </div>
      </PublicLayout>
    );
  }

  if (!token) {
    return (
      <PublicLayout>
        <PublicErrorState
          title={publicCopy.empty.noActiveReservation}
          message={publicCopy.empty.sessionExpired}
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

            <Button
              className="w-full"
              onClick={handleViewStatus}
              data-testid="button-view-status"
            >
              {publicCopy.buttons.viewStatus}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
