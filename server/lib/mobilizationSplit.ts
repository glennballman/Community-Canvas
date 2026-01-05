/**
 * MOBILIZATION SPLIT CALCULATOR
 * 
 * Philosophy:
 * - Customers coordinate demand, NOT bid down labor rates
 * - More members = contractor makes MORE money (not less)
 * - Split is for mobilization only, not labor rates
 * - Contractor sets all pricing
 */

import { serviceQuery } from '../db/tenantDb';

export interface MobilizationEstimate {
  run_id: string;
  mobilization_fee_total: number;
  split_method: 'flat' | 'pro_rata_units' | 'custom';
  current_member_count: number;
  share_per_member: number;
  threshold_met: boolean;
  min_threshold: number;
  estimated_total_value: number;
  
  // Projections
  if_one_more_joins: number;
  if_five_more_join: number;
  
  // Contractor view only
  contractor_margin_improvement?: number;
}

export async function computeMobilizationSplit(run_id: string): Promise<MobilizationEstimate> {
  const result = await serviceQuery(
    `SELECT 
      r.id as run_id,
      r.mobilization_fee_total,
      r.split_method,
      r.current_member_count,
      r.min_mobilization_threshold,
      r.estimated_total_value,
      r.pricing_model
    FROM coop_service_runs r
    WHERE r.id = $1`,
    [run_id]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Coop service run not found');
  }
  
  const run = result.rows[0];
  const mobFee = parseFloat(run.mobilization_fee_total) || 0;
  const memberCount = run.current_member_count || 1;
  const minThreshold = parseFloat(run.min_mobilization_threshold) || 0;
  const totalValue = parseFloat(run.estimated_total_value) || 0;
  
  // Compute current share
  let sharePerMember = 0;
  switch (run.split_method) {
    case 'flat':
      sharePerMember = memberCount > 0 ? mobFee / memberCount : mobFee;
      break;
    case 'pro_rata_units':
      sharePerMember = memberCount > 0 ? mobFee / memberCount : mobFee;
      break;
    default:
      sharePerMember = memberCount > 0 ? mobFee / memberCount : mobFee;
  }
  
  // Compute projections
  const ifOneMore = memberCount > 0 ? mobFee / (memberCount + 1) : mobFee;
  const ifFiveMore = memberCount > 0 ? mobFee / (memberCount + 5) : mobFee / 5;
  
  return {
    run_id,
    mobilization_fee_total: mobFee,
    split_method: run.split_method || 'flat',
    current_member_count: memberCount,
    share_per_member: Math.round(sharePerMember * 100) / 100,
    threshold_met: totalValue >= minThreshold,
    min_threshold: minThreshold,
    estimated_total_value: totalValue,
    if_one_more_joins: Math.round(ifOneMore * 100) / 100,
    if_five_more_join: Math.round(ifFiveMore * 100) / 100
  };
}

/**
 * Compute contractor's margin improvement (private to contractor)
 * More members = more revenue with same mobilization cost
 */
export async function computeContractorMargins(run_id: string): Promise<{
  base_margin: number;
  current_margin: number;
  margin_improvement_percent: number;
  effective_hourly_rate: number;
}> {
  const result = await serviceQuery(
    `SELECT 
      r.mobilization_fee_total,
      r.current_member_count,
      r.estimated_total_value,
      r.pricing_model,
      SUM(m.unit_count) as total_units
    FROM coop_service_runs r
    LEFT JOIN coop_run_members m ON m.run_id = r.id AND m.status IN ('interested', 'joined', 'scheduled')
    WHERE r.id = $1
    GROUP BY r.id`,
    [run_id]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Coop service run not found');
  }
  
  const run = result.rows[0];
  const mobFee = parseFloat(run.mobilization_fee_total) || 0;
  const totalUnits = parseInt(run.total_units) || 1;
  const unitPrice = parseFloat(run.pricing_model?.unit_price) || 0;
  
  // Revenue calculations
  const laborRevenue = totalUnits * unitPrice;
  const totalRevenue = laborRevenue + mobFee;
  
  // Assume ~30% labor cost, ~20% materials
  const estimatedCosts = laborRevenue * 0.5;
  const currentMargin = totalRevenue - estimatedCosts;
  
  // Base margin (single customer scenario)
  const baseRevenue = unitPrice + mobFee;
  const baseCosts = unitPrice * 0.5;
  const baseMargin = baseRevenue - baseCosts;
  
  // Improvement
  const improvement = baseMargin > 0 
    ? ((currentMargin - baseMargin) / baseMargin) * 100 
    : 0;
  
  // Effective hourly (assume 1 hour per unit)
  const effectiveHourly = totalUnits > 0 ? currentMargin / totalUnits : 0;
  
  return {
    base_margin: Math.round(baseMargin * 100) / 100,
    current_margin: Math.round(currentMargin * 100) / 100,
    margin_improvement_percent: Math.round(improvement * 10) / 10,
    effective_hourly_rate: Math.round(effectiveHourly * 100) / 100
  };
}

/**
 * Format for customer display
 */
export function formatCustomerEstimate(estimate: MobilizationEstimate): {
  headline: string;
  your_share: string;
  savings_note: string;
  threshold_status: string;
} {
  return {
    headline: `Current run size: ${estimate.current_member_count} home${estimate.current_member_count !== 1 ? 's' : ''}`,
    your_share: `Estimated mobilization share: $${estimate.share_per_member}`,
    savings_note: estimate.current_member_count >= 3
      ? `If 1 more neighbor joins, your share drops to ~$${estimate.if_one_more_joins}`
      : 'More neighbors = lower mobilization cost per home',
    threshold_status: estimate.threshold_met
      ? 'Minimum reached - contractor will schedule'
      : `Need ${Math.ceil((estimate.min_threshold - estimate.estimated_total_value) / 150)} more homes to reach minimum`
  };
}
