/**
 * PROMPT-6: Authoritative Capability Snapshot
 * PROMPT-7: Platform Admin Bootstrap Capability Enforcement
 * AUTH_CONSTITUTION.md governs; single authority for capability facts
 * 
 * Provides capability evaluation for effective_principal_id at all scope levels.
 * This is the ONLY source of truth for UI capability visibility.
 * 
 * CONSTITUTIONAL INVARIANT (PROMPT-7):
 * Platform administrators MUST always have platform-level capabilities.
 * This is enforced via bootstrap rules BEFORE DB capability evaluation.
 */

import { serviceQuery } from '../db/tenantDb';
import { resolvePlatformScopeId, resolveTenantScopeId } from './scope';

/**
 * PROMPT-7: Bootstrap capabilities for platform administrators
 * These are CONSTITUTIONAL capabilities that bypass DB evaluation.
 * A platform admin MUST always be able to access the platform.
 */
const PLATFORM_ADMIN_BOOTSTRAP_CAPABILITIES = [
  'platform.configure',
  'platform.read',
  'platform.admin',
] as const;

/**
 * PROMPT-7: Check if effective principal is a platform administrator
 * Queries cc_principals -> cc_users to get is_platform_admin flag
 * 
 * CONSTITUTIONAL: NO FALLBACK PATHS. Principal must exist.
 * If principal doesn't exist, returns false (fail-closed).
 */
async function isPlatformAdminPrincipal(effectivePrincipalId: string): Promise<boolean> {
  try {
    // cc_principals.user_id -> cc_users.id where is_platform_admin = true
    const result = await serviceQuery(`
      SELECT u.is_platform_admin 
      FROM cc_principals p
      JOIN cc_users u ON p.user_id = u.id
      WHERE p.id = $1
    `, [effectivePrincipalId]);
    
    return result.rows[0]?.is_platform_admin === true;
  } catch (error) {
    // Fail-closed: if we can't determine, assume not admin
    console.error('[isPlatformAdminPrincipal] Error checking platform admin status:', error);
    return false;
  }
}

/**
 * PROMPT-7: Get bootstrap capabilities for effective principal
 * Returns platform admin capabilities if principal is a platform admin.
 * This is a constitutional override, not a role mapping.
 */
async function getBootstrapCapabilities(
  effectivePrincipalId: string
): Promise<{ platform: string[]; source: 'bootstrap' | 'none' }> {
  const isAdmin = await isPlatformAdminPrincipal(effectivePrincipalId);
  
  if (isAdmin) {
    console.log('[getBootstrapCapabilities] Platform admin detected, applying bootstrap capabilities', {
      effectivePrincipalId,
      capabilities: PLATFORM_ADMIN_BOOTSTRAP_CAPABILITIES,
    });
    return {
      platform: [...PLATFORM_ADMIN_BOOTSTRAP_CAPABILITIES],
      source: 'bootstrap',
    };
  }
  
  return { platform: [], source: 'none' };
}

/**
 * PROMPT-7: Audit log bootstrap capability application
 * Records that capabilities were granted via bootstrap rule, not DB grants
 */
async function logBootstrapCapabilities(
  effectivePrincipalId: string,
  capabilities: string[],
  tenantId: string | null
): Promise<void> {
  try {
    // Insert audit record with source = 'bootstrap'
    await serviceQuery(`
      INSERT INTO cc_auth_audit_log (
        principal_id, 
        action, 
        resource_type, 
        resource_id,
        scope_id,
        decision,
        metadata
      ) VALUES (
        $1,
        'capability_bootstrap',
        'platform',
        NULL,
        (SELECT id FROM cc_scopes WHERE scope_type = 'platform' LIMIT 1),
        'allow',
        jsonb_build_object(
          'source', 'bootstrap',
          'capabilities', $2::jsonb,
          'tenant_id', $3,
          'reason', 'platform_admin_constitutional_rule'
        )
      )
    `, [effectivePrincipalId, JSON.stringify(capabilities), tenantId]);
  } catch (error) {
    // Don't fail capability evaluation if audit logging fails
    console.error('[logBootstrapCapabilities] Failed to log bootstrap capabilities:', error);
  }
}

export interface CapabilitySnapshot {
  ok: boolean;
  principal_id: string | null;
  effective_principal_id: string | null;
  context: {
    platform_scope_id: string;
    organization_scope_id: string | null;
    tenant_scope_id: string | null;
    tenant_id: string | null;
    organization_id: string | null;
  };
  capabilities: {
    platform: string[];
    organization: string[];
    tenant: string[];
    resource_types: Record<string, string[]>;
  };
  /** PROMPT-7: Metadata about capability sources for audit logging */
  _meta?: {
    bootstrap_applied: boolean;
    bootstrap_capabilities: string[];
  };
}

/**
 * Get all capabilities for a principal at a specific scope
 * Evaluates both direct capability grants and role-based grants
 */
async function getCapabilitiesAtScope(
  principalId: string,
  scopeId: string
): Promise<string[]> {
  const result = await serviceQuery(`
    WITH effective_capabilities AS (
      -- Direct capability grants at this scope or ancestor scopes
      SELECT DISTINCT c.code
      FROM cc_grants g
      JOIN cc_capabilities c ON g.capability_id = c.id
      WHERE g.principal_id = $1
        AND g.grant_type = 'capability'
        AND g.is_active = TRUE
        AND g.revoked_at IS NULL
        AND g.valid_from <= NOW()
        AND (g.valid_until IS NULL OR g.valid_until > NOW())
        AND (
          g.scope_id = $2 
          OR scope_is_ancestor_of(g.scope_id, $2)
        )
      
      UNION
      
      -- Role-based capability grants at this scope or ancestor scopes
      SELECT DISTINCT c.code
      FROM cc_grants g
      JOIN cc_role_capabilities rc ON g.role_id = rc.role_id
      JOIN cc_capabilities c ON rc.capability_id = c.id
      WHERE g.principal_id = $1
        AND g.grant_type = 'role'
        AND g.is_active = TRUE
        AND g.revoked_at IS NULL
        AND g.valid_from <= NOW()
        AND (g.valid_until IS NULL OR g.valid_until > NOW())
        AND (
          g.scope_id = $2 
          OR scope_is_ancestor_of(g.scope_id, $2)
        )
    )
    SELECT code FROM effective_capabilities ORDER BY code
  `, [principalId, scopeId]);
  
  return result.rows.map(row => row.code);
}

/**
 * Get all capabilities for a principal across all scopes (platform, org, tenant)
 * Returns comprehensive capability snapshot for UI gating
 * 
 * FAIL-CLOSED: Always returns locked response shape, even on errors.
 * On any error, returns ok:false with empty capabilities.
 * 
 * PROMPT-7: Bootstrap capabilities are applied for platform admins
 * via principal → user link. NO userId parameter - principals must exist.
 */
export async function getCapabilitySnapshot(
  principalId: string | null,
  effectivePrincipalId: string | null,
  tenantId: string | null,
  organizationId: string | null = null
): Promise<CapabilitySnapshot> {
  const platformScopeId = resolvePlatformScopeId();
  
  // Fail-closed empty snapshot (used on any error or missing principal)
  const failClosedSnapshot: CapabilitySnapshot = {
    ok: false,
    principal_id: principalId,
    effective_principal_id: effectivePrincipalId,
    context: {
      platform_scope_id: platformScopeId,
      organization_scope_id: null,
      tenant_scope_id: null,
      tenant_id: tenantId,
      organization_id: organizationId,
    },
    capabilities: {
      platform: [],
      organization: [],
      tenant: [],
      resource_types: {},
    },
  };
  
  // No effective principal = empty capabilities (not an error, but no access)
  if (!effectivePrincipalId) {
    return { ...failClosedSnapshot, ok: true };
  }
  
  try {
    // PROMPT-7: Get bootstrap capabilities BEFORE DB evaluation
    // This is a constitutional override for platform administrators
    const bootstrap = await getBootstrapCapabilities(effectivePrincipalId);
    
    // Get platform-level capabilities from DB
    const dbPlatformCaps = await getCapabilitiesAtScope(effectivePrincipalId, platformScopeId);
    
    // Merge bootstrap + DB capabilities (deduplicated)
    const platformCaps = Array.from(new Set([...bootstrap.platform, ...dbPlatformCaps]));
    
    // Get organization-level capabilities (if organization context exists)
    let orgCaps: string[] = [];
    let orgScopeId: string | null = null;
    
    if (organizationId && effectivePrincipalId) {
      const orgScopeResult = await serviceQuery(`
        SELECT id FROM cc_scopes 
        WHERE scope_type = 'organization' AND organization_id = $1
      `, [organizationId]);
      
      if (orgScopeResult.rows[0]) {
        const foundOrgScopeId: string = orgScopeResult.rows[0].id;
        orgScopeId = foundOrgScopeId;
        orgCaps = await getCapabilitiesAtScope(effectivePrincipalId, foundOrgScopeId);
      }
    }
    
    // Get tenant-level capabilities (if tenant context exists)
    let tenantCaps: string[] = [];
    let tenantScopeId: string | null = null;
    
    if (tenantId) {
      tenantScopeId = await resolveTenantScopeId(tenantId);
      if (tenantScopeId) {
        tenantCaps = await getCapabilitiesAtScope(effectivePrincipalId, tenantScopeId);
      }
    }
    
    // Get resource-type level capabilities (for common resource types in current tenant)
    // NOTE: Resource-level (individual resource) capabilities are not yet implemented
    const resourceTypeCaps: Record<string, string[]> = {};
    
    if (tenantId) {
      // Query all resource-type scopes under this tenant
      const resourceTypeScopesResult = await serviceQuery(`
        SELECT id, resource_type FROM cc_scopes 
        WHERE scope_type = 'resource_type' AND tenant_id = $1
      `, [tenantId]);
      
      for (const row of resourceTypeScopesResult.rows) {
        const caps = await getCapabilitiesAtScope(effectivePrincipalId, row.id);
        if (caps.length > 0) {
          resourceTypeCaps[row.resource_type] = caps;
        }
      }
    }
    
    // PROMPT-7: Audit log if bootstrap capabilities were applied
    if (bootstrap.source === 'bootstrap') {
      await logBootstrapCapabilities(effectivePrincipalId, bootstrap.platform, tenantId);
    }
    
    return {
      ok: true,
      principal_id: principalId,
      effective_principal_id: effectivePrincipalId,
      context: {
        platform_scope_id: platformScopeId,
        organization_scope_id: orgScopeId,
        tenant_scope_id: tenantScopeId,
        tenant_id: tenantId,
        organization_id: organizationId,
      },
      capabilities: {
        platform: platformCaps,
        organization: orgCaps,
        tenant: tenantCaps,
        resource_types: resourceTypeCaps,
      },
      // PROMPT-7: Include metadata about bootstrap capabilities
      _meta: {
        bootstrap_applied: bootstrap.source === 'bootstrap',
        bootstrap_capabilities: bootstrap.platform,
      },
    };
  } catch (error) {
    // FAIL-CLOSED: Any error returns empty capabilities
    console.error('[getCapabilitySnapshot] Error evaluating capabilities, returning fail-closed:', error);
    return failClosedSnapshot;
  }
}

/**
 * Check if a capability code exists in the snapshot
 * Used by client-side canUI() for exact capability lookups
 */
export function hasCapability(
  snapshot: CapabilitySnapshot,
  capabilityCode: string
): boolean {
  // Check platform capabilities
  if (snapshot.capabilities.platform.includes(capabilityCode)) {
    return true;
  }
  
  // Check organization capabilities
  if (snapshot.capabilities.organization.includes(capabilityCode)) {
    return true;
  }
  
  // Check tenant capabilities
  if (snapshot.capabilities.tenant.includes(capabilityCode)) {
    return true;
  }
  
  // Check resource-type capabilities
  for (const resourceType in snapshot.capabilities.resource_types) {
    if (snapshot.capabilities.resource_types[resourceType].includes(capabilityCode)) {
      return true;
    }
  }
  
  return false;
}
