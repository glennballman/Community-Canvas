import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";
import { publicFetch } from "../api/publicApi";
import { setPortalSlug, setOfferSlug } from "../state/publicTokenStore";

interface OfferData {
  id: string;
  name: string;
  description: string | null;
  portal_name: string;
}

export default function OfferLandingPage() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<OfferData | null>(null);

  useEffect(() => {
    const fetchOffer = async () => {
      if (!portalSlug || !offerSlug) {
        setError(publicCopy.empty.noOfferFound);
        setLoading(false);
        return;
      }

      const result = await publicFetch<{ offer: OfferData }>(
        `/api/public/reserve/${portalSlug}/${offerSlug}`
      );

      if (!result.ok) {
        setError(result.error.message || publicCopy.empty.noOfferFound);
      } else if (result.offer) {
        setOffer(result.offer);
      } else {
        setError(publicCopy.empty.noOfferFound);
      }

      setLoading(false);
    };

    fetchOffer();
  }, [portalSlug, offerSlug]);

  const handleStartReservation = () => {
    if (portalSlug && offerSlug) {
      setPortalSlug(portalSlug);
      setOfferSlug(offerSlug);
      navigate(`/reserve/${portalSlug}/${offerSlug}/start`);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <PublicLoadingState message={publicCopy.loading.loadingOffer} />
      </PublicLayout>
    );
  }

  if (error) {
    return (
      <PublicLayout>
        <PublicErrorState
          title={publicCopy.empty.noOfferFound}
          message={error}
          showBack={false}
        />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto" data-testid="offer-landing-page">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span data-testid="text-portal-name">{offer?.portal_name || "Reservations"}</span>
            </div>
            <CardTitle data-testid="text-offer-title">
              {offer?.name || publicCopy.titles.reserve}
            </CardTitle>
            {offer?.description && (
              <CardDescription data-testid="text-offer-description">
                {offer.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground" data-testid="text-disclaimer">
              {publicCopy.disclaimers.requestOnly}
            </p>

            <Button
              size="lg"
              className="w-full"
              onClick={handleStartReservation}
              data-testid="button-start-reservation"
            >
              {publicCopy.buttons.startReservation}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
