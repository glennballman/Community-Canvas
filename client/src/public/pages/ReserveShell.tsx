import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { ReserveStepHeader } from "../components/ReserveStepHeader";
import { CartPanel } from "../components/CartPanel";
import { publicCopy } from "../publicCopy";
import { publicApi } from "../api/publicApi";
import { usePublicCart } from "../state/usePublicCart";
import {
  getAuthFromToken,
  setAuthContext,
  PublicAuth,
} from "../state/publicTokenStore";
import {
  ReservationStep,
  RESERVATION_STEPS,
  isExpired,
  isLocked,
} from "../state/publicReservationMachine";

function deriveCurrentStep(pathname: string): ReservationStep {
  if (pathname.includes("/details")) return "details";
  if (pathname.includes("/review")) return "review";
  return "search";
}

export default function ReserveShell() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [auth, setAuth] = useState<PublicAuth | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [noAuth, setNoAuth] = useState(false);

  // Auth resolution on mount
  useEffect(() => {
    // Priority 1: Get from token store
    let resolvedAuth = getAuthFromToken();
    
    // Priority 2: Get from URL params
    if (!resolvedAuth) {
      const urlPortalId = searchParams.get("portalId");
      const urlCartId = searchParams.get("cartId");
      const urlAccessToken = searchParams.get("accessToken");
      
      if (urlPortalId && urlCartId && urlAccessToken) {
        resolvedAuth = {
          portalId: urlPortalId,
          cartId: urlCartId,
          accessToken: urlAccessToken,
        };
        // Persist to session storage
        setAuthContext(resolvedAuth);
      }
    }

    if (resolvedAuth) {
      setAuth(resolvedAuth);
    } else {
      setNoAuth(true);
    }
    
    setAuthChecked(true);
  }, [searchParams]);

  const { cart, items, status, isLoading, isError, refetch } = usePublicCart(auth);
  
  const currentStep = deriveCurrentStep(location.pathname);
  const hasItems = items.length > 0;

  const handleStepClick = useCallback((step: ReservationStep) => {
    if (!portalSlug || !offerSlug) return;
    navigate(`/reserve/${portalSlug}/${offerSlug}/start/${step}`);
  }, [navigate, portalSlug, offerSlug]);

  const handleBack = useCallback(() => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}`);
    } else {
      navigate(-1);
    }
  }, [navigate, portalSlug, offerSlug]);

  const handleAddAnother = useCallback(() => {
    if (!portalSlug || !offerSlug) return;
    navigate(`/reserve/${portalSlug}/${offerSlug}/start/search`);
  }, [navigate, portalSlug, offerSlug]);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    if (!auth || isLocked(status)) return;
    
    await publicApi.removeCartItem(itemId, {
      portalId: auth.portalId,
      cartId: auth.cartId,
      accessToken: auth.accessToken,
    });
    
    refetch();
  }, [auth, status, refetch]);

  const handleStartNewReservation = useCallback(() => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}`);
    }
  }, [navigate, portalSlug, offerSlug]);

  const handleResumeReservation = useCallback(() => {
    navigate("/reserve/resume");
  }, [navigate]);

  const handleStartOver = useCallback(() => {
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}`);
    }
  }, [navigate, portalSlug, offerSlug]);

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <PublicLayout>
        <PublicLoadingState message={publicCopy.loading.loadingCart} />
      </PublicLayout>
    );
  }

  // No auth found
  if (noAuth) {
    return (
      <PublicLayout>
        <div className="max-w-md mx-auto" data-testid="reserve-shell-no-auth">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{publicCopy.empty.noAuthFound}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {publicCopy.empty.noActiveReservation}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleResumeReservation}
                  data-testid="button-resume-reservation"
                >
                  {publicCopy.buttons.resumeReservation}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStartOver}
                  data-testid="button-start-over"
                >
                  {publicCopy.buttons.startOver}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  // Cart expired - special state
  if (isExpired(status)) {
    return (
      <PublicLayout>
        <div className="max-w-md mx-auto" data-testid="reserve-shell-expired">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>{publicCopy.status.expired}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {publicCopy.banners.expired}
              </p>
              <Button
                onClick={handleStartNewReservation}
                className="w-full"
                data-testid="button-start-new"
              >
                {publicCopy.buttons.startNewReservation}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  // Cart error
  if (isError) {
    return (
      <PublicLayout>
        <PublicErrorState
          title={publicCopy.errors.cartLoadFailed}
          message={publicCopy.errors.generic}
          showRetry
          onRetry={refetch}
        />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto space-y-6" data-testid="reserve-shell">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <ReserveStepHeader
              currentStep={currentStep}
              status={status}
              hasItems={hasItems}
              portalName={portalSlug}
              offerName={offerSlug}
              onStepClick={handleStepClick}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card data-testid="card-step-area">
              <CardContent className="pt-6">
                {isLoading ? (
                  <PublicLoadingState message={publicCopy.loading.loadingCart} />
                ) : (
                  <Outlet context={{ auth, cart, items, status, refetch }} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <CartPanel
              items={items}
              status={status}
              isLoading={isLoading}
              onRefresh={refetch}
              onRemoveItem={handleRemoveItem}
              onAddAnother={isLocked(status) ? undefined : handleAddAnother}
            />
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
