/**
 * PROMPT-6: Authoritative Capability Snapshot
 * AUTH_CONSTITUTION.md governs; single authority for capability facts
 * 
 * Provides capability evaluation for effective_principal_id at all scope levels.
 * This is the ONLY source of truth for UI capability visibility.
 */

import { serviceQuery } from '../db/tenantDb';
import { resolvePlatformScopeId, resolveTenantScopeId } from './scope';

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
 */
export async function getCapabilitySnapshot(
  principalId: string | null,
  effectivePrincipalId: string | null,
  tenantId: string | null,
  organizationId: string | null = null
): Promise<CapabilitySnapshot> {
  const emptySnapshot: CapabilitySnapshot = {
    ok: true,
    principal_id: principalId,
    effective_principal_id: effectivePrincipalId,
    context: {
      platform_scope_id: resolvePlatformScopeId(),
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
  
  if (!effectivePrincipalId) {
    return emptySnapshot;
  }
  
  const platformScopeId = resolvePlatformScopeId();
  
  // Get platform-level capabilities
  const platformCaps = await getCapabilitiesAtScope(effectivePrincipalId, platformScopeId);
  
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
  };
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
