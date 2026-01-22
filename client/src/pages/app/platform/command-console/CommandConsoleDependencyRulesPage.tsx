import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, AlertTriangle, Info, Ship, Route, Cloud, Zap, Plane } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DependencyRuleItem {
  id: string;
  portalId: string;
  portalName: string | null;
  portalSlug: string | null;
  dependencyType: string;
  rulePayload: {
    zoneId?: string;
    source?: string;
    severity?: string;
  } | null;
  createdAt: string;
}

export default function CommandConsoleDependencyRulesPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    ok: boolean;
    count: number;
    items: DependencyRuleItem[];
  }>({
    queryKey: ['/api/p2/platform/command-console/dependency-rules'],
  });

  function getFeedTypeIcon(feedType: string) {
    switch (feedType.toLowerCase()) {
      case 'ferry':
        return <Ship className="h-4 w-4" />;
      case 'road':
      case 'highway':
        return <Route className="h-4 w-4" />;
      case 'weather':
        return <Cloud className="h-4 w-4" />;
      case 'hydro':
      case 'power':
        return <Zap className="h-4 w-4" />;
      case 'seaplane':
        return <Plane className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warn':
      case 'warning':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-cc-dependency-rules">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Dependency Rules
          </h1>
          <p className="text-muted-foreground">
            Portal zone dependency rules for calendar feasibility overlays
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading dependency rules...</div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No dependency rules configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Dependency rules map feed data to portal zones for feasibility overlays
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Portal</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Feed Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((rule) => (
                  <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                    <TableCell>
                      <div className="font-medium">{rule.portalName || 'Unknown'}</div>
                      {rule.portalSlug && (
                        <div className="text-xs text-muted-foreground">/p/{rule.portalSlug}</div>
                      )}
                    </TableCell>
                    <TableCell>{rule.rulePayload?.zoneId ? rule.rulePayload.zoneId.slice(0, 8) + '...' : 'All Zones'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFeedTypeIcon(rule.dependencyType)}
                        <span className="capitalize">{rule.dependencyType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rule.rulePayload?.source || '—'}</TableCell>
                    <TableCell>{getSeverityBadge(rule.rulePayload?.severity || 'info')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
