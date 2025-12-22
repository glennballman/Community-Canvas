import { useState, useMemo, Fragment } from "react";
import { Check, X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ALL_MUNICIPALITIES, 
  SHARED_SOURCES, 
  MUNICIPAL_SOURCES, 
  DataSource 
} from "@shared/sources";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CATEGORIES = [
  { id: "emergency", label: "EMERGENCY", color: "text-red-400" },
  { id: "weather", label: "WEATHER", color: "text-sky-300" },
  { id: "power", label: "POWER", color: "text-yellow-400" },
  { id: "water", label: "WATER", color: "text-blue-400" },
  { id: "transit", label: "TRANSIT", color: "text-green-400" },
  { id: "marine", label: "MARINE", color: "text-cyan-400" },
  { id: "aviation", label: "AVIATION", color: "text-purple-400" },
  { id: "events", label: "EVENTS", color: "text-fuchsia-400" },
  { id: "economic", label: "ECONOMIC", color: "text-orange-400" },
  { id: "financial", label: "FINANCIAL", color: "text-green-300" },
  { id: "news", label: "NEWS", color: "text-cyan-400" },
  { id: "waste", label: "WASTE", color: "text-amber-400" },
  { id: "health", label: "HEALTH", color: "text-pink-400" },
  { id: "environment", label: "ENVIRONMENT", color: "text-emerald-400" },
  { id: "education", label: "EDUCATION", color: "text-indigo-400" },
  { id: "housing", label: "HOUSING", color: "text-orange-300" },
  { id: "parks", label: "PARKS & REC", color: "text-teal-400" },
  { id: "digital", label: "DIGITAL", color: "text-slate-400" },
];

interface SourceInfo {
  name: string;
  isShared: boolean;
  municipalities: Map<string, DataSource>;
}

function getShortName(fullName: string): string {
  return fullName
    .replace(/^(City of |District of |Township of |Village of |Corporation of |Bowen Island )/i, "")
    .replace(/ Municipality$/i, "")
    .replace(/ First Nation$/i, " FN");
}

export default function AdminMatrix() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedSource, setSelectedSource] = useState<{ source: SourceInfo; category: string } | null>(null);

  const sourcesByCategory = useMemo(() => {
    const result: Record<string, SourceInfo[]> = {};
    
    for (const cat of CATEGORIES) {
      const sourcesMap = new Map<string, SourceInfo>();
      
      const sharedInCat = SHARED_SOURCES.filter(s => s.category === cat.id);
      for (const source of sharedInCat) {
        const info: SourceInfo = {
          name: source.source_name,
          isShared: true,
          municipalities: new Map()
        };
        for (const muni of ALL_MUNICIPALITIES) {
          info.municipalities.set(muni, source);
        }
        sourcesMap.set(source.source_name, info);
      }
      
      for (const muni of ALL_MUNICIPALITIES) {
        const municipalSources = (MUNICIPAL_SOURCES[muni] || []).filter(s => s.category === cat.id);
        for (const source of municipalSources) {
          if (sourcesMap.has(source.source_name)) {
            sourcesMap.get(source.source_name)!.municipalities.set(muni, source);
          } else {
            const info: SourceInfo = {
              name: source.source_name,
              isShared: false,
              municipalities: new Map([[muni, source]])
            };
            sourcesMap.set(source.source_name, info);
          }
        }
      }
      
      const sorted = Array.from(sourcesMap.values()).sort((a, b) => {
        if (a.isShared !== b.isShared) return a.isShared ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      
      result[cat.id] = sorted;
    }
    
    return result;
  }, []);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, { shared: number; municipal: number; totalSources: number }> = {};
    
    for (const cat of CATEGORIES) {
      const sources = sourcesByCategory[cat.id] || [];
      const sharedCount = sources.filter(s => s.isShared).length;
      const municipalCount = sources.filter(s => !s.isShared).length;
      
      totals[cat.id] = {
        shared: sharedCount,
        municipal: municipalCount,
        totalSources: sources.length
      };
    }
    
    return totals;
  }, [sourcesByCategory]);

  const toggleCategory = (catId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catId)) {
      newExpanded.delete(catId);
    } else {
      newExpanded.add(catId);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-mono text-xs">
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border/50 bg-card/30 shrink-0">
        <h1 className="text-sm font-semibold uppercase tracking-wider">Data Source Coverage Matrix</h1>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{ALL_MUNICIPALITIES.length} Jurisdictions</span>
          <span className="text-border">|</span>
          <span>{CATEGORIES.length} Categories</span>
          <span className="text-border">|</span>
          <span>{SHARED_SOURCES.length} Shared Sources</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4">
            <table className="w-full border-collapse text-[10px]">
              <thead className="sticky top-0 z-20 bg-background">
                <tr>
                  <th className="text-left p-1.5 border-b border-r border-border/30 bg-card/50 min-w-[200px] sticky left-0 z-30">
                    CATEGORY / SOURCE
                  </th>
                  {ALL_MUNICIPALITIES.map(muni => (
                    <th 
                      key={muni} 
                      className="p-1 border-b border-border/30 bg-card/50 min-w-[28px] max-w-[40px]"
                      title={muni}
                    >
                      <div className="text-left truncate" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', maxHeight: '80px' }}>
                        {getShortName(muni)}
                      </div>
                    </th>
                  ))}
                  <th className="p-1 border-b border-l border-border/30 bg-card/50 min-w-[50px]">
                    COUNT
                  </th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => {
                  const isExpanded = expandedCategories.has(cat.id);
                  const totals = categoryTotals[cat.id];
                  const sources = sourcesByCategory[cat.id] || [];
                  
                  return (
                    <Fragment key={cat.id}>
                      <tr className="hover:bg-card/20 bg-card/10">
                        <td 
                          className={`p-1.5 border-b border-r border-border/30 sticky left-0 bg-card/30 z-10 cursor-pointer ${cat.color}`}
                          onClick={() => toggleCategory(cat.id)}
                        >
                          <div className="flex items-center gap-1">
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span className="font-semibold">{cat.label}</span>
                            <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1">
                              {totals.totalSources} sources
                            </Badge>
                            {totals.shared > 0 && (
                              <span className="text-[9px] text-muted-foreground ml-1">({totals.shared} shared)</span>
                            )}
                          </div>
                        </td>
                        {ALL_MUNICIPALITIES.map(muni => {
                          const municipalSources = (MUNICIPAL_SOURCES[muni] || []).filter(s => s.category === cat.id);
                          const hasLocalSources = municipalSources.length > 0;
                          
                          return (
                            <td 
                              key={muni}
                              className="p-0.5 border-b border-border/30 text-center bg-card/10"
                            >
                              {hasLocalSources ? (
                                <div className="flex items-center justify-center">
                                  <Check className="h-3 w-3 text-green-500" />
                                  {municipalSources.length > 1 && (
                                    <span className="text-[8px] text-green-400">{municipalSources.length}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30 text-[9px]">S</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-1 border-b border-l border-border/30 text-center text-muted-foreground bg-card/10">
                          <span className="text-[9px]">{sources.length}</span>
                        </td>
                      </tr>
                      
                      {isExpanded && sources.map((source, idx) => (
                        <tr 
                          key={`${cat.id}-${source.name}`} 
                          className={`hover:bg-card/30 ${selectedSource?.source.name === source.name && selectedSource?.category === cat.id ? 'bg-primary/10' : ''}`}
                        >
                          <td 
                            className="p-1 pl-6 border-b border-r border-border/20 sticky left-0 bg-background z-10 cursor-pointer"
                            onClick={() => setSelectedSource({ source, category: cat.id })}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/30 w-4">{idx + 1}.</span>
                              <span className={source.isShared ? "text-muted-foreground" : "text-foreground"}>
                                {source.name}
                              </span>
                              {source.isShared && (
                                <Badge variant="secondary" className="text-[8px] py-0 px-1">SHARED</Badge>
                              )}
                            </div>
                          </td>
                          {ALL_MUNICIPALITIES.map(muni => {
                            const hasSource = source.municipalities.has(muni);
                            const sourceData = source.municipalities.get(muni);
                            
                            return (
                              <td 
                                key={muni}
                                className={`p-0.5 border-b border-border/20 text-center ${hasSource ? 'cursor-pointer hover:bg-card/40' : ''}`}
                                onClick={() => hasSource && sourceData && window.open(sourceData.url, '_blank')}
                              >
                                {hasSource ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        {source.isShared ? (
                                          <span className="text-blue-400/60 text-[9px]">S</span>
                                        ) : (
                                          <Check className="h-2.5 w-2.5 text-green-500 mx-auto" />
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="text-xs">
                                        <p className="font-semibold">{source.name}</p>
                                        <p className="text-muted-foreground text-[10px] mt-1 break-all">{sourceData?.url}</p>
                                        <p className="text-blue-400 text-[10px] mt-1">Click to open</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <X className="h-2 w-2 text-red-500/20 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                          <td className="p-1 border-b border-l border-border/20 text-center text-muted-foreground">
                            <span className="text-[9px]">{source.municipalities.size}</span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-6 flex items-center gap-6 text-muted-foreground border-t border-border/30 pt-4">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>Municipal-specific source</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400/60 text-[9px]">S</span>
                <span>Shared/Regional source</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="h-3 w-3 text-red-500/30" />
                <span>No coverage</span>
              </div>
              <div className="text-muted-foreground/60">
                Click any cell with a source to open URL
              </div>
            </div>
          </div>
        </ScrollArea>

        {selectedSource && (
          <div className="w-80 border-l border-border/30 bg-card/20 flex flex-col shrink-0">
            <div className="p-3 border-b border-border/30 bg-card/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold">{selectedSource.source.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {CATEGORIES.find(c => c.id === selectedSource.category)?.label}
                    {selectedSource.source.isShared && " - SHARED"}
                  </p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => setSelectedSource(null)}
                  data-testid="button-close-detail"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                <p className="text-[10px] uppercase text-muted-foreground mb-2 font-semibold">
                  Available in {selectedSource.source.municipalities.size} jurisdictions
                </p>
                {Array.from(selectedSource.source.municipalities.entries()).map(([muni, source]) => (
                  <div key={muni} className="p-2 rounded bg-card/50 border border-border/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium">{muni}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 break-all">{source.url}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 shrink-0"
                        onClick={() => window.open(source.url, '_blank')}
                        data-testid={`button-open-${muni.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
