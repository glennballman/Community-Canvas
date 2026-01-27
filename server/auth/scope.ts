/**
 * PART 2B: Scope Resolution (Deterministic + Idempotent)
 * AUTH_CONSTITUTION.md governs; all scopes resolved via hierarchy
 */

import { serviceQuery } from '../db/tenantDb';

const PLATFORM_SCOPE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Returns the singleton platform scope ID
 */
export function resolvePlatformScopeId(): string {
  return PLATFORM_SCOPE_ID;
}

/**
 * Resolves or creates organization scope (idempotent)
 */
export async function resolveOrganizationScopeId(orgId: string): Promise<string | null> {
  const result = await serviceQuery(`
    SELECT id FROM cc_scopes 
    WHERE scope_type = 'organization' AND organization_id = $1
  `, [orgId]);
  
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  
  // Create if missing (trigger should handle this, but fallback)
  const insert = await serviceQuery(`
    INSERT INTO cc_scopes (scope_type, organization_id, parent_scope_id, scope_path)
    VALUES ('organization', $1, $2, 'platform/org:' || $1::text)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [orgId, PLATFORM_SCOPE_ID]);
  
  if (insert.rows[0]) {
    return insert.rows[0].id;
  }
  
  // Race condition - refetch
  const refetch = await serviceQuery(`
    SELECT id FROM cc_scopes 
    WHERE scope_type = 'organization' AND organization_id = $1
  `, [orgId]);
  
  return refetch.rows[0]?.id || null;
}

/**
 * Resolves or creates tenant scope (idempotent)
 */
export async function resolveTenantScopeId(tenantId: string): Promise<string | null> {
  // Use the DB function for race-safe upsert
  const result = await serviceQuery(`
    SELECT get_or_create_tenant_scope($1) as scope_id
  `, [tenantId]);
  
  return result.rows[0]?.scope_id || null;
}

/**
 * Resolves or creates resource-type scope under a tenant (idempotent)
 */
export async function resolveResourceTypeScopeId(
  tenantId: string, 
  resourceTypeCode: string
): Promise<string | null> {
  // First get the tenant scope
  const tenantScopeId = await resolveTenantScopeId(tenantId);
  if (!tenantScopeId) {
    return null;
  }
  
  // Check existing
  const result = await serviceQuery(`
    SELECT id FROM cc_scopes 
    WHERE scope_type = 'resource_type' 
      AND tenant_id = $1 
      AND resource_type = $2
  `, [tenantId, resourceTypeCode]);
  
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  
  // Get tenant path for scope_path construction
  const tenantScope = await serviceQuery(`
    SELECT scope_path FROM cc_scopes WHERE id = $1
  `, [tenantScopeId]);
  const tenantPath = tenantScope.rows[0]?.scope_path || 'platform/tenant:' + tenantId;
  
  // Create if missing
  const insert = await serviceQuery(`
    INSERT INTO cc_scopes (scope_type, tenant_id, resource_type, parent_scope_id, scope_path)
    VALUES ('resource_type', $1, $2, $3, $4)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [tenantId, resourceTypeCode, tenantScopeId, `${tenantPath}/type:${resourceTypeCode}`]);
  
  if (insert.rows[0]) {
    return insert.rows[0].id;
  }
  
  // Race condition - refetch
  const refetch = await serviceQuery(`
    SELECT id FROM cc_scopes 
    WHERE scope_type = 'resource_type' 
      AND tenant_id = $1 
      AND resource_type = $2
  `, [tenantId, resourceTypeCode]);
  
  return refetch.rows[0]?.id || null;
}

/**
 * Resolves or creates resource scope (idempotent)
 */
export async function resolveResourceScopeId(
  tenantId: string,
  resourceType: string,
  resourceId: string
): Promise<string | null> {
  // First get the resource-type scope
  const resourceTypeScopeId = await resolveResourceTypeScopeId(tenantId, resourceType);
  if (!resourceTypeScopeId) {
    return null;
  }
  
  // Check existing
  const result = await serviceQuery(`
    SELECT id FROM cc_scopes 
    WHERE scope_type = 'resource' 
      AND tenant_id = $1 
      AND resource_type = $2 
      AND resource_id = $3
  `, [tenantId, resourceType, resourceId]);
  
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  
  // Get parent path
  const parentScope = await serviceQuery(`
    SELECT scope_path FROM cc_scopes WHERE id = $1
  `, [resourceTypeScopeId]);
  const parentPath = parentScope.rows[0]?.scope_path || '';
  
  // Create if missing
  const insert = await serviceQuery(`
    INSERT INTO cc_scopes (scope_type, tenant_id, resource_type, resource_id, parent_scope_id, scope_path)
    VALUES ('resource', $1, $2, $3, $4, $5)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [tenantId, resourceType, resourceId, resourceTypeScopeId, `${parentPath}/res:${resourceId}`]);
  
  if (insert.rows[0]) {
    return insert.rows[0].id;
  }
  
  // Race condition - refetch
  const refetch = await serviceQuery(`
    SELECT id FROM cc_scopes 
    WHERE scope_type = 'resource' 
      AND tenant_id = $1 
      AND resource_type = $2 
      AND resource_id = $3
  `, [tenantId, resourceType, resourceId]);
  
  return refetch.rows[0]?.id || null;
}
