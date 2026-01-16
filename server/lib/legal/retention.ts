import { db } from '../../db';
import { sql } from 'drizzle-orm';

export type RetentionScope = 'evidence' | 'bundles' | 'claims' | 'dossiers' | 'all';

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  circleId: string | null;
  policyScope: RetentionScope;
  retainDays: number | null;
  minSeverity: string | null;
  createdAt: Date;
  createdByIndividualId: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateRetentionPolicyInput {
  tenantId: string;
  circleId?: string;
  policyScope: RetentionScope;
  retainDays?: number;
  minSeverity?: string;
  createdByIndividualId?: string;
  metadata?: Record<string, unknown>;
}

export async function createRetentionPolicy(input: CreateRetentionPolicyInput): Promise<RetentionPolicy> {
  const result = await db.execute(sql`
    INSERT INTO cc_retention_policies (
      tenant_id, circle_id, policy_scope, retain_days, min_severity,
      created_by_individual_id, metadata
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.circleId ?? null}::uuid,
      ${input.policyScope}::retention_policy_scope,
      ${input.retainDays ?? null},
      ${input.minSeverity ?? null},
      ${input.createdByIndividualId ?? null}::uuid,
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING *
  `);
  
  return mapPolicyRow(result.rows[0]);
}

export async function listRetentionPolicies(tenantId: string): Promise<RetentionPolicy[]> {
  const result = await db.execute(sql`
    SELECT * FROM cc_retention_policies
    WHERE tenant_id = ${tenantId}::uuid
    ORDER BY created_at DESC
  `);
  
  return result.rows.map(mapPolicyRow);
}

export async function getRetentionPolicy(policyId: string, tenantId: string): Promise<RetentionPolicy | null> {
  const result = await db.execute(sql`
    SELECT * FROM cc_retention_policies
    WHERE id = ${policyId}::uuid AND tenant_id = ${tenantId}::uuid
  `);
  
  if (result.rows.length === 0) return null;
  return mapPolicyRow(result.rows[0]);
}

function mapPolicyRow(row: any): RetentionPolicy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    policyScope: row.policy_scope,
    retainDays: row.retain_days,
    minSeverity: row.min_severity,
    createdAt: new Date(row.created_at),
    createdByIndividualId: row.created_by_individual_id,
    metadata: row.metadata ?? {},
  };
}
