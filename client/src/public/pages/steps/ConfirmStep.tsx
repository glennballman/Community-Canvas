import { useState, useRef, useCallback } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { publicCopy } from "../../publicCopy";
import { PublicLoadingState } from "../../components/PublicLoadingState";
import { ReviewLockedBanner } from "../../components/ReviewLockedBanner";
import { ConfirmForm, ConfirmFormData } from "../../components/ConfirmForm";
import { ConfirmFinanceSummary } from "../../components/ConfirmFinanceSummary";
import { SubmitConfirmPanel } from "../../components/SubmitConfirmPanel";
import { usePublicSubmitReservation } from "../../state/usePublicSubmitReservation";
import {
  PublicCartData,
  PublicCartItem,
  PublicCartStatus,
  isLocked,
} from "../../state/publicReservationMachine";
import { PublicAuth } from "../../state/publicTokenStore";

interface ConfirmOutletContext {
  auth: PublicAuth | null;
  cart: PublicCartData | null;
  items: PublicCartItem[];
  status: PublicCartStatus;
  refetch: () => Promise<void>;
}

export default function ConfirmStep() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<ConfirmOutletContext>();
  
  const { submit, isSubmitting, submitError } = usePublicSubmitReservation();
  const [formData, setFormData] = useState<ConfirmFormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { auth, items, status, refetch } = context || { 
    auth: null, 
    items: [], 
    status: "unknown" as PublicCartStatus,
    refetch: async () => {},
  };
  
  const locked = isLocked(status);
  const isEmpty = items.length === 0;

  const handleBackToReview = useCallback(() => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}/start/review`);
    }
  }, [navigate, portalSlug, offerSlug]);

  const handleFormChange = useCallback((data: ConfirmFormData) => {
    setFormData(data);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!auth || !formData?.email) return;

    const result = await submit({
      portalId: auth.portalId,
      cartId: auth.cartId,
      accessToken: auth.accessToken,
      email: formData.email,
      fullName: formData.fullName || undefined,
      phone: formData.phone || undefined,
    });

    if (result.ok) {
      // Refetch cart to get updated status
      await refetch();
      
      // Navigate to confirmation page
      const token = result.token || result.accessToken || auth.cartId;
      navigate(`/reserve/confirmation/${token}`);
    }
  }, [auth, formData, submit, refetch, navigate]);

  const handleViewStatus = useCallback(() => {
    if (auth?.cartId) {
      navigate(`/reserve/status/${auth.cartId}`);
    }
  }, [auth, navigate]);

  if (!context) {
    return <PublicLoadingState message={publicCopy.loading.loadingCart} />;
  }

  if (!auth) {
    return (
      <div className="py-8 text-center space-y-4" data-testid="confirm-step-no-auth">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">
          {publicCopy.empty.noAuthFound}
        </p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          <Button
            variant="outline"
            onClick={() => navigate("/reserve/resume")}
            data-testid="button-resume"
          >
            {publicCopy.buttons.resumeReservation}
          </Button>
          <Button
            variant="ghost"
            onClick={() => portalSlug && offerSlug && navigate(`/reserve/${portalSlug}/${offerSlug}`)}
            data-testid="button-start-over"
          >
            {publicCopy.buttons.startOver}
          </Button>
        </div>
      </div>
    );
  }

  if (isEmpty && !locked) {
    return (
      <div className="py-8 text-center space-y-4" data-testid="confirm-step-empty">
        <p className="text-muted-foreground">
          {publicCopy.empty.cartEmpty}
        </p>
        <Button
          variant="outline"
          onClick={handleBackToReview}
          data-testid="button-back-to-review"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Review
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="confirm-step">
      <div>
        <h2 className="text-xl font-semibold mb-1" data-testid="text-confirm-title">
          Confirm Your Reservation
        </h2>
        <p className="text-sm text-muted-foreground">
          You're about to place a reservation for the items shown.
        </p>
      </div>

      {locked && (
        <div className="space-y-4">
          <ReviewLockedBanner 
            message={status === "submitted" 
              ? publicCopy.banners.submitted 
              : status === "completed"
              ? publicCopy.banners.completed
              : publicCopy.banners.expired
            } 
          />
          <Button
            variant="outline"
            onClick={handleViewStatus}
            data-testid="button-view-status"
          >
            {publicCopy.buttons.viewStatus}
          </Button>
        </div>
      )}

      {!locked && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Contact Information
              </h3>
              
              <Alert>
                <AlertDescription className="text-sm">
                  We only collect the minimum information needed to confirm your reservation.
                  No account will be created.
                </AlertDescription>
              </Alert>

              <ConfirmForm
                disabled={locked}
                isSubmitting={isSubmitting}
                onSubmit={handleFormChange}
              />
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBackToReview}
                disabled={isSubmitting}
                data-testid="button-back-to-review"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Review
              </Button>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <ConfirmFinanceSummary items={items} />
            <SubmitConfirmPanel
              isSubmitting={isSubmitting}
              isDisabled={!formData?.email || locked}
              submitError={submitError}
              onSubmit={handleSubmit}
              itemCount={items.length}
            />
          </div>
        </div>
      )}
    </div>
  );
}
