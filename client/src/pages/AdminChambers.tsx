import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search,
  CheckCircle,
  XCircle,
  Briefcase,
  Store,
  Globe,
  Link2,
  ChevronDown,
  ChevronRight,
  MapPin,
  X,
  Filter,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getMemberTimelineSummary } from "@shared/member-timeline";
import { ChamberMapFull } from "./AdminNAICS";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { BC_CHAMBERS_OF_COMMERCE, type ChamberOfCommerce } from "@shared/chambers-of-commerce";
import { chamberMembers } from "@shared/chamber-members";
import { naicsSubsectorLabels } from "@shared/naics-codes";
import { GEO_HIERARCHY, type GeoNode } from "@shared/geography";
import type { ChamberProgress, ChamberProgressSummary, ChamberProgressStatus, PartialReason } from "@shared/chamber-progress";

const bcProvince = GEO_HIERARCHY["bc"];
const regionIds = bcProvince?.children || [];

function getRegions(): GeoNode[] {
  return regionIds.map(id => GEO_HIERARCHY[id]).filter((n): n is GeoNode => !!n);
}

function getMunicipalities(regionId: string): GeoNode[] {
  const region = GEO_HIERARCHY[regionId];
  if (!region?.children) return [];
  return region.children.map(id => GEO_HIERARCHY[id]).filter((n): n is GeoNode => !!n);
}

function findMatchingMunicipality(name: string | undefined): GeoNode | null {
  if (!name) return null;
  const searchName = name.toLowerCase();
  
  for (const regionId of regionIds) {
    const region = GEO_HIERARCHY[regionId];
    if (!region?.children) continue;
    for (const muniId of region.children) {
      const muni = GEO_HIERARCHY[muniId];
      if (!muni) continue;
      if (muni.shortName?.toLowerCase() === searchName) return muni;
      if (muni.name.toLowerCase() === searchName) return muni;
    }
  }
  
  for (const regionId of regionIds) {
    const region = GEO_HIERARCHY[regionId];
    if (!region?.children) continue;
    for (const muniId of region.children) {
      const muni = GEO_HIERARCHY[muniId];
      if (!muni) continue;
      const cleaned = muni.name
        .replace(/^(City of|District of|Town of|Village of|Township of|Resort Municipality of|District Municipality of|Island Municipality of)\s+/i, '')
        .toLowerCase();
      const searchCleaned = searchName
        .replace(/^(city of|district of|town of|village of|township of|resort municipality of|district municipality of|island municipality of)\s+/i, '')
        .toLowerCase();
      if (cleaned.toLowerCase() === searchCleaned) return muni;
      if (muni.shortName?.toLowerCase() === searchCleaned) return muni;
    }
  }
  
  return null;
}

function findMatchingRegion(regionId: string | undefined): GeoNode | null {
  if (!regionId) return null;
  for (const id of regionIds) {
    const region = GEO_HIERARCHY[id];
    if (!region) continue;
    if (region.id === regionId) return region;
    const cleanedName = region.name.toLowerCase().replace(/\s+/g, '-');
    if (cleanedName === regionId.toLowerCase()) return region;
  }
  return null;
}

interface ChamberWithMatch extends ChamberOfCommerce {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface GeoFilterPanelProps {
  selectedRegions: Set<string>;
  selectedMunicipalities: Set<string>;
  onToggleRegion: (regionId: string) => void;
  onToggleMunicipality: (muniId: string, regionId: string) => void;
  onClearAll: () => void;
  chamberCountByRegion: Record<string, number>;
  chamberCountByMuni: Record<string, number>;
  memberCountByRegion: Record<string, number>;
  memberCountByMuni: Record<string, number>;
}

function GeoFilterPanel({
  selectedRegions,
  selectedMunicipalities,
  onToggleRegion,
  onToggleMunicipality,
  onClearAll,
  chamberCountByRegion,
  chamberCountByMuni,
}: GeoFilterPanelProps) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  
  const toggleExpand = (regionId: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
  };

  const totalSelected = selectedRegions.size + selectedMunicipalities.size;
  const regions = getRegions();

  return (
    <div className="flex flex-col h-full border-r border-border/30">
      <div className="p-3 border-b border-border/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground">GEOGRAPHY FILTER</span>
        </div>
        {totalSelected > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 px-2 text-[10px] text-muted-foreground"
            data-testid="button-clear-geo-filter"
          >
            <X className="w-3 h-3 mr-1" />
            CLEAR ({totalSelected})
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {regions.map(region => {
            const isExpanded = expandedRegions.has(region.id);
            const isRegionSelected = selectedRegions.has(region.id);
            const municipalities = getMunicipalities(region.id);
            const selectedMunisInRegion = municipalities.filter(m => selectedMunicipalities.has(m.id)).length;
            const chamberCount = chamberCountByRegion[region.id] || 0;
            
            const checkState: "checked" | "unchecked" | "indeterminate" = 
              isRegionSelected ? "checked" : 
              selectedMunisInRegion > 0 ? "indeterminate" : "unchecked";

            return (
              <div key={region.id} className="mb-1">
                <div 
                  className="flex items-center gap-1 py-1 px-1 rounded hover-elevate cursor-pointer"
                  data-testid={`geo-region-${region.id}`}
                >
                  <button
                    onClick={() => toggleExpand(region.id)}
                    className="p-0.5"
                    data-testid={`button-expand-${region.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                  <Checkbox
                    checked={checkState === "checked"}
                    data-state={checkState}
                    onCheckedChange={() => onToggleRegion(region.id)}
                    className="h-3 w-3"
                    data-testid={`checkbox-region-${region.id}`}
                  />
                  <span 
                    className="text-[10px] font-medium flex-1 truncate"
                    onClick={() => toggleExpand(region.id)}
                  >
                    {region.shortName || region.name}
                  </span>
                  {chamberCount > 0 && (
                    <Badge variant="outline" className="text-[8px] h-4 px-1 bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                      {chamberCount}
                    </Badge>
                  )}
                </div>
                
                {isExpanded && municipalities.length > 0 && (
                  <div className="ml-5 border-l border-border/30 pl-2">
                    {municipalities.map(muni => {
                      const isMuniSelected = selectedMunicipalities.has(muni.id) || isRegionSelected;
                      const muniChamberCount = chamberCountByMuni[muni.id] || 0;
                      
                      return (
                        <div 
                          key={muni.id}
                          className="flex items-center gap-1 py-0.5 px-1 rounded hover-elevate"
                          data-testid={`geo-muni-${muni.id}`}
                        >
                          <Checkbox
                            checked={isMuniSelected}
                            disabled={isRegionSelected}
                            onCheckedChange={() => onToggleMunicipality(muni.id, region.id)}
                            className="h-3 w-3"
                            data-testid={`checkbox-muni-${muni.id}`}
                          />
                          <span className="text-[9px] text-muted-foreground flex-1 truncate">
                            {muni.shortName || muni.name}
                          </span>
                          {muniChamberCount > 0 && (
                            <span className="text-[8px] text-indigo-400">{muniChamberCount}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function GrowthChart() {
  const timelineSummary = useMemo(() => getMemberTimelineSummary(), []);
  
  return (
    <div className="flex-1 flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-medium">Members Added Over Time</h2>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-cyan-500 rounded-sm" />
            <span className="text-muted-foreground">Daily Additions</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-emerald-400" />
            <span className="text-muted-foreground">Cumulative Total</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 text-[10px] bg-muted/30 rounded p-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Total Members</span>
          <span className="text-lg font-medium text-emerald-400">{timelineSummary.totalMembers.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Days Tracked</span>
          <span className="text-lg font-medium">{timelineSummary.totalDays}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Avg/Day</span>
          <span className="text-lg font-medium text-cyan-400">{timelineSummary.avgPerDay.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Peak Day</span>
          <span className="text-lg font-medium text-amber-400">{timelineSummary.maxDay.toLocaleString()}</span>
          <span className="text-muted-foreground">{timelineSummary.maxDayLabel}</span>
        </div>
      </div>
      
      <div className="flex-1 min-h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={timelineSummary.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="dateLabel" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval={6}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="left"
              domain={[0, 20000]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              label={{ 
                value: 'Daily Additions', 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 }
              }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              label={{ 
                value: 'Cumulative Total', 
                angle: 90, 
                position: 'insideRight',
                style: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 }
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: 11
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar 
              yAxisId="left"
              dataKey="added" 
              fill="hsl(188 95% 43%)"
              radius={[4, 4, 0, 0]}
              name="Members Added"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="cumulative" 
              stroke="hsl(160 84% 39%)"
              strokeWidth={2}
              dot={false}
              name="Cumulative Total"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type ProgressSortKey = 'status' | 'chamber' | 'region' | 'members' | 'expected' | 'percentComplete' | 'naics';
type SortDirection = 'asc' | 'desc';

export default function AdminChambers() {
  const [chamberSearch, setChamberSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberNaicsFilter, setMemberNaicsFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("chambers");
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<Set<string>>(new Set());
  const [progressSortKey, setProgressSortKey] = useState<ProgressSortKey>('status');
  const [progressSortDir, setProgressSortDir] = useState<SortDirection>('asc');

  const chamberWithMatches: ChamberWithMatch[] = useMemo(() => {
    return BC_CHAMBERS_OF_COMMERCE.map(chamber => {
      const matchedMunicipality = findMatchingMunicipality(chamber.municipality);
      const matchedRegion = findMatchingRegion(chamber.region.toLowerCase().replace(/\s+/g, '-'));
      return {
        ...chamber,
        matchedMunicipality,
        matchedRegion,
      };
    });
  }, []);

  const chamberCountByRegion = useMemo(() => {
    const counts: Record<string, number> = {};
    chamberWithMatches.forEach(c => {
      if (c.matchedRegion) {
        counts[c.matchedRegion.id] = (counts[c.matchedRegion.id] || 0) + 1;
      }
    });
    return counts;
  }, [chamberWithMatches]);

  const chamberCountByMuni = useMemo(() => {
    const counts: Record<string, number> = {};
    chamberWithMatches.forEach(c => {
      if (c.matchedMunicipality) {
        counts[c.matchedMunicipality.id] = (counts[c.matchedMunicipality.id] || 0) + 1;
      }
    });
    return counts;
  }, [chamberWithMatches]);

  const memberCountByRegion = useMemo(() => {
    const counts: Record<string, number> = {};
    chamberMembers.forEach(m => {
      const regionId = m.region?.toLowerCase().replace(/\s+/g, '-');
      if (regionId) {
        counts[regionId] = (counts[regionId] || 0) + 1;
      }
    });
    return counts;
  }, []);

  const memberCountByMuni = useMemo(() => {
    const counts: Record<string, number> = {};
    chamberMembers.forEach(m => {
      const muni = findMatchingMunicipality(m.municipality);
      if (muni) {
        counts[muni.id] = (counts[muni.id] || 0) + 1;
      }
    });
    return counts;
  }, []);

  const hasGeoFilter = selectedRegions.size > 0 || selectedMunicipalities.size > 0;

  const filteredChambers = useMemo(() => {
    let filtered = chamberWithMatches;
    
    if (hasGeoFilter) {
      filtered = filtered.filter(c => {
        if (c.matchedRegion && selectedRegions.has(c.matchedRegion.id)) return true;
        if (c.matchedMunicipality && selectedMunicipalities.has(c.matchedMunicipality.id)) return true;
        if (c.matchedMunicipality && c.matchedMunicipality.parentId && selectedRegions.has(c.matchedMunicipality.parentId)) return true;
        return false;
      });
    }
    
    if (!chamberSearch) return filtered;
    const search = chamberSearch.toLowerCase();
    return filtered.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.municipality?.toLowerCase().includes(search) ||
      c.region?.toLowerCase().includes(search) ||
      c.matchedMunicipality?.name.toLowerCase().includes(search) ||
      c.matchedRegion?.name.toLowerCase().includes(search) ||
      c.notes?.toLowerCase().includes(search) ||
      c.website?.toLowerCase().includes(search)
    );
  }, [chamberWithMatches, chamberSearch, selectedRegions, selectedMunicipalities, hasGeoFilter]);

  const chamberStats = useMemo(() => {
    const matched = chamberWithMatches.filter(c => c.matchedMunicipality).length;
    const regionOnly = chamberWithMatches.filter(c => !c.matchedMunicipality && c.matchedRegion).length;
    const unmatched = chamberWithMatches.filter(c => !c.matchedMunicipality && !c.matchedRegion).length;
    const byRegion: Record<string, number> = {};
    chamberWithMatches.forEach(c => {
      byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    });
    const withWebsite = chamberWithMatches.filter(c => c.website).length;
    const withPhone = chamberWithMatches.filter(c => c.phone).length;
    const withMembers = chamberWithMatches.filter(c => c.members).length;
    return { 
      total: chamberWithMatches.length, 
      matched, 
      regionOnly, 
      unmatched, 
      byRegion,
      withWebsite,
      withPhone,
      withMembers
    };
  }, [chamberWithMatches]);

  const filteredMembers = useMemo(() => {
    let filtered = chamberMembers;
    
    if (hasGeoFilter) {
      filtered = filtered.filter(m => {
        const regionId = m.region?.toLowerCase().replace(/\s+/g, '-');
        if (regionId && selectedRegions.has(regionId)) return true;
        
        const muni = findMatchingMunicipality(m.municipality);
        if (muni && selectedMunicipalities.has(muni.id)) return true;
        if (muni && muni.parentId && selectedRegions.has(muni.parentId)) return true;
        return false;
      });
    }
    
    if (memberNaicsFilter !== "all") {
      filtered = filtered.filter(m => m.naicsSubsector === memberNaicsFilter);
    }
    
    if (!memberSearch) return filtered;
    const search = memberSearch.toLowerCase();
    return filtered.filter(m => {
      const businessName = m.businessName?.toLowerCase() || '';
      const naicsTitle = m.naicsTitle?.toLowerCase() || '';
      const subcategory = m.subcategory?.toLowerCase() || '';
      const description = m.description?.toLowerCase() || '';
      const municipality = m.municipality?.toLowerCase() || '';
      const region = m.region?.toLowerCase() || '';
      const website = m.website?.toLowerCase() || '';
      const subsectorLabel = naicsSubsectorLabels[m.naicsSubsector || '']?.toLowerCase() || '';
      
      return businessName.includes(search) ||
        naicsTitle.includes(search) ||
        subcategory.includes(search) ||
        description.includes(search) ||
        municipality.includes(search) ||
        region.includes(search) ||
        website.includes(search) ||
        subsectorLabel.includes(search);
    });
  }, [memberSearch, memberNaicsFilter, selectedRegions, selectedMunicipalities, hasGeoFilter]);

  const memberStats = useMemo(() => {
    const byNaicsSubsector: Record<string, number> = {};
    chamberMembers.forEach(m => {
      const subsector = m.naicsSubsector || 'unknown';
      byNaicsSubsector[subsector] = (byNaicsSubsector[subsector] || 0) + 1;
    });
    const withWebsite = chamberMembers.filter(m => m.website && !m.websiteNeedsCollection).length;
    const needsWebsite = chamberMembers.filter(m => m.websiteNeedsCollection).length;
    const withCrossRef = chamberMembers.filter(m => m.crossReference).length;
    const byChamber: Record<string, number> = {};
    chamberMembers.forEach(m => {
      byChamber[m.chamberId] = (byChamber[m.chamberId] || 0) + 1;
    });
    const usedSubsectors = Object.keys(byNaicsSubsector).filter(s => s !== 'unknown').sort();
    return { 
      total: chamberMembers.length, 
      byNaicsSubsector,
      byChamber,
      withWebsite,
      needsWebsite,
      withCrossRef,
      usedSubsectors
    };
  }, []);

  const { data: progressData } = useQuery<{ progressList: ChamberProgress[]; summary: ChamberProgressSummary }>({
    queryKey: ['/api/admin/chamber-progress'],
  });

  const progressList = progressData?.progressList || [];
  const progressSummary = progressData?.summary || {
    total: 0, completed: 0, partial: 0, pending: 0, inProgress: 0, blocked: 0,
    completedPercentage: 0, neededForThreshold: 0
  };

  const filteredProgressList = useMemo(() => {
    if (!hasGeoFilter) return progressList;
    return progressList.filter(p => {
      const chamber = chamberWithMatches.find(c => c.id === p.chamberId);
      if (!chamber) return false;
      if (chamber.matchedRegion && selectedRegions.has(chamber.matchedRegion.id)) return true;
      if (chamber.matchedMunicipality && selectedMunicipalities.has(chamber.matchedMunicipality.id)) return true;
      if (chamber.matchedMunicipality && chamber.matchedMunicipality.parentId && selectedRegions.has(chamber.matchedMunicipality.parentId)) return true;
      return false;
    });
  }, [progressList, hasGeoFilter, selectedRegions, selectedMunicipalities, chamberWithMatches]);

  const filteredProgressSummary = useMemo(() => {
    const data = filteredProgressList;
    return {
      total: data.length,
      completed: data.filter(p => p.status === 'completed').length,
      partial: data.filter(p => p.status === 'partial').length,
      pending: data.filter(p => p.status === 'pending').length,
      inProgress: data.filter(p => p.status === 'in_progress').length,
      blocked: data.filter(p => p.status === 'blocked').length,
      completedPercentage: data.length > 0 ? Math.round((data.filter(p => p.status === 'completed').length / data.length) * 100) : 0,
      neededForThreshold: Math.max(0, Math.ceil(data.length * 0.8) - data.filter(p => p.status === 'completed').length)
    };
  }, [filteredProgressList]);

  // Calculate % complete (members vs expected) - returns null if < 30 members
  const getPercentComplete = (row: ChamberProgress): number | null => {
    if (row.actualMembers < 30) return null;
    if (!row.expectedMembers || row.expectedMembers === 0) return null;
    return Math.min(100, Math.floor((row.actualMembers / row.expectedMembers) * 100));
  };

  // Operational order: pending first (work to start), then in_progress, partial, completed, blocked
  const statusOrder: Record<ChamberProgressStatus, number> = {
    'pending': 0,
    'in_progress': 1,
    'partial': 2,
    'completed': 3,
    'blocked': 4
  };

  const sortedProgressList = useMemo(() => {
    const sorted = [...filteredProgressList];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (progressSortKey) {
        case 'status':
          cmp = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'chamber':
          cmp = a.chamberName.localeCompare(b.chamberName);
          break;
        case 'region':
          cmp = a.region.localeCompare(b.region);
          break;
        case 'members':
          cmp = a.actualMembers - b.actualMembers;
          break;
        case 'expected':
          cmp = (a.expectedMembers || 0) - (b.expectedMembers || 0);
          break;
        case 'percentComplete': {
          const pctA = getPercentComplete(a) ?? -1;
          const pctB = getPercentComplete(b) ?? -1;
          cmp = pctA - pctB;
          break;
        }
        case 'naics':
          cmp = (a.naicsCoverage || 0) - (b.naicsCoverage || 0);
          break;
      }
      return progressSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProgressList, progressSortKey, progressSortDir]);

  const handleProgressSort = (key: ProgressSortKey) => {
    if (progressSortKey === key) {
      setProgressSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProgressSortKey(key);
      setProgressSortDir('asc');
    }
  };

  const getSortIcon = (key: ProgressSortKey) => {
    if (progressSortKey !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return progressSortDir === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const getStatusIcon = (status: ChamberProgressStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3 h-3 text-green-400" />;
      case 'partial': return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      case 'pending': return <Clock className="w-3 h-3 text-gray-400" />;
      case 'in_progress': return <Target className="w-3 h-3 text-blue-400" />;
      case 'blocked': return <Ban className="w-3 h-3 text-red-400" />;
      default: return null;
    }
  };

  const getStatusBadgeClass = (status: ChamberProgressStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'partial': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'pending': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'blocked': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getPartialReasonText = (reason: PartialReason) => {
    switch (reason) {
      case 'below_member_threshold': return 'Less than 30 members';
      case 'below_naics_threshold': return 'Less than 80% NAICS';
      case 'missing_expected_count': return 'Missing expected count';
      default: return reason;
    }
  };

  const handleToggleRegion = (regionId: string) => {
    setSelectedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
        const municipalities = getMunicipalities(regionId);
        setSelectedMunicipalities(prevMunis => {
          const nextMunis = new Set(prevMunis);
          municipalities.forEach(m => nextMunis.delete(m.id));
          return nextMunis;
        });
      }
      return next;
    });
  };

  const handleToggleMunicipality = (muniId: string, regionId: string) => {
    if (selectedRegions.has(regionId)) return;
    
    setSelectedMunicipalities(prev => {
      const next = new Set(prev);
      if (next.has(muniId)) {
        next.delete(muniId);
      } else {
        next.add(muniId);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setSelectedRegions(new Set());
    setSelectedMunicipalities(new Set());
  };

  return (
    <div className="h-full flex flex-col font-mono">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h1 className="text-sm font-bold tracking-wider text-foreground">CHAMBERS DATABASE</h1>
          <Badge variant="outline" className="text-[10px]">
            {chamberStats.total} CHAMBERS
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            {memberStats.total.toLocaleString()} MEMBERS
          </Badge>
          {hasGeoFilter && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
              <MapPin className="w-3 h-3 mr-1" />
              {selectedRegions.size + selectedMunicipalities.size} LOCATIONS SELECTED
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          BC Chambers of Commerce and verified member directories with NAICS industry classifications
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 flex-shrink-0">
          <GeoFilterPanel
            selectedRegions={selectedRegions}
            selectedMunicipalities={selectedMunicipalities}
            onToggleRegion={handleToggleRegion}
            onToggleMunicipality={handleToggleMunicipality}
            onClearAll={handleClearAll}
            chamberCountByRegion={chamberCountByRegion}
            chamberCountByMuni={chamberCountByMuni}
            memberCountByRegion={memberCountByRegion}
            memberCountByMuni={memberCountByMuni}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="chambers" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-400 data-[state=active]:bg-transparent px-4 py-2 text-xs"
                data-testid="tab-chambers"
              >
                CHAMBERS ({hasGeoFilter ? filteredChambers.length : chamberStats.total})
              </TabsTrigger>
              <TabsTrigger 
                value="members" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-400 data-[state=active]:bg-transparent px-4 py-2 text-xs"
                data-testid="tab-members"
              >
                MEMBERS ({hasGeoFilter ? filteredMembers.length.toLocaleString() : memberStats.total.toLocaleString()})
              </TabsTrigger>
              <TabsTrigger 
                value="audit" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-400 data-[state=active]:bg-transparent px-4 py-2 text-xs"
                data-testid="tab-audit"
              >
                PROGRESS ({hasGeoFilter ? filteredProgressList.length : progressSummary.total})
              </TabsTrigger>
              <TabsTrigger 
                value="growth" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent px-4 py-2 text-xs"
                data-testid="tab-growth"
              >
                GROWTH
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chambers" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
              <div className="p-3 border-b border-border/30 flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    placeholder="Search chambers of commerce..."
                    value={chamberSearch}
                    onChange={e => setChamberSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background/50"
                    data-testid="input-chamber-search"
                  />
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                  <span className="text-green-400">{chamberStats.matched} MATCHED</span>
                  <span className="text-blue-400">{chamberStats.withWebsite} WEBSITES</span>
                  <span className="text-cyan-400">{chamberStats.withPhone} PHONE</span>
                  <span className="text-amber-400">{chamberStats.withMembers} MEMBER DATA</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                        <th className="text-left py-2 px-2">CHAMBER</th>
                        <th className="text-left py-2 px-2">REGION</th>
                        <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                        <th className="text-left py-2 px-2">MATCHED TO</th>
                        <th className="text-left py-2 px-2">CONTACT</th>
                        <th className="text-left py-2 px-2">DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredChambers.map(chamber => (
                        <tr 
                          key={chamber.id} 
                          className="border-b border-border/20 hover-elevate"
                          data-testid={`row-chamber-${chamber.id}`}
                        >
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-3 h-3 text-indigo-400" />
                              <div>
                                <div className="font-medium">{chamber.name}</div>
                                {chamber.location.address && <div className="text-[10px] text-muted-foreground">{chamber.location.address}</div>}
                                <div className="text-[10px] text-muted-foreground">{chamber.location.lat.toFixed(4)}, {chamber.location.lng.toFixed(4)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className="text-[8px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                              {chamber.region}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">{chamber.municipality}</td>
                          <td className="py-2 px-2">
                            {chamber.matchedMunicipality ? (
                              <div className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                <span>{chamber.matchedMunicipality.name}</span>
                              </div>
                            ) : chamber.matchedRegion ? (
                              <span className="text-yellow-400">(region only)</span>
                            ) : (
                              <div className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" />
                                <span>No match</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <div className="text-[10px]">
                              {chamber.phone && <div className="text-muted-foreground">{chamber.phone}</div>}
                              {chamber.email && <div className="text-muted-foreground">{chamber.email}</div>}
                              {chamber.website && <div className="text-blue-400/70 truncate max-w-[150px]">{chamber.website.replace(/^https?:\/\//, '')}</div>}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="text-[10px]">
                              {chamber.founded && <div className="text-muted-foreground">Est. {chamber.founded}</div>}
                              {chamber.members && <div className="text-cyan-400">{chamber.members} members</div>}
                              {chamber.notes && <div className="text-muted-foreground/70 truncate max-w-[180px]">{chamber.notes}</div>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="members" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
              <div className="p-3 border-b border-border/30 flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background/50"
                    data-testid="input-member-search"
                  />
                </div>
                <select
                  value={memberNaicsFilter}
                  onChange={e => setMemberNaicsFilter(e.target.value)}
                  className="h-8 text-xs bg-background/50 border border-border/50 rounded-md px-2"
                  data-testid="select-member-naics"
                >
                  <option value="all">All Industries ({memberStats.total.toLocaleString()})</option>
                  {memberStats.usedSubsectors.map(subsector => (
                    <option key={subsector} value={subsector}>
                      {subsector}: {naicsSubsectorLabels[subsector] || 'Unknown'} ({memberStats.byNaicsSubsector[subsector] || 0})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                  <span className="text-emerald-400">{memberStats.withWebsite} WITH WEBSITE</span>
                  <span className="text-amber-400">{memberStats.needsWebsite} NEEDS WEBSITE</span>
                  <span className="text-cyan-400">{memberStats.withCrossRef} CROSS-REF</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                        <th className="text-left py-2 px-2">BUSINESS</th>
                        <th className="text-left py-2 px-2">NAICS INDUSTRY</th>
                        <th className="text-left py-2 px-2">CHAMBER</th>
                        <th className="text-left py-2 px-2">LOCATION</th>
                        <th className="text-left py-2 px-2">WEBSITE</th>
                        <th className="text-left py-2 px-2">CROSS-REF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(member => (
                        <tr 
                          key={member.id} 
                          className="border-b border-border/20 hover-elevate"
                          data-testid={`row-member-${member.id}`}
                        >
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Store className="w-3 h-3 text-emerald-400" />
                              <div>
                                <div className="font-medium text-foreground">{member.businessName}</div>
                                {member.description && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{member.description}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="text-[10px]">
                              <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                {member.naicsSubsector}: {naicsSubsectorLabels[member.naicsSubsector || ''] || 'Unknown'}
                              </Badge>
                              <div className="text-[9px] text-muted-foreground mt-0.5">{member.naicsTitle}</div>
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-indigo-400 text-[10px]">{member.chamberId}</span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="text-[10px]">
                              <div className="text-foreground">{member.municipality}</div>
                              <div className="text-muted-foreground">{member.region}</div>
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            {member.website ? (
                              <a 
                                href={member.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[10px]"
                                data-testid={`link-member-website-${member.id}`}
                              >
                                <Globe className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{member.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                              </a>
                            ) : member.websiteNeedsCollection ? (
                              <span className="text-amber-400/70 text-[10px]">Needs collection</span>
                            ) : (
                              <span className="text-muted-foreground/50 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {member.crossReference ? (
                              <div className="flex items-center gap-1 text-cyan-400 text-[10px]">
                                <Link2 className="w-3 h-3" />
                                <span>{member.crossReference.dataset}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50 text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="audit" className="flex-1 overflow-hidden m-0 flex data-[state=inactive]:hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-3 border-b border-border/30">
                  <div className="flex items-center gap-4 flex-wrap mb-3">
                    <div className="flex gap-4 text-[10px] flex-wrap">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        <span className="text-green-400">{filteredProgressSummary.completed} COMPLETED</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400">{filteredProgressSummary.partial} PARTIAL</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">{filteredProgressSummary.pending} PENDING</span>
                      </div>
                      {filteredProgressSummary.inProgress > 0 && (
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3 text-blue-400" />
                          <span className="text-blue-400">{filteredProgressSummary.inProgress} IN PROGRESS</span>
                        </div>
                      )}
                      {filteredProgressSummary.blocked > 0 && (
                        <div className="flex items-center gap-1">
                          <Ban className="w-3 h-3 text-red-400" />
                          <span className="text-red-400">{filteredProgressSummary.blocked} BLOCKED</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-[10px] text-muted-foreground">
                        {filteredProgressSummary.completedPercentage}% COMPLETE
                      </div>
                      {filteredProgressSummary.neededForThreshold > 0 && (
                        <Badge variant="outline" className="text-[8px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {filteredProgressSummary.neededForThreshold} MORE FOR 80% THRESHOLD
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                    Completion criteria: 30+ members AND 80%+ NAICS coverage. Partial = has data but does not meet both criteria.
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-50 bg-background">
                      <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                        <th className="text-left py-2 px-2">
                          <button 
                            className="flex items-center cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity"
                            onClick={() => handleProgressSort('status')}
                          >
                            STATUS{getSortIcon('status')}
                          </button>
                        </th>
                        <th className="text-left py-2 px-2">
                          <button 
                            className="flex items-center cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity"
                            onClick={() => handleProgressSort('chamber')}
                          >
                            CHAMBER{getSortIcon('chamber')}
                          </button>
                        </th>
                        <th className="text-left py-2 px-2">
                          <button 
                            className="flex items-center cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity"
                            onClick={() => handleProgressSort('region')}
                          >
                            REGION{getSortIcon('region')}
                          </button>
                        </th>
                        <th className="text-right py-2 px-2">
                          <button 
                            className="flex items-center justify-end cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity ml-auto"
                            onClick={() => handleProgressSort('members')}
                          >
                            MEMBERS{getSortIcon('members')}
                          </button>
                        </th>
                        <th className="text-right py-2 px-2">
                          <button 
                            className="flex items-center justify-end cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity ml-auto"
                            onClick={() => handleProgressSort('expected')}
                          >
                            EXPECTED{getSortIcon('expected')}
                          </button>
                        </th>
                        <th className="text-right py-2 px-2">
                          <button 
                            className="flex items-center justify-end cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity ml-auto"
                            onClick={() => handleProgressSort('percentComplete')}
                          >
                            % COMPLETE{getSortIcon('percentComplete')}
                          </button>
                        </th>
                        <th className="text-right py-2 px-2">
                          <button 
                            className="flex items-center justify-end cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity ml-auto"
                            onClick={() => handleProgressSort('naics')}
                          >
                            NAICS{getSortIcon('naics')}
                          </button>
                        </th>
                        <th className="text-left py-2 px-2">ISSUES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProgressList.map(row => {
                        const pctComplete = getPercentComplete(row);
                        return (
                          <tr 
                            key={row.chamberId} 
                            className="border-b border-border/20 hover-elevate"
                            data-testid={`row-progress-${row.chamberId}`}
                          >
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5">
                                {getStatusIcon(row.status)}
                                <Badge variant="outline" className={`text-[8px] ${getStatusBadgeClass(row.status)}`}>
                                  {row.status.toUpperCase().replace('_', ' ')}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{row.chamberName}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{row.municipality}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className="text-[8px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                                {row.region}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className={row.actualMembers >= 30 ? "text-emerald-400 font-medium" : row.actualMembers > 0 ? "text-yellow-400" : "text-muted-foreground/50"}>
                                {row.actualMembers > 0 ? row.actualMembers : '-'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              {row.expectedMembers !== null ? (
                                <span className="text-cyan-400">{row.expectedMembers}</span>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {pctComplete !== null ? (
                                <span className={pctComplete >= 80 ? "text-emerald-400 font-medium" : pctComplete >= 50 ? "text-yellow-400" : "text-orange-400"}>
                                  {pctComplete}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {row.naicsCoverage !== null ? (
                                <span className={row.naicsCoverage >= 80 ? "text-emerald-400 font-medium" : row.naicsCoverage > 0 ? "text-yellow-400" : "text-muted-foreground"}>
                                  {row.naicsCoverage}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">N/A</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {row.partialReasons.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.partialReasons.map(reason => (
                                    <Badge 
                                      key={reason} 
                                      variant="outline" 
                                      className="text-[7px] bg-yellow-500/5 text-yellow-400/80 border-yellow-500/20"
                                    >
                                      {getPartialReasonText(reason)}
                                    </Badge>
                                  ))}
                                </div>
                              ) : row.status === 'completed' ? (
                                <span className="text-[10px] text-green-400/70">All criteria met</span>
                              ) : row.status === 'pending' ? (
                                <span className="text-[10px] text-muted-foreground/50">Not started</span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
              <div className="w-[1200px] border-l border-border/30 flex-shrink-0">
                <ChamberMapFull />
              </div>
            </TabsContent>

            <TabsContent value="growth" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
              <GrowthChart />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
