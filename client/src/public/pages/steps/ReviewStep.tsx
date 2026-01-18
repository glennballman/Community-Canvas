import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicCopy } from "../../publicCopy";
import { PublicLoadingState } from "../../components/PublicLoadingState";
import { ReviewLockedBanner } from "../../components/ReviewLockedBanner";
import { ReviewItemCard } from "../../components/ReviewItemCard";
import { ReviewSummary } from "../../components/ReviewSummary";
import {
  PublicCartData,
  PublicCartItem,
  PublicCartStatus,
  isLocked,
} from "../../state/publicReservationMachine";
import { PublicAuth } from "../../state/publicTokenStore";

interface ReviewOutletContext {
  auth: PublicAuth | null;
  cart: PublicCartData | null;
  items: PublicCartItem[];
  status: PublicCartStatus;
  refetch: () => Promise<void>;
}

export default function ReviewStep() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<ReviewOutletContext>();
  
  const { items, status } = context || { items: [], status: "unknown" as PublicCartStatus };
  const locked = isLocked(status);
  const isEmpty = items.length === 0;

  const handleBackToSearch = () => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}/start/search`);
    }
  };

  const handleContinue = () => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}/start/confirm`);
    }
  };

  if (!context) {
    return <PublicLoadingState message={publicCopy.loading.loadingCart} />;
  }

  if (isEmpty && !locked) {
    return (
      <div className="py-8 text-center space-y-4" data-testid="review-step-empty">
        <p className="text-muted-foreground">
          {publicCopy.empty.cartEmpty}
        </p>
        <Button
          variant="outline"
          onClick={handleBackToSearch}
          data-testid="button-back-to-search"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {publicCopy.availability.searchButton}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="review-step">
      <div>
        <h2 className="text-xl font-semibold mb-1" data-testid="text-review-title">
          Review Your Reservation
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything below is available for your selected dates
        </p>
      </div>

      {locked && (
        <ReviewLockedBanner />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Reservation Items
          </h3>
          
          {items.map((item) => (
            <ReviewItemCard key={item.id} item={item} />
          ))}
        </div>

        <div className="lg:col-span-1">
          <ReviewSummary items={items} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleBackToSearch}
          disabled={locked}
          data-testid="button-change-availability"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Change Dates / Availability
        </Button>

        {!locked && (
          <Button
            onClick={handleContinue}
            disabled={isEmpty}
            data-testid="button-continue"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
