import { db } from '../../db';
import { sql } from 'drizzle-orm';

export type OperatorActionKey =
  | 'run_start'
  | 'run_resolve'
  | 'run_grant_scope'
  | 'run_revoke_scope'
  | 'run_export_playbook'
  | 'run_generate_record_pack'
  | 'run_share_authority'
  | 'run_dashboard_view'
  | 'claim_assemble'
  | 'dossier_export'
  | 'dossier_share_authority'
  | 'hold_create'
  | 'hold_add_target'
  | 'hold_release'
  | 'dispute_assemble_defense_pack'
  | 'defense_pack_export'
  | 'defense_pack_share_authority';

export interface OperatorEventInput {
  tenantId: string;
  circleId?: string;
  operatorIndividualId: string;
  actionKey: OperatorActionKey;
  subjectType: string;
  subjectId: string;
  payload?: Record<string, unknown>;
}

export async function logOperatorEvent(input: OperatorEventInput): Promise<string> {
  const { tenantId, circleId, operatorIndividualId, actionKey, subjectType, subjectId, payload } = input;
  
  const payloadJson = JSON.stringify(payload ?? {});
  
  const result = await db.execute(sql`
    INSERT INTO cc_operator_events (
      tenant_id, circle_id, operator_individual_id, action_key, subject_type, subject_id, payload
    ) VALUES (
      ${tenantId}, ${circleId ?? null}, ${operatorIndividualId}, ${actionKey}, ${subjectType}, ${subjectId}, ${payloadJson}::jsonb
    )
    RETURNING id
  `);
  
  return (result.rows[0] as { id: string }).id;
}

export async function getOperatorEvents(
  tenantId: string,
  options?: {
    circleId?: string;
    operatorIndividualId?: string;
    actionKey?: OperatorActionKey;
    subjectType?: string;
    subjectId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Array<{
  id: string;
  tenantId: string;
  circleId: string | null;
  operatorIndividualId: string;
  actionKey: string;
  subjectType: string;
  subjectId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}>> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  
  let query = sql`
    SELECT * FROM cc_operator_events
    WHERE tenant_id = ${tenantId}
  `;
  
  if (options?.circleId) {
    query = sql`${query} AND circle_id = ${options.circleId}`;
  }
  if (options?.operatorIndividualId) {
    query = sql`${query} AND operator_individual_id = ${options.operatorIndividualId}`;
  }
  if (options?.actionKey) {
    query = sql`${query} AND action_key = ${options.actionKey}`;
  }
  if (options?.subjectType) {
    query = sql`${query} AND subject_type = ${options.subjectType}`;
  }
  if (options?.subjectId) {
    query = sql`${query} AND subject_id = ${options.subjectId}`;
  }
  
  query = sql`${query} ORDER BY occurred_at DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await db.execute(query);
  
  return result.rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    operatorIndividualId: row.operator_individual_id,
    actionKey: row.action_key,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    occurredAt: row.occurred_at,
    payload: row.payload,
  }));
}
