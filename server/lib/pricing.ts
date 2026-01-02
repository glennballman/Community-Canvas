// =====================================================================
// PRICING CALCULATOR
// =====================================================================

import {
  PriceCalculationInput,
  PriceCalculationResult,
  BundlePriceCalculationInput,
  BundlePriceCalculationResult,
  PriceBreakdownItem,
  ServiceWithDetails
} from '../types/serviceRuns';

const EMERGENCY_MULTIPLIER = 1.5;

/**
 * Calculate price for a single service
 */
export function calculateServicePrice(input: PriceCalculationInput): PriceCalculationResult {
  const { service, quantity, community, accessDifficulty, seasonalFactor, isEmergency } = input;
  const pricing = service.pricing;
  
  if (!pricing) {
    throw new Error(`No pricing configured for service: ${service.slug}`);
  }
  
  const breakdown: PriceBreakdownItem[] = [];
  
  // Base price calculation based on pricing model
  let basePrice = pricing.basePrice;
  let quantityTotal = basePrice;
  
  switch (pricing.pricingModel) {
    case 'flat':
      quantityTotal = basePrice;
      breakdown.push({ label: 'Flat rate', amount: basePrice, type: 'base' });
      break;
    case 'per_unit':
    case 'per_sqft':
    case 'per_hour':
      quantityTotal = basePrice * quantity;
      breakdown.push({ 
        label: `${quantity} × $${basePrice.toFixed(2)} ${pricing.unitDescriptor}`, 
        amount: quantityTotal, 
        type: 'base' 
      });
      break;
    case 'hybrid':
      // Base fee + variable component
      const variablePortion = basePrice * 0.35 * quantity;
      quantityTotal = basePrice + variablePortion;
      breakdown.push({ label: 'Base fee', amount: basePrice, type: 'base' });
      breakdown.push({ label: `Variable (${quantity} units)`, amount: variablePortion, type: 'base' });
      break;
    default:
      quantityTotal = basePrice * quantity;
  }
  
  // Apply multipliers
  const remoteMultiplier = pricing.remoteMultiplier * community.remoteMultiplier;
  const accessMultiplier = accessDifficulty ?? pricing.accessDifficultyMultiplier;
  const seasonalMultiplier = seasonalFactor ?? pricing.seasonalMultiplier;
  const emergencyMultiplier = isEmergency ? EMERGENCY_MULTIPLIER : 1.0;
  
  let subtotal = quantityTotal;
  
  if (remoteMultiplier !== 1.0) {
    const remoteAmount = subtotal * (remoteMultiplier - 1);
    breakdown.push({ 
      label: `Remote location (×${remoteMultiplier.toFixed(2)})`, 
      amount: remoteAmount, 
      type: 'multiplier' 
    });
    subtotal *= remoteMultiplier;
  }
  
  if (accessMultiplier !== 1.0) {
    const accessAmount = subtotal * (accessMultiplier - 1);
    breakdown.push({ 
      label: `Access difficulty (×${accessMultiplier.toFixed(2)})`, 
      amount: accessAmount, 
      type: 'multiplier' 
    });
    subtotal *= accessMultiplier;
  }
  
  if (seasonalMultiplier !== 1.0) {
    const seasonalAmount = subtotal * (seasonalMultiplier - 1);
    breakdown.push({ 
      label: `Seasonal adjustment (×${seasonalMultiplier.toFixed(2)})`, 
      amount: seasonalAmount, 
      type: 'multiplier' 
    });
    subtotal *= seasonalMultiplier;
  }
  
  if (emergencyMultiplier !== 1.0) {
    const emergencyAmount = subtotal * (emergencyMultiplier - 1);
    breakdown.push({ 
      label: `Emergency response (×${emergencyMultiplier.toFixed(2)})`, 
      amount: emergencyAmount, 
      type: 'multiplier' 
    });
    subtotal *= emergencyMultiplier;
  }
  
  // Add mobilization surcharge
  const mobilizationSurcharge = pricing.mobilizationSurcharge;
  if (mobilizationSurcharge > 0) {
    breakdown.push({ 
      label: 'Mobilization surcharge', 
      amount: mobilizationSurcharge, 
      type: 'surcharge' 
    });
    subtotal += mobilizationSurcharge;
  }
  
  // Apply minimum charge
  let finalPrice = subtotal;
  let minimumApplied = false;
  
  if (pricing.minimumCharge > 0 && finalPrice < pricing.minimumCharge) {
    const adjustment = pricing.minimumCharge - finalPrice;
    breakdown.push({ 
      label: `Minimum charge adjustment`, 
      amount: adjustment, 
      type: 'adjustment' 
    });
    finalPrice = pricing.minimumCharge;
    minimumApplied = true;
  }
  
  // Round to cents
  finalPrice = Math.round(finalPrice * 100) / 100;
  
  return {
    basePrice,
    quantityTotal,
    remoteMultiplier,
    accessMultiplier,
    seasonalMultiplier,
    emergencyMultiplier,
    mobilizationSurcharge,
    subtotal,
    minimumApplied,
    finalPrice,
    breakdown
  };
}

/**
 * Calculate price for a bundle
 */
export function calculateBundlePrice(input: BundlePriceCalculationInput): BundlePriceCalculationResult {
  const { bundle, community, quantities } = input;
  const bundlePricing = bundle.pricing;
  
  if (!bundlePricing) {
    throw new Error(`No pricing configured for bundle: ${bundle.slug}`);
  }
  
  const breakdown: PriceBreakdownItem[] = [];
  const serviceTotals: { serviceSlug: string; price: number }[] = [];
  
  // Calculate individual service prices
  let sumBeforeDiscount = 0;
  let sumStandaloneMobilization = 0;
  
  for (const item of bundle.items) {
    if (!item.service) continue;
    
    const service = item.service as ServiceWithDetails;
    const qty = quantities?.[service.slug] ?? item.quantity;
    
    // Calculate à la carte price (for comparison)
    try {
      const serviceResult = calculateServicePrice({
        service,
        quantity: qty,
        community,
        isEmergency: false
      });
      
      serviceTotals.push({
        serviceSlug: service.slug,
        price: serviceResult.finalPrice
      });
      
      sumBeforeDiscount += serviceResult.finalPrice;
      sumStandaloneMobilization += serviceResult.mobilizationSurcharge;
    } catch (e) {
      // Service might not have pricing configured yet
      console.warn(`Could not calculate price for ${service.slug}:`, e);
    }
  }
  
  breakdown.push({ 
    label: 'Services total (à la carte)', 
    amount: sumBeforeDiscount, 
    type: 'base' 
  });
  
  // Apply bundle discount
  const discountFactor = bundlePricing.discountFactor;
  const discountAmount = sumBeforeDiscount * (1 - discountFactor);
  const afterDiscount = sumBeforeDiscount * discountFactor;
  
  breakdown.push({ 
    label: `Bundle discount (${((1 - discountFactor) * 100).toFixed(0)}% off)`, 
    amount: -discountAmount, 
    type: 'adjustment' 
  });
  
  // Add bundle mobilization (replaces individual mobilizations)
  const mobilizationSurcharge = bundlePricing.mobilizationSurcharge;
  breakdown.push({ 
    label: 'Bundle mobilization', 
    amount: mobilizationSurcharge, 
    type: 'surcharge' 
  });
  
  // Apply remote multiplier
  const remoteMultiplier = bundlePricing.remoteMultiplier * community.remoteMultiplier;
  let finalPrice = (afterDiscount + mobilizationSurcharge) * remoteMultiplier;
  
  if (remoteMultiplier !== 1.0) {
    const remoteAmount = (afterDiscount + mobilizationSurcharge) * (remoteMultiplier - 1);
    breakdown.push({ 
      label: `Remote location (×${remoteMultiplier.toFixed(2)})`, 
      amount: remoteAmount, 
      type: 'multiplier' 
    });
  }
  
  // Discount cap rule: customer discount cannot exceed mobilization savings
  const mobilizationSavings = Math.max(0, sumStandaloneMobilization - mobilizationSurcharge);
  const effectiveDiscount = sumBeforeDiscount - finalPrice;
  
  if (effectiveDiscount > mobilizationSavings && mobilizationSavings > 0) {
    // Cap the discount
    const cappedPrice = sumBeforeDiscount - mobilizationSavings;
    if (cappedPrice > finalPrice) {
      const capAdjustment = cappedPrice - finalPrice;
      breakdown.push({ 
        label: 'Discount cap adjustment', 
        amount: capAdjustment, 
        type: 'adjustment' 
      });
      finalPrice = cappedPrice;
    }
  }
  
  // Round to cents
  finalPrice = Math.round(finalPrice * 100) / 100;
  
  const savingsVsAlaCarte = sumBeforeDiscount - finalPrice;
  
  return {
    serviceTotals,
    sumBeforeDiscount,
    discountFactor,
    discountAmount,
    mobilizationSurcharge,
    remoteMultiplier,
    finalPrice,
    savingsVsAlaCarte,
    breakdown
  };
}

/**
 * Calculate mobilization cost split across slots
 */
export function calculateMobilizationPerSlot(
  totalMobilization: number,
  activeSlots: number
): number {
  if (activeSlots <= 0) return 0;
  return Math.round((totalMobilization / activeSlots) * 100) / 100;
}
