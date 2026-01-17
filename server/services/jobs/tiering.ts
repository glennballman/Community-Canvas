/**
 * Job Tiering Service
 * 
 * Manages job attention and assistance tiers for enhanced visibility and platform support.
 * This is currently DISABLED by default - all tier functionality requires the
 * 'job_tiers_enabled' feature flag to be set to true.
 * 
 * Scope Precedence (for feature flags):
 * 1. portal-scoped (highest priority)
 * 2. tenant-scoped
 * 3. global (lowest priority)
 * 
 * Attention Tiers:
 * - standard: Default, no additional cost
 * - featured: Highlighted in search results (incremental pricing per day/month)
 * - urgent: Urgent badge, timeboxed to 7 days max (flat pricing)
 * 
 * Assistance Tiers:
 * - none: Default, no additional cost
 * - assisted: Platform screening assistance (monthly pricing)
 */

import { getBooleanFlag, FlagScope } from '../featureFlags';

export type AttentionTier = 'standard' | 'featured' | 'urgent';
export type AssistanceTier = 'none' | 'assisted';
export type BillingInterval = 'day' | 'month' | 'flat';

export interface TierPricing {
  priceCentsPerDay?: number;
  priceCentsFlat?: number;
  priceCentsPerMonth?: number;
  durationDays?: number;
  label: string;
  description: string;
}

export interface TieringConfig {
  attentionTiers?: Record<string, TierPricing>;
  assistanceTiers?: Record<string, TierPricing>;
  attention_tiers?: Record<string, any>;
  assistance_tiers?: Record<string, any>;
}

export interface AttentionTierInfo {
  key: AttentionTier;
  label: string;
  description: string;
  incrementalPriceCents: number;
  unit: BillingInterval;
  durationDays?: number;
  notes?: string;
}

export interface AssistanceTierInfo {
  key: AssistanceTier;
  label: string;
  incrementalPriceCents: number;
  unit: BillingInterval;
  notes?: string;
}

export interface TieringPayload {
  enabled: boolean;
  source: FlagScope;
  currency: string;
  attentionTiers: AttentionTierInfo[];
  assistanceTiers: AssistanceTierInfo[];
}

export interface TieringAvailability extends TieringPayload {
  attentionTiersLegacy: {
    tier: AttentionTier;
    label: string;
    description: string;
    priceCentsPerDay?: number;
    priceCentsFlat?: number;
    durationDays?: number;
  }[];
  assistanceTiersLegacy: {
    tier: AssistanceTier;
    label: string;
    description: string;
    priceCentsPerMonth?: number;
  }[];
}

const DEFAULT_TIER_PRICING = {
  featured_daily_cents: 100,
  featured_monthly_cents: 1000,
  urgent_flat_cents: 700,
  urgent_duration_days: 7,
  assisted_monthly_cents: 900
};

function parseConfigPricing(config: any): typeof DEFAULT_TIER_PRICING {
  if (!config) return DEFAULT_TIER_PRICING;

  const attentionTiers = config.attention_tiers || config.attentionTiers || {};
  const assistanceTiers = config.assistance_tiers || config.assistanceTiers || {};

  return {
    featured_daily_cents: 
      attentionTiers.featured?.price_cents_per_day ||
      attentionTiers.featured?.priceCentsPerDay ||
      DEFAULT_TIER_PRICING.featured_daily_cents,
    featured_monthly_cents:
      attentionTiers.featured?.price_cents_per_month ||
      attentionTiers.featured?.priceCentsPerMonth ||
      DEFAULT_TIER_PRICING.featured_monthly_cents,
    urgent_flat_cents:
      attentionTiers.urgent?.price_cents_flat ||
      attentionTiers.urgent?.priceCentsFlat ||
      DEFAULT_TIER_PRICING.urgent_flat_cents,
    urgent_duration_days:
      attentionTiers.urgent?.duration_days ||
      attentionTiers.urgent?.durationDays ||
      DEFAULT_TIER_PRICING.urgent_duration_days,
    assisted_monthly_cents:
      assistanceTiers.assisted?.price_cents_per_month ||
      assistanceTiers.assisted?.priceCentsPerMonth ||
      DEFAULT_TIER_PRICING.assisted_monthly_cents
  };
}

/**
 * Check if job tiering is enabled and get available tiers
 * Scope precedence: portal > tenant > global > default(false)
 */
export async function getTieringAvailability(params: {
  tenantId?: string;
  portalId?: string;
}): Promise<TieringAvailability> {
  const { tenantId, portalId } = params;

  try {
    const flagResult = await getBooleanFlag('job_tiers_enabled', { tenantId, portalId });
    const enabled = flagResult.enabled;
    const source = flagResult.source;
    const pricing = parseConfigPricing(flagResult.config);

    const attentionTiers: AttentionTierInfo[] = [
      {
        key: 'standard',
        label: 'Standard',
        description: 'Default visibility',
        incrementalPriceCents: 0,
        unit: 'day'
      },
      {
        key: 'featured',
        label: 'Featured Job',
        description: 'Highlighted in search results',
        incrementalPriceCents: pricing.featured_daily_cents,
        unit: 'day',
        notes: `or $${(pricing.featured_monthly_cents / 100).toFixed(2)}/month`
      },
      {
        key: 'urgent',
        label: 'Urgently Hiring',
        description: `Urgent badge for ${pricing.urgent_duration_days} days`,
        incrementalPriceCents: pricing.urgent_flat_cents,
        unit: 'flat',
        durationDays: pricing.urgent_duration_days
      }
    ];

    const assistanceTiers: AssistanceTierInfo[] = [
      {
        key: 'none',
        label: 'Self-Service',
        incrementalPriceCents: 0,
        unit: 'month'
      },
      {
        key: 'assisted',
        label: 'Assisted Hiring',
        incrementalPriceCents: pricing.assisted_monthly_cents,
        unit: 'month',
        notes: 'Platform screening assistance'
      }
    ];

    return {
      enabled,
      source,
      currency: 'CAD',
      attentionTiers,
      assistanceTiers,
      attentionTiersLegacy: [
        { tier: 'standard', label: 'Standard', description: 'Default visibility' },
        { 
          tier: 'featured', 
          label: 'Featured Job', 
          description: 'Highlighted in search results',
          priceCentsPerDay: pricing.featured_daily_cents
        },
        { 
          tier: 'urgent', 
          label: 'Urgently Hiring', 
          description: `Urgent badge for ${pricing.urgent_duration_days} days`,
          priceCentsFlat: pricing.urgent_flat_cents,
          durationDays: pricing.urgent_duration_days
        }
      ],
      assistanceTiersLegacy: [
        { tier: 'none', label: 'Self-Service', description: 'Manage applications yourself' },
        { 
          tier: 'assisted', 
          label: 'Assisted Hiring', 
          description: 'Platform screening assistance',
          priceCentsPerMonth: pricing.assisted_monthly_cents
        }
      ]
    };
  } catch (error) {
    console.error('[tiering] Error fetching tier availability:', error);
    return {
      enabled: false,
      source: 'default',
      currency: 'CAD',
      attentionTiers: [
        { key: 'standard', label: 'Standard', description: 'Default visibility', incrementalPriceCents: 0, unit: 'day' }
      ],
      assistanceTiers: [
        { key: 'none', label: 'Self-Service', incrementalPriceCents: 0, unit: 'month' }
      ],
      attentionTiersLegacy: [
        { tier: 'standard', label: 'Standard', description: 'Default visibility' }
      ],
      assistanceTiersLegacy: [
        { tier: 'none', label: 'Self-Service', description: 'Manage applications yourself' }
      ]
    };
  }
}

export interface TierPriceParams {
  tenantId?: string;
  portalId?: string;
  attentionTier: AttentionTier;
  assistanceTier: AssistanceTier;
  baseBillingInterval?: BillingInterval;
  baseDurationDays?: number;
}

export interface TierPriceResult {
  tierPriceCents: number;
  breakdown: {
    attentionPriceCents: number;
    assistancePriceCents: number;
    attentionTier: AttentionTier;
    assistanceTier: AssistanceTier;
  };
  urgentEndsAt?: string;
  enabled: boolean;
  source: FlagScope;
  warning?: string;
}

/**
 * Compute incremental tier price (base portal price NOT included)
 * Returns 0 if tiering is disabled
 * 
 * Pricing logic:
 * - featured (daily): incrementalPriceCents * baseDurationDays
 * - featured (monthly): featured_monthly_cents
 * - urgent: flat price, urgentEndsAt = now + min(7, baseDurationDays)
 * - assisted: monthly price (doesn't affect publication dates)
 */
export async function computeTierPrice(params: TierPriceParams): Promise<TierPriceResult> {
  const { 
    tenantId, 
    portalId, 
    attentionTier, 
    assistanceTier, 
    baseBillingInterval = 'day',
    baseDurationDays = 30 
  } = params;

  const availability = await getTieringAvailability({ tenantId, portalId });

  if (!availability.enabled) {
    return {
      tierPriceCents: 0,
      breakdown: {
        attentionPriceCents: 0,
        assistancePriceCents: 0,
        attentionTier,
        assistanceTier
      },
      enabled: false,
      source: availability.source,
      warning: 'TIERS_DISABLED'
    };
  }

  let attentionPriceCents = 0;
  let assistancePriceCents = 0;
  let urgentEndsAt: string | undefined;

  if (attentionTier === 'featured') {
    const featuredTier = availability.attentionTiers.find(t => t.key === 'featured');
    if (featuredTier) {
      if (baseBillingInterval === 'day') {
        attentionPriceCents = featuredTier.incrementalPriceCents * baseDurationDays;
      } else if (baseBillingInterval === 'month') {
        attentionPriceCents = DEFAULT_TIER_PRICING.featured_monthly_cents;
      }
    }
  } else if (attentionTier === 'urgent') {
    const urgentTier = availability.attentionTiers.find(t => t.key === 'urgent');
    if (urgentTier) {
      attentionPriceCents = urgentTier.incrementalPriceCents;
      const urgentDays = Math.min(urgentTier.durationDays || 7, baseDurationDays);
      const urgentEnd = new Date();
      urgentEnd.setDate(urgentEnd.getDate() + urgentDays);
      urgentEndsAt = urgentEnd.toISOString();
    }
  }

  if (assistanceTier === 'assisted') {
    const assistedTier = availability.assistanceTiers.find(t => t.key === 'assisted');
    if (assistedTier) {
      const months = baseBillingInterval === 'month' ? 1 : Math.ceil(baseDurationDays / 30);
      assistancePriceCents = assistedTier.incrementalPriceCents * months;
    }
  }

  return {
    tierPriceCents: attentionPriceCents + assistancePriceCents,
    breakdown: {
      attentionPriceCents,
      assistancePriceCents,
      attentionTier,
      assistanceTier
    },
    urgentEndsAt,
    enabled: true,
    source: availability.source
  };
}

/**
 * Validate tier values
 */
export function isValidAttentionTier(tier: string): tier is AttentionTier {
  return ['standard', 'featured', 'urgent'].includes(tier);
}

export function isValidAssistanceTier(tier: string): tier is AssistanceTier {
  return ['none', 'assisted'].includes(tier);
}
