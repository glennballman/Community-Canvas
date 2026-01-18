import { Badge } from "@/components/ui/badge";

interface JobStatusBadgeProps {
  status: string;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const getVariant = () => {
    switch (status) {
      case "open":
        return "default";
      case "filled":
        return "secondary";
      case "closed":
        return "outline";
      case "draft":
        return "outline";
      default:
        return "outline";
    }
  };

  const getLabel = () => {
    switch (status) {
      case "open":
        return "Open";
      case "filled":
        return "Filled";
      case "closed":
        return "Closed";
      case "draft":
        return "Draft";
      default:
        return status;
    }
  };

  return (
    <Badge variant={getVariant()} data-testid={`badge-status-${status}`}>
      {getLabel()}
    </Badge>
  );
}
