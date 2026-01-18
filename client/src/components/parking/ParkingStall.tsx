import { Button } from "@/components/ui/button";
import { Accessibility } from "lucide-react";

interface ParkingUnit {
  id: string;
  code: string;
  accessible: boolean;
  currentStatus: string;
}

interface Props {
  unit: ParkingUnit;
  isSelected: boolean;
  onClick: () => void;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  occupied: "destructive",
  reserved: "secondary",
  maintenance: "outline",
};

export function ParkingStall({ unit, isSelected, onClick }: Props) {
  const variant = statusVariants[unit.currentStatus] || "default";

  return (
    <Button
      variant={variant}
      onClick={onClick}
      data-testid={`parking-stall-${unit.id}`}
      className={`
        ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
      `}
      title={`${unit.code} - ${unit.currentStatus}`}
    >
      {unit.accessible && <Accessibility className="h-3 w-3 mr-1" />}
      {unit.code}
    </Button>
  );
}
