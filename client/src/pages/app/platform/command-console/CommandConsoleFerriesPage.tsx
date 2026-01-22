import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ship, RefreshCw, AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react';

interface FerryItem {
  id: string;
  title: string;
  summary: string | null;
  severity: string | null;
  alertType: string | null;
  delayMinutes: number | null;
  affectedDate: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  source: string | null;
}

export default function CommandConsoleFerriesPage() {
  const [scope, setScope] = useState<'all' | 'bamfield'>('bamfield');

  const { data, isLoading, refetch, isFetching } = useQuery<{
    ok: boolean;
    scope: string;
    count: number;
    items: FerryItem[];
    lastUpdated: string;
  }>({
    queryKey: ['/api/p2/platform/command-console/ferries', scope],
    queryFn: async () => {
      const res = await fetch(`/api/p2/platform/command-console/ferries?scope=${scope}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch ferry data');
      return res.json();
    },
  });

  function getAlertIcon(alertType: string | null, severity: string | null) {
    if (alertType === 'cancellation' || severity?.toLowerCase() === 'critical') {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (alertType === 'delay' || severity?.toLowerCase() === 'warning') {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    return <Info className="h-4 w-4 text-muted-foreground" />;
  }

  function getAlertBadge(alertType: string | null, delayMinutes: number | null) {
    if (alertType === 'cancellation') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (delayMinutes && delayMinutes > 0) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">{delayMinutes}min delay</Badge>;
    }
    if (alertType) {
      return <Badge variant="secondary">{alertType}</Badge>;
    }
    return null;
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-cc-ferries">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="h-6 w-6" />
            BC Ferries
          </h1>
          <p className="text-muted-foreground">
            Ferry schedules, delays, and cancellations
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
        <div className="text-center py-8 text-muted-foreground">Loading ferry data...</div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-muted-foreground">
              {scope === 'bamfield' 
                ? 'No ferry alerts affecting Bamfield area' 
                : 'No active ferry alerts'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => (
            <Card key={item.id} data-testid={`card-ferry-${item.id}`}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {getAlertIcon(item.alertType, item.severity)}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {item.title}
                      </CardTitle>
                    </div>
                  </div>
                  {getAlertBadge(item.alertType, item.delayMinutes)}
                </div>
              </CardHeader>
              {item.summary && (
                <CardContent className="py-2 px-4 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  {item.affectedDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Affected: {new Date(item.affectedDate).toLocaleDateString()}
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
