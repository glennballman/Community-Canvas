/**
 * Zone Pricing Modifiers - Estimate Computation
 * 
 * IMPORTANT: This is advisory/estimate-only output.
 * These modifiers do NOT modify any ledger/folio/payment paths.
 * All results are simulation data, never implying actual charging.
 */

export interface ZonePricingModifiers {
  contractor_multiplier?: number;
  logistics_surcharge_flat?: number;
  time_risk_multiplier?: number;
  notes?: string;
  [key: string]: number | string | undefined;
}

export interface ModifierBreakdownItem {
  type: 'multiplier' | 'flat';
  key: string;
  label: string;
  value: number;
  effect: number;
}

export interface ZonePricingEstimate {
  base_estimate: number;
  zone_modifier_breakdown: ModifierBreakdownItem[];
  final_estimate: number;
  notes: string[];
}

const MODIFIER_LABELS: Record<string, string> = {
  contractor_multiplier: 'Contractor Rate Adjustment',
  logistics_surcharge_flat: 'Logistics Surcharge',
  time_risk_multiplier: 'Time/Risk Factor',
};

/**
 * Compute pricing estimate with zone modifiers applied.
 * 
 * Order of application:
 * 1. Base estimate
 * 2. Zone pricing modifiers (multipliers first, then flat fees)
 * 3. Property-level overrides (future)
 * 4. Work-request-specific overrides (future)
 * 
 * @param baseEstimate The base price estimate before zone modifiers
 * @param zoneModifiers The zone's pricing_modifiers object
 * @returns Structured breakdown with final estimate
 */
export function computeZonePricingEstimate(
  baseEstimate: number,
  zoneModifiers: ZonePricingModifiers | null | undefined
): ZonePricingEstimate {
  const breakdown: ModifierBreakdownItem[] = [];
  const notes: string[] = [];
  let currentEstimate = baseEstimate;

  if (!zoneModifiers || Object.keys(zoneModifiers).length === 0) {
    return {
      base_estimate: baseEstimate,
      zone_modifier_breakdown: [],
      final_estimate: baseEstimate,
      notes: [],
    };
  }

  // Apply multipliers first
  if (zoneModifiers.contractor_multiplier && zoneModifiers.contractor_multiplier !== 1) {
    const multiplier = zoneModifiers.contractor_multiplier;
    const effect = currentEstimate * (multiplier - 1);
    breakdown.push({
      type: 'multiplier',
      key: 'contractor_multiplier',
      label: MODIFIER_LABELS.contractor_multiplier,
      value: multiplier,
      effect: Math.round(effect * 100) / 100,
    });
    currentEstimate *= multiplier;
  }

  if (zoneModifiers.time_risk_multiplier && zoneModifiers.time_risk_multiplier !== 1) {
    const multiplier = zoneModifiers.time_risk_multiplier;
    const effect = currentEstimate * (multiplier - 1);
    breakdown.push({
      type: 'multiplier',
      key: 'time_risk_multiplier',
      label: MODIFIER_LABELS.time_risk_multiplier,
      value: multiplier,
      effect: Math.round(effect * 100) / 100,
    });
    currentEstimate *= multiplier;
  }

  // Apply flat fees after multipliers
  if (zoneModifiers.logistics_surcharge_flat && zoneModifiers.logistics_surcharge_flat > 0) {
    const flatFee = zoneModifiers.logistics_surcharge_flat;
    breakdown.push({
      type: 'flat',
      key: 'logistics_surcharge_flat',
      label: MODIFIER_LABELS.logistics_surcharge_flat,
      value: flatFee,
      effect: flatFee,
    });
    currentEstimate += flatFee;
  }

  // Collect notes
  if (zoneModifiers.notes) {
    notes.push(zoneModifiers.notes);
  }

  return {
    base_estimate: baseEstimate,
    zone_modifier_breakdown: breakdown,
    final_estimate: Math.round(currentEstimate * 100) / 100,
    notes,
  };
}

/**
 * Format a modifier value for display.
 */
export function formatModifierValue(type: 'multiplier' | 'flat', value: number): string {
  if (type === 'multiplier') {
    const percentage = Math.round((value - 1) * 100);
    return percentage >= 0 ? `+${percentage}%` : `${percentage}%`;
  }
  return `+$${value.toFixed(2)}`;
}

/**
 * Check if a zone has any pricing modifiers set.
 */
export function hasZonePricingModifiers(modifiers: ZonePricingModifiers | null | undefined): boolean {
  if (!modifiers) return false;
  const { notes, ...numericModifiers } = modifiers;
  return Object.values(numericModifiers).some(v => typeof v === 'number' && v !== 0 && v !== 1);
}
