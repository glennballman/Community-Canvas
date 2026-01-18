import { Button } from "@/components/ui/button";
import { Anchor } from "lucide-react";

interface MarinaUnit {
  id: string;
  code: string;
  max_length_ft: number | null;
  currentStatus: string;
}

interface Props {
  unit: MarinaUnit;
  isSelected: boolean;
  onClick: () => void;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  occupied: "destructive",
  reserved: "secondary",
  maintenance: "outline",
};

export function MarinaSlip({ unit, isSelected, onClick }: Props) {
  const variant = statusVariants[unit.currentStatus] || "default";

  return (
    <Button
      variant={variant}
      onClick={onClick}
      data-testid={`marina-slip-${unit.code}`}
      className={`
        ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
      `}
      title={`${unit.code} - ${unit.currentStatus}${unit.max_length_ft ? ` (${unit.max_length_ft}ft)` : ""}`}
    >
      <Anchor className="h-3 w-3 mr-1" />
      {unit.code}
    </Button>
  );
}
