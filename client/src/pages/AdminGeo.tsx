import { useState } from "react";
import { Globe, ChevronRight, Database, Users, MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import GeoTree from "@/components/GeoTree";
import { 
  GEO_HIERARCHY, 
  getParentChain, 
  getChildren,
  getNode,
  type GeoNode 
} from "@shared/geography";
import { SHARED_SOURCES, MUNICIPAL_SOURCES, ALL_MUNICIPALITIES, type DataSource } from "@shared/sources";

function Breadcrumb({ nodeId }: { nodeId: string }) {
  const chain = getParentChain(nodeId);
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {chain.map((node, idx) => (
        <span key={node.id} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="w-3 h-3" />}
          <span className={idx === chain.length - 1 ? "text-foreground font-medium" : ""}>
            {node.shortName || node.name}
          </span>
        </span>
      ))}
    </div>
  );
}

function getSourcesForNode(node: GeoNode): { sources: DataSource[]; coverageType: string }[] {
  const results: { sources: DataSource[]; coverageType: string }[] = [];
  
  if (node.level === "province") {
    results.push({ sources: SHARED_SOURCES, coverageType: "Provincial/Regional" });
  } else if (node.level === "region") {
    results.push({ sources: SHARED_SOURCES, coverageType: "Provincial (inherited)" });
    
    const regionMuniSources: DataSource[] = [];
    const childNodes = getChildren(node.id);
    childNodes.forEach(child => {
      const muniSources = MUNICIPAL_SOURCES[child.name] || [];
      regionMuniSources.push(...muniSources);
    });
    if (regionMuniSources.length > 0) {
      results.push({ sources: regionMuniSources, coverageType: "Municipal (aggregated)" });
    }
  } else if (node.level === "municipality") {
    results.push({ sources: SHARED_SOURCES, coverageType: "Provincial (inherited)" });
    
    const muniName = node.name;
    const municipalSources = MUNICIPAL_SOURCES[muniName] || [];
    if (municipalSources.length > 0) {
      results.push({ sources: municipalSources, coverageType: "Municipal" });
    }
  }
  
  return results;
}

function hasMunicipalData(node: GeoNode): boolean {
  if (node.level === "municipality") {
    return ALL_MUNICIPALITIES.includes(node.name);
  }
  if (node.level === "region") {
    const children = getChildren(node.id);
    return children.some(child => ALL_MUNICIPALITIES.includes(child.name));
  }
  return true;
}

function NodeDetail({ nodeId }: { nodeId: string }) {
  const node = getNode(nodeId);
  if (!node) return null;
  
  const allChildren = getChildren(nodeId);
  const coveredChildren = allChildren.filter(c => ALL_MUNICIPALITIES.includes(c.name));
  const children = node.level === "region" ? coveredChildren : allChildren;
  const sourceGroups = getSourcesForNode(node);
  const totalSources = sourceGroups.reduce((sum, g) => sum + g.sources.length, 0);
  const hasData = hasMunicipalData(node);
  const noCoverage = node.level === "region" && coveredChildren.length === 0;
  
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{node.name}</h2>
          {node.level === "municipality" && !ALL_MUNICIPALITIES.includes(node.name) && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">NO DATA</Badge>
          )}
          {node.level === "municipality" && ALL_MUNICIPALITIES.includes(node.name) && (
            <Badge className="text-[9px] bg-green-500/20 text-green-400">COVERED</Badge>
          )}
          {noCoverage && (
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-400/30">NO MUNICIPAL DATA YET</Badge>
          )}
        </div>
        <Breadcrumb nodeId={nodeId} />
      </div>
      
      {noCoverage && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-amber-400 text-sm mb-2">Region Not Yet Covered</div>
            <p className="text-xs text-muted-foreground">
              This region has {allChildren.length} municipalities but none are in the current dataset.
              Provincial/regional shared sources still apply.
            </p>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            {node.level === "province" ? (
              <>
                <div className="text-2xl font-bold">{allChildren.filter(r => {
                  const regionChildren = getChildren(r.id);
                  return regionChildren.some(c => ALL_MUNICIPALITIES.includes(c.name));
                }).length}/{allChildren.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Regions with Data</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{children.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  {node.level === "region" ? "Municipalities" : "Sub-areas"}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{totalSources}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Data Sources</div>
          </CardContent>
        </Card>
        
        {node.metadata?.population && (
          <Card className="bg-card/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">
                {(node.metadata.population / 1000).toFixed(0)}K
              </div>
              <div className="text-[10px] text-muted-foreground uppercase">Population</div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {children.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Child Jurisdictions ({children.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {children.map(child => (
                <Badge key={child.id} variant="secondary" className="text-xs">
                  {child.shortName || child.name}
                  {child.metadata?.population && (
                    <span className="ml-1 text-muted-foreground">
                      ({(child.metadata.population / 1000).toFixed(0)}K)
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {sourceGroups.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceGroups.map((group, idx) => (
              <div key={idx}>
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{group.coverageType}</Badge>
                  <span>{group.sources.length} sources</span>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {group.sources.slice(0, 20).map((source, sidx) => (
                      <div 
                        key={sidx} 
                        className="flex items-center justify-between gap-2 text-xs p-1.5 rounded bg-background/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="secondary" className="text-[9px] shrink-0">
                            {source.category}
                          </Badge>
                          <span className="truncate">{source.source_name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => window.open(source.url, "_blank")}
                          data-testid={`button-open-source-${sidx}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {group.sources.length > 20 && (
                      <div className="text-[10px] text-muted-foreground text-center py-2">
                        + {group.sources.length - 20} more sources
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminGeo() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("bc");

  return (
    <div className="h-full flex font-mono">
      <div className="w-64 border-r border-border/50 bg-card/20 flex flex-col">
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold tracking-wider">GEOGRAPHIC VIEW</span>
        </header>
        <div className="flex-1 overflow-hidden">
          <GeoTree 
            selectedNodeId={selectedNodeId} 
            onSelectNode={setSelectedNodeId}
          />
        </div>
        <footer className="px-3 py-2 border-t border-border/30 text-[10px] text-muted-foreground">
          {Object.keys(GEO_HIERARCHY).length} nodes in hierarchy
        </footer>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {selectedNodeId ? (
          <NodeDetail nodeId={selectedNodeId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Select a location from the tree</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
