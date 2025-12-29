import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { NAICSTreeSummary, NAICSSectorNode, NAICSSubsectorNode, NAICSIndustryNode, NAICSMemberSummary } from "@shared/naics-hierarchy";

interface MemberListResponse {
  members: NAICSMemberSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
        className="flex items-center gap-2 p-3 hover-elevate cursor-pointer"
        onClick={onToggle}
        data-testid={`naics-sector-${sector.code}`}
      >
        <button className="p-0.5" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500/70" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] shrink-0">
              {sector.code}
            </Badge>
            <span className="text-sm font-medium truncate">{sector.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {formatMemberCount(sector.memberCount)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={(e) => { e.stopPropagation(); onViewMembers(); }}
            data-testid={`view-sector-${sector.code}`}
          >
            View All
          </Button>
        </div>
        <button className="p-1" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pl-6 pb-2 bg-muted/20">
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
    <div className="border-b border-border/20 last:border-b-0">
      <div
        className="flex items-center gap-2 p-2 hover-elevate cursor-pointer"
        onClick={onToggle}
        data-testid={`naics-subsector-${subsector.code}`}
      >
        <button className="p-0.5" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-blue-500/70" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] shrink-0">
              {subsector.code}
            </Badge>
            <span className="text-xs truncate">{subsector.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-[10px]">
            {formatMemberCount(subsector.memberCount)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 px-1.5"
            onClick={(e) => { e.stopPropagation(); onViewMembers(); }}
            data-testid={`view-subsector-${subsector.code}`}
          >
            View
          </Button>
        </div>
        <button className="p-0.5" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pl-5 pb-1 bg-muted/10">
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
      className="flex items-center gap-2 p-1.5 hover-elevate cursor-pointer"
      onClick={onViewMembers}
      data-testid={`naics-industry-${industry.code}`}
    >
      <FileText className="w-3 h-3 text-green-500/70 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[9px] shrink-0">
            {industry.code}
          </Badge>
          <span className="text-[11px] truncate text-muted-foreground">{industry.title}</span>
        </div>
      </div>
      <Badge variant="secondary" className="text-[9px] shrink-0">
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-mono gap-1">
                          <Hash className="w-2.5 h-2.5" />
                          {member.naicsCode}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">{member.naicsTitle}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" />
                          {member.chamberId}
                        </span>
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
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-lg font-bold tracking-wide">NAICS CODE EXPLORER</h1>
            <p className="text-xs text-muted-foreground">
              Browse businesses by North American Industry Classification System codes
            </p>
          </div>
          {tree && (
            <Badge variant="outline" className="text-sm">
              {formatMemberCount(tree.totalMembers)} total businesses
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sectors, subsectors, or industries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
            data-testid="input-search-naics"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
  );
}
