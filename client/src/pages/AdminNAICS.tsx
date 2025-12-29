import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Building2,
  Folder,
  FolderOpen,
  FileText,
  ArrowLeft,
  Users,
  Hash,
  MapPin,
  Loader2,
  PieChart as PieChartIcon,
  BarChart3,
  Map
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { NAICSTreeSummary, NAICSSectorNode, NAICSSubsectorNode, NAICSIndustryNode, NAICSMemberSummary } from "@shared/naics-hierarchy";

interface MemberListResponse {
  members: NAICSMemberSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ChamberLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  memberCount: number;
}

type ViewLevel = "tree" | "sector" | "subsector" | "industry";

interface ViewState {
  level: ViewLevel;
  sectorCode?: string;
  sectorTitle?: string;
  subsectorCode?: string;
  subsectorTitle?: string;
  industryCode?: string;
  industryTitle?: string;
}

function formatMemberCount(count: number): string {
  return count.toLocaleString();
}

const CHART_COLORS = [
  "hsl(210, 70%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(190, 70%, 45%)",
  "hsl(25, 75%, 50%)",
  "hsl(120, 50%, 45%)",
  "hsl(0, 0%, 50%)",
];

function SectorPieChart({ sectors }: { sectors: NAICSSectorNode[] }) {
  const sortedSectors = [...sectors].sort((a, b) => b.memberCount - a.memberCount);
  const top8 = sortedSectors.slice(0, 8);
  const otherCount = sortedSectors.slice(8).reduce((sum, s) => sum + s.memberCount, 0);
  
  const data = [
    ...top8.map(s => ({
      name: s.title.length > 25 ? s.title.substring(0, 22) + "..." : s.title,
      value: s.memberCount,
      code: s.code,
    })),
    ...(otherCount > 0 ? [{ name: "Other Sectors", value: otherCount, code: "other" }] : []),
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <PieChartIcon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Members by Sector</h3>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatMemberCount(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {data.slice(0, 6).map((item, idx) => (
          <div key={item.code} className="flex items-center gap-1.5 text-[10px]">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[idx] }}
            />
            <span className="truncate text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopSubsectorsChart({ sectors }: { sectors: NAICSSectorNode[] }) {
  const allSubsectors = sectors.flatMap(s => 
    s.subsectors.map(sub => ({
      name: sub.title.length > 30 ? sub.title.substring(0, 27) + "..." : sub.title,
      count: sub.memberCount,
      code: sub.code,
    }))
  );
  
  const top10 = allSubsectors
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Top Subsectors</h3>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9 }}
              width={120}
            />
            <Tooltip
              formatter={(value: number) => formatMemberCount(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="count" fill="hsl(210, 70%, 50%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ChamberMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { data: tokenData } = useQuery<{ token: string }>({
    queryKey: ["/api/config/mapbox-token"],
  });

  const { data: chambers } = useQuery<ChamberLocation[]>({
    queryKey: ["/api/chambers/locations"],
  });

  useEffect(() => {
    if (!mapContainer.current || map.current || !tokenData?.token) return;

    mapboxgl.accessToken = tokenData.token;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-125.5, 54.0],
      zoom: 4.5,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [tokenData?.token]);

  useEffect(() => {
    if (!map.current || !mapLoaded || !chambers) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    chambers.forEach((chamber) => {
      const el = document.createElement("div");
      el.className = "chamber-marker";
      el.style.width = "10px";
      el.style.height = "10px";
      el.style.backgroundColor = "hsl(210, 70%, 50%)";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

      const marker = new mapboxgl.Marker(el)
        .setLngLat([chamber.lng, chamber.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 15 }).setHTML(
            `<div style="font-size:12px;"><strong>${chamber.name}</strong><br/>${formatMemberCount(chamber.memberCount)} members</div>`
          )
        )
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  }, [chambers, mapLoaded]);

  if (!tokenData?.token) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Map className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Chamber Locations</h3>
        </div>
        <div className="h-[200px] rounded-md bg-muted/30 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Map loading...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Map className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Chamber Locations</h3>
        {chambers && (
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {chambers.length} chambers
          </Badge>
        )}
      </div>
      <div
        ref={mapContainer}
        className="h-[200px] rounded-md overflow-hidden"
        data-testid="map-chamber-locations"
      />
    </Card>
  );
}

function ChamberMapFull() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { data: tokenData } = useQuery<{ token: string }>({
    queryKey: ["/api/config/mapbox-token"],
  });

  const { data: chambers } = useQuery<ChamberLocation[]>({
    queryKey: ["/api/chambers/locations"],
  });

  useEffect(() => {
    if (!mapContainer.current || map.current || !tokenData?.token) return;

    mapboxgl.accessToken = tokenData.token;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-125.5, 54.0],
      zoom: 4.8,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [tokenData?.token]);

  useEffect(() => {
    if (!map.current || !mapLoaded || !chambers) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    chambers.forEach((chamber) => {
      const size = Math.max(8, Math.min(20, 6 + Math.sqrt(chamber.memberCount) * 2));
      
      const el = document.createElement("div");
      el.className = "chamber-marker";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = "hsl(210, 70%, 50%)";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      const marker = new mapboxgl.Marker(el)
        .setLngLat([chamber.lng, chamber.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 15 }).setHTML(
            `<div style="font-size:12px; color: #1a1a1a;"><strong>${chamber.name}</strong><br/>${formatMemberCount(chamber.memberCount)} members</div>`
          )
        )
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  }, [chambers, mapLoaded]);

  const totalMembers = chambers?.reduce((sum, c) => sum + c.memberCount, 0) || 0;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border/50 flex items-center gap-2">
        <Map className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold tracking-wide">BC CHAMBER MAP</h2>
        <div className="ml-auto flex items-center gap-2">
          {chambers && (
            <>
              <Badge variant="outline" className="text-[10px]">
                {chambers.length} chambers
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {formatMemberCount(totalMembers)} members
              </Badge>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 relative">
        {!tokenData?.token ? (
          <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div
            ref={mapContainer}
            className="absolute inset-0"
            data-testid="map-chamber-locations-full"
          />
        )}
      </div>
    </div>
  );
}

function TreeNodeSector({
  sector,
  isExpanded,
  onToggle,
  onViewMembers,
  expandedSubsectors,
  onToggleSubsector,
  onViewSubsectorMembers,
  onViewIndustryMembers,
}: {
  sector: NAICSSectorNode;
  isExpanded: boolean;
  onToggle: () => void;
  onViewMembers: () => void;
  expandedSubsectors: Set<string>;
  onToggleSubsector: (code: string) => void;
  onViewSubsectorMembers: (subsector: NAICSSubsectorNode) => void;
  onViewIndustryMembers: (industry: NAICSIndustryNode, subsector: NAICSSubsectorNode) => void;
}) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div
        className="flex items-center gap-1.5 p-2 hover-elevate cursor-pointer"
        onClick={onToggle}
        data-testid={`naics-sector-${sector.code}`}
      >
        <button className="p-0.5" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500/70" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[9px] shrink-0 px-1">
              {sector.code}
            </Badge>
            <span className="text-xs font-medium truncate">{sector.title}</span>
          </div>
        </div>
        <Badge variant="secondary" className="text-[9px] shrink-0">
          {formatMemberCount(sector.memberCount)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] h-6 px-1.5"
          onClick={(e) => { e.stopPropagation(); onViewMembers(); }}
          data-testid={`view-sector-${sector.code}`}
        >
          View
        </Button>
        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
      </div>

      {isExpanded && (
        <div className="pl-4 pb-1 bg-muted/20">
          {sector.subsectors.map((subsector) => (
            <TreeNodeSubsector
              key={subsector.code}
              subsector={subsector}
              isExpanded={expandedSubsectors.has(subsector.code)}
              onToggle={() => onToggleSubsector(subsector.code)}
              onViewMembers={() => onViewSubsectorMembers(subsector)}
              onViewIndustryMembers={(industry) => onViewIndustryMembers(industry, subsector)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNodeSubsector({
  subsector,
  isExpanded,
  onToggle,
  onViewMembers,
  onViewIndustryMembers,
}: {
  subsector: NAICSSubsectorNode;
  isExpanded: boolean;
  onToggle: () => void;
  onViewMembers: () => void;
  onViewIndustryMembers: (industry: NAICSIndustryNode) => void;
}) {
  return (
    <div className="border-t border-border/20 first:border-t-0">
      <div
        className="flex items-center gap-1.5 p-1.5 hover-elevate cursor-pointer"
        onClick={onToggle}
        data-testid={`naics-subsector-${subsector.code}`}
      >
        <button className="p-0.5" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? (
            <FolderOpen className="w-3 h-3 text-blue-500" />
          ) : (
            <Folder className="w-3 h-3 text-blue-500/70" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[8px] shrink-0 px-1">
              {subsector.code}
            </Badge>
            <span className="text-[11px] truncate text-muted-foreground">{subsector.title}</span>
          </div>
        </div>
        <Badge variant="secondary" className="text-[8px] shrink-0">
          {formatMemberCount(subsector.memberCount)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="text-[9px] h-5 px-1"
          onClick={(e) => { e.stopPropagation(); onViewMembers(); }}
          data-testid={`view-subsector-${subsector.code}`}
        >
          View
        </Button>
        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
      </div>

      {isExpanded && (
        <div className="pl-4 pb-1 bg-muted/10">
          {subsector.industries.map((industry) => (
            <TreeNodeIndustry
              key={industry.code}
              industry={industry}
              onViewMembers={() => onViewIndustryMembers(industry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNodeIndustry({
  industry,
  onViewMembers,
}: {
  industry: NAICSIndustryNode;
  onViewMembers: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 p-1 hover-elevate cursor-pointer"
      onClick={onViewMembers}
      data-testid={`naics-industry-${industry.code}`}
    >
      <FileText className="w-2.5 h-2.5 text-green-500/70 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-mono text-[8px] shrink-0 px-1">
            {industry.code}
          </Badge>
          <span className="text-[10px] truncate text-muted-foreground">{industry.title}</span>
        </div>
      </div>
      <Badge variant="secondary" className="text-[8px] shrink-0">
        {formatMemberCount(industry.memberCount)}
      </Badge>
    </div>
  );
}

function MemberList({
  title,
  subtitle,
  endpoint,
  onBack,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const urlWithParams = `${endpoint}?page=${page}&pageSize=50`;
  
  const { data, isLoading } = useQuery<MemberListResponse>({
    queryKey: [urlWithParams],
  });

  const filteredMembers = data?.members.filter(m =>
    searchTerm === "" || m.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/50 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1"
            data-testid="button-back-to-tree"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {data && (
            <Badge variant="outline" className="text-sm">
              {formatMemberCount(data.total)} businesses
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter businesses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
            data-testid="input-search-members"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-1">
              {filteredMembers.map((member, idx) => (
                <Card
                  key={member.id}
                  className="p-3 hover-elevate"
                  data-testid={`member-row-${idx}`}
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{member.businessName}</div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Hash className="w-2.5 h-2.5" />
                          {member.naicsCode}
                        </span>
                        <span className="truncate">{member.naicsTitle}</span>
                        {member.municipality && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {member.municipality}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default function AdminNAICS() {
  const [viewState, setViewState] = useState<ViewState>({ level: "tree" });
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [expandedSubsectors, setExpandedSubsectors] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const { data: tree, isLoading } = useQuery<NAICSTreeSummary>({
    queryKey: ["/api/naics/tree"],
  });

  const toggleSector = (code: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleSubsector = (code: string) => {
    setExpandedSubsectors(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const filteredSectors = tree?.sectors.filter(sector => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (sector.title.toLowerCase().includes(term)) return true;
    if (sector.code.includes(term)) return true;
    return sector.subsectors.some(sub =>
      sub.title.toLowerCase().includes(term) ||
      sub.code.includes(term) ||
      sub.industries.some(ind =>
        ind.title.toLowerCase().includes(term) || ind.code.includes(term)
      )
    );
  }) || [];

  if (viewState.level !== "tree") {
    let endpoint = "";
    let title = "";
    let subtitle = "";

    if (viewState.level === "sector" && viewState.sectorCode) {
      endpoint = `/api/naics/sector/${viewState.sectorCode}/members`;
      title = viewState.sectorTitle || `Sector ${viewState.sectorCode}`;
      subtitle = `NAICS Sector ${viewState.sectorCode}`;
    } else if (viewState.level === "subsector" && viewState.subsectorCode) {
      endpoint = `/api/naics/subsector/${viewState.subsectorCode}/members`;
      title = viewState.subsectorTitle || `Subsector ${viewState.subsectorCode}`;
      subtitle = `NAICS Subsector ${viewState.subsectorCode}`;
    } else if (viewState.level === "industry" && viewState.industryCode) {
      endpoint = `/api/naics/code/${viewState.industryCode}/members`;
      title = viewState.industryTitle || `Industry ${viewState.industryCode}`;
      subtitle = `NAICS Code ${viewState.industryCode}`;
    }

    return (
      <MemberList
        title={title}
        subtitle={subtitle}
        endpoint={endpoint}
        onBack={() => setViewState({ level: "tree" })}
      />
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Left Column - Tree Browser */}
      <div className="w-[35%] flex flex-col border-r border-border/50">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h1 className="text-sm font-bold tracking-wide">NAICS EXPLORER</h1>
              <p className="text-[10px] text-muted-foreground">
                Industry Classification Codes
              </p>
            </div>
            {tree && (
              <Badge variant="outline" className="text-[10px]">
                {formatMemberCount(tree.totalMembers)} businesses
              </Badge>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-8"
              data-testid="input-search-naics"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredSectors.map((sector) => (
                <TreeNodeSector
                  key={sector.code}
                  sector={sector}
                  isExpanded={expandedSectors.has(sector.code)}
                  onToggle={() => toggleSector(sector.code)}
                  onViewMembers={() => setViewState({
                    level: "sector",
                    sectorCode: sector.code,
                    sectorTitle: sector.title,
                  })}
                  expandedSubsectors={expandedSubsectors}
                  onToggleSubsector={toggleSubsector}
                  onViewSubsectorMembers={(subsector) => setViewState({
                    level: "subsector",
                    sectorCode: sector.code,
                    sectorTitle: sector.title,
                    subsectorCode: subsector.code,
                    subsectorTitle: subsector.title,
                  })}
                  onViewIndustryMembers={(industry, subsector) => setViewState({
                    level: "industry",
                    sectorCode: sector.code,
                    sectorTitle: sector.title,
                    subsectorCode: subsector.code,
                    subsectorTitle: subsector.title,
                    industryCode: industry.code,
                    industryTitle: industry.title,
                  })}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Middle Column - Charts */}
      <div className="w-[30%] p-3 overflow-auto border-r border-border/50">
        <div className="space-y-3">
          {tree && tree.sectors.length > 0 && (
            <>
              <SectorPieChart sectors={tree.sectors} />
              <TopSubsectorsChart sectors={tree.sectors} />
            </>
          )}
        </div>
      </div>

      {/* Right Column - Map */}
      <div className="flex-1 flex flex-col">
        <ChamberMapFull />
      </div>
    </div>
  );
}
