/**
 * N3 Service Run Attention Page
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Shows all service runs requiring attention with open replan bundles
 * Features: Portal/Zone filtering, Zone-aware grouping
 */

import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, AlertTriangle, MapPin, AlertCircle } from 'lucide-react';
import { 
  useN3Attention, 
  useN3DismissBundle, 
  useN3Status, 
  useN3Filters,
  type AttentionBundleWithZone,
  type N3FilterZone,
} from '@/hooks/n3/useN3';
import { AttentionQueueTable } from '@/components/n3/AttentionQueueTable';
import { useToast } from '@/hooks/use-toast';
import { getZoneBadgeLabel } from '@/components/ZoneBadge';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface ZoneLike {
  id: string;
  key: string;
  name: string;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
}

interface ZoneGroup {
  key: string;
  label: string;
  zoneId: string | null;
  bundles: AttentionBundleWithZone[];
}

function getZoneGroupLabel(bundle: AttentionBundleWithZone): string {
  if (!bundle.zone_id) return 'Unzoned';
  
  const zoneLike: ZoneLike = {
    id: bundle.zone_id,
    key: bundle.zone_key || 'unknown',
    name: bundle.zone_name || 'Unknown Zone',
    badge_label_resident: bundle.badge_label_resident,
    badge_label_contractor: bundle.badge_label_contractor,
    badge_label_visitor: bundle.badge_label_visitor,
  };
  
  return getZoneBadgeLabel(zoneLike, 'resident');
}

function groupBundlesByZone(bundles: AttentionBundleWithZone[]): ZoneGroup[] {
  const groups = new Map<string, ZoneGroup>();
  
  for (const bundle of bundles) {
    const groupKey = bundle.zone_id ? `zone:${bundle.zone_id}` : 'zone:none';
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        label: getZoneGroupLabel(bundle),
        zoneId: bundle.zone_id,
        bundles: [],
      });
    }
    
    groups.get(groupKey)!.bundles.push(bundle);
  }
  
  const result = Array.from(groups.values());
  result.sort((a, b) => {
    if (a.zoneId === null && b.zoneId !== null) return 1;
    if (a.zoneId !== null && b.zoneId === null) return -1;
    return a.label.localeCompare(b.label);
  });
  
  return result;
}

export default function ServiceRunAttentionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  
  const { data: filtersData } = useN3Filters(TEST_TENANT_ID, selectedPortalId);
  
  const filters = useMemo(() => ({
    portalId: selectedPortalId,
    zoneId: selectedZoneId,
  }), [selectedPortalId, selectedZoneId]);
  
  const { 
    data: attentionData, 
    isLoading,
    refetch,
    isRefetching 
  } = useN3Attention(TEST_TENANT_ID, filters);
  
  const { data: status } = useN3Status();
  const dismissMutation = useN3DismissBundle(TEST_TENANT_ID);

  const zoneGroups = useMemo(() => {
    if (!attentionData?.bundles) return [];
    return groupBundlesByZone(attentionData.bundles);
  }, [attentionData?.bundles]);

  const unzonedCount = useMemo(() => {
    return attentionData?.bundles?.filter(b => !b.zone_id).length || 0;
  }, [attentionData?.bundles]);

  const zonesForPortal = useMemo(() => {
    if (!filtersData?.zones) return [];
    if (!selectedPortalId) return filtersData.zones;
    return filtersData.zones.filter(z => z.portal_id === selectedPortalId);
  }, [filtersData?.zones, selectedPortalId]);

  const handlePortalChange = (value: string) => {
    if (value === 'all') {
      setSelectedPortalId(null);
    } else {
      setSelectedPortalId(value);
    }
    setSelectedZoneId(null);
  };

  const handleZoneChange = (value: string) => {
    if (value === 'all') {
      setSelectedZoneId(null);
    } else if (value === 'none') {
      setSelectedZoneId('none');
    } else {
      setSelectedZoneId(value);
    }
  };

  const handleView = (bundleId: string, runId: string) => {
    setLocation(`/app/n3/monitor/${runId}?bundle=${bundleId}`);
  };

  const handleDismiss = async (bundleId: string) => {
    try {
      await dismissMutation.mutateAsync({ bundleId });
      toast({
        title: 'Bundle dismissed',
        description: 'The replan bundle has been dismissed.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to dismiss bundle.',
        variant: 'destructive',
      });
    }
  };

  const getZoneLabel = (zone: N3FilterZone) => {
    const zoneLike: ZoneLike = {
      id: zone.id,
      key: zone.key,
      name: zone.name,
      badge_label_resident: zone.badge_label_resident,
      badge_label_contractor: zone.badge_label_contractor,
      badge_label_visitor: zone.badge_label_visitor,
    };
    return getZoneBadgeLabel(zoneLike, 'resident');
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Service Run Attention Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and address risk conditions for upcoming service runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={status.isEnabled ? 'default' : 'secondary'}>
              Monitor: {status.isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-attention"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg">Filters</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedPortalId || 'all'}
                onValueChange={handlePortalChange}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-portal-filter">
                  <SelectValue placeholder="All portals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-portal-all">All portals</SelectItem>
                  {filtersData?.portals?.map(portal => (
                    <SelectItem 
                      key={portal.id} 
                      value={portal.id}
                      data-testid={`option-portal-${portal.id}`}
                    >
                      {portal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedZoneId || 'all'}
                onValueChange={handleZoneChange}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-zone-filter">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-zone-all">All zones</SelectItem>
                  <SelectItem value="none" data-testid="option-zone-unzoned">Unzoned</SelectItem>
                  {zonesForPortal.map(zone => (
                    <SelectItem 
                      key={zone.id} 
                      value={zone.id}
                      data-testid={`option-zone-${zone.id}`}
                    >
                      {getZoneLabel(zone)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {unzonedCount > 0 && !selectedZoneId && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                {unzonedCount} run{unzonedCount !== 1 ? 's' : ''} need zone assignment for better logistics and estimate accuracy.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {zoneGroups.map(group => (
        <Card key={group.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{group.label}</span>
              </div>
              <Badge variant="outline">
                {group.bundles.filter(b => b.status === 'open').length} requiring action
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AttentionQueueTable
              bundles={group.bundles}
              isLoading={isLoading}
              onView={handleView}
              onDismiss={handleDismiss}
            />
          </CardContent>
        </Card>
      ))}

      {!isLoading && zoneGroups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No attention bundles found{selectedPortalId || selectedZoneId ? ' matching your filters' : ''}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
