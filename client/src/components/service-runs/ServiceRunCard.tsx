import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, Users, MapPin, Truck } from "lucide-react";
import type { ServiceRun } from "@/hooks/useServiceRuns";

interface ServiceRunCardProps {
  serviceRun: ServiceRun;
  onClick?: () => void;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "confirmed":
    case "completed":
      return "default";
    case "published":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export function ServiceRunCard({ serviceRun, onClick }: ServiceRunCardProps) {
  return (
    <Card
      className="p-3 hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`service-run-card-${serviceRun.id}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-1" data-testid="service-run-title">
            {serviceRun.company_name}
          </h4>
          <Badge variant={getStatusVariant(serviceRun.status)} className="shrink-0 text-xs">
            {formatStatus(serviceRun.status)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {serviceRun.service_type}
          </Badge>
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{serviceRun.destination_region}</span>
          </div>

          {serviceRun.crew_name && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{serviceRun.crew_name}</span>
            </div>
          )}

          {serviceRun.planned_duration_days && serviceRun.planned_duration_days > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{serviceRun.planned_duration_days} day{serviceRun.planned_duration_days !== 1 ? "s" : ""}</span>
            </div>
          )}

          {serviceRun.total_job_slots && (
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              <span>{serviceRun.slots_filled || 0}/{serviceRun.total_job_slots} slots</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ServiceRunCardCompact({ serviceRun, onClick }: ServiceRunCardProps) {
  return (
    <div
      className="p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer border border-transparent hover:border-border"
      onClick={onClick}
      data-testid={`service-run-card-${serviceRun.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate">{serviceRun.company_name}</span>
        <Badge variant={getStatusVariant(serviceRun.status)} className="text-[10px] h-5">
          {formatStatus(serviceRun.status)}
        </Badge>
      </div>
      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
        {serviceRun.service_type} · {serviceRun.destination_region}
      </div>
    </div>
  );
}
