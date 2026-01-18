import { useDashboardData } from "@/hooks/useDashboardData";
import { SummaryTile } from "@/components/dashboard/SummaryTile";
import { ActivityPanel } from "@/components/dashboard/ActivityPanel";
import { AttentionPanel } from "@/components/dashboard/AttentionPanel";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardData();
  const { currentTenant } = useTenant();

  if (error) {
    return (
      <div className="p-6" data-testid="dashboard-error">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <h3 className="text-destructive font-medium">Unable to load dashboard</h3>
          <p className="text-destructive/80 text-sm mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="mt-3"
            data-testid="button-retry"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const tenantName = currentTenant?.tenant_name || data?.tenantName || "Operations Overview";
  const roleBadge = currentTenant?.role || data?.roleBadge;

  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-tenant-name">
            {tenantName}
          </p>
        </div>
        {roleBadge && (
          <span
            className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full"
            data-testid="badge-role"
          >
            {roleBadge}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile
          title="Reservations"
          count={data?.reservations?.total ?? 0}
          subtitle={`${data?.reservations?.activeToday ?? 0} active today`}
          href="/app/reservations"
          isLoading={isLoading}
          icon="calendar"
        />
        <SummaryTile
          title="Service Runs"
          count={data?.serviceRuns?.upcoming ?? 0}
          subtitle="Next 7 days"
          href="/app/service-runs"
          isLoading={isLoading}
          icon="truck"
        />
        <SummaryTile
          title="Jobs"
          count={data?.jobs?.openPostings ?? 0}
          subtitle="Open postings"
          href="/app/jobs"
          isLoading={isLoading}
          icon="briefcase"
        />
        <SummaryTile
          title="Messages"
          count={data?.messages?.unread ?? 0}
          subtitle="Unread"
          href="/app/messages"
          isLoading={isLoading}
          icon="mail"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityPanel
          title="Today & Next 48 Hours"
          items={data?.upcomingActivity || []}
          isLoading={isLoading}
          emptyMessage="No upcoming reservations"
        />
        <AttentionPanel
          title="Needs Attention"
          items={data?.attentionItems || []}
          isLoading={isLoading}
          emptyMessage="No items need attention"
        />
      </div>
    </div>
  );
}
