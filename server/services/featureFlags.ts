/**
 * Feature Flags Service
 * 
 * Centralized feature flag resolution with proper scope precedence:
 * 1. portal-scoped (scope_type='portal' AND scope_id=portalId)
 * 2. tenant-scoped (scope_type='tenant' AND scope_id=tenantId)
 * 3. global (scope_type='global' AND scope_id IS NULL)
 * Default: false
 */

import { serviceQuery } from '../db/tenantDb';

export type FlagScope = 'portal' | 'tenant' | 'global' | 'default';

export interface FlagResolution<T = boolean> {
  enabled: T;
  source: FlagScope;
  config?: Record<string, unknown>;
  key: string;
}

export interface FlagContext {
  tenantId?: string;
  portalId?: string;
}

/**
 * Get a boolean feature flag with proper scope precedence:
 * portal > tenant > global > default(false)
 */
export async function getBooleanFlag(
  key: string,
  context: FlagContext
): Promise<FlagResolution<boolean>> {
  const { tenantId, portalId } = context;

  try {
    const result = await serviceQuery(`
      SELECT key, is_enabled, scope_type, scope_id, config
      FROM cc_feature_flags
      WHERE key = $1
        AND (
          (scope_type = 'portal' AND scope_id = $2)
          OR (scope_type = 'tenant' AND scope_id = $3)
          OR (scope_type = 'global' AND scope_id IS NULL)
        )
      ORDER BY 
        CASE scope_type 
          WHEN 'portal' THEN 1 
          WHEN 'tenant' THEN 2 
          WHEN 'global' THEN 3 
        END
      LIMIT 1
    `, [key, portalId || null, tenantId || null]);

    if (result.rows.length === 0) {
      return {
        enabled: false,
        source: 'default',
        key
      };
    }

    const flag = result.rows[0];
    return {
      enabled: Boolean(flag.is_enabled),
      source: flag.scope_type as FlagScope,
      config: flag.config,
      key
    };
  } catch (error) {
    console.error(`[featureFlags] Error fetching flag ${key}:`, error);
    return {
      enabled: false,
      source: 'default',
      key
    };
  }
}

/**
 * Get all flags for a given context (for debugging/admin)
 */
export async function getAllFlags(
  context: FlagContext
): Promise<FlagResolution<boolean>[]> {
  const { tenantId, portalId } = context;

  try {
    const result = await serviceQuery(`
      WITH ranked_flags AS (
        SELECT 
          key, is_enabled, scope_type, scope_id, config,
          ROW_NUMBER() OVER (
            PARTITION BY key 
            ORDER BY 
              CASE scope_type 
                WHEN 'portal' THEN 1 
                WHEN 'tenant' THEN 2 
                WHEN 'global' THEN 3 
              END
          ) as rn
        FROM cc_feature_flags
        WHERE (scope_type = 'portal' AND scope_id = $1)
          OR (scope_type = 'tenant' AND scope_id = $2)
          OR (scope_type = 'global' AND scope_id IS NULL)
      )
      SELECT key, is_enabled, scope_type, config
      FROM ranked_flags
      WHERE rn = 1
    `, [portalId || null, tenantId || null]);

    return result.rows.map(row => ({
      enabled: Boolean(row.is_enabled),
      source: row.scope_type as FlagScope,
      config: row.config,
      key: row.key
    }));
  } catch (error) {
    console.error('[featureFlags] Error fetching all flags:', error);
    return [];
  }
}

/**
 * Check if a specific flag is enabled (convenience function)
 */
export async function isFlagEnabled(
  key: string,
  context: FlagContext
): Promise<boolean> {
  const resolution = await getBooleanFlag(key, context);
  return resolution.enabled;
}
