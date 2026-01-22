import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Route, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface RoadItem {
  id: string;
  title: string;
  summary: string | null;
  severity: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  location: string | null;
  source: string | null;
}

export default function CommandConsoleRoadsPage() {
  const [scope, setScope] = useState<'all' | 'bamfield'>('bamfield');

  const { data, isLoading, refetch, isFetching } = useQuery<{
    ok: boolean;
    scope: string;
    count: number;
    items: RoadItem[];
    lastUpdated: string;
  }>({
    queryKey: ['/api/p2/platform/command-console/roads', scope],
    queryFn: async () => {
      const res = await fetch(`/api/p2/platform/command-console/roads?scope=${scope}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch road data');
      return res.json();
    },
  });

  function getSeverityIcon(severity: string | null) {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'major':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
      case 'moderate':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function getSeverityBadge(severity: string | null) {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'major':
        return <Badge variant="destructive">{severity}</Badge>;
      case 'warning':
      case 'moderate':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">{severity}</Badge>;
      default:
        return <Badge variant="secondary">{severity || 'Info'}</Badge>;
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-cc-roads">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6" />
            BC Roads (DriveBC)
          </h1>
          <p className="text-muted-foreground">
            Real-time road conditions and closures from DriveBC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={scope === 'bamfield' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setScope('bamfield')}
              data-testid="button-scope-bamfield"
            >
              Bamfield
            </Button>
            <Button
              variant={scope === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setScope('all')}
              data-testid="button-scope-all"
            >
              All BC
            </Button>
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
      </div>

      {data?.lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading road data...</div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-muted-foreground">
              {scope === 'bamfield' 
                ? 'No road events affecting Bamfield area' 
                : 'No active road events'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => (
            <Card key={item.id} data-testid={`card-road-${item.id}`}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {getSeverityIcon(item.severity)}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {item.title}
                      </CardTitle>
                      {item.location && (
                        <p className="text-xs text-muted-foreground">{item.location}</p>
                      )}
                    </div>
                  </div>
                  {getSeverityBadge(item.severity)}
                </div>
              </CardHeader>
              {item.summary && (
                <CardContent className="py-2 px-4 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  {item.effectiveFrom && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Since: {new Date(item.effectiveFrom).toLocaleDateString()}
                      {item.effectiveUntil && ` — Until: ${new Date(item.effectiveUntil).toLocaleDateString()}`}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
