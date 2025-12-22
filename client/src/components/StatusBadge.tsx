import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Normalize status for checking
  const normalized = status.toLowerCase();
  
  let variant = "default";
  
  if (normalized.includes("outage") || normalized.includes("closed") || normalized.includes("cancelled") || normalized.includes("critical")) {
    variant = "destructive";
  } else if (normalized.includes("alert") || normalized.includes("delay") || normalized.includes("risk") || normalized.includes("warning")) {
    variant = "warning";
  } else if (normalized.includes("good") || normalized.includes("normal") || normalized.includes("open") || normalized.includes("on time")) {
    variant = "success";
  }

  const variants = {
    default: "bg-secondary text-secondary-foreground border-secondary-foreground/20",
    destructive: "bg-red-500/15 text-red-500 border-red-500/20",
    warning: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20",
    success: "bg-green-500/15 text-green-500 border-green-500/20",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
      variants[variant as keyof typeof variants],
      className
    )}>
      {status}
    </span>
  );
}
