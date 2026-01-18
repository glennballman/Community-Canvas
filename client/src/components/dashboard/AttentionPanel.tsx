import { Link } from "react-router-dom";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AttentionItem {
  id: string;
  type: "arrival" | "departure" | "overdue" | "alert" | "action";
  title: string;
  description?: string;
  href: string;
  priority: "high" | "medium" | "low";
}

interface AttentionPanelProps {
  title: string;
  items: AttentionItem[];
  isLoading?: boolean;
  emptyMessage: string;
}

const priorityIcons = {
  high: AlertTriangle,
  medium: Clock,
  low: CheckCircle,
};

const priorityColors = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

export function AttentionPanel({
  title,
  items,
  isLoading,
  emptyMessage,
}: AttentionPanelProps) {
  if (isLoading) {
    return (
      <Card className="p-5" data-testid="attention-panel-loading">
        <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="h-8 w-8 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2 mt-1"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5" data-testid="attention-panel">
      <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>

      {items.length === 0 ? (
        <div className="text-center py-6" data-testid="attention-empty">
          <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => {
            const Icon = priorityIcons[item.priority];
            return (
              <Link key={item.id} to={item.href} data-testid={`attention-item-${item.id}`}>
                <div className="flex items-start gap-3 p-3 rounded-lg hover-elevate cursor-pointer">
                  <Icon
                    className={`h-5 w-5 mt-0.5 ${priorityColors[item.priority]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
