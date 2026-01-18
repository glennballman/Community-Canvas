import { Badge } from "@/components/ui/badge";

interface ReservationStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  checked_in: { label: "Checked In", variant: "default" },
  checked_out: { label: "Checked Out", variant: "outline" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function ReservationStatusBadge({ status }: ReservationStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };

  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}
