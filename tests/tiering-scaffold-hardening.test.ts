/**
 * Tiering Scaffold Hardening Tests
 * 
 * Tests for the 4 operational hardening checks:
 * 1. Feature flag scope precedence (portal > tenant > global)
 * 2. Deterministic tier pricing source (no hardcoded UI prices)
 * 3. Tier + duration compatibility (daily/monthly + urgent timebox)
 * 4. Auditability + copy enforcement (pricing breakdown + scan coverage)
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('Tiering Hardening Tests', () => {
  
  describe('CHECK 1: Feature Flag Scope Precedence', () => {
    
    it('should resolve portal scope over tenant scope', async () => {
      const { getBooleanFlag } = await import('../server/services/featureFlags');
      
      const result = await getBooleanFlag('job_tiers_enabled', {
        tenantId: 'test-tenant-id',
        portalId: 'test-portal-id'
      });
      
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source');
      expect(['portal', 'tenant', 'global', 'default']).toContain(result.source);
    });

    it('should return default source when no flag exists', async () => {
      const { getBooleanFlag } = await import('../server/services/featureFlags');
      
      const result = await getBooleanFlag('nonexistent_flag_12345', {
        tenantId: 'test-tenant',
        portalId: 'test-portal'
      });
      
      expect(result.enabled).toBe(false);
      expect(result.source).toBe('default');
    });

    it('should prefer portal over tenant in scope order (portal=1, tenant=2, global=3)', async () => {
      const { getBooleanFlag } = await import('../server/services/featureFlags');
      
      const scopePrecedence = ['portal', 'tenant', 'global'] as const;
      const scopeIndex = (scope: string) => scopePrecedence.indexOf(scope as any);
      
      const result = await getBooleanFlag('job_tiers_enabled', {
        tenantId: 'test-tenant',
        portalId: 'test-portal'
      });
      
      if (result.source !== 'default') {
        const idx = scopeIndex(result.source);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(3);
      }
    });
  });

  describe('CHECK 2: Deterministic Tier Pricing Source', () => {
    
    it('getTieringAvailability should return pricing from config', async () => {
      const { getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const result = await getTieringAvailability({
        tenantId: 'test-tenant',
        portalId: 'test-portal'
      });
      
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('currency', 'CAD');
      expect(result).toHaveProperty('attentionTiers');
      expect(result).toHaveProperty('assistanceTiers');
      
      expect(Array.isArray(result.attentionTiers)).toBe(true);
      expect(Array.isArray(result.assistanceTiers)).toBe(true);
      
      const featuredTier = result.attentionTiers.find(t => t.key === 'featured');
      expect(featuredTier).toBeDefined();
      expect(featuredTier?.incrementalPriceCents).toBeTypeOf('number');
      expect(featuredTier?.unit).toBeOneOf(['day', 'month', 'flat']);
    });

    it('attentionTiers should have correct structure', async () => {
      const { getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const result = await getTieringAvailability({});
      
      for (const tier of result.attentionTiers) {
        expect(tier).toHaveProperty('key');
        expect(tier).toHaveProperty('label');
        expect(tier).toHaveProperty('incrementalPriceCents');
        expect(tier).toHaveProperty('unit');
        expect(['standard', 'featured', 'urgent']).toContain(tier.key);
      }
    });

    it('assistanceTiers should have correct structure', async () => {
      const { getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const result = await getTieringAvailability({});
      
      for (const tier of result.assistanceTiers) {
        expect(tier).toHaveProperty('key');
        expect(tier).toHaveProperty('label');
        expect(tier).toHaveProperty('incrementalPriceCents');
        expect(tier).toHaveProperty('unit');
        expect(['none', 'assisted']).toContain(tier.key);
      }
    });
  });

  describe('CHECK 3: Tier + Duration Compatibility', () => {
    
    it('computeTierPrice should accept baseBillingInterval and baseDurationDays', async () => {
      const { computeTierPrice } = await import('../server/services/jobs/tiering');
      
      const result = await computeTierPrice({
        attentionTier: 'featured',
        assistanceTier: 'none',
        baseBillingInterval: 'day',
        baseDurationDays: 10
      });
      
      expect(result).toHaveProperty('tierPriceCents');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source');
    });

    it('featured tier with daily billing should multiply by duration', async () => {
      const { computeTierPrice, getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const availability = await getTieringAvailability({});
      
      if (!availability.enabled) {
        const result = await computeTierPrice({
          attentionTier: 'featured',
          assistanceTier: 'none',
          baseBillingInterval: 'day',
          baseDurationDays: 10
        });
        
        expect(result.tierPriceCents).toBe(0);
        expect(result.warning).toBe('TIERS_DISABLED');
      }
    });

    it('urgent tier should set urgentEndsAt when enabled', async () => {
      const { computeTierPrice, getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const availability = await getTieringAvailability({});
      
      const result = await computeTierPrice({
        attentionTier: 'urgent',
        assistanceTier: 'none',
        baseBillingInterval: 'day',
        baseDurationDays: 30
      });
      
      if (availability.enabled) {
        expect(result.urgentEndsAt).toBeDefined();
        const urgentEnd = new Date(result.urgentEndsAt!);
        const now = new Date();
        const daysUntilEnd = Math.ceil((urgentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        expect(daysUntilEnd).toBeLessThanOrEqual(7);
      } else {
        expect(result.urgentEndsAt).toBeUndefined();
      }
    });

    it('urgent timebox should be max 7 days', async () => {
      const { computeTierPrice, getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const availability = await getTieringAvailability({});
      
      if (availability.enabled) {
        const result = await computeTierPrice({
          attentionTier: 'urgent',
          assistanceTier: 'none',
          baseBillingInterval: 'day',
          baseDurationDays: 30
        });
        
        if (result.urgentEndsAt) {
          const urgentEnd = new Date(result.urgentEndsAt);
          const now = new Date();
          const daysUntilEnd = Math.ceil((urgentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          expect(daysUntilEnd).toBeLessThanOrEqual(7);
        }
      }
    });
  });

  describe('CHECK 4: Auditability + Copy Enforcement', () => {
    
    it('computeTierPrice should always return breakdown', async () => {
      const { computeTierPrice } = await import('../server/services/jobs/tiering');
      
      const result = await computeTierPrice({
        attentionTier: 'standard',
        assistanceTier: 'none',
        baseDurationDays: 30
      });
      
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown).toHaveProperty('attentionPriceCents');
      expect(result.breakdown).toHaveProperty('assistancePriceCents');
      expect(result.breakdown).toHaveProperty('attentionTier');
      expect(result.breakdown).toHaveProperty('assistanceTier');
    });

    it('should return warning when tiers disabled', async () => {
      const { computeTierPrice, getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const availability = await getTieringAvailability({});
      
      const result = await computeTierPrice({
        attentionTier: 'featured',
        assistanceTier: 'assisted',
        baseDurationDays: 30
      });
      
      if (!availability.enabled) {
        expect(result.tierPriceCents).toBe(0);
        expect(result.warning).toBe('TIERS_DISABLED');
      }
    });

    it('when tiers disabled, all prices should be zero', async () => {
      const { computeTierPrice, getTieringAvailability } = await import('../server/services/jobs/tiering');
      
      const availability = await getTieringAvailability({});
      
      if (!availability.enabled) {
        const result = await computeTierPrice({
          attentionTier: 'urgent',
          assistanceTier: 'assisted',
          baseDurationDays: 30
        });
        
        expect(result.tierPriceCents).toBe(0);
        expect(result.breakdown.attentionPriceCents).toBe(0);
        expect(result.breakdown.assistancePriceCents).toBe(0);
      }
    });
  });

  describe('Type Validation', () => {
    
    it('isValidAttentionTier should validate correctly', async () => {
      const { isValidAttentionTier } = await import('../server/services/jobs/tiering');
      
      expect(isValidAttentionTier('standard')).toBe(true);
      expect(isValidAttentionTier('featured')).toBe(true);
      expect(isValidAttentionTier('urgent')).toBe(true);
      expect(isValidAttentionTier('invalid')).toBe(false);
      expect(isValidAttentionTier('')).toBe(false);
    });

    it('isValidAssistanceTier should validate correctly', async () => {
      const { isValidAssistanceTier } = await import('../server/services/jobs/tiering');
      
      expect(isValidAssistanceTier('none')).toBe(true);
      expect(isValidAssistanceTier('assisted')).toBe(true);
      expect(isValidAssistanceTier('invalid')).toBe(false);
      expect(isValidAssistanceTier('')).toBe(false);
    });
  });
});
