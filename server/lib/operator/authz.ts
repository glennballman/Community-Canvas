import { db } from '../../db';
import { sql } from 'drizzle-orm';

export type OperatorRoleKey = 'emergency_operator' | 'legal_operator' | 'insurance_operator' | 'platform_operator';

export interface OperatorAuthContext {
  tenantId: string;
  circleId?: string;
  individualId: string;
}

export interface OperatorRoleCheckResult {
  hasRole: boolean;
  roleId?: string;
  assignmentId?: string;
}

export async function isOperatorRole(
  roleKey: OperatorRoleKey,
  context: OperatorAuthContext
): Promise<OperatorRoleCheckResult> {
  const { tenantId, circleId, individualId } = context;
  
  const query = circleId
    ? sql`
        SELECT 
          ora.id as assignment_id,
          ora.role_id,
          opr.role_key
        FROM cc_operator_role_assignments ora
        JOIN cc_operator_roles opr ON ora.role_id = opr.id
        WHERE ora.tenant_id = ${tenantId}
          AND ora.individual_id = ${individualId}
          AND ora.status = 'active'
          AND opr.role_key = ${roleKey}
          AND (ora.circle_id IS NULL OR ora.circle_id = ${circleId})
        LIMIT 1
      `
    : sql`
        SELECT 
          ora.id as assignment_id,
          ora.role_id,
          opr.role_key
        FROM cc_operator_role_assignments ora
        JOIN cc_operator_roles opr ON ora.role_id = opr.id
        WHERE ora.tenant_id = ${tenantId}
          AND ora.individual_id = ${individualId}
          AND ora.status = 'active'
          AND opr.role_key = ${roleKey}
          AND ora.circle_id IS NULL
        LIMIT 1
      `;
  
  const result = await db.execute(query);
  
  if (result.rows.length === 0) {
    return { hasRole: false };
  }
  
  const row = result.rows[0] as { assignment_id: string; role_id: string };
  return {
    hasRole: true,
    roleId: row.role_id,
    assignmentId: row.assignment_id,
  };
}

export async function requireOperatorRole(
  roleKey: OperatorRoleKey,
  context: OperatorAuthContext
): Promise<{ roleId: string; assignmentId: string }> {
  const result = await isOperatorRole(roleKey, context);
  
  if (!result.hasRole) {
    const error = new Error(`Operator role '${roleKey}' required`);
    (error as any).statusCode = 403;
    (error as any).code = 'OPERATOR_ROLE_REQUIRED';
    throw error;
  }
  
  return {
    roleId: result.roleId!,
    assignmentId: result.assignmentId!,
  };
}

export async function getOperatorRoles(
  context: OperatorAuthContext
): Promise<{ roleKey: OperatorRoleKey; roleId: string; title: string }[]> {
  const { tenantId, circleId, individualId } = context;
  
  const query = circleId
    ? sql`
        SELECT 
          opr.id as role_id,
          opr.role_key,
          opr.title
        FROM cc_operator_role_assignments ora
        JOIN cc_operator_roles opr ON ora.role_id = opr.id
        WHERE ora.tenant_id = ${tenantId}
          AND ora.individual_id = ${individualId}
          AND ora.status = 'active'
          AND (ora.circle_id IS NULL OR ora.circle_id = ${circleId})
      `
    : sql`
        SELECT 
          opr.id as role_id,
          opr.role_key,
          opr.title
        FROM cc_operator_role_assignments ora
        JOIN cc_operator_roles opr ON ora.role_id = opr.id
        WHERE ora.tenant_id = ${tenantId}
          AND ora.individual_id = ${individualId}
          AND ora.status = 'active'
          AND ora.circle_id IS NULL
      `;
  
  const result = await db.execute(query);
  
  return result.rows.map((row: any) => ({
    roleKey: row.role_key as OperatorRoleKey,
    roleId: row.role_id,
    title: row.title,
  }));
}

export async function assignOperatorRole(
  roleKey: OperatorRoleKey,
  targetIndividualId: string,
  context: OperatorAuthContext & { assignedByIndividualId: string }
): Promise<string> {
  const { tenantId, circleId, assignedByIndividualId } = context;
  
  const roleResult = await db.execute(sql`
    SELECT id FROM cc_operator_roles
    WHERE tenant_id = ${tenantId} AND role_key = ${roleKey}
  `);
  
  let roleId: string;
  
  if (roleResult.rows.length === 0) {
    const createResult = await db.execute(sql`
      INSERT INTO cc_operator_roles (tenant_id, role_key, title)
      VALUES (${tenantId}, ${roleKey}, ${roleKey.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())})
      RETURNING id
    `);
    roleId = (createResult.rows[0] as { id: string }).id;
  } else {
    roleId = (roleResult.rows[0] as { id: string }).id;
  }
  
  const existingResult = await db.execute(sql`
    SELECT id FROM cc_operator_role_assignments
    WHERE tenant_id = ${tenantId}
      AND individual_id = ${targetIndividualId}
      AND role_id = ${roleId}
      AND status = 'active'
      ${circleId ? sql`AND circle_id = ${circleId}` : sql`AND circle_id IS NULL`}
  `);
  
  if (existingResult.rows.length > 0) {
    return (existingResult.rows[0] as { id: string }).id;
  }
  
  const insertResult = await db.execute(sql`
    INSERT INTO cc_operator_role_assignments (
      tenant_id, circle_id, individual_id, role_id, assigned_by_individual_id
    ) VALUES (
      ${tenantId}, ${circleId ?? null}, ${targetIndividualId}, ${roleId}, ${assignedByIndividualId}
    )
    RETURNING id
  `);
  
  return (insertResult.rows[0] as { id: string }).id;
}

export async function revokeOperatorRole(
  assignmentId: string,
  revokedByIndividualId: string
): Promise<void> {
  await db.execute(sql`
    UPDATE cc_operator_role_assignments
    SET status = 'revoked',
        revoked_at = now(),
        revoked_by_individual_id = ${revokedByIndividualId}
    WHERE id = ${assignmentId}
  `);
}
