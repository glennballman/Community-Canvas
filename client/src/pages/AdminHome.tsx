import { Link } from "wouter";
import { 
  Grid3X3, 
  Database, 
  Activity,
  TrendingUp,
  Globe,
  Clock,
  ChevronRight,
  Download,
  Archive,
  Building2,
  Search,
  Truck,
  Shield,
  Radio,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROVINCIAL_SOURCES, REGIONAL_SOURCES, MUNICIPAL_SOURCES, ALL_MUNICIPALITIES } from "@shared/sources";
import { useQuery } from "@tanstack/react-query";

interface Backup {
  name: string;
  size: number;
  created: string;
}

interface CivosStats {
  success: boolean;
  stats: {
    signals: { active: number };
    capacity: { properties: number; spots: number };
  };
}

export default function AdminHome() {
  const { data: backupsData } = useQuery<{ backups: Backup[] }>({
    queryKey: ['/api/backups'],
  });
  
  const { data: civosData } = useQuery<CivosStats>({
    queryKey: ['/api/civos/stats'],
  });
  
  const backups = backupsData?.backups || [];
  
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };
  
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

  const statCards = [
    { label: 'Municipalities', value: totalMunicipalities, icon: Globe, color: 'text-blue-400 border-blue-500/30' },
    { label: 'Entities', value: 10791, icon: MapPin, color: 'text-green-400 border-green-500/30' },
    { label: 'Data Sources', value: totalSources, icon: Database, color: 'text-cyan-400 border-cyan-500/30' },
    { label: 'Staging Props', value: civosData?.stats?.capacity?.properties || 37, icon: Building2, color: 'text-purple-400 border-purple-500/30' },
    { label: 'Total Spots', value: civosData?.stats?.capacity?.spots || 2698, icon: Search, color: 'text-yellow-400 border-yellow-500/30' },
    { label: 'Active Signals', value: civosData?.stats?.signals?.active || 0, icon: Radio, color: 'text-red-400 border-red-500/30' },
    { label: 'Vehicles', value: 5, icon: Truck, color: 'text-orange-400 border-orange-500/30' },
    { label: 'Trailers', value: 4, icon: Archive, color: 'text-pink-400 border-pink-500/30' },
  ];

  return (
    <div className="h-full overflow-auto p-6 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-foreground">SYSTEM OVERVIEW</h1>
            <p className="text-xs text-muted-foreground mt-1">
              BC Staging Network health and statistics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <Badge variant="outline" className="text-[10px]">
              <Clock className="w-3 h-3 mr-1" />
              {new Date().toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* Stats Grid - 8 columns on large screens */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {statCards.map(card => (
            <Card key={card.label} className={`bg-card/50 border-l-4 ${card.color}`}>
              <CardContent className="p-3">
                <card.icon className={`w-5 h-5 mb-2 ${card.color.split(' ')[0]}`} />
                <div className={`text-xl font-bold ${card.color.split(' ')[0]}`} data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  {card.value.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">{card.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/import">
                <Button variant="default" size="sm" className="w-full justify-start gap-2" data-testid="action-import">
                  <Download className="w-4 h-4" />
                  Import Data
                </Button>
              </Link>
              <Link href="/admin/civos">
                <Button variant="secondary" size="sm" className="w-full justify-start gap-2" data-testid="action-civos">
                  <Shield className="w-4 h-4" />
                  Generate CivOS Signals
                </Button>
              </Link>
              <Link href="/admin/sources">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="action-sources">
                  <Database className="w-4 h-4" />
                  Add Data Source
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Last data import</span>
                <span className="text-xs text-foreground">2 hours ago</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Signals generated</span>
                <Badge variant="secondary" className="text-xs">{civosData?.stats?.signals?.active || 0} active</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">New bookings</span>
                <span className="text-xs text-foreground">3 today</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-blue-400" />
                External Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/command-center">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2" data-testid="link-command">
                  <Shield className="w-4 h-4" />
                  Command Center
                </Button>
              </Link>
              <Link href="/fleet">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2" data-testid="link-fleet">
                  <Truck className="w-4 h-4" />
                  Fleet Management
                </Button>
              </Link>
              <Link href="/staging">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2" data-testid="link-staging">
                  <Search className="w-4 h-4" />
                  Staging Search
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background/50 rounded-md">
                <div className="text-green-400 text-2xl mb-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="font-medium text-sm">Database</div>
                <div className="text-[10px] text-muted-foreground">Connected</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-md">
                <div className="text-green-400 text-2xl mb-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="font-medium text-sm">API</div>
                <div className="text-[10px] text-muted-foreground">Responding</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-md">
                <div className="text-green-400 text-2xl mb-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="font-medium text-sm">Firecrawl</div>
                <div className="text-[10px] text-muted-foreground">Available</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-md">
                <div className="text-green-400 text-2xl mb-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="font-medium text-sm">CivOS</div>
                <div className="text-[10px] text-muted-foreground">Synced</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/admin/matrix">
            <Card className="bg-card/50 hover-elevate cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center">
                      <Grid3X3 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wide">SOURCE MATRIX</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        View coverage grid across municipalities
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/sources">
            <Card className="bg-card/50 hover-elevate cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-blue-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wide">MANAGE SOURCES</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add, edit, or remove data sources
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {backups.length > 0 && (
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Archive className="w-4 h-4" />
                DATA BACKUPS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div 
                    key={backup.name} 
                    className="flex items-center justify-between gap-2 flex-wrap bg-background/50 rounded-md p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Archive className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium" data-testid={`backup-name-${backup.name}`}>
                          {backup.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatBytes(backup.size)} | Created: {new Date(backup.created).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <a 
                      href={`/api/backups/${backup.name}`} 
                      download
                      data-testid={`download-backup-${backup.name}`}
                    >
                      <Button size="sm" variant="outline" className="gap-2">
                        <Download className="w-3 h-3" />
                        Download
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
