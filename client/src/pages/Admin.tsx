import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ALL_MUNICIPALITIES, 
  SHARED_SOURCES, 
  MUNICIPAL_SOURCES, 
  getSourcesForMunicipality,
  DataSource 
} from "@shared/sources";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CATEGORIES = [
  { id: "emergency", label: "EMERGENCY", color: "text-red-400" },
  { id: "power", label: "POWER", color: "text-yellow-400" },
  { id: "water", label: "WATER", color: "text-blue-400" },
  { id: "transit", label: "TRANSIT", color: "text-green-400" },
  { id: "aviation", label: "AVIATION", color: "text-purple-400" },
  { id: "economic", label: "ECONOMIC", color: "text-orange-400" },
  { id: "news", label: "NEWS", color: "text-cyan-400" },
  { id: "waste", label: "WASTE", color: "text-amber-400" },
];

interface SourceCell {
  shared: DataSource[];
  municipal: DataSource[];
  total: number;
}

function getShortName(fullName: string): string {
  return fullName
    .replace(/^(City of |District of |Township of |Village of |Corporation of |Bowen Island )/i, "")
    .replace(/ Municipality$/i, "")
    .replace(/ First Nation$/i, " FN");
}

export default function Admin() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.id)));
  const [selectedCell, setSelectedCell] = useState<{ municipality: string; category: string } | null>(null);

  const matrix = useMemo(() => {
    const data: Record<string, Record<string, SourceCell>> = {};
    
    for (const municipality of ALL_MUNICIPALITIES) {
      data[municipality] = {};
      const municipalSources = MUNICIPAL_SOURCES[municipality] || [];
      
      for (const cat of CATEGORIES) {
        const sharedInCat = SHARED_SOURCES.filter(s => s.category === cat.id);
        const municipalInCat = municipalSources.filter(s => s.category === cat.id);
        
        data[municipality][cat.id] = {
          shared: sharedInCat,
          municipal: municipalInCat,
          total: sharedInCat.length + municipalInCat.length
        };
      }
    }
    
    return data;
  }, []);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, { shared: number; municipal: number; municipalities: number }> = {};
    
    for (const cat of CATEGORIES) {
      const sharedCount = SHARED_SOURCES.filter(s => s.category === cat.id).length;
      let municipalCount = 0;
      let municipalitiesWithSources = 0;
      
      for (const municipality of ALL_MUNICIPALITIES) {
        const sources = (MUNICIPAL_SOURCES[municipality] || []).filter(s => s.category === cat.id);
        municipalCount += sources.length;
        if (sources.length > 0) municipalitiesWithSources++;
      }
      
      totals[cat.id] = {
        shared: sharedCount,
        municipal: municipalCount,
        municipalities: municipalitiesWithSources
      };
    }
    
    return totals;
  }, []);

  const toggleCategory = (catId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catId)) {
      newExpanded.delete(catId);
    } else {
      newExpanded.add(catId);
    }
    setExpandedCategories(newExpanded);
  };

  const selectedSources = selectedCell ? matrix[selectedCell.municipality]?.[selectedCell.category] : null;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-mono text-xs">
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border/50 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold uppercase tracking-wider">Data Source Coverage Matrix</h1>
        </div>
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
                  <th className="text-left p-1.5 border-b border-r border-border/30 bg-card/50 min-w-[140px] sticky left-0 z-30">
                    CATEGORY
                  </th>
                  {ALL_MUNICIPALITIES.map(muni => (
                    <th 
                      key={muni} 
                      className="p-1 border-b border-border/30 bg-card/50 min-w-[60px] max-w-[80px]"
                      title={muni}
                    >
                      <div className="writing-mode-vertical text-left truncate" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', maxHeight: '100px' }}>
                        {getShortName(muni)}
                      </div>
                    </th>
                  ))}
                  <th className="p-1 border-b border-l border-border/30 bg-card/50 min-w-[70px]">
                    TOTALS
                  </th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => {
                  const isExpanded = expandedCategories.has(cat.id);
                  const totals = categoryTotals[cat.id];
                  
                  return (
                    <tr key={cat.id} className="hover:bg-card/20">
                      <td 
                        className={`p-1.5 border-b border-r border-border/30 sticky left-0 bg-background z-10 cursor-pointer ${cat.color}`}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <div className="flex items-center gap-1">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <span className="font-semibold">{cat.label}</span>
                          <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1">
                            {totals.shared}S + {totals.municipal}M
                          </Badge>
                        </div>
                      </td>
                      {ALL_MUNICIPALITIES.map(muni => {
                        const cell = matrix[muni][cat.id];
                        const hasData = cell.total > 0;
                        const hasMunicipal = cell.municipal.length > 0;
                        const isSelected = selectedCell?.municipality === muni && selectedCell?.category === cat.id;
                        
                        return (
                          <td 
                            key={muni}
                            className={`p-1 border-b border-border/30 text-center cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-card/40'
                            }`}
                            onClick={() => setSelectedCell({ municipality: muni, category: cat.id })}
                            data-testid={`cell-${cat.id}-${muni.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            {hasMunicipal ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    <Check className="h-3 w-3 text-green-500" />
                                    {cell.municipal.length > 1 && (
                                      <span className="text-[8px] text-green-400 ml-0.5">{cell.municipal.length}</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs">
                                    <p className="font-semibold mb-1">{muni} - {cat.label}</p>
                                    {cell.municipal.map(s => (
                                      <p key={s.url} className="text-muted-foreground">{s.source_name}</p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : hasData ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-muted-foreground/40">S</div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Shared sources only ({cell.shared.length})</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <X className="h-3 w-3 text-red-500/30 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1 border-b border-l border-border/30 text-center text-muted-foreground">
                        <div className="text-[9px]">
                          <span className="text-foreground">{totals.municipalities}</span>
                          <span>/{ALL_MUNICIPALITIES.length}</span>
                        </div>
                      </td>
                    </tr>
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
                <span className="text-muted-foreground/40">S</span>
                <span>Shared/Regional source only</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="h-3 w-3 text-red-500/30" />
                <span>No coverage</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        {selectedCell && selectedSources && (
          <div className="w-80 border-l border-border/30 bg-card/20 flex flex-col shrink-0">
            <div className="p-3 border-b border-border/30 bg-card/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold">{selectedCell.municipality}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {CATEGORIES.find(c => c.id === selectedCell.category)?.label}
                  </p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => setSelectedCell(null)}
                  data-testid="button-close-detail"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {selectedSources.municipal.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-2 font-semibold">
                      Municipal Sources ({selectedSources.municipal.length})
                    </p>
                    <div className="space-y-2">
                      {selectedSources.municipal.map(source => (
                        <div key={source.url} className="p-2 rounded bg-card/50 border border-border/30">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium">{source.source_name}</p>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 shrink-0"
                              onClick={() => window.open(source.url, '_blank')}
                              data-testid={`button-open-${source.source_name.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 break-all">{source.url}</p>
                          {source.description && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1">{source.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedSources.shared.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-2 font-semibold">
                      Shared/Regional Sources ({selectedSources.shared.length})
                    </p>
                    <div className="space-y-2">
                      {selectedSources.shared.map(source => (
                        <div key={source.url} className="p-2 rounded bg-card/30 border border-border/20">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-muted-foreground">{source.source_name}</p>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 shrink-0"
                              onClick={() => window.open(source.url, '_blank')}
                              data-testid={`button-open-shared-${source.source_name.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1 break-all">{source.url}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSources.total === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <X className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No sources configured</p>
                    <p className="text-[10px] mt-1">Add sources to shared/sources.ts</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
