import { db } from '../../db';
import { sql } from 'drizzle-orm';

export type HoldTargetType = 
  | 'evidence_object' 
  | 'evidence_bundle' 
  | 'claim' 
  | 'claim_dossier' 
  | 'table_scope';

export type HoldType = 
  | 'insurance_claim'
  | 'dispute_defense'
  | 'class_action'
  | 'regulatory'
  | 'litigation'
  | 'other';

export type HoldStatus = 'active' | 'released';

export type HoldEventType = 
  | 'created'
  | 'target_added'
  | 'target_removed'
  | 'released'
  | 'access_blocked'
  | 'export_blocked';

export interface LegalHold {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  holdType: HoldType;
  title: string;
  description: string | null;
  holdStatus: HoldStatus;
  createdAt: Date;
  createdByIndividualId: string | null;
  releasedAt: Date | null;
  releasedByIndividualId: string | null;
  releaseReason: string | null;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface HoldTarget {
  id: string;
  tenantId: string;
  holdId: string;
  targetType: HoldTargetType;
  targetId: string | null;
  tableName: string | null;
  scopeFilter: Record<string, unknown> | null;
  addedAt: Date;
  addedByIndividualId: string | null;
  notes: string | null;
}

export interface HoldEvent {
  id: string;
  tenantId: string;
  holdId: string;
  eventType: HoldEventType;
  eventAt: Date;
  actorIndividualId: string | null;
  eventPayload: Record<string, unknown>;
  clientRequestId: string | null;
}

export interface CreateHoldInput {
  tenantId: string;
  circleId?: string;
  portalId?: string;
  holdType: HoldType;
  title: string;
  description?: string;
  createdByIndividualId?: string;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AddTargetInput {
  holdId: string;
  tenantId: string;
  targetType: HoldTargetType;
  targetId?: string;
  tableName?: string;
  scopeFilter?: Record<string, unknown>;
  addedByIndividualId?: string;
  notes?: string;
}

export interface ReleaseHoldInput {
  holdId: string;
  tenantId: string;
  reason: string;
  releasedByIndividualId?: string;
}

export async function isRowOnActiveHold(
  tenantId: string,
  targetType: HoldTargetType,
  targetId: string
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT cc_is_row_on_active_hold(${tenantId}::uuid, ${targetType}, ${targetId}::uuid) as on_hold
  `);
  return (result.rows[0] as any)?.on_hold ?? false;
}

export async function assertNotOnHold(params: {
  tenantId: string;
  targetType: HoldTargetType;
  targetId: string;
}): Promise<void> {
  const onHold = await isRowOnActiveHold(params.tenantId, params.targetType, params.targetId);
  if (onHold) {
    const holds = await listActiveHoldsForTarget(params.tenantId, params.targetType, params.targetId);
    const holdIds = holds.map(h => h.id).join(', ');
    throw new Error(`LEGAL_HOLD_ACTIVE: Cannot modify ${params.targetType} ${params.targetId} while under legal hold (holds: ${holdIds})`);
  }
}

export async function listActiveHoldsForTarget(
  tenantId: string,
  targetType: HoldTargetType,
  targetId: string
): Promise<LegalHold[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT h.*
    FROM cc_legal_holds h
    JOIN cc_legal_hold_targets t ON t.hold_id = h.id
    WHERE h.tenant_id = ${tenantId}::uuid
      AND h.hold_status = 'active'
      AND t.target_type = ${targetType}::hold_target_type
      AND t.target_id = ${targetId}::uuid
  `);
  
  return result.rows.map(mapHoldRow);
}

export async function createLegalHold(input: CreateHoldInput): Promise<LegalHold> {
  const result = await db.execute(sql`
    INSERT INTO cc_legal_holds (
      tenant_id, circle_id, portal_id, hold_type, title, description,
      created_by_individual_id, client_request_id, metadata
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.circleId ?? null}::uuid,
      ${input.portalId ?? null}::uuid,
      ${input.holdType}::legal_hold_type,
      ${input.title},
      ${input.description ?? null},
      ${input.createdByIndividualId ?? null}::uuid,
      ${input.clientRequestId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING *
  `);
  
  const hold = mapHoldRow(result.rows[0]);
  
  await logHoldEvent({
    tenantId: input.tenantId,
    holdId: hold.id,
    eventType: 'created',
    actorIndividualId: input.createdByIndividualId,
    eventPayload: { title: input.title, holdType: input.holdType },
    clientRequestId: input.clientRequestId,
  });
  
  return hold;
}

export async function addHoldTarget(input: AddTargetInput): Promise<HoldTarget> {
  if (input.targetType !== 'table_scope' && !input.targetId) {
    throw new Error('target_id is required for non-table_scope targets');
  }
  if (input.targetType === 'table_scope' && !input.tableName) {
    throw new Error('table_name is required for table_scope targets');
  }
  
  if (input.targetId) {
    const valid = await validateTargetExists(input.targetType, input.targetId);
    if (!valid) {
      throw new Error(`Target ${input.targetType} ${input.targetId} does not exist`);
    }
  }
  
  const result = await db.execute(sql`
    INSERT INTO cc_legal_hold_targets (
      tenant_id, hold_id, target_type, target_id, table_name, scope_filter,
      added_by_individual_id, notes
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.holdId}::uuid,
      ${input.targetType}::hold_target_type,
      ${input.targetId ?? null}::uuid,
      ${input.tableName ?? null},
      ${input.scopeFilter ? JSON.stringify(input.scopeFilter) : null}::jsonb,
      ${input.addedByIndividualId ?? null}::uuid,
      ${input.notes ?? null}
    )
    RETURNING *
  `);
  
  const target = mapTargetRow(result.rows[0]);
  
  await logHoldEvent({
    tenantId: input.tenantId,
    holdId: input.holdId,
    eventType: 'target_added',
    actorIndividualId: input.addedByIndividualId,
    eventPayload: { 
      targetType: input.targetType, 
      targetId: input.targetId,
      tableName: input.tableName,
    },
  });
  
  return target;
}

export async function releaseHold(input: ReleaseHoldInput): Promise<LegalHold> {
  const result = await db.execute(sql`
    UPDATE cc_legal_holds
    SET hold_status = 'released',
        released_at = NOW(),
        released_by_individual_id = ${input.releasedByIndividualId ?? null}::uuid,
        release_reason = ${input.reason}
    WHERE id = ${input.holdId}::uuid
      AND tenant_id = ${input.tenantId}::uuid
      AND hold_status = 'active'
    RETURNING *
  `);
  
  if (result.rows.length === 0) {
    throw new Error('Hold not found or already released');
  }
  
  const hold = mapHoldRow(result.rows[0]);
  
  await logHoldEvent({
    tenantId: input.tenantId,
    holdId: input.holdId,
    eventType: 'released',
    actorIndividualId: input.releasedByIndividualId,
    eventPayload: { reason: input.reason },
  });
  
  return hold;
}

export async function getHold(holdId: string, tenantId: string): Promise<LegalHold | null> {
  const result = await db.execute(sql`
    SELECT * FROM cc_legal_holds
    WHERE id = ${holdId}::uuid AND tenant_id = ${tenantId}::uuid
  `);
  
  if (result.rows.length === 0) return null;
  return mapHoldRow(result.rows[0]);
}

export async function listHolds(tenantId: string, status?: HoldStatus): Promise<LegalHold[]> {
  if (status) {
    const result = await db.execute(sql`
      SELECT * FROM cc_legal_holds
      WHERE tenant_id = ${tenantId}::uuid
        AND hold_status = ${status}::legal_hold_status
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapHoldRow);
  }
  
  const result = await db.execute(sql`
    SELECT * FROM cc_legal_holds
    WHERE tenant_id = ${tenantId}::uuid
    ORDER BY created_at DESC
  `);
  return result.rows.map(mapHoldRow);
}

export async function getHoldTargets(holdId: string, tenantId: string): Promise<HoldTarget[]> {
  const result = await db.execute(sql`
    SELECT * FROM cc_legal_hold_targets
    WHERE hold_id = ${holdId}::uuid AND tenant_id = ${tenantId}::uuid
    ORDER BY added_at DESC
  `);
  return result.rows.map(mapTargetRow);
}

export async function getHoldEvents(holdId: string, tenantId: string): Promise<HoldEvent[]> {
  const result = await db.execute(sql`
    SELECT * FROM cc_legal_hold_events
    WHERE hold_id = ${holdId}::uuid AND tenant_id = ${tenantId}::uuid
    ORDER BY event_at DESC
  `);
  return result.rows.map(mapEventRow);
}

async function logHoldEvent(params: {
  tenantId: string;
  holdId: string;
  eventType: HoldEventType;
  actorIndividualId?: string;
  eventPayload?: Record<string, unknown>;
  clientRequestId?: string;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO cc_legal_hold_events (
      tenant_id, hold_id, event_type, actor_individual_id, event_payload, client_request_id
    ) VALUES (
      ${params.tenantId}::uuid,
      ${params.holdId}::uuid,
      ${params.eventType}::hold_event_type,
      ${params.actorIndividualId ?? null}::uuid,
      ${JSON.stringify(params.eventPayload ?? {})}::jsonb,
      ${params.clientRequestId ?? null}
    )
  `);
}

async function validateTargetExists(targetType: HoldTargetType, targetId: string): Promise<boolean> {
  let tableName: string;
  
  switch (targetType) {
    case 'evidence_object':
      tableName = 'cc_evidence_objects';
      break;
    case 'evidence_bundle':
      tableName = 'cc_evidence_bundles';
      break;
    case 'claim':
      tableName = 'cc_insurance_claims';
      break;
    case 'claim_dossier':
      tableName = 'cc_claim_dossiers';
      break;
    default:
      return true;
  }
  
  const result = await db.execute(sql.raw(`
    SELECT EXISTS (SELECT 1 FROM ${tableName} WHERE id = '${targetId}'::uuid) as exists
  `));
  
  return (result.rows[0] as any)?.exists ?? false;
}

function mapHoldRow(row: any): LegalHold {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    portalId: row.portal_id,
    holdType: row.hold_type,
    title: row.title,
    description: row.description,
    holdStatus: row.hold_status,
    createdAt: new Date(row.created_at),
    createdByIndividualId: row.created_by_individual_id,
    releasedAt: row.released_at ? new Date(row.released_at) : null,
    releasedByIndividualId: row.released_by_individual_id,
    releaseReason: row.release_reason,
    clientRequestId: row.client_request_id,
    metadata: row.metadata ?? {},
  };
}

function mapTargetRow(row: any): HoldTarget {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    holdId: row.hold_id,
    targetType: row.target_type,
    targetId: row.target_id,
    tableName: row.table_name,
    scopeFilter: row.scope_filter,
    addedAt: new Date(row.added_at),
    addedByIndividualId: row.added_by_individual_id,
    notes: row.notes,
  };
}

function mapEventRow(row: any): HoldEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    holdId: row.hold_id,
    eventType: row.event_type,
    eventAt: new Date(row.event_at),
    actorIndividualId: row.actor_individual_id,
    eventPayload: row.event_payload ?? {},
    clientRequestId: row.client_request_id,
  };
}
