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
 * 
 * PROMPT-7: First ensures cc_individuals record exists (required by FK constraint)
 * PROMPT-13: Delegates to ensure_principal_for_user DB function for idempotent creation
 * 
 * Identity Graph (PROMPT-13):
 * - cc_users: account record (email/login/profile)
 * - cc_individuals: person record (name/contact/personhood)  
 * - cc_principals: authorization actor record (user/service/machine)
 * FK chain: cc_principals.user_id -> cc_individuals.id (NOT cc_users!)
 */
export async function getOrCreatePrincipal(userId: string, _displayName?: string, _email?: string): Promise<string> {
  // PROMPT-13: Use the DB function which handles the full identity graph chain
  // cc_users -> cc_individuals -> cc_principals
  const result = await serviceQuery(`
    SELECT ensure_principal_for_user($1) as principal_id
  `, [userId]);
  
  return result.rows[0]?.principal_id || null;
}
