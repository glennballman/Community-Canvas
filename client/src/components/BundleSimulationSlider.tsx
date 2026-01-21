/**
 * BundleSimulationSlider - "What If I Bundle?" Simulation
 * 
 * IMPORTANT: This is a PURE UI SIMULATION component.
 * - No DB persistence
 * - No new "bundle" entities created
 * - No side effects on Work Request save payload
 * - Savings model is based on travel-cost amortization ASSUMPTION
 * 
 * Designed to feed future Service Run bundling system.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Info, Users, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import {
  simulateBundling,
  ZonePricingModifiers,
  BundleSimulationResult,
} from '@shared/zonePricing';

interface BundleSimulationSliderProps {
  baseEstimate: number | null;
  zoneModifiers?: ZonePricingModifiers | null;
  className?: string;
}

export function BundleSimulationSlider({
  baseEstimate,
  zoneModifiers,
  className = '',
}: BundleSimulationSliderProps) {
  const [bundleSize, setBundleSize] = useState(1);

  const hasEstimate = typeof baseEstimate === 'number' && baseEstimate > 0;

  const simulation: BundleSimulationResult | null = useMemo(() => {
    if (!hasEstimate) return null;
    return simulateBundling({
      baseEstimate: baseEstimate!,
      zoneModifiers,
      bundleSize,
    });
  }, [baseEstimate, zoneModifiers, bundleSize, hasEstimate]);

  const showSavings = bundleSize > 1 && hasEstimate && simulation !== null;

  return (
    <Card className={className} data-testid="card-bundle-simulation">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          What If I Bundle?
          <Badge variant="outline" className="text-xs ml-auto">
            <Info className="h-3 w-3 mr-1" />
            simulation only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">If I bundle similar requests:</span>
            <Badge variant="secondary" data-testid="badge-bundle-size">
              {bundleSize} request{bundleSize !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Slider
            value={[bundleSize]}
            onValueChange={(value) => setBundleSize(value[0])}
            min={1}
            max={10}
            step={1}
            className="w-full"
            data-testid="slider-bundle-size"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {!hasEstimate && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Add an estimate to see bundle savings simulation.</span>
          </div>
        )}

        {showSavings && simulation && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 p-3 rounded space-y-1">
                <div className="text-xs text-muted-foreground">Solo (per request)</div>
                <div className="text-lg font-semibold" data-testid="text-solo-cost">
                  ${simulation.soloPerRequestCost.toFixed(2)}
                </div>
              </div>
              <div className="bg-primary/10 p-3 rounded space-y-1 border border-primary/20">
                <div className="text-xs text-muted-foreground">Bundled (per request)</div>
                <div className="text-lg font-semibold text-primary" data-testid="text-bundled-cost">
                  ${simulation.bundledPerRequestCost.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-green-500/10 dark:bg-green-500/20 p-3 rounded border border-green-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Estimated Savings</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400" data-testid="text-savings">
                    ${simulation.estimatedSavings.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {simulation.savingsPercentage}% off total
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Total solo cost ({bundleSize} trips):</span>
                <span>${simulation.totalSoloCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total bundled cost (1 trip):</span>
                <span>${simulation.totalBundledCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {hasEstimate && bundleSize === 1 && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
            <DollarSign className="h-4 w-4 inline mr-1" />
            Move the slider to see potential savings from coordinating with neighbors.
          </div>
        )}

        {simulation && (
          <div className="text-xs text-muted-foreground border-t pt-3 mt-2">
            <div className="flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                Savings based on assumed contractor travel cost of ${simulation.travelCostAssumption}/trip 
                being shared across bundled requests. Actual savings may vary.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BundleSimulationSlider;
