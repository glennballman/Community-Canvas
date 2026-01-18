import { publicCopy } from "../../publicCopy";

export default function DetailsStep() {
  return (
    <div className="py-8 text-center" data-testid="step-details">
      <h2 className="text-lg font-semibold mb-2" data-testid="text-step-title">
        {publicCopy.stepLabels.details}
      </h2>
      <p className="text-muted-foreground">
        This step will be implemented in a future phase (Guest Details Form).
      </p>
    </div>
  );
}
