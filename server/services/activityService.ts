import { db } from '../db';
import { sql } from 'drizzle-orm';

interface LogActivityRequest {
  tenantId: string;
  actorId?: string;
  actorTenantId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

interface ActivityLedger {
  id: string;
  tenantId: string | null;
  actorIdentityId: string | null;
  actorTenantId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string | null;
  payload: Record<string, any>;
  createdAt: Date;
}

export async function logActivity(req: LogActivityRequest): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id, actor_identity_id, actor_tenant_id,
      action, entity_type, entity_id,
      payload, correlation_id
    ) VALUES (
      ${req.tenantId},
      ${req.actorId || null},
      ${req.actorTenantId || null},
      ${req.action},
      ${req.resourceType},
      ${req.resourceId},
      ${JSON.stringify(req.metadata || {})}::jsonb,
      ${req.correlationId || null}
    )
    RETURNING id
  `);
  
  return result.rows[0].id as string;
}

export async function getActivityForResource(
  resourceType: string, 
  resourceId: string
): Promise<ActivityLedger[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      tenant_id as "tenantId",
      actor_identity_id as "actorIdentityId",
      actor_tenant_id as "actorTenantId",
      action,
      entity_type as "entityType",
      entity_id as "entityId",
      correlation_id as "correlationId",
      payload,
      created_at as "createdAt"
    FROM cc_activity_ledger
    WHERE entity_type = ${resourceType}
      AND entity_id = ${resourceId}
    ORDER BY created_at DESC
  `);
  
  return result.rows as unknown as ActivityLedger[];
}

export async function getActivityByActor(
  actorId: string, 
  since?: Date
): Promise<ActivityLedger[]> {
  const sinceDate = since || new Date(0);
  
  const result = await db.execute(sql`
    SELECT 
      id,
      tenant_id as "tenantId",
      actor_identity_id as "actorIdentityId",
      actor_tenant_id as "actorTenantId",
      action,
      entity_type as "entityType",
      entity_id as "entityId",
      correlation_id as "correlationId",
      payload,
      created_at as "createdAt"
    FROM cc_activity_ledger
    WHERE actor_identity_id = ${actorId}
      AND created_at >= ${sinceDate}
    ORDER BY created_at DESC
  `);
  
  return result.rows as unknown as ActivityLedger[];
}

export async function getActivityByCorrelation(
  correlationId: string
): Promise<ActivityLedger[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      tenant_id as "tenantId",
      actor_identity_id as "actorIdentityId",
      actor_tenant_id as "actorTenantId",
      action,
      entity_type as "entityType",
      entity_id as "entityId",
      correlation_id as "correlationId",
      payload,
      created_at as "createdAt"
    FROM cc_activity_ledger
    WHERE correlation_id = ${correlationId}
    ORDER BY created_at ASC
  `);
  
  return result.rows as unknown as ActivityLedger[];
}

export async function getRecentActivity(
  tenantId: string,
  limit: number = 50
): Promise<ActivityLedger[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      tenant_id as "tenantId",
      actor_identity_id as "actorIdentityId",
      actor_tenant_id as "actorTenantId",
      action,
      entity_type as "entityType",
      entity_id as "entityId",
      correlation_id as "correlationId",
      payload,
      created_at as "createdAt"
    FROM cc_activity_ledger
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  
  return result.rows as unknown as ActivityLedger[];
}
