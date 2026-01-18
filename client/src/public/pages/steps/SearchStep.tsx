import { useParams, useOutletContext } from "react-router-dom";
import { AvailabilitySearch } from "../../components/AvailabilitySearch";
import { PublicAuth } from "../../state/publicTokenStore";
import { PublicCartStatus } from "../../state/publicReservationMachine";

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

  return (
    <div data-testid="step-search">
      <AvailabilitySearch
        portalSlug={portalSlug}
        offerSlug={offerSlug}
        offerMetadata={context?.offerMetadata}
      />
    </div>
  );
}
