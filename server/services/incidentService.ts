/**
 * V3.3.1 Incident Service
 * Emergency incident management for road blockages, illegal parking, etc.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logActivity } from './activityService';

export interface CreateIncidentRequest {
  tenantId: string;
  communityId?: string;
  incidentType: string;
  severity: 'info' | 'warning' | 'critical';
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  facilityId?: string;
  inventoryUnitId?: string;
  webcamEntityId?: number;
  photoUrls?: string[];
  narrative: string;
  reporterName?: string;
  reporterContact?: string;
  createdBy?: string;
  qaSeedTag?: string;
}

export interface IncidentResult {
  id: string;
  incidentNumber: string;
  status: string;
  severity: string;
  createdAt: Date;
}

export interface Incident {
  id: string;
  tenantId: string;
  communityId: string | null;
  incidentNumber: string;
  incidentType: string;
  severity: string;
  status: string;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  facilityId: string | null;
  narrative: string | null;
  reporterName: string | null;
  dispatchLog: any[];
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
}

async function generateIncidentNumber(tenantId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
  const dateOnly = today.toISOString().slice(0, 10);
  
  const result = await db.execute(sql`
    INSERT INTO cc_daily_sequences (tenant_id, sequence_date, sequence_type, current_value)
    VALUES (${tenantId}, ${dateOnly}, 'incident', 1)
    ON CONFLICT (tenant_id, sequence_date, sequence_type)
    DO UPDATE SET current_value = cc_daily_sequences.current_value + 1
    RETURNING current_value
  `);
  
  const seq = result.rows[0]?.current_value as number || 1;
  const seqStr = seq.toString().padStart(3, '0');
  
  return `INC-${dateStr}-${seqStr}`;
}

export async function createIncident(req: CreateIncidentRequest): Promise<IncidentResult> {
  const incidentNumber = await generateIncidentNumber(req.tenantId);
  
  const result = await db.execute(sql`
    INSERT INTO cc_incidents (
      tenant_id, community_id, incident_number,
      incident_type, severity, status,
      location_label, latitude, longitude,
      facility_id, inventory_unit_id,
      webcam_entity_id, photo_urls,
      narrative, reporter_name, reporter_contact,
      created_by, qa_seed_tag
    ) VALUES (
      ${req.tenantId},
      ${req.communityId || null},
      ${incidentNumber},
      ${req.incidentType},
      ${req.severity},
      'open',
      ${req.locationLabel || null},
      ${req.latitude || null},
      ${req.longitude || null},
      ${req.facilityId || null},
      ${req.inventoryUnitId || null},
      ${req.webcamEntityId || null},
      ${req.photoUrls ? sql`ARRAY[${sql.raw(req.photoUrls.map(u => `'${u}'`).join(','))}]::text[]` : null},
      ${req.narrative},
      ${req.reporterName || null},
      ${req.reporterContact || null},
      ${req.createdBy || null},
      ${req.qaSeedTag || null}
    )
    RETURNING id, incident_number, status, severity, created_at
  `);
  
  const row = result.rows[0];
  
  await logActivity({
    tenantId: req.tenantId,
    actorId: req.createdBy,
    action: 'incident.created',
    resourceType: 'incident',
    resourceId: row.id as string,
    metadata: {
      incidentNumber,
      incidentType: req.incidentType,
      severity: req.severity,
    },
  });
  
  return {
    id: row.id as string,
    incidentNumber: row.incident_number as string,
    status: row.status as string,
    severity: row.severity as string,
    createdAt: row.created_at as Date,
  };
}

export async function addIncidentAction(
  incidentId: string,
  actionType: string,
  payload: Record<string, any>,
  actorId?: string
): Promise<string> {
  const incidentResult = await db.execute(sql`
    SELECT tenant_id FROM cc_incidents WHERE id = ${incidentId}
  `);
  
  if (incidentResult.rows.length === 0) {
    throw new Error('Incident not found');
  }
  
  const tenantId = incidentResult.rows[0].tenant_id as string;
  
  const result = await db.execute(sql`
    INSERT INTO cc_incident_actions (
      tenant_id, incident_id, action_type, payload, performed_by
    ) VALUES (
      ${tenantId}, ${incidentId}, ${actionType}, ${JSON.stringify(payload)}::jsonb, ${actorId || null}
    )
    RETURNING id
  `);
  
  await db.execute(sql`
    UPDATE cc_incidents 
    SET dispatch_log = dispatch_log || ${JSON.stringify([{
      action: actionType,
      performedAt: new Date().toISOString(),
      performedBy: actorId,
      ...payload,
    }])}::jsonb,
    updated_at = now()
    WHERE id = ${incidentId}
  `);
  
  return result.rows[0].id as string;
}

export async function dispatchTow(
  incidentId: string,
  priority: 'normal' | 'urgent' | 'emergency',
  notes: string,
  actorId?: string
): Promise<{ actionId: string; towRequestId: string }> {
  const incidentResult = await db.execute(sql`
    SELECT tenant_id, location_label, latitude, longitude
    FROM cc_incidents WHERE id = ${incidentId}
  `);
  
  if (incidentResult.rows.length === 0) {
    throw new Error('Incident not found');
  }
  
  const incident = incidentResult.rows[0];
  const tenantId = incident.tenant_id as string;
  
  const actionId = await addIncidentAction(
    incidentId,
    'dispatch_tow',
    { priority, notes },
    actorId
  );
  
  const towResult = await db.execute(sql`
    INSERT INTO cc_tow_requests (
      tenant_id, incident_id, incident_action_id,
      priority, location_label, latitude, longitude, notes
    ) VALUES (
      ${tenantId}, ${incidentId}, ${actionId},
      ${priority}, ${incident.location_label}, ${incident.latitude}, ${incident.longitude}, ${notes}
    )
    RETURNING id
  `);
  
  const towRequestId = towResult.rows[0].id as string;
  
  await db.execute(sql`
    UPDATE cc_incidents SET status = 'dispatched', updated_at = now()
    WHERE id = ${incidentId}
  `);
  
  await logActivity({
    tenantId,
    actorId,
    action: 'incident.dispatch',
    resourceType: 'incident',
    resourceId: incidentId,
    metadata: { priority, actionId, towRequestId },
  });
  
  return { actionId, towRequestId };
}

export async function resolveIncident(
  incidentId: string,
  resolution: string,
  actorId?: string
): Promise<void> {
  const incidentResult = await db.execute(sql`
    SELECT tenant_id FROM cc_incidents WHERE id = ${incidentId}
  `);
  
  if (incidentResult.rows.length === 0) {
    throw new Error('Incident not found');
  }
  
  const tenantId = incidentResult.rows[0].tenant_id as string;
  
  await addIncidentAction(incidentId, 'resolve', { resolution }, actorId);
  
  await db.execute(sql`
    UPDATE cc_incidents
    SET status = 'resolved', resolution = ${resolution}, resolved_at = now(),
        resolved_by = ${actorId || null}, updated_at = now()
    WHERE id = ${incidentId}
  `);
  
  await logActivity({
    tenantId,
    actorId,
    action: 'incident.resolved',
    resourceType: 'incident',
    resourceId: incidentId,
    metadata: { resolution },
  });
}

export async function getIncident(incidentId: string): Promise<Incident | null> {
  const result = await db.execute(sql`
    SELECT 
      id, tenant_id as "tenantId", community_id as "communityId",
      incident_number as "incidentNumber", incident_type as "incidentType",
      severity, status, location_label as "locationLabel",
      latitude, longitude, facility_id as "facilityId",
      narrative, reporter_name as "reporterName",
      dispatch_log as "dispatchLog",
      resolved_at as "resolvedAt", resolution,
      created_at as "createdAt"
    FROM cc_incidents
    WHERE id = ${incidentId}
  `);
  
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as Incident;
}

export async function getOpenIncidents(tenantId: string): Promise<Incident[]> {
  const result = await db.execute(sql`
    SELECT 
      id, tenant_id as "tenantId", community_id as "communityId",
      incident_number as "incidentNumber", incident_type as "incidentType",
      severity, status, location_label as "locationLabel",
      latitude, longitude, facility_id as "facilityId",
      narrative, reporter_name as "reporterName",
      dispatch_log as "dispatchLog",
      resolved_at as "resolvedAt", resolution,
      created_at as "createdAt"
    FROM cc_incidents
    WHERE tenant_id = ${tenantId}
      AND status NOT IN ('resolved', 'closed', 'cancelled')
    ORDER BY 
      CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      created_at DESC
  `);
  
  return result.rows as unknown as Incident[];
}

export async function testIncidentLifecycle(): Promise<{
  success: boolean;
  incident?: IncidentResult;
  towRequest?: { actionId: string; towRequestId: string };
  activityCount?: number;
  error?: string;
}> {
  try {
    const testTag = `test-${Date.now()}`;
    
    const incident = await createIncident({
      tenantId: 'd0000000-0000-0000-0000-000000000001',
      communityId: 'c0000000-0000-0000-0000-000000000001',
      incidentType: 'road_blockage',
      severity: 'critical',
      locationLabel: 'Main Parking Lot - Fire Lane',
      narrative: 'Vehicle blocking fire lane, firetruck unable to access',
      reporterName: 'Test Reporter',
      qaSeedTag: testTag,
    });
    
    const towDispatch = await dispatchTow(
      incident.id,
      'emergency',
      'Fire lane blocked - immediate removal required',
    );
    
    await resolveIncident(incident.id, 'vehicle_removed');
    
    const activityResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cc_activity_ledger
      WHERE entity_type = 'incident' AND entity_id = ${incident.id}
    `);
    const activityCount = parseInt(activityResult.rows[0]?.count as string) || 0;
    
    await db.execute(sql`DELETE FROM cc_tow_requests WHERE incident_id = ${incident.id}`);
    await db.execute(sql`DELETE FROM cc_incident_actions WHERE incident_id = ${incident.id}`);
    await db.execute(sql`DELETE FROM cc_incidents WHERE qa_seed_tag = ${testTag}`);
    
    return {
      success: true,
      incident,
      towRequest: towDispatch,
      activityCount,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
