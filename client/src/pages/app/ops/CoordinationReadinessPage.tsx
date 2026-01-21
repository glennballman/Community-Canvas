/**
 * Coordination Readiness Dashboard
 * 
 * Admin/ops dashboard showing where coordination intent is accumulating.
 * Answers: "Which zones have the most coordination-ready work right now?"
 * 
 * All outputs are counts-only, privacy-safe.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { 
  useCoordinationReadiness, 
  useCoordinationReadinessBuckets,
  type CoordinationReadinessZone,
} from '@/hooks/useCoordination';
import { getZoneBadgeLabel } from '@/components/ZoneBadge';
import { 
  Users, 
  MapPin, 
  AlertCircle, 
  TrendingUp,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface Portal {
  id: string;
  name: string;
  slug: string;
}

interface Zone {
  id: string;
  key: string;
  name: string;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle,
  variant = 'default',
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType;
  subtitle?: string;
  variant?: 'default' | 'warning' | 'success';
}) {
  const variantStyles = {
    default: 'text-foreground',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className={`text-2xl font-semibold ${variantStyles[variant]}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneReadinessRow({ 
  zone,
  isSelected,
  onClick,
}: { 
  zone: CoordinationReadinessZone;
  isSelected: boolean;
  onClick: () => void;
}) {
  const zoneLabel = zone.zone_id 
    ? getZoneBadgeLabel({
        id: zone.zone_id,
        key: zone.zone_key || '',
        name: zone.zone_name || '',
        badge_label_resident: zone.badge_label_resident,
        badge_label_contractor: zone.badge_label_contractor,
        badge_label_visitor: zone.badge_label_visitor,
      }, 'resident')
    : 'Unzoned';

  const ratioPercent = Math.round(zone.coord_ready_ratio * 100);

  return (
    <TableRow 
      className={`cursor-pointer hover-elevate ${isSelected ? 'bg-accent' : ''}`}
      onClick={onClick}
      data-testid={`row-zone-${zone.zone_id || 'unzoned'}`}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {zone.zone_id ? (
            <Badge variant="secondary" data-testid={`badge-zone-${zone.zone_key}`}>
              {zoneLabel}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-dashed" data-testid="badge-zone-unzoned">
              Unzoned
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="font-medium">{zone.coord_ready_count}</span>
        <span className="text-muted-foreground"> / {zone.active_count}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress value={ratioPercent} className="h-2 flex-1" />
          <Badge 
            variant={ratioPercent >= 50 ? 'default' : 'secondary'}
            className="tabular-nums"
          >
            {ratioPercent}%
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatRelativeTime(zone.last_activity_at)}
      </TableCell>
      <TableCell className="text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

function CategoryBucketsPanel({
  portalId,
  zoneId,
  zoneName,
  windowDays,
  isUnzoned = false,
}: {
  portalId: string;
  zoneId: string | null;
  zoneName: string;
  windowDays: number;
  isUnzoned?: boolean;
}) {
  const { data, isLoading } = useCoordinationReadinessBuckets(
    portalId,
    isUnzoned ? 'none' : zoneId,
    windowDays,
    10
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Top Categories in {zoneName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.buckets?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Top Categories in {zoneName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active work requests in this zone within the selected window.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Top Categories in {zoneName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.buckets.map((bucket) => {
            const ratioPercent = Math.round(bucket.coord_ready_ratio * 100);
            return (
              <div key={bucket.category} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bucket.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {bucket.coord_ready_count} ready of {bucket.active_count} active
                  </p>
                </div>
                <Badge variant={ratioPercent >= 50 ? 'default' : 'secondary'}>
                  {ratioPercent}%
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoordinationReadinessPage() {
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<CoordinationReadinessZone | null>(null);
  const [windowDays, setWindowDays] = useState(14);

  const { data: portalsData, isLoading: portalsLoading } = useQuery<{ portals: Portal[] }>({
    queryKey: ['/api/portals'],
  });
  const portals = portalsData?.portals || [];

  const { data: readinessData, isLoading: readinessLoading } = useCoordinationReadiness(
    selectedPortalId,
    null,
    windowDays
  );

  if (portalsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const selectedZoneLabel = selectedZone
    ? (selectedZone.zone_id
        ? getZoneBadgeLabel({
            id: selectedZone.zone_id,
            key: selectedZone.zone_key || '',
            name: selectedZone.zone_name || '',
            badge_label_resident: selectedZone.badge_label_resident,
          }, 'resident')
        : 'Unzoned')
    : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Coordination Readiness</h1>
          <p className="text-muted-foreground">
            Zones with the most coordination-ready work requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedPortalId || ''}
            onValueChange={(v) => {
              setSelectedPortalId(v || null);
              setSelectedZone(null);
            }}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-portal">
              <SelectValue placeholder="Select portal..." />
            </SelectTrigger>
            <SelectContent>
              {portals.map((portal) => (
                <SelectItem key={portal.id} value={portal.id}>
                  {portal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={windowDays.toString()}
            onValueChange={(v) => setWindowDays(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[120px]" data-testid="select-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedPortalId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Select a portal to view coordination readiness</p>
            <p className="text-muted-foreground">
              Choose a portal from the dropdown above to see zone-level coordination data.
            </p>
          </CardContent>
        </Card>
      ) : readinessLoading ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Total Active"
              value={readinessData?.rollups.total_active || 0}
              icon={Users}
              subtitle={`In last ${windowDays} days`}
            />
            <KpiCard
              title="Coordination Ready"
              value={readinessData?.rollups.total_coord_ready || 0}
              icon={TrendingUp}
              variant="success"
              subtitle="Opted in for coordination"
            />
            <KpiCard
              title="Ready Ratio"
              value={`${readinessData?.rollups.total_active 
                ? Math.round((readinessData.rollups.total_coord_ready / readinessData.rollups.total_active) * 100) 
                : 0}%`}
              icon={TrendingUp}
            />
            <KpiCard
              title="Unzoned Ready"
              value={readinessData?.rollups.unzoned_coord_ready || 0}
              icon={AlertCircle}
              variant={readinessData?.rollups.unzoned_coord_ready ? 'warning' : 'default'}
              subtitle="Operational debt"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Coordination Readiness by Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!readinessData?.zones?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    No active work requests in the selected window.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zone</TableHead>
                        <TableHead className="text-right">Ready / Active</TableHead>
                        <TableHead>Readiness</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {readinessData.zones.map((zone) => (
                        <ZoneReadinessRow
                          key={zone.zone_id || 'unzoned'}
                          zone={zone}
                          isSelected={selectedZone?.zone_id === zone.zone_id}
                          onClick={() => setSelectedZone(
                            selectedZone?.zone_id === zone.zone_id ? null : zone
                          )}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selectedZone ? (
                <CategoryBucketsPanel
                  portalId={selectedPortalId}
                  zoneId={selectedZone.zone_id}
                  zoneName={selectedZoneLabel || 'Selected Zone'}
                  windowDays={windowDays}
                  isUnzoned={!selectedZone.zone_id}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Click a zone row to see top coordination-ready categories.
                    </p>
                  </CardContent>
                </Card>
              )}

              {!selectedZone && selectedPortalId && (
                <CategoryBucketsPanel
                  portalId={selectedPortalId}
                  zoneId={null}
                  zoneName="All Zones"
                  windowDays={windowDays}
                  isUnzoned={false}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
