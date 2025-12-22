import { useLatestSnapshot, useRefreshSnapshot } from "@/hooks/use-snapshots";
import { DashboardLayout } from "@/components/DashboardLayout";
import { HydroWidget } from "@/components/widgets/HydroWidget";
import { FerryWidget } from "@/components/widgets/FerryWidget";
import { RoadWidget } from "@/components/widgets/RoadWidget";
import { AlertWidget } from "@/components/widgets/AlertWidget";
import { WaterWidget } from "@/components/widgets/WaterWidget";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const LOCATION = "Bamfield";

export default function Dashboard() {
  const { data: snapshot, isLoading, error } = useLatestSnapshot(LOCATION);
  const { mutate: refresh, isPending: isRefreshing } = useRefreshSnapshot();
  const { toast } = useToast();

  const handleRefresh = () => {
    refresh(LOCATION, {
      onSuccess: () => {
        toast({
          title: "Data Updated",
          description: "Status information has been refreshed successfully.",
        });
      },
      onError: (err) => {
        toast({
          title: "Refresh Failed",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout location={LOCATION} isRefreshing={isRefreshing} onRefresh={handleRefresh}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl md:col-span-2 row-span-2" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !snapshot) {
    return (
      <DashboardLayout location={LOCATION} isRefreshing={isRefreshing} onRefresh={handleRefresh}>
        <EmptyState onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      </DashboardLayout>
    );
  }

  const { real_time_status_updates: updates } = snapshot.data;

  return (
    <DashboardLayout 
      location={snapshot.location} 
      lastUpdated={snapshot.createdAt ? new Date(snapshot.createdAt) : null}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {/* Alerts span full width */}
        <AlertWidget data={updates.active_alerts} />

        {/* Bento Grid Layout */}
        <HydroWidget data={updates.bc_hydro_outages} />
        <FerryWidget data={updates.ferry_schedules} />
        <RoadWidget data={updates.road_conditions} />
        <WaterWidget data={updates.water_sewer_alerts} />
        
        {/* Fallback for empty slots to maintain grid shape if needed or extra widgets */}
        <div className="hidden lg:block lg:col-span-1 rounded-xl border border-border/30 bg-card/20 p-6 flex items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Community Tip</p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              For emergencies call 911. This dashboard is for informational purposes only.
            </p>
          </div>
        </div>

      </motion.div>
    </DashboardLayout>
  );
}
