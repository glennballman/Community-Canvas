import { useState } from "react";
import { useLatestSnapshot, useRefreshSnapshot } from "@/hooks/use-snapshots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  Droplet, 
  Ship, 
  Navigation, 
  AlertTriangle, 
  Cloud, 
  Waves, 
  Bus, 
  Plane, 
  Wind,
  Heart,
  Calendar,
  ParkingCircle,
  Construction,
  TrendingUp,
  Flame,
  RefreshCw,
  Activity,
  ExternalLink,
  X,
  ChevronRight,
  Wifi,
  Trash2,
  Building
} from "lucide-react";
import type { StatusEntry } from "@shared/schema";

const CATEGORIES = [
  { id: "emergency", label: "Emergency Alerts", icon: AlertTriangle, color: "text-red-500" },
  { id: "power", label: "BC Hydro", icon: Zap, color: "text-yellow-500" },
  { id: "water", label: "Water & Sewer", icon: Droplet, color: "text-blue-400" },
  { id: "telecom", label: "Telecom", icon: Wifi, color: "text-purple-400" },
  { id: "transit", label: "TransLink", icon: Bus, color: "text-green-400" },
  { id: "traffic", label: "Traffic", icon: Navigation, color: "text-orange-400" },
  { id: "parking", label: "Parking", icon: ParkingCircle, color: "text-cyan-400" },
  { id: "closures", label: "Road Closures", icon: Construction, color: "text-red-400" },
  { id: "ferry", label: "Ferries", icon: Ship, color: "text-blue-500" },
  { id: "airport", label: "YVR Airport", icon: Plane, color: "text-sky-400" },
  { id: "weather", label: "Weather", icon: Cloud, color: "text-gray-400" },
  { id: "air_quality", label: "Air Quality", icon: Wind, color: "text-emerald-400" },
  { id: "tides", label: "Tides", icon: Waves, color: "text-teal-400" },
  { id: "health", label: "Health Services", icon: Heart, color: "text-pink-400" },
  { id: "events", label: "Active Events", icon: Calendar, color: "text-violet-400" },
  { id: "economic", label: "Economic", icon: TrendingUp, color: "text-lime-400" },
  { id: "facilities", label: "Facilities", icon: Building, color: "text-slate-400" },
  { id: "waste", label: "Waste Collection", icon: Trash2, color: "text-amber-400" },
  { id: "fire", label: "Wildfire Risk", icon: Flame, color: "text-orange-500" },
];

function StatusDot({ status }: { status?: string }) {
  if (!status) return <span className="w-2 h-2 rounded-full bg-gray-600" />;
  const s = status.toLowerCase();
  if (s.includes("operational") || s.includes("on time") || s.includes("open") || s.includes("normal") || s.includes("good") || s.includes("low")) {
    return <span className="w-2 h-2 rounded-full bg-green-500" />;
  }
  if (s.includes("outage") || s.includes("closed") || s.includes("critical") || s.includes("high") || s.includes("cancelled")) {
    return <span className="w-2 h-2 rounded-full bg-red-500" />;
  }
  if (s.includes("delay") || s.includes("warning") || s.includes("moderate") || s.includes("construction")) {
    return <span className="w-2 h-2 rounded-full bg-yellow-500" />;
  }
  return <span className="w-2 h-2 rounded-full bg-blue-500" />;
}

function CategoryBlock({ 
  category, 
  items, 
  onItemClick,
  selectedItem
}: { 
  category: typeof CATEGORIES[0];
  items: StatusEntry[];
  onItemClick: (item: StatusEntry, category: typeof CATEGORIES[0]) => void;
  selectedItem: StatusEntry | null;
}) {
  const Icon = category.icon;
  const hasData = items && items.length > 0;

  return (
    <div className="bg-card/30 border border-border/30 rounded p-2 min-h-[80px]">
      <div className="flex items-center gap-1.5 mb-1.5 border-b border-border/20 pb-1">
        <Icon className={`h-3.5 w-3.5 ${category.color}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</span>
      </div>
      
      {hasData ? (
        <div className="space-y-0.5">
          {items.slice(0, 5).map((item, idx) => (
            <div 
              key={idx}
              onClick={() => onItemClick(item, category)}
              className={`flex items-center justify-between gap-2 py-0.5 px-1 rounded cursor-pointer text-xs hover-elevate transition-colors ${
                selectedItem === item ? 'bg-primary/20' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <StatusDot status={item.status} />
                <span className="truncate">{item.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.status}</span>
            </div>
          ))}
          {items.length > 5 && (
            <div className="text-[10px] text-muted-foreground pl-4">+{items.length - 5} more</div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-10">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">No Data</span>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ 
  item, 
  category,
  onClose 
}: { 
  item: StatusEntry;
  category: typeof CATEGORIES[0];
  onClose: () => void;
}) {
  const Icon = category.icon;
  
  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${category.color}`} />
          <span className="font-semibold text-sm">{category.label}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{item.label}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusDot status={item.status} />
              <Badge variant={
                item.status?.toLowerCase().includes("outage") || item.status?.toLowerCase().includes("critical") 
                  ? "destructive" 
                  : item.status?.toLowerCase().includes("delay") || item.status?.toLowerCase().includes("warning")
                  ? "secondary"
                  : "outline"
              }>
                {item.status}
              </Badge>
            </div>
          </div>
          
          {item.details && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Details</h4>
              <p className="text-sm">{item.details}</p>
            </div>
          )}
          
          {item.severity && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Severity</h4>
              <Badge variant={item.severity === "critical" ? "destructive" : item.severity === "warning" ? "secondary" : "outline"}>
                {item.severity}
              </Badge>
            </div>
          )}
          
          {item.status_citation && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Source</h4>
              <a 
                href={item.status_citation} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                View Source <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Dashboard() {
  const [cityName, setCityName] = useState("Vancouver");
  const [selectedItem, setSelectedItem] = useState<StatusEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[0] | null>(null);
  const { data: snapshotResponse, isLoading, error } = useLatestSnapshot(cityName);
  const { mutate: refresh, isPending: isRefreshing } = useRefreshSnapshot();
  const { toast } = useToast();

  const handleRefresh = () => {
    refresh(cityName, {
      onSuccess: () => {
        toast({
          title: "Refresh Triggered",
          description: "Firecrawl AI is gathering the latest data...",
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

  const handleItemClick = (item: StatusEntry, category: typeof CATEGORIES[0]) => {
    setSelectedItem(item);
    setSelectedCategory(category);
  };

  const snapshot = snapshotResponse?.data;
  const categories = snapshot?.categories || {};

  const leftColumnCategories = CATEGORIES.filter((_, i) => i % 2 === 0);
  const rightColumnCategories = CATEGORIES.filter((_, i) => i % 2 === 1);

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{cityName}, BC Command Center</h1>
          <span className="text-xs text-muted-foreground">
            {snapshotResponse?.timestamp 
              ? `Updated: ${new Date(snapshotResponse.timestamp).toLocaleString()}`
              : 'No data yet'
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-sm"
          >
            <option value="Vancouver">Vancouver, BC</option>
            <option value="Bamfield">Bamfield, BC</option>
          </select>
          <Button 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </header>

      {/* Alert Banner */}
      {categories["emergency"]?.length > 0 && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-1.5 flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-400">
            {categories["emergency"][0]?.label}: {categories["emergency"][0]?.status}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Main Grid */}
        <div className={`flex-1 p-3 overflow-auto ${selectedItem ? 'pr-0' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading data...</div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <AlertTriangle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No data available for {cityName}.</p>
              <Button onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? "Fetching..." : "Run First Extraction"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 auto-rows-min">
              {/* Left Column */}
              <div className="space-y-2">
                {leftColumnCategories.map(cat => (
                  <CategoryBlock 
                    key={cat.id}
                    category={cat}
                    items={categories[cat.id] || []}
                    onItemClick={handleItemClick}
                    selectedItem={selectedItem}
                  />
                ))}
              </div>
              
              {/* Right Column */}
              <div className="space-y-2">
                {rightColumnCategories.map(cat => (
                  <CategoryBlock 
                    key={cat.id}
                    category={cat}
                    items={categories[cat.id] || []}
                    onItemClick={handleItemClick}
                    selectedItem={selectedItem}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && selectedCategory && (
          <div className="w-80 shrink-0 border-l border-border">
            <DetailPanel 
              item={selectedItem}
              category={selectedCategory}
              onClose={() => {
                setSelectedItem(null);
                setSelectedCategory(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
