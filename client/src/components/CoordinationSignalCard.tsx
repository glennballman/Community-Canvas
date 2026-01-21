/**
 * Coordination Signal Card
 * 
 * Pre-incentive advisory display showing counts of similar work requests
 * in the same zone. Advisory only - no auto-actions, no persistence.
 * 
 * Privacy: Shows counts only, no titles/addresses/media unless viewer has access.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, AlertCircle, MapPin } from 'lucide-react';
import { useWorkRequestCoordination } from '@/hooks/useCoordination';
import { useTenant } from '@/contexts/TenantContext';

interface CoordinationSignalCardProps {
  workRequestId: string;
  portalId: string | null;
  zoneId: string | null;
}

export function CoordinationSignalCard({ 
  workRequestId, 
  portalId, 
  zoneId 
}: CoordinationSignalCardProps) {
  const [windowDays, setWindowDays] = useState(14);
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.tenant_id || null;

  const { data, isLoading } = useWorkRequestCoordination(
    workRequestId,
    windowDays,
    tenantId
  );

  if (!portalId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card data-testid="card-coordination-signal">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Coordination Signal
            </CardTitle>
            <Badge variant="outline" className="text-xs">advisory</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const similarCount = data?.totals?.similar_active_count || 0;
  const showNudge = similarCount >= 2;
  const isUnzoned = !zoneId;
  const unzonedCount = data?.totals?.unzoned_similar_count || 0;

  return (
    <Card data-testid="card-coordination-signal">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Coordination Signal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">advisory</Badge>
            <Select
              value={windowDays.toString()}
              onValueChange={(v) => setWindowDays(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[90px] h-7 text-xs" data-testid="select-window-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" data-testid="option-window-7">7 days</SelectItem>
                <SelectItem value="14" data-testid="option-window-14">14 days</SelectItem>
                <SelectItem value="30" data-testid="option-window-30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Similar requests in this zone:
          </span>
          <Badge 
            variant={similarCount > 0 ? 'default' : 'secondary'} 
            data-testid="text-similar-count"
          >
            {similarCount}
          </Badge>
        </div>

        {showNudge && (
          <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs text-primary" data-testid="text-coordination-nudge">
              Coordination can reduce travel overhead and shorten scheduling time.
            </p>
          </div>
        )}

        {isUnzoned && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-unzoned-nudge">
              Assign a zone to improve coordination.
            </p>
          </div>
        )}

        {!isUnzoned && unzonedCount > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {unzonedCount} similar unzoned request{unzonedCount !== 1 ? 's' : ''} could also coordinate.
            </span>
          </div>
        )}

        {data?.message && (
          <p className="text-xs text-muted-foreground" data-testid="text-coordination-message">
            {data.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
