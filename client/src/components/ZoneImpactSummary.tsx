/**
 * ZoneImpactSummary - Display zone pricing impact simulation
 * 
 * IMPORTANT: This is advisory/estimate-only output.
 * All results are "simulation" data, never implying actual charging.
 * Non-editable by contractor.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, DollarSign } from 'lucide-react';
import { ZoneBadge, ViewerContext } from './ZoneBadge';
import { 
  computeZonePricingEstimate, 
  formatModifierValue,
  ZonePricingModifiers,
  ZonePricingEstimate
} from '@shared/zonePricing';

interface Zone {
  id: string;
  key: string;
  name: string;
  badge_label_resident?: string | null;
  badge_label_contractor?: string | null;
  badge_label_visitor?: string | null;
  pricingModifiers?: ZonePricingModifiers | null;
}

interface ZoneImpactSummaryProps {
  zone: Zone | null;
  baseEstimate?: number;
  viewerContext?: ViewerContext;
  className?: string;
}

export function ZoneImpactSummary({ 
  zone, 
  baseEstimate = 0,
  viewerContext = 'resident',
  className = ''
}: ZoneImpactSummaryProps) {
  if (!zone) {
    return null;
  }

  const modifiers = zone.pricingModifiers || {};
  const hasModifiers = Object.keys(modifiers).some(k => {
    if (k === 'notes') return false;
    const v = modifiers[k as keyof ZonePricingModifiers];
    return typeof v === 'number' && v !== 0 && v !== 1;
  });

  if (!hasModifiers && !modifiers.notes) {
    return null;
  }

  const estimate: ZonePricingEstimate = computeZonePricingEstimate(baseEstimate, modifiers);

  return (
    <Card className={`${className}`} data-testid="card-zone-impact">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Zone Impact (simulation)
          <Badge variant="outline" className="text-xs ml-auto">
            <Info className="h-3 w-3 mr-1" />
            advisory only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Zone:</span>
          <ZoneBadge 
            zone={{
              id: zone.id,
              key: zone.key,
              name: zone.name,
              badge_label_resident: zone.badge_label_resident,
              badge_label_contractor: zone.badge_label_contractor,
              badge_label_visitor: zone.badge_label_visitor,
            }} 
            viewerContext={viewerContext}
          />
        </div>

        {baseEstimate > 0 && estimate.zone_modifier_breakdown.length > 0 && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base estimate:</span>
              <span>${estimate.base_estimate.toFixed(2)}</span>
            </div>

            {estimate.zone_modifier_breakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between pl-2 border-l-2 border-muted">
                <span className="text-muted-foreground">
                  {item.label} ({formatModifierValue(item.type, item.value)}):
                </span>
                <span className={item.effect >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}>
                  {item.effect >= 0 ? '+' : ''}${item.effect.toFixed(2)}
                </span>
              </div>
            ))}

            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Adjusted estimate:</span>
              <span>${estimate.final_estimate.toFixed(2)}</span>
            </div>
          </div>
        )}

        {!baseEstimate && hasModifiers && (
          <div className="space-y-1 text-sm">
            {modifiers.contractor_multiplier && modifiers.contractor_multiplier !== 1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contractor rate:</span>
                <Badge variant="secondary">{formatModifierValue('multiplier', modifiers.contractor_multiplier)}</Badge>
              </div>
            )}
            {modifiers.time_risk_multiplier && modifiers.time_risk_multiplier !== 1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time/risk factor:</span>
                <Badge variant="secondary">{formatModifierValue('multiplier', modifiers.time_risk_multiplier)}</Badge>
              </div>
            )}
            {modifiers.logistics_surcharge_flat && modifiers.logistics_surcharge_flat > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Logistics surcharge:</span>
                <Badge variant="secondary">{formatModifierValue('flat', modifiers.logistics_surcharge_flat)}</Badge>
              </div>
            )}
          </div>
        )}

        {estimate.notes.length > 0 && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            {estimate.notes.map((note, idx) => (
              <p key={idx}>{note}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ZoneImpactSummary;
