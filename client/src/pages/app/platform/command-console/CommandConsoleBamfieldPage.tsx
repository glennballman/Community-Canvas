import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle, Route, Ship, Cloud, Zap, Activity, ExternalLink } from 'lucide-react';

interface FeedSummary {
  count: number;
  items: Array<{
    id: string;
    title: string;
    summary: string | null;
    severity: string | null;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
  }>;
}

interface BamfieldSnapshot {
  ok: boolean;
  portal: { id: string; name: string; slug: string } | null;
  overallStatus: 'ok' | 'risky' | 'blocked';
  zones: Array<{ id: string; name: string; key: string }>;
  dependencyRules: Array<{
    id: string;
    zoneId: string;
    zoneName: string;
    feedType: string;
    source: string;
    severity: string;
  }>;
  feeds: {
    roads: FeedSummary;
    ferries: FeedSummary;
    weather: FeedSummary;
    hydro: FeedSummary;
    earthquakes: FeedSummary;
  };
  lastUpdated: string;
}

export default function CommandConsoleBamfieldPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<BamfieldSnapshot>({
    queryKey: ['/api/p2/platform/command-console/bamfield'],
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      case 'risky':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Risky</Badge>;
      default:
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">OK</Badge>;
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'blocked':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'risky':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  }

  const feedConfigs = [
    { key: 'roads', label: 'BC Roads', icon: Route, href: '/app/platform/command-console/roads' },
    { key: 'ferries', label: 'BC Ferries', icon: Ship, href: '/app/platform/command-console/ferries' },
    { key: 'weather', label: 'Weather', icon: Cloud, href: '/app/platform/command-console/weather' },
    { key: 'hydro', label: 'BC Hydro', icon: Zap, href: '/app/platform/command-console/hydro' },
    { key: 'earthquakes', label: 'Earthquakes', icon: Activity, href: '/app/platform/command-console/earthquakes' },
  ] as const;

  return (
    <div className="p-6 space-y-6" data-testid="page-cc-bamfield">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Bamfield Snapshot
          </h1>
          <p className="text-muted-foreground">
            Aggregated feed status for the Bamfield community portal
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.portal && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/p/${data.portal.slug}/calendar`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                View Portal
              </a>
            </Button>
          )}
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

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading Bamfield snapshot...</div>
      ) : !data?.portal ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
            <p className="text-muted-foreground">Bamfield portal not found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the Demo Seed button in the Debug Panel to create demo data
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(data.overallStatus)}
                  <div>
                    <CardTitle className="text-lg">{data.portal.name}</CardTitle>
                    <CardDescription>/p/{data.portal.slug}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Overall Status:</span>
                  {getStatusBadge(data.overallStatus)}
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedConfigs.map(({ key, label, icon: Icon, href }) => {
              const feed = data.feeds[key];
              return (
                <Card key={key} data-testid={`card-feed-${key}`}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">{label}</CardTitle>
                      </div>
                      <Badge variant={feed.count > 0 ? 'secondary' : 'outline'}>
                        {feed.count} alerts
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 px-4">
                    {feed.count === 0 ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        No active alerts
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {feed.items.slice(0, 2).map((item) => (
                          <p key={item.id} className="text-sm text-muted-foreground truncate">
                            {item.title}
                          </p>
                        ))}
                        {feed.count > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{feed.count - 2} more
                          </p>
                        )}
                      </div>
                    )}
                    <Link
                      to={href}
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                    >
                      View all
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {data.zones.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">Portal Zones</CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="flex flex-wrap gap-2">
                  {data.zones.map((zone) => (
                    <Badge key={zone.id} variant="outline">
                      {zone.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.dependencyRules.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">Dependency Rules</CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="space-y-2">
                  {data.dependencyRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between text-sm">
                      <span>
                        {rule.zoneName || 'All Zones'}: {rule.feedType}
                      </span>
                      <Badge
                        variant={rule.severity === 'critical' ? 'destructive' : 'secondary'}
                      >
                        {rule.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.lastUpdated && (
            <p className="text-xs text-muted-foreground text-right">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
