import { Link } from "react-router-dom";
import { Calendar, Truck, Briefcase, Mail, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SummaryTileProps {
  title: string;
  count: number;
  subtitle: string;
  href: string;
  isLoading?: boolean;
  icon?: "calendar" | "truck" | "briefcase" | "mail" | "alert";
}

const iconMap = {
  calendar: Calendar,
  truck: Truck,
  briefcase: Briefcase,
  mail: Mail,
  alert: AlertCircle,
};

export function SummaryTile({
  title,
  count,
  subtitle,
  href,
  isLoading,
  icon = "calendar",
}: SummaryTileProps) {
  const Icon = iconMap[icon];

  if (isLoading) {
    return (
      <Card className="p-5 animate-pulse" data-testid={`tile-${icon}-loading`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="h-8 w-8 bg-muted rounded"></div>
        </div>
        <div className="mt-3">
          <div className="h-8 bg-muted rounded w-16"></div>
          <div className="h-3 bg-muted rounded w-20 mt-2"></div>
        </div>
      </Card>
    );
  }

  return (
    <Link to={href} data-testid={`tile-${icon}`}>
      <Card className="p-5 hover-elevate cursor-pointer">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-3">
          <span className="text-3xl font-semibold text-foreground" data-testid={`count-${icon}`}>
            {count}
          </span>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </Card>
    </Link>
  );
}
