/**
 * PART 2A: Principal Resolution (Single Authority)
 * AUTH_CONSTITUTION.md governs; no parallel identity sources
 */

import { Request } from 'express';
import { serviceQuery } from '../db/tenantDb';

export interface PrincipalContext {
  principalId: string | null;
  effectivePrincipalId: string | null;
  isImpersonating: boolean;
  userId: string | null;
  effectiveUserId: string | null;
}

/**
 * Resolves principal from session - SINGLE AUTHORITY for identity
 * 
 * Returns:
 * - principalId: Principal for the real logged-in user
 * - effectivePrincipalId: Principal for impersonated user if impersonating, else principalId
 * - isImpersonating: true if impersonation is active
 */
export async function resolvePrincipalFromSession(req: Request): Promise<PrincipalContext> {
  const session = (req as any).session;
  const realUserId = session?.userId || (req as any).user?.userId || null;
  
  if (!realUserId) {
    return {
      principalId: null,
      effectivePrincipalId: null,
      isImpersonating: false,
      userId: null,
      effectiveUserId: null,
    };
  }
  
  // Check for active impersonation in session
  const impersonation = session?.impersonation;
  const isImpersonating = !!(
    impersonation?.impersonated_user_id &&
    impersonation?.expires_at &&
    new Date(impersonation.expires_at) > new Date()
  );
  
  const effectiveUserId = isImpersonating 
    ? impersonation.impersonated_user_id 
    : realUserId;
  
  // Resolve principal_id for real user
  const realPrincipalResult = await serviceQuery(`
    SELECT id FROM cc_principals 
    WHERE user_id = $1 AND is_active = TRUE
    LIMIT 1
  `, [realUserId]);
  
  const principalId = realPrincipalResult.rows[0]?.id || null;
  
  // Resolve principal_id for effective user (same if not impersonating)
  let effectivePrincipalId = principalId;
  
  if (isImpersonating && effectiveUserId !== realUserId) {
    const effectivePrincipalResult = await serviceQuery(`
      SELECT id FROM cc_principals 
      WHERE user_id = $1 AND is_active = TRUE
      LIMIT 1
    `, [effectiveUserId]);
    
    effectivePrincipalId = effectivePrincipalResult.rows[0]?.id || null;
  }
  
  return {
    principalId,
    effectivePrincipalId,
    isImpersonating,
    userId: realUserId,
    effectiveUserId,
  };
}

/**
 * Get or create principal for a user
 * Used during user creation or first login
 */
export async function getOrCreatePrincipal(userId: string, displayName: string, email?: string): Promise<string> {
  // First try to find existing principal
  const existing = await serviceQuery(`
    SELECT id FROM cc_principals WHERE user_id = $1 AND is_active = TRUE LIMIT 1
  `, [userId]);
  
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }
  
  // Create new principal
  const result = await serviceQuery(`
    INSERT INTO cc_principals (principal_type, user_id, display_name, email)
    VALUES ('user', $1, $2, $3)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [userId, displayName, email]);
  
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  
  // Race condition - re-fetch
  const refetch = await serviceQuery(`
    SELECT id FROM cc_principals WHERE user_id = $1 AND is_active = TRUE LIMIT 1
  `, [userId]);
  
  return refetch.rows[0]?.id || null;
}
