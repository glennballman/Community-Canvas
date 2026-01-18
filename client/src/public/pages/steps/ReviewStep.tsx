import { publicCopy } from "../../publicCopy";

export default function ReviewStep() {
  return (
    <div className="py-8 text-center" data-testid="step-review">
      <h2 className="text-lg font-semibold mb-2" data-testid="text-step-title">
        {publicCopy.stepLabels.review}
      </h2>
      <p className="text-muted-foreground">
        This step will be implemented in a future phase (Review & Submit).
      </p>
    </div>
  );
}
