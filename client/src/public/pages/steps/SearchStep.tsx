import { publicCopy } from "../../publicCopy";

export default function SearchStep() {
  return (
    <div className="py-8 text-center" data-testid="step-search">
      <h2 className="text-lg font-semibold mb-2" data-testid="text-step-title">
        {publicCopy.stepLabels.search}
      </h2>
      <p className="text-muted-foreground">
        This step will be implemented in P-UI-04 (AvailabilitySearch).
      </p>
    </div>
  );
}
