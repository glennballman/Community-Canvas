import { Link } from "wouter";
import { 
  Grid3X3, 
  Database, 
  Activity,
  TrendingUp,
  Globe,
  Clock,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROVINCIAL_SOURCES, REGIONAL_SOURCES, MUNICIPAL_SOURCES, ALL_MUNICIPALITIES } from "@shared/sources";

export default function AdminHome() {
  const totalProvincialSources = PROVINCIAL_SOURCES.length;
  const totalRegionalSources = Object.values(REGIONAL_SOURCES).reduce(
    (acc, sources) => acc + sources.length, 0
  );
  const totalMunicipalSources = Object.values(MUNICIPAL_SOURCES).reduce(
    (acc, sources) => acc + sources.length, 0
  );
  const totalSharedSources = totalProvincialSources + totalRegionalSources;
  const totalSources = totalSharedSources + totalMunicipalSources;
  const totalMunicipalities = ALL_MUNICIPALITIES.length;
  
  const categoryCounts: Record<string, number> = {};
  PROVINCIAL_SOURCES.forEach(s => {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
  });
  Object.values(REGIONAL_SOURCES).forEach(sources => {
    sources.forEach(s => {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    });
  });
  Object.values(MUNICIPAL_SOURCES).forEach(sources => {
    sources.forEach(s => {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    });
  });
  const totalCategories = Object.keys(categoryCounts).length;

  return (
    <div className="h-full overflow-auto p-6 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-foreground">ADMIN OVERVIEW</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage data sources for BC Community Status Dashboard
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <Clock className="w-3 h-3 mr-1" />
            {new Date().toLocaleDateString()}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Database className="w-3 h-3" />
                TOTAL SOURCES
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="stat-total-sources">{totalSources}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {totalSharedSources} shared + {totalMunicipalSources} municipal
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Globe className="w-3 h-3" />
                MUNICIPALITIES
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="stat-municipalities">{totalMunicipalities}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                BC jurisdictions tracked
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Grid3X3 className="w-3 h-3" />
                CATEGORIES
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="stat-categories">{totalCategories}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Data categories active
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Activity className="w-3 h-3" />
                SYSTEM STATUS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-lg font-bold text-green-400" data-testid="stat-system-status">ONLINE</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                All services operational
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/admin/matrix">
            <Card className="bg-card/50 hover-elevate cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center">
                      <Grid3X3 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wide">SOURCE MATRIX</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        View coverage grid of all sources across municipalities and categories
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">{totalCategories} categories</Badge>
                  <Badge variant="secondary" className="text-[10px]">{totalMunicipalities} municipalities</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/sources">
            <Card className="bg-card/50 hover-elevate cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-blue-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wide">MANAGE SOURCES</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add, edit, or remove data sources and configure scraping settings
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">{totalSharedSources} shared</Badge>
                  <Badge variant="secondary" className="text-[10px]">{totalMunicipalSources} municipal</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              CATEGORY BREAKDOWN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <div key={category} className="bg-background/50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-foreground">{count}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{category}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
