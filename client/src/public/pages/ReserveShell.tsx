import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { publicCopy } from "../publicCopy";

export default function ReserveShell() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto" data-testid="reserve-shell">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {publicCopy.buttons.back}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card data-testid="card-step-area">
              <CardHeader>
                <CardTitle data-testid="text-step-title">
                  {publicCopy.steps.selectDates}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center text-muted-foreground" data-testid="step-placeholder">
                  <p>Step content will be implemented in subsequent phases.</p>
                  <p className="text-sm mt-2">Portal: {portalSlug}</p>
                  <p className="text-sm">Offer: {offerSlug}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card data-testid="card-cart-panel">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <CardTitle className="text-base" data-testid="text-cart-title">
                    {publicCopy.cart.yourReservation}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground" data-testid="cart-placeholder">
                  <p className="text-sm">{publicCopy.cart.empty}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
