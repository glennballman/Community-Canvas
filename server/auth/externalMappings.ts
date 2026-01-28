/**
 * PROMPT-15: External Role Mapping Enforcement
 * AUTH_CONSTITUTION.md governs; fail-closed resolver
 * 
 * Translates external system roles to internal role codes.
 * NEVER assigns silent defaults - unmapped roles are denied.
 */

import { serviceQuery } from '../db/tenantDb';

export interface ExternalRoleMappingResult {
  ok: boolean;
  roleCode: string | null;
  roleId: string | null;
  roleName: string | null;
  capabilities: string[];
  error?: string;
}

export interface ExternalMappingPreview {
  ok: boolean;
  externalSystem: string;
  externalRoleCode: string;
  mappedRoleCode: string | null;
  mappedRoleName: string | null;
  capabilities: string[];
  error?: string;
  generatedAt: string;
}

/**
 * Resolve external system role to internal role code
 * FAIL-CLOSED: Returns null/error if mapping not found
 * AUDITABLE: Logs deny reasons when mapping is missing
 */
export async function resolveExternalRoleToRoleCode(
  externalSystem: string,
  externalRoleCode: string
): Promise<ExternalRoleMappingResult> {
  
  // Validate inputs
  if (!externalSystem || typeof externalSystem !== 'string') {
    await logMappingDeny(externalSystem, externalRoleCode, 'invalid_external_system');
    return {
      ok: false,
      roleCode: null,
      roleId: null,
      roleName: null,
      capabilities: [],
      error: 'invalid_external_system'
    };
  }

  if (!externalRoleCode || typeof externalRoleCode !== 'string') {
    await logMappingDeny(externalSystem, externalRoleCode, 'invalid_external_role_code');
    return {
      ok: false,
      roleCode: null,
      roleId: null,
      roleName: null,
      capabilities: [],
      error: 'invalid_external_role_code'
    };
  }

  // Normalize inputs
  const normalizedSystem = externalSystem.toLowerCase().trim();
  const normalizedRole = externalRoleCode.toLowerCase().trim();

  try {
    // Query cc_roles for the mapping
    const result = await serviceQuery(`
      SELECT 
        r.id,
        r.code,
        r.name
      FROM cc_roles r
      WHERE r.external_system = $1
        AND r.external_role_code = $2
        AND r.is_active = true
      LIMIT 1
    `, [normalizedSystem, normalizedRole]);

    if (result.rows.length === 0) {
      await logMappingDeny(normalizedSystem, normalizedRole, 'no_mapping_found');
      return {
        ok: false,
        roleCode: null,
        roleId: null,
        roleName: null,
        capabilities: [],
        error: 'no_mapping_found'
      };
    }

    const role = result.rows[0];

    // Get capabilities for this role
    const capsResult = await serviceQuery(`
      SELECT c.code
      FROM cc_role_capabilities rc
      JOIN cc_capabilities c ON rc.capability_id = c.id
      WHERE rc.role_id = $1
      ORDER BY c.code
    `, [role.id]);

    const capabilities = capsResult.rows.map((r: any) => r.code);

    await logMappingAllow(normalizedSystem, normalizedRole, role.code);

    return {
      ok: true,
      roleCode: role.code,
      roleId: role.id,
      roleName: role.name,
      capabilities
    };
  } catch (error) {
    console.error('[resolveExternalRoleToRoleCode] Error:', error);
    await logMappingDeny(normalizedSystem, normalizedRole, 'query_error');
    return {
      ok: false,
      roleCode: null,
      roleId: null,
      roleName: null,
      capabilities: [],
      error: 'query_error'
    };
  }
}

/**
 * Get preview of external role mapping for QA/ingestion pipelines
 */
export async function getExternalMappingPreview(
  externalSystem: string,
  externalRoleCode: string
): Promise<ExternalMappingPreview> {
  const generatedAt = new Date().toISOString();
  
  const result = await resolveExternalRoleToRoleCode(externalSystem, externalRoleCode);

  return {
    ok: result.ok,
    externalSystem,
    externalRoleCode,
    mappedRoleCode: result.roleCode,
    mappedRoleName: result.roleName,
    capabilities: result.capabilities,
    error: result.error,
    generatedAt
  };
}

/**
 * List all supported external systems
 */
export async function listExternalSystems(): Promise<string[]> {
  try {
    const result = await serviceQuery(`
      SELECT DISTINCT external_system
      FROM cc_roles
      WHERE external_system IS NOT NULL
        AND is_active = true
      ORDER BY external_system
    `);
    return result.rows.map((r: any) => r.external_system);
  } catch (error) {
    console.error('[listExternalSystems] Error:', error);
    return [];
  }
}

/**
 * List all mappings for a specific external system
 */
export async function listMappingsForSystem(
  externalSystem: string
): Promise<Array<{ externalRoleCode: string; roleCode: string; roleName: string }>> {
  try {
    const result = await serviceQuery(`
      SELECT 
        external_role_code,
        code,
        name
      FROM cc_roles
      WHERE external_system = $1
        AND external_role_code IS NOT NULL
        AND is_active = true
      ORDER BY external_role_code
    `, [externalSystem.toLowerCase().trim()]);

    return result.rows.map((r: any) => ({
      externalRoleCode: r.external_role_code,
      roleCode: r.code,
      roleName: r.name
    }));
  } catch (error) {
    console.error('[listMappingsForSystem] Error:', error);
    return [];
  }
}

/**
 * Log mapping deny to audit log
 */
async function logMappingDeny(
  externalSystem: string | null,
  externalRoleCode: string | null,
  reason: string
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
        NULL,
        NULL,
        'external_role_mapping',
        'external_mapping',
        NULL,
        (SELECT id FROM cc_scopes WHERE scope_type = 'platform' LIMIT 1),
        'deny',
        jsonb_build_object(
          'external_system', $1,
          'external_role_code', $2,
          'reason', $3,
          'timestamp', NOW()::TEXT
        )
      )
    `, [externalSystem, externalRoleCode, reason]);
  } catch (logError) {
    console.error('[logMappingDeny] Failed to log deny:', logError);
  }
}

/**
 * Log mapping allow to audit log
 */
async function logMappingAllow(
  externalSystem: string,
  externalRoleCode: string,
  mappedRoleCode: string
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
        NULL,
        NULL,
        'external_role_mapping',
        'external_mapping',
        NULL,
        (SELECT id FROM cc_scopes WHERE scope_type = 'platform' LIMIT 1),
        'allow',
        jsonb_build_object(
          'external_system', $1,
          'external_role_code', $2,
          'mapped_role_code', $3,
          'timestamp', NOW()::TEXT
        )
      )
    `, [externalSystem, externalRoleCode, mappedRoleCode]);
  } catch (logError) {
    console.error('[logMappingAllow] Failed to log allow:', logError);
  }
}
