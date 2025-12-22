import { FileText, RefreshCw, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AdminLogs() {
  const mockLogs = [
    { id: 1, timestamp: new Date().toISOString(), type: "info", message: "System initialized", source: "System" },
    { id: 2, timestamp: new Date(Date.now() - 60000).toISOString(), type: "success", message: "Scraped BC Hydro outages successfully", source: "Firecrawl" },
    { id: 3, timestamp: new Date(Date.now() - 120000).toISOString(), type: "warning", message: "Rate limit approaching for BC Ferries API", source: "API" },
  ];

  return (
    <div className="h-full flex flex-col font-mono">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border/50 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-violet-400" />
          <h1 className="text-sm font-semibold uppercase tracking-wider">Scrape Logs</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-refresh-logs">
          <RefreshCw className="w-3 h-3" />
          REFRESH
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {mockLogs.map(log => (
            <Card key={log.id} className="bg-card/50">
              <CardContent className="p-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-[9px] ${
                    log.type === "success" ? "text-green-400 border-green-400/30" :
                    log.type === "warning" ? "text-yellow-400 border-yellow-400/30" :
                    log.type === "error" ? "text-red-400 border-red-400/30" :
                    "text-blue-400 border-blue-400/30"
                  }`}
                >
                  {log.type.toUpperCase()}
                </Badge>
                <span className="text-xs flex-1">{log.message}</span>
                <Badge variant="secondary" className="text-[9px]">{log.source}</Badge>
              </CardContent>
            </Card>
          ))}
          
          <div className="text-center py-8 text-muted-foreground text-xs">
            Log history will be populated when scraping is active
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
