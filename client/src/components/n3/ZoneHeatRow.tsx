/**
 * ZoneHeatRow Component
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Displays a zone's heat metrics with density bar visualization.
 * Uses Prompt 14 label logic (getZoneBadgeLabel) for zone display.
 */

import { Badge } from '@/components/ui/badge';
import { getZoneBadgeLabel } from '@/components/ZoneBadge';

interface ZoneLike {
  id: string;
  key: string;
  name: string;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
}

export interface ZoneHeatRowProps {
  zone: {
    zone_id: string | null;
    zone_key: string | null;
    zone_name: string | null;
    badge_label_resident: string | null;
    badge_label_contractor: string | null;
    badge_label_visitor: string | null;
  } | null;
  count: number;
  maxCount: number;
  label?: 'runs' | 'attention';
}

export function ZoneHeatRow({ zone, count, maxCount, label = 'attention' }: ZoneHeatRowProps) {
  const isUnzoned = !zone?.zone_id;
  
  const displayLabel = isUnzoned 
    ? 'Unzoned' 
    : getZoneBadgeLabel(
        {
          id: zone!.zone_id!,
          key: zone!.zone_key || 'unknown',
          name: zone!.zone_name || 'Unknown',
          badge_label_resident: zone!.badge_label_resident,
          badge_label_contractor: zone!.badge_label_contractor,
          badge_label_visitor: zone!.badge_label_visitor,
        } as ZoneLike,
        'resident'
      );

  const percentage = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div 
      className="flex items-center gap-3 py-2"
      data-testid={`zone-heat-row-${zone?.zone_id || 'unzoned'}`}
    >
      <div className="flex-shrink-0 w-28">
        <Badge 
          variant={isUnzoned ? 'secondary' : 'outline'}
          className={isUnzoned ? 'text-amber-600 dark:text-amber-400 border-amber-500/50' : ''}
        >
          {displayLabel}
        </Badge>
      </div>
      
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            isUnzoned 
              ? 'bg-amber-500' 
              : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex-shrink-0 w-20 text-right">
        <span className="text-sm font-medium">{count}</span>
        <span className="text-xs text-muted-foreground ml-1">
          {label === 'attention' ? 'attn' : 'runs'}
        </span>
      </div>
    </div>
  );
}
