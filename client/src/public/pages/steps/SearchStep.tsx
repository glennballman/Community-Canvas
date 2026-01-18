import { useParams } from "react-router-dom";
import { AvailabilitySearch } from "../../components/AvailabilitySearch";

export default function SearchStep() {
  const { portalSlug, offerSlug } = useParams<{ portalSlug: string; offerSlug: string }>();

  return (
    <div data-testid="step-search">
      <AvailabilitySearch
        portalSlug={portalSlug}
        offerSlug={offerSlug}
      />
    </div>
  );
}
