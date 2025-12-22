import { useState } from "react";
import { useLatestSnapshot, useRefreshSnapshot } from "@/hooks/use-snapshots";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  ExternalLink, 
  Activity,
  Zap, 
  Droplet, 
  Ship, 
  Navigation, 
  Bus, 
  Plane, 
  Cloud, 
  Waves, 
  Wind, 
  Heart, 
  Calendar, 
  ParkingCircle, 
  Construction, 
  TrendingUp, 
  Flame,
  Clock,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const CATEGORIES = [
  { id: "emergency", label: "Emergency", icon: AlertTriangle },
  { id: "power", label: "Power", icon: Zap },
  { id: "water", label: "Water", icon: Droplet },
  { id: "ferry", label: "Ferries", icon: Ship },
  { id: "traffic", label: "Traffic", icon: Navigation },
  { id: "transit", label: "Transit", icon: Bus },
  { id: "airport", label: "Airport", icon: Plane },
  { id: "weather", label: "Weather", icon: Cloud },
  { id: "tides", label: "Tides", icon: Waves },
  { id: "air_quality", label: "Air Quality", icon: Wind },
  { id: "health", label: "Health", icon: Heart },
  { id: "events", label: "Events", icon: Calendar },
  { id: "parking", label: "Parking", icon: ParkingCircle },
  { id: "construction", label: "Construction", icon: Construction },
  { id: "economic", label: "Economic", icon: TrendingUp },
  { id: "fire", label: "Fire Risk", icon: Flame },
];

export default function Dashboard() {
  const [cityName, setCityName] = useState("Vancouver");
  const [selectedItem, setSelectedItem] = useState<{ categoryId: string, index: number } | null>(null);
  const { data: snapshotResponse, isLoading, error } = useLatestSnapshot(cityName);
  const { mutate: refresh, isPending: isRefreshing } = useRefreshSnapshot();
  const { toast } = useToast();

  const handleRefresh = () => {
    refresh(cityName, {
      onSuccess: () => {
        toast({ title: "Refresh Triggered", description: "AI gathering latest data." });
      },
      onError: (err) => {
        toast({ title: "Refresh Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const snapshot = snapshotResponse?.data;
  const categoriesData = snapshot?.categories || {};

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("operational") || s.includes("on time") || s.includes("open") || s.includes("normal") || s.includes("good")) return "text-green-500";
    if (s.includes("outage") || s.includes("delay") || s.includes("closed") || s.includes("heavy") || s.includes("critical")) return "text-red-500";
    if (s.includes("warning") || s.includes("moderate")) return "text-yellow-500";
    return "text-muted-foreground";
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const activeDetail = selectedItem ? categoriesData[selectedItem.categoryId]?.[selectedItem.index] : null;

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0b] text-white font-mono uppercase text-xs overflow-hidden">
      {/* Header - Terminal Style */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#121214]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-4 w-4" />
            <span className="font-bold tracking-widest">CITY.TERMINAL v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={cityName.toLowerCase()}
              onChange={(e) => setCityName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
              className="bg-transparent border-none text-white focus:ring-0 cursor-pointer hover:text-primary transition-colors"
            >
              <option value="vancouver">LOC: VANCOUVER_BC</option>
              <option value="bamfield">LOC: BAMFIELD_BC</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {snapshotResponse?.timestamp && (
            <span className="text-[10px] opacity-50">SYNC_TIME: {new Date(snapshotResponse.timestamp).toLocaleTimeString()}</span>
          )}
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            variant="ghost"
            className="h-6 px-2 text-[10px] border border-white/10 hover:bg-primary/20"
          >
            {isRefreshing ? "SYNCING..." : "TRIGGER_REFRESH"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: 2-Column Grid of all categories */}
        <div className="flex-[2] border-r border-white/10 overflow-y-auto p-4 bg-[#0d0d0f]">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full bg-white/5" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-white/5 border border-white/5">
              {CATEGORIES.map((cat) => {
                const items = categoriesData[cat.id] || [];
                return (
                  <div key={cat.id} className="bg-[#121214] p-3 flex flex-col gap-2 min-h-[140px]">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-1 mb-1">
                      <cat.icon className="h-3 w-3 text-primary" />
                      <span className="font-bold text-primary/80 tracking-tighter">{cat.label}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 overflow-hidden">
                      {items.length > 0 ? (
                        items.slice(0, 4).map((item, idx) => (
                          <div 
                            key={idx}
                            onClick={() => setSelectedItem({ categoryId: cat.id, index: idx })}
                            className={`flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded transition-colors group ${selectedItem?.categoryId === cat.id && selectedItem?.index === idx ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                          >
                            <span className="truncate pr-2 opacity-80 group-hover:opacity-100">{item.label}</span>
                            <span className={`flex-shrink-0 font-bold ${getStatusColor(item.status)}`}>
                              {item.status.length > 10 ? item.status.substring(0, 8) + '..' : item.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-30 italic py-4">
                          <span>NO_DATA_STREAM</span>
                          <span className="text-[10px]">RECONFIGURE SOURCE</span>
                        </div>
                      )}
                      {items.length > 4 && (
                        <div className="text-[9px] opacity-40 text-center mt-auto">+ {items.length - 4} MORE ENTRIES</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Details Pane */}
        <div className="flex-1 bg-[#0a0a0b] p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeDetail ? (
              <motion.div
                key={`${selectedItem?.categoryId}-${selectedItem?.index}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <span className="text-[10px] tracking-[0.2em]">CATEGORY_INSPECT</span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter">{activeDetail.label}</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#121214] border border-white/5 p-4 rounded">
                    <span className="block text-[10px] opacity-40 mb-1">CURRENT_STATUS</span>
                    <div className={`text-lg font-bold ${getStatusColor(activeDetail.status)}`}>
                      {activeDetail.status}
                    </div>
                  </div>
                  <div className="bg-[#121214] border border-white/5 p-4 rounded">
                    <span className="block text-[10px] opacity-40 mb-1">SEVERITY_LEVEL</span>
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(activeDetail.severity)}
                      <span className="font-bold">{activeDetail.severity || "NORMAL"}</span>
                    </div>
                  </div>
                </div>

                {activeDetail.details && (
                  <div className="bg-[#121214] border border-white/5 p-4 rounded">
                    <span className="block text-[10px] opacity-40 mb-2">TELEMETRY_DETAILS</span>
                    <p className="text-sm opacity-80 leading-relaxed normal-case font-sans">
                      {activeDetail.details}
                    </p>
                  </div>
                )}

                {activeDetail.status_citation && (
                  <div className="pt-4">
                    <Button variant="outline" className="w-full border-white/10 hover:bg-white/5" asChild>
                      <a href={activeDetail.status_citation} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        VIEW_DATA_SOURCE
                      </a>
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-20">
                <div className="relative">
                  <Activity className="h-16 w-16 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 border-2 border-white/20 rounded-full animate-[ping_3s_infinite]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold tracking-widest">AWAITING_INPUT</h3>
                  <p className="text-[10px]">SELECT_CATEGORY_NODE_FOR_DETAILED_INSPECTION</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer - Status Bar */}
      <footer className="h-6 bg-[#121214] border-t border-white/10 flex items-center justify-between px-4 text-[9px] opacity-60">
        <div className="flex gap-4">
          <span>SYSTEM: ONLINE</span>
          <span>NETWORK: STABLE</span>
          <span>LOCATION: {cityName}</span>
        </div>
        <div className="flex gap-4">
          <span>FIRE_CRAWL_AGENT: READY</span>
          <span>LATENCY: 42ms</span>
        </div>
      </footer>
    </div>
  );
}
