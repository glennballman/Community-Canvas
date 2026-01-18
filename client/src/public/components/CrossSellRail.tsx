import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sparkles, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { publicCopy } from "../publicCopy";
import { CrossSellCard } from "./CrossSellCard";
import { PublicCartItem } from "../state/publicReservationMachine";
import { 
  getCarryForwardCandidates, 
  generateCandidatesForType,
  CarryForwardCandidate,
} from "../state/publicCarryForward";
import { getOrderedCrossSellCandidates } from "../state/publicCrossSellOrdering";
import { setPrefillIntent } from "../state/publicPrefillSearch";
import { EntryPointType } from "../state/publicEntryPoint";

interface CrossSellRailProps {
  portalId: string;
  cartId: string;
  offerId?: string;
  cartItems: PublicCartItem[];
  locked: boolean;
}

function derivePrimaryType(items: PublicCartItem[]): EntryPointType {
  if (items.length === 0) return "lodging";
  
  const firstTitle = items[0].title.toLowerCase();
  if (firstTitle.includes("slip") || firstTitle.includes("marina") || firstTitle.includes("dock")) {
    return "marina";
  }
  if (firstTitle.includes("stall") || firstTitle.includes("parking") || firstTitle.includes("spot")) {
    return "parking";
  }
  if (firstTitle.includes("kayak") || firstTitle.includes("rental") || firstTitle.includes("gear")) {
    return "equipment";
  }
  if (firstTitle.includes("tour") || firstTitle.includes("excursion") || firstTitle.includes("activity")) {
    return "activity";
  }
  return "lodging";
}

export function CrossSellRail({
  portalId,
  cartId,
  offerId,
  cartItems,
  locked,
}: CrossSellRailProps) {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();
  const navigate = useNavigate();
  
  const primaryType = derivePrimaryType(cartItems);
  
  const orderedCandidates = useMemo(() => {
    let candidates: CarryForwardCandidate[] = [];
    
    if (offerId) {
      candidates = getCarryForwardCandidates(portalId, offerId);
    }
    
    if (candidates.length === 0) {
      candidates = generateCandidatesForType(primaryType);
    }
    
    return getOrderedCrossSellCandidates(candidates, cartItems, primaryType, 4);
  }, [portalId, offerId, cartItems, primaryType]);
  
  const handleCheckAvailability = useCallback((candidate: CarryForwardCandidate) => {
    if (locked) return;
    
    setPrefillIntent(portalId, cartId, {
      itemType: candidate.itemType || candidate.entryPointType,
      suggestedWindow: candidate.suggestedWindow,
      facilityId: candidate.facilityId,
      displayName: candidate.displayName || candidate.hint,
      whyShown: candidate.whyShown,
    });
    
    if (portalSlug && offerSlug) {
      navigate(`/reserve/${portalSlug}/${offerSlug}/start/search`);
    }
  }, [locked, portalId, cartId, portalSlug, offerSlug, navigate]);
  
  return (
    <Card data-testid="cross-sell-rail">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {publicCopy.crossSell.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {publicCopy.crossSell.subtitle}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {locked && (
          <Alert data-testid="cross-sell-locked-banner">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              {publicCopy.banners.cannotChange}
            </AlertDescription>
          </Alert>
        )}
        
        {orderedCandidates.length === 0 ? (
          <p 
            className="text-sm text-muted-foreground text-center py-4"
            data-testid="cross-sell-empty"
          >
            {publicCopy.crossSell.empty}
          </p>
        ) : (
          orderedCandidates.map((candidate, index) => (
            <CrossSellCard
              key={candidate.offerId || candidate.offerSlug || `candidate-${index}`}
              candidate={candidate}
              disabled={locked}
              onCheckAvailability={() => handleCheckAvailability(candidate)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
