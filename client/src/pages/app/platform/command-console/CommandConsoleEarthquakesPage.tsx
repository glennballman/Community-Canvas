import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface EarthquakeItem {
  id: string;
  title: string;
  summary: string | null;
  severity: string | null;
  magnitude: number | null;
  depth: number | null;
  effectiveFrom: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
}

export default function CommandConsoleEarthquakesPage() {
  const [scope, setScope] = useState<'all' | 'bamfield'>('bamfield');

  const { data, isLoading, refetch, isFetching } = useQuery<{
    ok: boolean;
    scope: string;
    count: number;
    items: EarthquakeItem[];
    lastUpdated: string;
  }>({
    queryKey: [`/api/p2/platform/command-console/earthquakes?scope=${scope}`],
  });

  function getMagnitudeIcon(magnitude: number | null) {
    if (magnitude && magnitude >= 5.0) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (magnitude && magnitude >= 3.0) {
      return <Activity className="h-4 w-4 text-yellow-500" />;
    }
    return <Info className="h-4 w-4 text-muted-foreground" />;
  }

  function getMagnitudeBadge(magnitude: number | null) {
    if (!magnitude) return <Badge variant="secondary">Unknown</Badge>;
    if (magnitude >= 5.0) {
      return <Badge variant="destructive">M{magnitude.toFixed(1)}</Badge>;
    }
    if (magnitude >= 3.0) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">M{magnitude.toFixed(1)}</Badge>;
    }
    return <Badge variant="secondary">M{magnitude.toFixed(1)}</Badge>;
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-cc-earthquakes">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Earthquakes
          </h1>
          <p className="text-muted-foreground">
            Recent seismic activity from Earthquakes Canada
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
        <div className="text-center py-8 text-muted-foreground">Loading earthquake data...</div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-muted-foreground">
              {scope === 'bamfield' 
                ? 'No recent seismic activity near Bamfield' 
                : 'No recent seismic activity'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => (
            <Card key={item.id} data-testid={`card-earthquake-${item.id}`}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {getMagnitudeIcon(item.magnitude)}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {item.title}
                      </CardTitle>
                      {item.depth && (
                        <p className="text-xs text-muted-foreground">
                          Depth: {item.depth.toFixed(1)} km
                        </p>
                      )}
                    </div>
                  </div>
                  {getMagnitudeBadge(item.magnitude)}
                </div>
              </CardHeader>
              {(item.summary || item.effectiveFrom) && (
                <CardContent className="py-2 px-4 pt-0">
                  {item.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  )}
                  {item.effectiveFrom && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Time: {new Date(item.effectiveFrom).toLocaleString()}
                    </p>
                  )}
                  {item.latitude && item.longitude && (
                    <p className="text-xs text-muted-foreground">
                      Location: {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
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
