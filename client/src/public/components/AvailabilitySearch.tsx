import { useState, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AlertCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvailabilityInputs, AvailabilityQuery } from "./AvailabilityInputs";
import { AvailabilityResults } from "./AvailabilityResults";
import { AvailabilityResult } from "./AvailabilityResultCard";
import { PublicLoadingState } from "./PublicLoadingState";
import { publicApi } from "../api/publicApi";
import { publicCopy } from "../publicCopy";
import { 
  EntryPointType, 
  deriveEntryPointType, 
  getEntryPointLabel,
} from "../state/publicEntryPoint";
import { 
  setCarryForwardCandidates, 
  generateCandidatesForType,
} from "../state/publicCarryForward";
import { PublicAuth } from "../state/publicTokenStore";
import { PublicCartStatus, isLocked } from "../state/publicReservationMachine";
import { PrefillSearchIntent } from "../state/publicPrefillSearch";

interface AvailabilitySearchContext {
  auth: PublicAuth | null;
  cart: any;
  items: any[];
  status: PublicCartStatus;
  refetch: () => Promise<void>;
}

export interface AvailabilitySearchProps {
  portalSlug?: string;
  offerSlug?: string;
  offerId?: string;
  offerMetadata?: any;
  initialPrefill?: PrefillSearchIntent | null;
}

export function AvailabilitySearch({
  portalSlug,
  offerSlug,
  offerId,
  offerMetadata,
  initialPrefill,
}: AvailabilitySearchProps) {
  const navigate = useNavigate();
  const context = useOutletContext<AvailabilitySearchContext>();
  const { auth, status, refetch } = context || {};

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const entryPointType: EntryPointType = deriveEntryPointType(offerMetadata);
  const locked = status ? isLocked(status) : false;

  const handleSearch = useCallback(async (query: AvailabilityQuery) => {
    if (!portalSlug) {
      setSearchError("Portal not found.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      // Build availability query matching backend contract
      const apiQuery = {
        portalSlug,
        startAt: query.startDate ? format(query.startDate, "yyyy-MM-dd") : "",
        endAt: query.endDate ? format(query.endDate, "yyyy-MM-dd") : "",
        assetType: entryPointType === "lodging" ? "unit" : 
                   entryPointType === "parking" ? "parking_stall" :
                   entryPointType === "marina" ? "marina_slip" : undefined,
        assetId: offerId,
      };

      const result = await publicApi.availability(apiQuery);

      if (!result.ok) {
        setSearchError(result.error?.message || publicCopy.errors.generic);
      } else {
        const availabilityData = result.availability || result.results || result.items || [];
        const mappedResults: AvailabilityResult[] = availabilityData.map((item: any, index: number) => ({
          id: item.id || item.unit_id || `result-${index}`,
          unitId: item.unit_id || item.unitId || item.id,
          title: item.title || item.name || item.unit_name || `Unit ${index + 1}`,
          description: item.description,
          startsAt: item.starts_at || item.startsAt || query.startDate?.toISOString() || "",
          endsAt: item.ends_at || item.endsAt || query.endDate?.toISOString() || "",
          capacity: item.capacity || item.max_guests,
          available: item.available !== false,
          unitPrice: item.unit_price || item.price,
        }));
        setResults(mappedResults);
      }
    } catch (err) {
      setSearchError(publicCopy.errors.networkError);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, [portalSlug, offerId, entryPointType]);

  const handleAddToCart = useCallback(async (result: AvailabilityResult) => {
    if (!auth || locked) return;

    setAddingId(result.id);

    try {
      const addResult = await publicApi.addCartItem({
        portalId: auth.portalId,
        cartId: auth.cartId,
        accessToken: auth.accessToken,
        inventoryUnitId: result.unitId,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        quantity: 1,
        title: result.title,
      });

      if (!addResult.ok) {
        setSearchError(addResult.error?.message || "Failed to add item to reservation.");
        return;
      }

      // Store carry-forward candidates for cross-sell
      if (auth.portalId && (offerId || offerSlug)) {
        const candidates = generateCandidatesForType(entryPointType);
        setCarryForwardCandidates(auth.portalId, offerId || offerSlug || "", candidates);
      }

      // Refetch cart
      if (refetch) {
        await refetch();
      }

      // Navigate to details step
      if (portalSlug && offerSlug) {
        navigate(`/reserve/${portalSlug}/${offerSlug}/start/details`);
      }
    } catch (err) {
      setSearchError(publicCopy.errors.networkError);
    } finally {
      setAddingId(null);
    }
  }, [auth, locked, offerId, offerSlug, portalSlug, entryPointType, refetch, navigate]);

  return (
    <div className="space-y-6" data-testid="availability-search">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          {getEntryPointLabel(entryPointType)} {publicCopy.availability.searchButton.replace("Search ", "")}
        </h2>
      </div>

      {locked && (
        <Alert variant="destructive" data-testid="locked-banner">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{publicCopy.banners.cannotChange}</AlertDescription>
        </Alert>
      )}

      <AvailabilityInputs
        entryPointType={entryPointType}
        disabled={locked}
        onSearch={handleSearch}
        isSearching={isSearching}
      />

      {searchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{searchError}</AlertDescription>
        </Alert>
      )}

      {isSearching ? (
        <PublicLoadingState message={publicCopy.loading.checkingAvailability} />
      ) : hasSearched ? (
        <AvailabilityResults
          results={results}
          disabled={locked}
          onAdd={handleAddToCart}
          addingId={addingId}
        />
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          <p>{publicCopy.availability.searchFirst}</p>
        </div>
      )}
    </div>
  );
}
