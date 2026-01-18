import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvailabilitySearch } from "../../components/AvailabilitySearch";
import { publicCopy } from "../../publicCopy";
import { PublicAuth } from "../../state/publicTokenStore";
import { PublicCartStatus } from "../../state/publicReservationMachine";
import { 
  getPrefillIntent, 
  clearPrefillIntent, 
  PrefillSearchIntent 
} from "../../state/publicPrefillSearch";

interface SearchStepContext {
  auth: PublicAuth | null;
  cart: any;
  items: any[];
  status: PublicCartStatus;
  refetch: () => Promise<void>;
  offerMetadata?: any;
}

export default function SearchStep() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const context = useOutletContext<SearchStepContext>();
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null);
  const [initialPrefill, setInitialPrefill] = useState<PrefillSearchIntent | null>(null);

  useEffect(() => {
    if (!context?.auth) return;
    
    const prefill = getPrefillIntent(context.auth.portalId, context.auth.cartId);
    if (prefill) {
      setInitialPrefill(prefill);
      if (prefill.displayName) {
        setPrefillBanner(publicCopy.crossSell.showingFor(prefill.displayName));
      }
      clearPrefillIntent(context.auth.portalId, context.auth.cartId);
    }
  }, [context?.auth?.portalId, context?.auth?.cartId]);

  return (
    <div data-testid="step-search">
      {prefillBanner && (
        <Alert className="mb-4" data-testid="prefill-banner">
          <Info className="h-4 w-4" />
          <AlertDescription>{prefillBanner}</AlertDescription>
        </Alert>
      )}
      <AvailabilitySearch
        portalSlug={portalSlug}
        offerSlug={offerSlug}
        offerMetadata={context?.offerMetadata}
        initialPrefill={initialPrefill}
      />
    </div>
  );
}
