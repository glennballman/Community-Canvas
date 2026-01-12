/**
 * V3.3.1 Pricing Service
 * Calculates quotes using offers → rate_rules → tax_rules
 * NOTE: Community Canvas does NOT process payments - only calculates pricing
 */

import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';

// Types
export interface QuoteRequest {
  facilityId: string;
  offerId: string;
  startAt: Date;
  endAt: Date;
  vesselLengthFt?: number;
  vehicleLengthFt?: number;
  nights?: number;
}

export interface Adjustment {
  ruleName: string;
  amountCents: number;
}

export interface TaxLine {
  taxName: string;
  amountCents: number;
}

export interface QuoteResult {
  baseAmountCents: number;
  adjustments: Adjustment[];
  subtotalCents: number;
  taxes: TaxLine[];
  totalCents: number;
  breakdown: string;
}

interface RateConditions {
  start_date?: string;
  end_date?: string;
  min_length_ft?: number;
  max_length_ft?: number;
  days?: string[];
}

/**
 * Check if a seasonal rule applies to the given date range
 */
function isSeasonalRuleActive(conditions: RateConditions, startAt: Date, endAt: Date): boolean {
  if (!conditions.start_date || !conditions.end_date) return false;
  
  const seasonStart = new Date(conditions.start_date);
  const seasonEnd = new Date(conditions.end_date);
  
  // Rule applies if any part of the stay overlaps with the season
  return startAt <= seasonEnd && endAt >= seasonStart;
}

/**
 * Check if a length tier rule applies
 */
function isLengthTierActive(conditions: RateConditions, lengthFt?: number): boolean {
  if (!lengthFt) return false;
  
  const minLength = conditions.min_length_ft ?? 0;
  const maxLength = conditions.max_length_ft ?? Infinity;
  
  return lengthFt >= minLength && lengthFt <= maxLength;
}

/**
 * Check if a weekday rule applies
 */
function isWeekdayRuleActive(conditions: RateConditions, startAt: Date): boolean {
  if (!conditions.days || conditions.days.length === 0) return false;
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const startDayName = dayNames[startAt.getDay()];
  
  return conditions.days.includes(startDayName);
}

/**
 * Calculate quote for an offer
 */
export async function calculateQuote(request: QuoteRequest): Promise<QuoteResult> {
  // Fetch offer
  const offerResult = await db.execute(sql`
    SELECT id, tenant_id, price_cents, tax_category_code, offer_type, duration_type
    FROM cc_offers 
    WHERE id = ${request.offerId} AND is_active = true
  `);
  
  if (offerResult.rows.length === 0) {
    throw new Error(`Offer not found: ${request.offerId}`);
  }
  
  const offer = offerResult.rows[0] as {
    id: string;
    tenant_id: string;
    price_cents: number;
    tax_category_code: string;
    offer_type: string;
    duration_type: string | null;
  };
  
  // Determine effective length for per-foot pricing
  const effectiveLengthFt = request.vesselLengthFt ?? request.vehicleLengthFt ?? 1;
  
  // Calculate base amount (per-foot for marina offers)
  let baseAmountCents = offer.price_cents;
  if (offer.offer_type === 'slip_overnight' || offer.offer_type === 'moorage_monthly') {
    baseAmountCents = offer.price_cents * effectiveLengthFt;
  }
  
  // Fetch rate rules for this offer, ordered by priority
  const rulesResult = await db.execute(sql`
    SELECT id, rule_name, rule_type, conditions, adjustment_type, adjustment_value
    FROM cc_rate_rules 
    WHERE offer_id = ${request.offerId} AND is_active = true
    ORDER BY priority ASC
  `);
  
  const adjustments: Adjustment[] = [];
  let adjustedAmountCents = baseAmountCents;
  
  // Apply rules in priority order
  for (const rule of rulesResult.rows) {
    const conditions = (rule.conditions || {}) as RateConditions;
    const ruleType = rule.rule_type as string;
    const ruleName = rule.rule_name as string;
    const adjustmentType = rule.adjustment_type as string;
    const adjustmentValue = parseFloat(rule.adjustment_value as string);
    
    let applies = false;
    
    switch (ruleType) {
      case 'seasonal':
        applies = isSeasonalRuleActive(conditions, request.startAt, request.endAt);
        break;
      case 'length_tier':
        applies = isLengthTierActive(conditions, effectiveLengthFt);
        break;
      case 'weekday':
        applies = isWeekdayRuleActive(conditions, request.startAt);
        break;
      // Add more rule types as needed
    }
    
    if (applies) {
      let adjustmentAmountCents = 0;
      
      switch (adjustmentType) {
        case 'multiply':
          const newAmount = Math.round(adjustedAmountCents * adjustmentValue);
          adjustmentAmountCents = newAmount - adjustedAmountCents;
          adjustedAmountCents = newAmount;
          break;
        case 'add_cents':
          adjustmentAmountCents = Math.round(adjustmentValue);
          adjustedAmountCents += adjustmentAmountCents;
          break;
        case 'replace_cents':
          adjustmentAmountCents = Math.round(adjustmentValue) - adjustedAmountCents;
          adjustedAmountCents = Math.round(adjustmentValue);
          break;
      }
      
      adjustments.push({
        ruleName,
        amountCents: adjustmentAmountCents,
      });
    }
  }
  
  const subtotalCents = adjustedAmountCents;
  
  // Fetch tax rules for this category
  // Use community tenant for shared tax rules
  const taxResult = await db.execute(sql`
    SELECT tax_name, rate_percent, min_nights
    FROM cc_tax_rules 
    WHERE tax_category_code = ${offer.tax_category_code} AND is_active = true
    ORDER BY is_compound ASC, tax_name ASC
  `);
  
  const taxes: TaxLine[] = [];
  let taxTotalCents = 0;
  
  // Calculate number of nights if not provided
  const nights = request.nights ?? Math.max(1, Math.ceil(
    (request.endAt.getTime() - request.startAt.getTime()) / (1000 * 60 * 60 * 24)
  ));
  
  for (const tax of taxResult.rows) {
    const taxName = tax.tax_name as string;
    const ratePercent = parseFloat(tax.rate_percent as string);
    const minNights = tax.min_nights as number | null;
    
    // MRDT only applies if stay is less than minNights
    if (minNights !== null && nights >= minNights) {
      continue;
    }
    
    const taxAmountCents = Math.round(subtotalCents * (ratePercent / 100));
    taxes.push({
      taxName,
      amountCents: taxAmountCents,
    });
    taxTotalCents += taxAmountCents;
  }
  
  const totalCents = subtotalCents + taxTotalCents;
  
  // Build breakdown string
  const breakdown = buildBreakdown(baseAmountCents, adjustments, subtotalCents, taxes, totalCents);
  
  return {
    baseAmountCents,
    adjustments,
    subtotalCents,
    taxes,
    totalCents,
    breakdown,
  };
}

/**
 * Build human-readable breakdown
 */
function buildBreakdown(
  baseCents: number,
  adjustments: Adjustment[],
  subtotalCents: number,
  taxes: TaxLine[],
  totalCents: number
): string {
  const lines: string[] = [];
  
  lines.push(`Base: $${(baseCents / 100).toFixed(2)}`);
  
  for (const adj of adjustments) {
    const sign = adj.amountCents >= 0 ? '+' : '';
    lines.push(`  ${adj.ruleName}: ${sign}$${(adj.amountCents / 100).toFixed(2)}`);
  }
  
  lines.push(`Subtotal: $${(subtotalCents / 100).toFixed(2)}`);
  
  for (const tax of taxes) {
    lines.push(`  ${tax.taxName}: $${(tax.amountCents / 100).toFixed(2)}`);
  }
  
  lines.push(`Total: $${(totalCents / 100).toFixed(2)}`);
  
  return lines.join('\n');
}

/**
 * Quick test function - can be called from a route for validation
 */
export async function testPricing(): Promise<{ success: boolean; result?: QuoteResult; error?: string }> {
  try {
    // Get Save Paradise DAY_PASS offer
    const offerResult = await db.execute(sql`
      SELECT o.id, o.code, o.price_cents, f.name as facility_name
      FROM cc_offers o
      JOIN cc_facilities f ON o.facility_id = f.id
      WHERE o.code = 'DAY_PASS' 
      AND o.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8'
    `);
    
    if (offerResult.rows.length === 0) {
      return { success: false, error: 'DAY_PASS offer not found' };
    }
    
    const offer = offerResult.rows[0];
    
    // Test: July day pass (peak season) = $15 × 1.5 + 5% GST
    // Expected: $22.50 + $1.13 = $23.63
    const quote = await calculateQuote({
      facilityId: '', // Not needed for this test
      offerId: offer.id as string,
      startAt: new Date('2026-07-15'),
      endAt: new Date('2026-07-15'),
    });
    
    return { success: true, result: quote };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
