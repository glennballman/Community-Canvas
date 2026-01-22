import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cloud, RefreshCw, AlertTriangle, CheckCircle, CloudRain, Wind } from 'lucide-react';

interface WeatherItem {
  id: string;
  title: string;
  summary: string | null;
  severity: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  warningType: string | null;
  source: string | null;
}

export default function CommandConsoleWeatherPage() {
  const [scope, setScope] = useState<'all' | 'bamfield'>('bamfield');

  const { data, isLoading, refetch, isFetching } = useQuery<{
    ok: boolean;
    scope: string;
    count: number;
    items: WeatherItem[];
    lastUpdated: string;
  }>({
    queryKey: [`/api/p2/platform/command-console/weather?scope=${scope}`],
  });

  function getWeatherIcon(warningType: string | null, severity: string | null) {
    if (severity?.toLowerCase() === 'critical' || severity?.toLowerCase() === 'major') {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (warningType?.toLowerCase().includes('wind')) {
      return <Wind className="h-4 w-4 text-yellow-500" />;
    }
    if (warningType?.toLowerCase().includes('rain') || warningType?.toLowerCase().includes('storm')) {
      return <CloudRain className="h-4 w-4 text-blue-500" />;
    }
    return <Cloud className="h-4 w-4 text-muted-foreground" />;
  }

  function getSeverityBadge(severity: string | null, warningType: string | null) {
    const label = warningType || severity || 'Advisory';
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'major':
        return <Badge variant="destructive">{label}</Badge>;
      case 'warning':
      case 'moderate':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-cc-weather">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6" />
            Weather
          </h1>
          <p className="text-muted-foreground">
            Environment Canada weather alerts and warnings
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
        <div className="text-center py-8 text-muted-foreground">Loading weather data...</div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-muted-foreground">
              {scope === 'bamfield' 
                ? 'No weather alerts affecting Bamfield area' 
                : 'No active weather alerts'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => (
            <Card key={item.id} data-testid={`card-weather-${item.id}`}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {getWeatherIcon(item.warningType, item.severity)}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {item.title}
                      </CardTitle>
                    </div>
                  </div>
                  {getSeverityBadge(item.severity, item.warningType)}
                </div>
              </CardHeader>
              {item.summary && (
                <CardContent className="py-2 px-4 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  {item.effectiveFrom && (
                    <p className="text-xs text-muted-foreground mt-1">
                      From: {new Date(item.effectiveFrom).toLocaleString()}
                      {item.effectiveUntil && ` — Until: ${new Date(item.effectiveUntil).toLocaleString()}`}
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
