import { Database, Plus, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PROVINCIAL_SOURCES, REGIONAL_SOURCES, MUNICIPAL_SOURCES, type DataSource } from "@shared/sources";

export default function AdminSources() {
  // Flatten all regional sources
  const allRegionalSources = Object.entries(REGIONAL_SOURCES).flatMap(([regionId, sources]) =>
    sources.map(s => ({ ...s, region: regionId }))
  );
  
  const allSources: (DataSource & { municipality?: string; region?: string; tier?: string })[] = [
    ...PROVINCIAL_SOURCES.map(s => ({ ...s, tier: 'provincial' as const })),
    ...allRegionalSources.map(s => ({ ...s, tier: 'regional' as const })),
    ...Object.entries(MUNICIPAL_SOURCES).flatMap(([muni, sources]) => 
      sources.map(s => ({ ...s, municipality: muni, tier: 'municipal' as const }))
    )
  ];

  return (
    <div className="h-full flex flex-col font-mono">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border/50 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-blue-400" />
          <h1 className="text-sm font-semibold uppercase tracking-wider">Manage Sources</h1>
        </div>
        <Button size="sm" className="gap-2" data-testid="button-add-new-source">
          <Plus className="w-3 h-3" />
          ADD SOURCE
        </Button>
      </header>

      <div className="p-4 border-b border-border/30 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search sources..." 
            className="pl-10 text-xs" 
            data-testid="input-search-sources"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-3 h-3" />
          Filter
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {allSources.map((source, idx) => (
            <Card key={`${source.source_name}-${idx}`} className="bg-card/50">
              <CardContent className="p-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{source.source_name}</span>
                    <Badge variant="outline" className="text-[9px]">{source.category}</Badge>
                    {source.is_shared && (
                      <Badge className="text-[9px] bg-blue-500/20 text-blue-400">SHARED</Badge>
                    )}
                    {source.municipality && (
                      <Badge className="text-[9px] bg-green-500/20 text-green-400">{source.municipality}</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 truncate">
                    {source.url}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-edit-source-${idx}`}>
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <footer className="px-4 py-2 border-t border-border/30 text-[10px] text-muted-foreground">
        Showing {allSources.length} sources
      </footer>
    </div>
  );
}
