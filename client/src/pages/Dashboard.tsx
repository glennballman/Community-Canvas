import { useState } from "react";
import { useLatestSnapshot, useRefreshSnapshot } from "@/hooks/use-snapshots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  Droplet, 
  AlertTriangle, 
  Bus, 
  Plane, 
  TrendingUp,
  RefreshCw,
  Activity,
  ExternalLink,
  X,
  ChevronRight,
  Trash2,
  Eye,
  Database,
  Globe,
  Newspaper
} from "lucide-react";
import type { StatusEntry } from "@shared/schema";
import { getSourcesByCategory, ALL_MUNICIPALITIES, type DataSource } from "@shared/sources";

const CATEGORIES = [
  { id: "emergency", label: "Emergency Alerts", icon: AlertTriangle, color: "text-red-500" },
  { id: "power", label: "Power / Hydro", icon: Zap, color: "text-yellow-500" },
  { id: "water", label: "Water & Sewer", icon: Droplet, color: "text-blue-400" },
  { id: "transit", label: "Transit & Roads", icon: Bus, color: "text-green-400" },
  { id: "aviation", label: "Aviation", icon: Plane, color: "text-sky-400" },
  { id: "economic", label: "Economic/Govt", icon: TrendingUp, color: "text-lime-400" },
  { id: "news", label: "Local News", icon: Newspaper, color: "text-violet-400" },
  { id: "waste", label: "Waste & Recycling", icon: Trash2, color: "text-amber-400" },
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

function truncateUrl(url: string, maxLen: number = 35): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    if (display.length > maxLen) {
      return display.substring(0, maxLen) + "...";
    }
    return display;
  } catch {
    return url.length > maxLen ? url.substring(0, maxLen) + "..." : url;
  }
}

function CategoryBlockSources({ 
  category, 
  sources,
  onSourceClick,
  selectedSource
}: { 
  category: typeof CATEGORIES[0];
  sources: DataSource[];
  onSourceClick: (source: DataSource, category: typeof CATEGORIES[0]) => void;
  selectedSource: DataSource | null;
}) {
  const Icon = category.icon;
  const hasSources = sources && sources.length > 0;

  return (
    <div className={`bg-card/30 border rounded p-2 min-h-[80px] ${selectedSource && sources.includes(selectedSource) ? 'border-primary/50' : 'border-border/30'}`}>
      <div className="flex items-center gap-1.5 mb-1.5 border-b border-border/20 pb-1">
        <Icon className={`h-3.5 w-3.5 ${category.color}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">{category.label}</span>
        {hasSources && <Badge variant="outline" className="text-[9px] px-1 py-0">{sources.length}</Badge>}
      </div>
      
      {hasSources ? (
        <div className="space-y-1">
          {sources.map((source, idx) => (
            <div 
              key={idx}
              onClick={() => onSourceClick(source, category)}
              className={`py-1 px-1 rounded cursor-pointer text-xs hover-elevate transition-colors ${
                selectedSource === source ? 'bg-primary/20' : ''
              }`}
              data-testid={`source-${category.id}-${idx}`}
            >
              <div className="flex items-center gap-1.5">
                <Database className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{source.source_name}</span>
                {source.is_shared && <Badge variant="secondary" className="text-[8px] px-1 py-0">Regional</Badge>}
              </div>
              <div className="flex items-center gap-1 mt-0.5 pl-4">
                <Globe className="h-2.5 w-2.5 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground truncate">{truncateUrl(source.url)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-10">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">No Sources Configured</span>
        </div>
      )}
    </div>
  );
}

function CategoryBlockData({ 
  category, 
  items, 
  onItemClick,
  onCategoryClick,
  selectedItem,
  selectedCategory
}: { 
  category: typeof CATEGORIES[0];
  items: StatusEntry[];
  onItemClick: (item: StatusEntry, category: typeof CATEGORIES[0]) => void;
  onCategoryClick: (category: typeof CATEGORIES[0]) => void;
  selectedItem: StatusEntry | null;
  selectedCategory: typeof CATEGORIES[0] | null;
}) {
  const Icon = category.icon;
  const hasData = items && items.length > 0;
  const isSelected = selectedCategory?.id === category.id;

  return (
    <div className={`bg-card/30 border rounded p-2 min-h-[80px] ${isSelected ? 'border-primary/50' : 'border-border/30'}`}>
      <div 
        className="flex items-center gap-1.5 mb-1.5 border-b border-border/20 pb-1 cursor-pointer hover-elevate rounded px-1 -mx-1"
        onClick={() => onCategoryClick(category)}
        data-testid={`category-header-${category.id}`}
      >
        <Icon className={`h-3.5 w-3.5 ${category.color}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">{category.label}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
      </div>
      
      {hasData ? (
        <div className="space-y-0.5">
          {items.slice(0, 5).map((item, idx) => (
            <div 
              key={idx}
              onClick={() => onItemClick(item, category)}
              data-testid={`item-${category.id}-${idx}`}
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
        <div 
          className="flex items-center justify-center h-10 cursor-pointer hover-elevate rounded"
          onClick={() => onCategoryClick(category)}
        >
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">No Data</span>
        </div>
      )}
    </div>
  );
}

function SourceDetailPanel({ 
  source, 
  category,
  allSources,
  onClose,
  onSourceSelect
}: { 
  source: DataSource | null;
  category: typeof CATEGORIES[0];
  allSources: DataSource[];
  onClose: () => void;
  onSourceSelect: (source: DataSource) => void;
}) {
  const Icon = category.icon;
  const displaySource = source || allSources[0];
  
  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${category.color}`} />
          <span className="font-semibold text-sm">{category.label}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {!displaySource ? (
          <div className="p-4 text-center">
            <div className="text-muted-foreground text-sm mb-2">No data sources configured.</div>
            <div className="text-xs text-muted-foreground/60">
              Add sources via Firecrawl to populate this category.
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{displaySource.source_name}</h3>
              {displaySource.is_shared && (
                <Badge variant="secondary" className="mt-1">Regional/Shared Source</Badge>
              )}
            </div>
            
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Source URL</h4>
              <a 
                href={displaySource.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline break-all"
              >
                {displaySource.url} <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
            
            {displaySource.description && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Description</h4>
                <p className="text-sm">{displaySource.description}</p>
              </div>
            )}
            
            {allSources.length > 1 && (
              <div className="border-t border-border pt-3 mt-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">All Sources ({allSources.length})</h4>
                <div className="space-y-1">
                  {allSources.map((s, idx) => (
                    <div 
                      key={idx}
                      onClick={() => onSourceSelect(s)}
                      className={`p-1.5 rounded cursor-pointer text-xs hover-elevate ${
                        s === displaySource ? 'bg-primary/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Database className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate flex-1">{s.source_name}</span>
                        {s.is_shared && <Badge variant="secondary" className="text-[8px] px-1">Regional</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground pl-5 truncate">{truncateUrl(s.url)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function DataDetailPanel({ 
  item, 
  category,
  allItems,
  onClose,
  onItemSelect
}: { 
  item: StatusEntry | null;
  category: typeof CATEGORIES[0];
  allItems: StatusEntry[];
  onClose: () => void;
  onItemSelect: (item: StatusEntry) => void;
}) {
  const Icon = category.icon;
  const hasData = allItems && allItems.length > 0;
  
  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${category.color}`} />
          <span className="font-semibold text-sm">{category.label}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {!hasData ? (
          <div className="p-4 text-center">
            <div className="text-muted-foreground text-sm mb-2">No data available for this category.</div>
            <div className="text-xs text-muted-foreground/60">
              Click "Refresh" to fetch the latest data from configured sources.
            </div>
          </div>
        ) : item ? (
          <div className="p-3 space-y-4">
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
            
            {allItems.length > 1 && (
              <div className="border-t border-border pt-3 mt-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">All Items ({allItems.length})</h4>
                <div className="space-y-1">
                  {allItems.map((i, idx) => (
                    <div 
                      key={idx}
                      onClick={() => onItemSelect(i)}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs hover-elevate ${
                        i === item ? 'bg-primary/20' : ''
                      }`}
                    >
                      <StatusDot status={i.status} />
                      <span className="truncate flex-1">{i.label}</span>
                      <span className="text-muted-foreground">{i.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">All Items ({allItems.length})</h4>
            <div className="space-y-1">
              {allItems.map((i, idx) => (
                <div 
                  key={idx}
                  onClick={() => onItemSelect(i)}
                  className="flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs hover-elevate"
                >
                  <StatusDot status={i.status} />
                  <span className="truncate flex-1">{i.label}</span>
                  <span className="text-muted-foreground">{i.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default function Dashboard() {
  const [cityName, setCityName] = useState("City of Vancouver");
  const [viewMode, setViewMode] = useState<"data" | "sources">("sources");
  const [selectedItem, setSelectedItem] = useState<StatusEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[0] | null>(null);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [selectedSourceCategory, setSelectedSourceCategory] = useState<typeof CATEGORIES[0] | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  
  const { data: snapshotResponse, isLoading } = useLatestSnapshot(cityName);
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

  const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
    setSelectedCategory(category);
    setSelectedItem(null);
  };

  const handleSourceClick = (source: DataSource, category: typeof CATEGORIES[0]) => {
    setSelectedSource(source);
    setSelectedSourceCategory(category);
  };

  const snapshot = snapshotResponse?.data;
  const categories = snapshot?.categories || {};
  const sourcesByCategory = getSourcesByCategory(cityName);

  const leftColumnCategories = CATEGORIES.filter((_, i) => i % 2 === 0);
  const rightColumnCategories = CATEGORIES.filter((_, i) => i % 2 === 1);

  const municipalities = ALL_MUNICIPALITIES;

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{cityName} Command Center</h1>
          <span className="text-xs text-muted-foreground">
            {viewMode === "sources" ? "Sources View" : (
              snapshotResponse?.timestamp 
                ? `Updated: ${new Date(snapshotResponse.timestamp).toLocaleString()}`
                : 'No data yet'
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded p-0.5">
            <Button 
              size="sm" 
              variant={viewMode === "sources" ? "default" : "ghost"}
              onClick={() => setViewMode("sources")}
              className="gap-1 h-7 text-xs"
              data-testid="toggle-sources-view"
            >
              <Database className="h-3 w-3" />
              Sources
            </Button>
            <Button 
              size="sm" 
              variant={viewMode === "data" ? "default" : "ghost"}
              onClick={() => setViewMode("data")}
              className="gap-1 h-7 text-xs"
              data-testid="toggle-data-view"
            >
              <Eye className="h-3 w-3" />
              Data
            </Button>
          </div>
          
          <select 
            value={cityName}
            onChange={(e) => {
              setCityName(e.target.value);
              setSelectedCategory(null);
              setSelectedItem(null);
              setSelectedSource(null);
              setSelectedSourceCategory(null);
            }}
            className="bg-background border border-border rounded px-2 py-1 text-sm"
            data-testid="select-city"
          >
            {municipalities.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          
          {viewMode === "data" && (
            <Button 
              size="sm" 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="gap-1"
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
        </div>
      </header>

      {/* Alert Banner (only in data view) */}
      {viewMode === "data" && categories["emergency"]?.length > 0 && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-1.5 flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-400">
            {categories["emergency"][0]?.label}: {categories["emergency"][0]?.status}
          </span>
        </div>
      )}

      {/* Main Content - 4 Column Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Column 1 & 2: Category Grid */}
        <div className="w-[420px] shrink-0 p-2 overflow-auto border-r border-border/30">
          {viewMode === "data" && isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground text-xs">Loading...</div>
            </div>
          ) : viewMode === "sources" ? (
            <div className="grid grid-cols-2 gap-1.5 auto-rows-min">
              <div className="space-y-1.5">
                {leftColumnCategories.map(cat => (
                  <CategoryBlockSources 
                    key={cat.id}
                    category={cat}
                    sources={sourcesByCategory[cat.id] || []}
                    onSourceClick={(source, category) => {
                      handleSourceClick(source, category);
                      setIframeUrl(source.url);
                    }}
                    selectedSource={selectedSource}
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                {rightColumnCategories.map(cat => (
                  <CategoryBlockSources 
                    key={cat.id}
                    category={cat}
                    sources={sourcesByCategory[cat.id] || []}
                    onSourceClick={(source, category) => {
                      handleSourceClick(source, category);
                      setIframeUrl(source.url);
                    }}
                    selectedSource={selectedSource}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 auto-rows-min">
              <div className="space-y-1.5">
                {leftColumnCategories.map(cat => (
                  <CategoryBlockData 
                    key={cat.id}
                    category={cat}
                    items={categories[cat.id] || []}
                    onItemClick={handleItemClick}
                    onCategoryClick={handleCategoryClick}
                    selectedItem={selectedItem}
                    selectedCategory={selectedCategory}
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                {rightColumnCategories.map(cat => (
                  <CategoryBlockData 
                    key={cat.id}
                    category={cat}
                    items={categories[cat.id] || []}
                    onItemClick={handleItemClick}
                    onCategoryClick={handleCategoryClick}
                    selectedItem={selectedItem}
                    selectedCategory={selectedCategory}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Detail Panel */}
        <div className="w-[320px] shrink-0 border-r border-border/30">
          {viewMode === "sources" && selectedSourceCategory ? (
            <SourceDetailPanel 
              source={selectedSource}
              category={selectedSourceCategory}
              allSources={sourcesByCategory[selectedSourceCategory.id] || []}
              onClose={() => {
                setSelectedSource(null);
                setSelectedSourceCategory(null);
                setIframeUrl(null);
              }}
              onSourceSelect={(source) => {
                setSelectedSource(source);
                setIframeUrl(source.url);
              }}
            />
          ) : viewMode === "data" && selectedCategory ? (
            <DataDetailPanel 
              item={selectedItem}
              category={selectedCategory}
              allItems={categories[selectedCategory.id] || []}
              onClose={() => {
                setSelectedItem(null);
                setSelectedCategory(null);
                setIframeUrl(null);
              }}
              onItemSelect={(item) => setSelectedItem(item)}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center text-muted-foreground">
                <ChevronRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Select a source to view details</p>
              </div>
            </div>
          )}
        </div>

        {/* Column 4: Iframe Web View (50% of remaining) */}
        <div className="w-1/2 flex flex-col bg-black/20">
          {iframeUrl ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 bg-card/50 border-b border-border/30 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate font-mono">{iframeUrl}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(iframeUrl, '_blank')}
                    className="h-6 w-6"
                    data-testid="button-open-external"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIframeUrl(null)}
                    className="h-6 w-6"
                    data-testid="button-close-iframe"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <iframe
                src={iframeUrl}
                className="flex-1 w-full border-0"
                title="Source Preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
                data-testid="iframe-source-preview"
              />
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Web Preview</p>
                <p className="text-xs mt-1">Select a source to view the page here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
