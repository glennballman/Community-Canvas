/**
 * PROMPT-6: Authoritative Capability Snapshot
 * PROMPT-7: Platform Admin Bootstrap Capability Enforcement
 * PROMPT-8: Platform Admin Authority via Principal Grants (NOT cc_users.is_platform_admin)
 * AUTH_CONSTITUTION.md governs; single authority for capability facts
 * 
 * Provides capability evaluation for effective_principal_id at all scope levels.
 * This is the ONLY source of truth for UI capability visibility.
 * 
 * CONSTITUTIONAL INVARIANT (PROMPT-8):
 * Platform admin status is determined ONLY via cc_grants at platform scope.
 * cc_users.is_platform_admin is NON-AUTHORITATIVE (legacy/data-only).
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
 * PROMPT-8: Check if effective principal is a platform administrator
 * Queries cc_grants for platform_admin role at platform scope.
 * 
 * CONSTITUTIONAL: Platform admin status is determined ONLY via grants.
 * cc_users.is_platform_admin is NON-AUTHORITATIVE (legacy/data-only).
 * 
 * NO FALLBACK PATHS. If grant doesn't exist, returns false (fail-closed).
 */
async function isPlatformAdminPrincipal(effectivePrincipalId: string): Promise<boolean> {
  try {
    // Check for platform_admin role grant at platform scope
    const result = await serviceQuery(`
      SELECT 1 
      FROM cc_grants g
      WHERE g.principal_id = $1
        AND g.role_id = '10000000-0000-0000-0000-000000000001'::UUID  -- platform_admin role
        AND g.scope_id = '00000000-0000-0000-0000-000000000001'::UUID  -- platform scope
        AND g.is_active = TRUE
        AND g.revoked_at IS NULL
        AND g.valid_from <= NOW()
        AND (g.valid_until IS NULL OR g.valid_until > NOW())
      LIMIT 1
    `, [effectivePrincipalId]);
    
    return result.rows.length > 0;
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

/**
 * PROMPT-14: Authoritative Capability Snapshot Response Shape
 * This interface is LOCKED - changes require explicit versioning.
 * Client code may depend on this exact structure.
 */
export interface CapabilitySnapshot {
  /** PROMPT-14: Response version for client compatibility */
  version: "1";
  /** PROMPT-14: ISO timestamp when snapshot was generated */
  generatedAt: string;
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
 * PROMPT-14: Log successful snapshot generation to audit log
 * Records allow decisions for audit trail and compliance
 */
async function logSnapshotSuccess(
  principalId: string | null,
  effectivePrincipalId: string | null,
  capabilityCount: number
): Promise<void> {
  try {
    await serviceQuery(`
      INSERT INTO cc_auth_audit_log (
        principal_id, 
        effective_principal_id,
        action, 
        resource_type, 
        resource_id,
        scope_id,
        decision,
        metadata
      ) VALUES (
        $1,
        $2,
        'capability_snapshot_success',
        'snapshot',
        NULL,
        (SELECT id FROM cc_scopes WHERE scope_type = 'platform' LIMIT 1),
        'allow',
        jsonb_build_object(
          'capability_count', $3,
          'timestamp', NOW()::TEXT
        )
      )
    `, [principalId, effectivePrincipalId, capabilityCount]);
  } catch (logError) {
    // Don't fail snapshot if audit logging fails
    console.error('[logSnapshotSuccess] Failed to log snapshot success:', logError);
  }
}

/**
 * PROMPT-14: Log snapshot generation failure to audit log
 * Records deny-by-empty decisions for debugging and compliance
 */
async function logSnapshotFailure(
  principalId: string | null,
  effectivePrincipalId: string | null,
  reason: string,
  errorDetails?: string
): Promise<void> {
  try {
    await serviceQuery(`
      INSERT INTO cc_auth_audit_log (
        principal_id, 
        effective_principal_id,
        action, 
        resource_type, 
        resource_id,
        scope_id,
        decision,
        metadata
      ) VALUES (
        $1,
        $2,
        'capability_snapshot_failure',
        'snapshot',
        NULL,
        (SELECT id FROM cc_scopes WHERE scope_type = 'platform' LIMIT 1),
        'deny',
        jsonb_build_object(
          'reason', $3,
          'error', $4,
          'timestamp', NOW()::TEXT
        )
      )
    `, [principalId, effectivePrincipalId, reason, errorDetails || null]);
  } catch (logError) {
    console.error('[logSnapshotFailure] Failed to log snapshot failure:', logError);
  }
}

/**
 * Get all capabilities for a principal across all scopes (platform, org, tenant)
 * Returns comprehensive capability snapshot for UI gating
 * 
 * PROMPT-14: Response shape is LOCKED with explicit versioning.
 * FAIL-CLOSED: Always returns locked response shape, even on errors.
 * On any error, returns ok:false with empty capabilities AND logs audit event.
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
  const generatedAt = new Date().toISOString();
  
  // PROMPT-14: Fail-closed empty snapshot with versioned response shape
  const failClosedSnapshot: CapabilitySnapshot = {
    version: "1",
    generatedAt,
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
  
  // No effective principal = empty capabilities (not an error, but deny-by-empty)
  if (!effectivePrincipalId) {
    // PROMPT-14: Log deny-by-empty for missing principal
    await logSnapshotFailure(principalId, null, 'no_effective_principal');
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
    
    // PROMPT-14: Log successful snapshot generation for audit trail
    await logSnapshotSuccess(principalId, effectivePrincipalId, platformCaps.length + orgCaps.length + tenantCaps.length);
    
    // PROMPT-14: Return versioned response shape
    return {
      version: "1",
      generatedAt,
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
  } catch (error: any) {
    // PROMPT-14: FAIL-CLOSED - Any error returns empty capabilities AND logs audit event
    console.error('[getCapabilitySnapshot] Error evaluating capabilities, returning fail-closed:', error);
    await logSnapshotFailure(
      principalId, 
      effectivePrincipalId, 
      'evaluation_error', 
      error?.message || 'Unknown error'
    );
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
