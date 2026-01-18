import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";

interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  status: string;
  href: string;
}

interface ActivityPanelProps {
  title: string;
  items: ActivityItem[];
  isLoading?: boolean;
  emptyMessage: string;
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  default: "bg-muted text-muted-foreground",
};

export function ActivityPanel({
  title,
  items,
  isLoading,
  emptyMessage,
}: ActivityPanelProps) {
  if (isLoading) {
    return (
      <Card className="p-5" data-testid="activity-panel-loading">
        <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded"></div>
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
    <Card className="p-5" data-testid="activity-panel">
      <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center" data-testid="activity-empty">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <Link key={item.id} to={item.href} data-testid={`activity-item-${item.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg hover-elevate cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.subtitle ||
                      formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                  </p>
                </div>
                <span
                  className={`ml-3 px-2 py-1 text-xs font-medium rounded ${
                    statusColors[item.status] || statusColors.default
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
