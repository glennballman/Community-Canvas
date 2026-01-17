/**
 * Job Tiering Service
 * 
 * Manages job attention and assistance tiers for enhanced visibility and platform support.
 * This is currently DISABLED by default - all tier functionality requires the
 * 'job_tiers_enabled' feature flag to be set to true.
 * 
 * Attention Tiers:
 * - standard: Default, no additional cost
 * - featured: Highlighted in search results (+$1.00/day)
 * - urgent: Urgent badge for 7 days ($7 flat)
 * 
 * Assistance Tiers:
 * - none: Default, no additional cost
 * - assisted: Platform screening assistance ($9/month)
 */

import { serviceQuery } from '../../db/tenantDb';

export type AttentionTier = 'standard' | 'featured' | 'urgent';
export type AssistanceTier = 'none' | 'assisted';

export interface TierPricing {
  priceCentsPerDay?: number;
  priceCentsFlat?: number;
  priceCentsPerMonth?: number;
  durationDays?: number;
  label: string;
  description: string;
}

export interface TieringConfig {
  attentionTiers: Record<string, TierPricing>;
  assistanceTiers: Record<string, TierPricing>;
}

export interface TieringAvailability {
  enabled: boolean;
  attentionTiers: {
    tier: AttentionTier;
    label: string;
    description: string;
    priceCentsPerDay?: number;
    priceCentsFlat?: number;
    durationDays?: number;
  }[];
  assistanceTiers: {
    tier: AssistanceTier;
    label: string;
    description: string;
    priceCentsPerMonth?: number;
  }[];
}

const DEFAULT_TIER_CONFIG: TieringConfig = {
  attentionTiers: {
    featured: {
      priceCentsPerDay: 100,
      label: 'Featured Job',
      description: 'Highlighted in search results'
    },
    urgent: {
      priceCentsFlat: 700,
      durationDays: 7,
      label: 'Urgently Hiring',
      description: 'Urgent badge for 7 days'
    }
  },
  assistanceTiers: {
    assisted: {
      priceCentsPerMonth: 900,
      label: 'Assisted Hiring',
      description: 'Platform screening assistance'
    }
  }
};

/**
 * Check if job tiering is enabled and get available tiers
 */
export async function getTieringAvailability(params: {
  tenantId?: string;
  portalId?: string;
}): Promise<TieringAvailability> {
  const { tenantId, portalId } = params;

  try {
    const result = await serviceQuery(`
      SELECT is_enabled, config
      FROM cc_feature_flags
      WHERE key = 'job_tiers_enabled'
        AND (
          (scope_type = 'global' AND scope_id IS NULL)
          OR (scope_type = 'portal' AND scope_id = $1)
          OR (scope_type = 'tenant' AND scope_id = $2)
        )
      ORDER BY 
        CASE scope_type 
          WHEN 'tenant' THEN 1 
          WHEN 'portal' THEN 2 
          WHEN 'global' THEN 3 
        END
      LIMIT 1
    `, [portalId || null, tenantId || null]);

    const flag = result.rows[0];
    const enabled = flag?.is_enabled || false;
    const config: TieringConfig = flag?.config || DEFAULT_TIER_CONFIG;

    return {
      enabled,
      attentionTiers: [
        {
          tier: 'standard',
          label: 'Standard',
          description: 'Default visibility'
        },
        {
          tier: 'featured',
          label: config.attentionTiers?.featured?.label || 'Featured Job',
          description: config.attentionTiers?.featured?.description || 'Highlighted in search results',
          priceCentsPerDay: config.attentionTiers?.featured?.priceCentsPerDay || 100
        },
        {
          tier: 'urgent',
          label: config.attentionTiers?.urgent?.label || 'Urgently Hiring',
          description: config.attentionTiers?.urgent?.description || 'Urgent badge for 7 days',
          priceCentsFlat: config.attentionTiers?.urgent?.priceCentsFlat || 700,
          durationDays: config.attentionTiers?.urgent?.durationDays || 7
        }
      ],
      assistanceTiers: [
        {
          tier: 'none',
          label: 'Self-Service',
          description: 'Manage applications yourself'
        },
        {
          tier: 'assisted',
          label: config.assistanceTiers?.assisted?.label || 'Assisted Hiring',
          description: config.assistanceTiers?.assisted?.description || 'Platform screening assistance',
          priceCentsPerMonth: config.assistanceTiers?.assisted?.priceCentsPerMonth || 900
        }
      ]
    };
  } catch (error) {
    console.error('[tiering] Error fetching tier availability:', error);
    return {
      enabled: false,
      attentionTiers: [
        { tier: 'standard', label: 'Standard', description: 'Default visibility' }
      ],
      assistanceTiers: [
        { tier: 'none', label: 'Self-Service', description: 'Manage applications yourself' }
      ]
    };
  }
}

/**
 * Compute incremental tier price (base portal price NOT included)
 * Returns 0 if tiering is disabled
 */
export async function computeTierPrice(params: {
  tenantId?: string;
  portalId?: string;
  attentionTier: AttentionTier;
  assistanceTier: AssistanceTier;
  durationDays?: number;
}): Promise<{
  tierPriceCents: number;
  breakdown: {
    attentionPriceCents: number;
    assistancePriceCents: number;
  };
  enabled: boolean;
}> {
  const { tenantId, portalId, attentionTier, assistanceTier, durationDays = 30 } = params;

  const availability = await getTieringAvailability({ tenantId, portalId });

  if (!availability.enabled) {
    return {
      tierPriceCents: 0,
      breakdown: {
        attentionPriceCents: 0,
        assistancePriceCents: 0
      },
      enabled: false
    };
  }

  let attentionPriceCents = 0;
  let assistancePriceCents = 0;

  if (attentionTier === 'featured') {
    const featuredTier = availability.attentionTiers.find(t => t.tier === 'featured');
    if (featuredTier?.priceCentsPerDay) {
      attentionPriceCents = featuredTier.priceCentsPerDay * durationDays;
    }
  } else if (attentionTier === 'urgent') {
    const urgentTier = availability.attentionTiers.find(t => t.tier === 'urgent');
    if (urgentTier?.priceCentsFlat) {
      attentionPriceCents = urgentTier.priceCentsFlat;
    }
  }

  if (assistanceTier === 'assisted') {
    const assistedTier = availability.assistanceTiers.find(t => t.tier === 'assisted');
    if (assistedTier?.priceCentsPerMonth) {
      const months = Math.ceil(durationDays / 30);
      assistancePriceCents = assistedTier.priceCentsPerMonth * months;
    }
  }

  return {
    tierPriceCents: attentionPriceCents + assistancePriceCents,
    breakdown: {
      attentionPriceCents,
      assistancePriceCents
    },
    enabled: true
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
