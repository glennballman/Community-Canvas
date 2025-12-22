import { useState } from "react";
import { useLatestSnapshot, useRefreshSnapshot } from "@/hooks/use-snapshots";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Info, AlertTriangle, ExternalLink, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

// Note: ThemeToggle removed as it might not exist in the project yet.
// If it does, we can re-add it once verified.
const ThemeToggle = () => null;

export default function Dashboard() {
  const [cityName, setCityName] = useState("Vancouver");
  const [activeCategory, setActiveCategory] = useState("emergency");
  const { data: snapshotResponse, isLoading, error } = useLatestSnapshot(cityName);
  const { mutate: refresh, isPending: isRefreshing } = useRefreshSnapshot();
  const { toast } = useToast();

  const handleRefresh = () => {
    refresh(cityName, {
      onSuccess: () => {
        toast({
          title: "Refresh Triggered",
          description: "Firecrawl AI is now gathering the latest data.",
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

  const snapshot = snapshotResponse?.data;
  const categories = snapshot?.categories || {};
  const activeItems = categories[activeCategory] || [];

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("operational") || s.includes("on time") || s.includes("open") || s.includes("normal")) {
      return <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-500">Operational</Badge>;
    }
    if (s.includes("outage") || s.includes("delay") || s.includes("closed") || s.includes("heavy")) {
      return <Badge variant="destructive">Alert</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <AppSidebar 
          cityName={cityName}
          onCityChange={setCityName}
          activeCategory={activeCategory}
          onCategorySelect={setActiveCategory}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="h-4 w-[1px] bg-border" />
              <h2 className="text-lg font-semibold tracking-tight">{cityName} Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
              {snapshotResponse?.timestamp && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Last Sync: {new Date(snapshotResponse.timestamp).toLocaleTimeString()}
                </span>
              )}
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <Skeleton className="h-8 w-64" />
                  <div className="grid gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center space-y-4"
                >
                  <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h3 className="text-xl font-semibold">No Data Available</h3>
                    <p className="text-muted-foreground">We haven't collected any snapshots for {cityName} yet.</p>
                  </div>
                  <Button onClick={handleRefresh} disabled={isRefreshing}>
                    {isRefreshing ? "Fetching Data..." : "Run First Extraction"}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col gap-1">
                    <h3 className="text-2xl font-bold tracking-tight capitalize">
                      {activeCategory.replace('_', ' ')}
                    </h3>
                    <p className="text-muted-foreground">
                      Real-time status and updates from verified sources.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    {activeItems.length > 0 ? (
                      activeItems.map((item, idx) => (
                        <Card key={idx} className="hover-elevate transition-all border-border/50">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <div className="flex items-center gap-3">
                              {getSeverityIcon(item.severity)}
                              <CardTitle className="text-base font-semibold">{item.label}</CardTitle>
                            </div>
                            {getStatusBadge(item.status)}
                          </CardHeader>
                          {(item.details || item.status_citation) && (
                            <CardContent className="px-4 pb-4 pt-0">
                              {item.details && (
                                <p className="text-sm text-muted-foreground mb-2">{item.details}</p>
                              )}
                              {item.status_citation && (
                                <a 
                                  href={item.status_citation} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                                >
                                  Source <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      ))
                    ) : (
                      <Card className="border-dashed bg-muted/20">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                          <Info className="h-8 w-8 text-muted-foreground mb-4" />
                          <p className="font-medium">No Data Available</p>
                          <p className="text-sm text-muted-foreground">
                            Firecrawl hasn't configured sources for this category in {cityName} yet.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
