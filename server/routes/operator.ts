import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, AuthRequest } from './foundation';
import { can } from '../auth/authorize';
import { 
  createIncident, 
  dispatchTow, 
  resolveIncident, 
  getIncident, 
  getOpenIncidents,
  testIncidentLifecycle
} from '../services/incidentService';
import { 
  getOperatorAvailability,
  testOperatorAvailability
} from '../services/availabilityService';
import { 
  OperatorDashboardAvailabilityResponseSchema 
} from '../../shared/types/operatorDashboardAvailability';
import { assertNoCountLikeKeysDeep } from '../../shared/types/noCountsGuard';
import { logActivity } from '../services/activityService';
import { hasScope } from '../services/federationService';
import * as reservationService from '../services/reservationService';
import {
  validateQrToken,
  validateShortCode,
  validatePlate,
  recordAccessEvent,
  revokeCredential,
  extendCredential,
  getCredentialsForReservation,
  testAccessCredentials
} from '../services/accessService';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireOperatorRole, OperatorRoleKey } from '../lib/operator/authz';
import { logOperatorEvent, OperatorActionKey } from '../lib/operator/audit';

const router = express.Router();

/**
 * PROMPT-17B: Canonical 403 deny helper (AUTH_CONSTITUTION §8a)
 */
function denyCapability(res: Response, capability: string): Response {
  return res.status(403).json({
    error: 'Forbidden',
    code: 'NOT_AUTHORIZED',
    capability,
    reason: 'capability_not_granted',
  });
}

// ============================================================================
// PUBLIC TEST ROUTES (defined BEFORE router-level auth)
// ============================================================================

router.get('/incidents/test/lifecycle', async (_req, res: Response) => {
  try {
    const result = await testIncidentLifecycle();
    res.json(result);
  } catch (error: any) {
    console.error('Test incident lifecycle error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/dashboard/availability/test', async (_req, res: Response) => {
  try {
    const result = await testOperatorAvailability();
    res.json(result);
  } catch (error: any) {
    console.error('Test availability error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/credentials/test', async (_req, res: Response) => {
  try {
    const result = await testAccessCredentials();
    res.json(result);
  } catch (error: any) {
    console.error('Test credentials error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PROMPT-17B: Router-level authentication gate (after public test routes)
router.use(authenticateToken);

router.get('/availability', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');
  
  try {
    const { 
      tenant_id, 
      item_type, 
      search, 
      date_start, 
      date_end, 
      capacity 
    } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'tenant_id is required' 
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const tenantResult = await serviceQuery(`
      SELECT t.id, t.tenant_type, tu.role
      FROM cc_tenants t
      JOIN cc_tenant_users tu ON tu.tenant_id = t.id
      WHERE t.id = $1 AND tu.user_id = $2 AND tu.status = 'active'
    `, [tenant_id, userId]);

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this tenant' 
      });
    }

    const tenantType = tenantResult.rows[0].tenant_type;
    if (tenantType !== 'community' && tenantType !== 'government') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only community and government operators can access this endpoint' 
      });
    }

    let query = `
      SELECT 
        ci.id as item_id,
        ci.tenant_id as business_tenant_id,
        t.name as business_name,
        ci.name as item_name,
        ci.short_description,
        ci.item_type,
        ci.category,
        ci.photos,
        ci.price_amount,
        ci.price_unit,
        ci.price_visible,
        ci.capacity_max,
        ci.pickup_location,
        true as can_request_hold,
        CASE 
          WHEN ci.share_availability = true AND ci.share_details = true THEN 'full'
          WHEN ci.share_availability = true THEN 'availability_only'
          ELSE 'limited'
        END as sharing_status
      FROM inventory_items ci
      JOIN cc_tenants t ON t.id = ci.tenant_id
      WHERE ci.status = 'active'
        AND ci.share_availability = true
        AND (ci.visible_to_communities IS NULL OR $1::uuid = ANY(ci.visible_to_communities))
    `;

    const params: any[] = [tenant_id];
    let paramIndex = 2;

    if (item_type) {
      query += ` AND ci.item_type = $${paramIndex}`;
      params.push(item_type);
      paramIndex++;
    }

    if (search) {
      query += ` AND (ci.name ILIKE $${paramIndex} OR ci.short_description ILIKE $${paramIndex} OR ci.category ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (capacity) {
      query += ` AND ci.capacity_max >= $${paramIndex}`;
      params.push(Number(capacity));
      paramIndex++;
    }

    query += ` ORDER BY ci.name LIMIT 50`;

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      results: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Operator availability search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search availability' 
    });
  }
});

router.post('/hold-request', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');
  
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const {
      tenant_id,
      inventory_item_id,
      date_start,
      date_end,
      party_size,
      caller_name,
      caller_phone,
      caller_email,
      caller_notes
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'tenant_id is required' 
      });
    }

    if (!inventory_item_id || !date_start || !date_end) {
      return res.status(400).json({ 
        success: false, 
        error: 'inventory_item_id, date_start, and date_end are required' 
      });
    }

    const tenantResult = await serviceQuery(`
      SELECT t.id, t.tenant_type, tu.role
      FROM cc_tenants t
      JOIN cc_tenant_users tu ON tu.tenant_id = t.id
      WHERE t.id = $1 AND tu.user_id = $2 AND tu.status = 'active'
    `, [tenant_id, userId]);

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this tenant' 
      });
    }

    const tenantType = tenantResult.rows[0].tenant_type;
    if (tenantType !== 'community' && tenantType !== 'government') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only community and government operators can request holds' 
      });
    }

    const itemResult = await serviceQuery(`
      SELECT ci.id, ci.tenant_id, ci.name,
             tss.allow_hold_requests
      FROM inventory_items ci
      LEFT JOIN cc_tenant_sharing_settings tss ON ci.tenant_id = tss.tenant_id
      WHERE ci.id = $1 AND ci.status = 'active'
    `, [inventory_item_id]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Item not found' 
      });
    }

    const item = itemResult.rows[0];

    if (!item.allow_hold_requests) {
      return res.status(403).json({ 
        success: false, 
        error: 'This business does not accept hold requests' 
      });
    }

    const holdResult = await serviceQuery(`
      INSERT INTO cc_hold_requests (
        inventory_item_id, business_tenant_id, requesting_tenant_id, requesting_user_id,
        date_start, date_end, party_size,
        caller_name, caller_phone, caller_email, caller_notes,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now() + interval '4 hours')
      RETURNING *
    `, [
      inventory_item_id,
      item.tenant_id,
      tenant_id,
      userId,
      date_start,
      date_end,
      party_size || null,
      caller_name || null,
      caller_phone || null,
      caller_email || null,
      caller_notes || null
    ]);

    res.json({
      success: true,
      hold_request: holdResult.rows[0]
    });

  } catch (error: any) {
    console.error('Hold request error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create hold request' 
    });
  }
});

router.post('/call-log', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');
  
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const {
      tenant_id,
      caller_name,
      caller_phone,
      caller_email,
      need_type,
      need_summary,
      date_start,
      date_end,
      party_size,
      special_requirements,
      outcome,
      outcome_notes
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'tenant_id is required' 
      });
    }

    const tenantResult = await serviceQuery(`
      SELECT t.id, t.tenant_type, tu.role
      FROM cc_tenants t
      JOIN cc_tenant_users tu ON tu.tenant_id = t.id
      WHERE t.id = $1 AND tu.user_id = $2 AND tu.status = 'active'
    `, [tenant_id, userId]);

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this tenant' 
      });
    }

    const tenantType = tenantResult.rows[0].tenant_type;
    if (tenantType !== 'community' && tenantType !== 'government') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only community and government operators can log calls' 
      });
    }

    const result = await serviceQuery(`
      INSERT INTO cc_operator_call_logs (
        operator_tenant_id, operator_user_id,
        caller_name, caller_phone, caller_email,
        need_type, need_summary, date_start, date_end, party_size, special_requirements,
        outcome, outcome_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      tenant_id,
      userId,
      caller_name || null,
      caller_phone || null,
      caller_email || null,
      need_type || null,
      need_summary || null,
      date_start || null,
      date_end || null,
      party_size || null,
      special_requirements || null,
      outcome || null,
      outcome_notes || null
    ]);

    res.json({
      success: true,
      call_log: result.rows[0]
    });

  } catch (error: any) {
    console.error('Call log error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to log call' 
    });
  }
});

// ============================================================================
// INCIDENT MANAGEMENT ROUTES
// ============================================================================

async function verifyTenantAccess(userId: string, tenantId: string): Promise<{ allowed: boolean; tenantType?: string }> {
  const result = await serviceQuery(`
    SELECT t.tenant_type, tu.role
    FROM cc_tenants t
    JOIN cc_tenant_users tu ON tu.tenant_id = t.id
    WHERE t.id = $1 AND tu.user_id = $2 AND tu.status = 'active'
  `, [tenantId, userId]);
  
  if (result.rows.length === 0) {
    return { allowed: false };
  }
  return { allowed: true, tenantType: result.rows[0].tenant_type };
}

router.post('/incidents', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');
  
  try {
    const userId = req.user?.userId;
    const { tenant_id, incident_type, severity, location_label, latitude, longitude, facility_id, narrative, reporter_name, reporter_contact } = req.body;
    
    if (!tenant_id || !incident_type || !narrative) {
      return res.status(400).json({ success: false, error: 'tenant_id, incident_type, and narrative are required' });
    }
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    const incident = await createIncident({
      tenantId: tenant_id,
      incidentType: incident_type,
      severity: severity || 'warning',
      locationLabel: location_label,
      latitude,
      longitude,
      facilityId: facility_id,
      narrative,
      reporterName: reporter_name,
      reporterContact: reporter_contact,
      createdBy: userId,
    });
    
    res.json({ success: true, incident });
  } catch (error: any) {
    console.error('Create incident error:', error);
    res.status(500).json({ success: false, error: 'Failed to create incident' });
  }
});

router.get('/incidents', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const userId = req.user?.userId;
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id is required' });
    }
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    const incidents = await getOpenIncidents(tenant_id as string);
    res.json({ success: true, incidents });
  } catch (error: any) {
    console.error('Get incidents error:', error);
    res.status(500).json({ success: false, error: 'Failed to get incidents' });
  }
});

router.get('/incidents/:id', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const incident = await getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    
    const access = await verifyTenantAccess(userId, incident.tenantId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this incident' });
    }
    
    res.json({ success: true, incident });
  } catch (error: any) {
    console.error('Get incident error:', error);
    res.status(500).json({ success: false, error: 'Failed to get incident' });
  }
});

router.post('/incidents/:id/dispatch', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const incident = await getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    
    const access = await verifyTenantAccess(userId, incident.tenantId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this incident' });
    }
    
    const { priority, notes } = req.body;
    const result = await dispatchTow(req.params.id, priority || 'normal', notes || '', userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Dispatch tow error:', error);
    res.status(500).json({ success: false, error: 'Failed to dispatch tow' });
  }
});

router.post('/incidents/:id/resolve', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const incident = await getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    
    const access = await verifyTenantAccess(userId, incident.tenantId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this incident' });
    }
    
    const { resolution } = req.body;
    if (!resolution) {
      return res.status(400).json({ success: false, error: 'resolution is required' });
    }
    
    await resolveIncident(req.params.id, resolution, userId);
    res.json({ success: true, status: 'resolved' });
  } catch (error: any) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve incident' });
  }
});

// ============================================================================
// DASHBOARD AVAILABILITY ROUTES
// ============================================================================

router.get('/dashboard/availability', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { portalSlug, start, end, view, includeTruthOnly, includeWebcams, includeIncidents, tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id is required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    const result = await getOperatorAvailability({
      portalSlug: portalSlug as string || 'default',
      communityId: tenant_id as string,
      startDate: start ? new Date(start as string) : new Date(),
      endDate: end ? new Date(end as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      channel: 'chamber_desk',
      includeTruthOnly: includeTruthOnly === 'true',
      includeWebcams: includeWebcams === 'true',
      includeIncidents: includeIncidents === 'true'
    });
    
    const parsed = OperatorDashboardAvailabilityResponseSchema.parse(result);
    
    const violations = assertNoCountLikeKeysDeep(parsed);
    if (violations.length > 0) {
      console.error('COUNT LEAK DETECTED:', violations);
      return res.status(500).json({ error: 'Internal contract violation' });
    }
    
    res.json(parsed);
  } catch (error: any) {
    console.error('Dashboard availability error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch availability' });
  }
});

router.post('/reservations/bundle', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { 
      tenant_id,
      portalSlug, 
      windowStart, 
      windowEnd, 
      caller, 
      requirements, 
      items 
    } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id is required' });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    const bundleId = crypto.randomUUID();
    const reservations = [];
    
    for (const item of items) {
      const scopeCheck = await hasScope(
        { 
          actorTenantId: tenant_id, 
          actorIndividualId: userId, 
          communityId: tenant_id 
        },
        item.providerTenantId,
        'reservation:create'
      );
      
      if (!scopeCheck) {
        return res.status(403).json({ 
          error: `No federation scope for tenant ${item.providerTenantId}` 
        });
      }
      
      const reservation = await reservationService.createReservation({
        tenantId: item.providerTenantId,
        facilityId: item.facilityId,
        offerId: item.offerId,
        customerName: caller?.name || 'Chamber Guest',
        customerEmail: caller?.email,
        customerPhone: caller?.telephone,
        startAt: new Date(windowStart),
        endAt: new Date(windowEnd),
        vesselLengthFt: requirements?.boatLengthFt,
        vehicleLengthFt: requirements?.combinedVehicleLengthFt,
        idempotencyKey: `bundle-${bundleId}-${item.assetId}`,
        source: 'chamber'
      });
      
      reservations.push({
        reservationId: reservation.reservationId,
        confirmationNumber: reservation.confirmationNumber,
        assetId: item.assetId,
        providerTenantId: item.providerTenantId,
        status: reservation.status
      });
      
      await logActivity({
        tenantId: tenant_id,
        actorId: userId,
        action: 'federation.reservation',
        resourceType: 'reservation',
        resourceId: reservation.reservationId,
        metadata: { bundleId, providerTenantId: item.providerTenantId },
        correlationId: bundleId
      });
    }
    
    res.json({
      traceId: crypto.randomUUID(),
      bundleId,
      reservations
    });
  } catch (error: any) {
    console.error('Bundle reservation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create bundle reservation' });
  }
});

// ============================================================================
// Access Credentials Routes
// ============================================================================

router.post('/credentials/validate', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { qrToken, shortCode, plate, facilityId, tenant_id } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id is required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    let result;
    let method: string;
    
    if (qrToken) {
      result = await validateQrToken(qrToken, facilityId);
      method = 'qr_scan';
    } else if (shortCode) {
      result = await validateShortCode(shortCode, facilityId);
      method = 'short_code';
    } else if (plate) {
      if (!facilityId) {
        return res.status(400).json({ success: false, error: 'facilityId is required for plate lookup' });
      }
      result = await validatePlate(plate, facilityId);
      method = 'plate_lookup';
    } else {
      return res.status(400).json({ success: false, error: 'Provide qrToken, shortCode, or plate' });
    }
    
    await recordAccessEvent(
      tenant_id,
      result.credential?.id || null,
      facilityId || null,
      'validate',
      result.result,
      userId,
      undefined,
      { method }
    );
    
    await logActivity({
      tenantId: tenant_id,
      actorId: userId,
      action: 'credential.validated',
      resourceType: 'credential',
      resourceId: result.credential?.id || 'unknown',
      metadata: { result: result.result, method }
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Credential validation error:', error);
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

router.post('/credentials/:id/revoke', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { tenant_id, reason } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id is required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    await revokeCredential(req.params.id, reason || 'Revoked by operator', userId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Credential revoke error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to revoke credential' });
  }
});

router.post('/credentials/:id/extend', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { tenant_id, validUntil } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id is required' });
    }
    
    if (!validUntil) {
      return res.status(400).json({ success: false, error: 'validUntil is required' });
    }
    
    const access = await verifyTenantAccess(userId, tenant_id);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    const result = await extendCredential(req.params.id, new Date(validUntil), userId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Credential extend error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to extend credential' });
  }
});

router.get('/reservations/:id/credentials', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ success: false, error: 'tenant_id query param is required' });
    }
    
    const access = await verifyTenantAccess(userId, String(tenant_id));
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }
    
    const credentials = await getCredentialsForReservation(req.params.id);
    
    res.json({ credentials });
  } catch (error: any) {
    console.error('Get credentials error:', error);
    res.status(500).json({ success: false, error: 'Failed to get credentials' });
  }
});

// ============================================================================
// P2.18-B OPERATOR BACKEND SURFACE
// Emergency, Insurance, Legal, Dispute Operations with Role-Based Access
// ============================================================================

interface OperatorContext {
  tenantId: string;
  circleId?: string;
  individualId: string;
}

async function getP2OperatorContext(req: AuthRequest): Promise<OperatorContext> {
  const userId = req.user?.userId;
  if (!userId) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }
  
  const tenantId = req.headers['x-tenant-id'] as string;
  const circleId = req.headers['x-circle-id'] as string | undefined;
  const individualId = (req.headers['x-individual-id'] as string) || userId;
  
  if (!tenantId) {
    throw Object.assign(new Error('x-tenant-id header required'), { statusCode: 400 });
  }
  
  const membershipCheck = await serviceQuery(`
    SELECT 1 FROM cc_tenant_users
    WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
    LIMIT 1
  `, [tenantId, userId]);
  
  if (membershipCheck.rows.length === 0) {
    throw Object.assign(new Error('Access denied to this tenant'), { statusCode: 403 });
  }
  
  return { tenantId, circleId, individualId };
}

async function withP2OperatorRole(
  req: AuthRequest,
  res: Response,
  roleKey: OperatorRoleKey,
  actionKey: OperatorActionKey,
  subjectType: string,
  subjectId: string,
  handler: (ctx: OperatorContext) => Promise<any>
) {
  try {
    const ctx = await getP2OperatorContext(req);
    await requireOperatorRole(roleKey, ctx);
    
    const result = await handler(ctx);
    
    await logOperatorEvent({
      tenantId: ctx.tenantId,
      circleId: ctx.circleId,
      operatorIndividualId: ctx.individualId,
      actionKey,
      subjectType,
      subjectId,
      payload: { request_body: req.body },
    });
    
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error(`P2 Operator endpoint error:`, err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ ok: false, error: err.message });
  }
}

// Emergency Ops
router.post('/p2/emergency/runs/start', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const subjectId = randomUUID();
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_start', 'emergency_run', subjectId, async (ctx) => {
    const { scenario_type, title, notes } = req.body;
    
    const result = await db.execute(sql`
      INSERT INTO cc_emergency_runs (
        id, tenant_id, run_type, scenario_type, title, status, started_at, notes, metadata
      ) VALUES (
        ${subjectId}, ${ctx.tenantId}, 'real', ${scenario_type ?? 'other'}, ${title ?? 'Emergency Run'},
        'active', now(), ${notes ?? null}, '{}'::jsonb
      )
      RETURNING id
    `);
    
    return { runId: (result.rows[0] as { id: string }).id };
  });
});

router.post('/p2/emergency/runs/:id/resolve', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_resolve', 'emergency_run', id, async (ctx) => {
    const { resolution_notes } = req.body;
    
    await db.execute(sql`
      UPDATE cc_emergency_runs
      SET status = 'resolved', resolved_at = now(), resolution_notes = ${resolution_notes ?? null}
      WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
    `);
    
    return { resolved: true };
  });
});

router.post('/p2/emergency/runs/:id/grant-scope', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_grant_scope', 'emergency_run', id, async (ctx) => {
    const { scope_type, target_id, expires_at } = req.body;
    
    const grantId = randomUUID();
    await db.execute(sql`
      INSERT INTO cc_authority_share_grants (
        id, tenant_id, bundle_id, grantee_type, scope, token, expires_at, is_active, created_at
      ) VALUES (
        ${grantId}, ${ctx.tenantId}, ${id}, ${scope_type ?? 'authority'}, 'read_only', ${randomUUID()}, 
        ${expires_at ?? null}, true, now()
      )
    `);
    
    return { grantId };
  });
});

router.post('/p2/emergency/runs/:id/revoke-scope', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_revoke_scope', 'emergency_run', id, async (ctx) => {
    const { grant_id } = req.body;
    
    await db.execute(sql`
      UPDATE cc_authority_share_grants
      SET is_active = false, revoked_at = now()
      WHERE id = ${grant_id} AND tenant_id = ${ctx.tenantId}
    `);
    
    return { revoked: true };
  });
});

router.post('/p2/emergency/runs/:id/export-playbook', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_export_playbook', 'emergency_run', id, async (ctx) => {
    const runResult = await db.execute(sql`
      SELECT * FROM cc_emergency_runs WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
    `);
    
    if (runResult.rows.length === 0) {
      throw Object.assign(new Error('Emergency run not found'), { statusCode: 404 });
    }
    
    const capturesResult = await db.execute(sql`
      SELECT * FROM cc_record_captures WHERE emergency_run_id = ${id}
    `);
    
    return {
      playbook: {
        run: runResult.rows[0],
        captures: capturesResult.rows,
        exportedAt: new Date().toISOString(),
      },
    };
  });
});

router.post('/p2/emergency/runs/:id/generate-record-pack', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_generate_record_pack', 'emergency_run', id, async (ctx) => {
    const bundleId = randomUUID();
    const manifestHash = `pack-${bundleId.substring(0, 8)}`;
    const metadata = JSON.stringify({ emergency_run_id: id });
    
    await db.execute(sql`
      INSERT INTO cc_evidence_bundles (
        id, tenant_id, bundle_type, status, manifest_hash, created_at, metadata
      ) VALUES (
        ${bundleId}, ${ctx.tenantId}, 'emergency_run', 'open', ${manifestHash}, now(), ${metadata}::jsonb
      )
    `);
    
    return { bundleId };
  });
});

router.post('/p2/emergency/runs/:id/share-authority', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_share_authority', 'emergency_run', id, async (ctx) => {
    const { authority_type, authority_email, scope, expires_at } = req.body;
    
    const grantId = randomUUID();
    const token = randomUUID();
    
    await db.execute(sql`
      INSERT INTO cc_authority_share_grants (
        id, tenant_id, bundle_id, grantee_type, grantee_email, scope, token, expires_at, is_active
      ) VALUES (
        ${grantId}, ${ctx.tenantId}, ${id}, ${authority_type ?? 'authority'}, 
        ${authority_email ?? null}, ${scope ?? 'read_only'}, ${token}, ${expires_at ?? null}, true
      )
    `);
    
    return { grantId, token };
  });
});

router.get('/p2/emergency/runs/:id/dashboard', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'emergency_operator', 'run_dashboard_view', 'emergency_run', id, async (ctx) => {
    const runResult = await db.execute(sql`
      SELECT * FROM cc_emergency_runs WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
    `);
    
    if (runResult.rows.length === 0) {
      throw Object.assign(new Error('Emergency run not found'), { statusCode: 404 });
    }
    
    const [grantsResult, capturesResult, bundlesResult] = await Promise.all([
      db.execute(sql`SELECT * FROM cc_authority_share_grants WHERE bundle_id = ${id}`),
      db.execute(sql`SELECT * FROM cc_record_captures WHERE emergency_run_id = ${id} ORDER BY captured_at DESC`),
      db.execute(sql`SELECT * FROM cc_evidence_bundles WHERE metadata->>'emergency_run_id' = ${id}`),
    ]);
    
    return {
      dashboard: {
        run: runResult.rows[0],
        grants: grantsResult.rows,
        captures: capturesResult.rows,
        bundles: bundlesResult.rows,
      },
    };
  });
});

// Insurance Ops
router.post('/p2/insurance/claims/:id/assemble', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'insurance_operator', 'claim_assemble', 'insurance_claim', id, async (ctx) => {
    const dossierId = randomUUID();
    const dossierJson = JSON.stringify({ claim_id: id, assembled_by: ctx.individualId });
    const dossierSha256 = `dossier-${dossierId.substring(0, 8)}`;
    
    await db.execute(sql`
      INSERT INTO cc_claim_dossiers (
        id, tenant_id, claim_id, dossier_status, dossier_json, dossier_sha256, 
        dossier_version, export_artifacts, assembled_at, metadata
      ) VALUES (
        ${dossierId}, ${ctx.tenantId}, ${id}, 'assembled', ${dossierJson}::jsonb, 
        ${dossierSha256}, 1, '[]'::jsonb, now(), '{}'::jsonb
      )
    `);
    
    return { dossierId };
  });
});

router.post('/p2/insurance/dossiers/:id/export', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'insurance_operator', 'dossier_export', 'claim_dossier', id, async (ctx) => {
    const dossierResult = await db.execute(sql`
      SELECT * FROM cc_claim_dossiers WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
    `);
    
    if (dossierResult.rows.length === 0) {
      throw Object.assign(new Error('Dossier not found'), { statusCode: 404 });
    }
    
    await db.execute(sql`
      UPDATE cc_claim_dossiers
      SET dossier_status = 'exported', exported_at = now()
      WHERE id = ${id}
    `);
    
    return { exported: true, dossier: dossierResult.rows[0] };
  });
});

router.post('/p2/insurance/dossiers/:id/share-authority', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'insurance_operator', 'dossier_share_authority', 'claim_dossier', id, async (ctx) => {
    const { adjuster_email, scope, expires_at } = req.body;
    
    const grantId = randomUUID();
    const token = randomUUID();
    
    await db.execute(sql`
      INSERT INTO cc_authority_share_grants (
        id, tenant_id, bundle_id, grantee_type, grantee_email, scope, token, expires_at, is_active
      ) VALUES (
        ${grantId}, ${ctx.tenantId}, ${id}, 'adjuster', ${adjuster_email ?? null}, 
        ${scope ?? 'read_only'}, ${token}, ${expires_at ?? null}, true
      )
    `);
    
    return { grantId, token };
  });
});

// Legal Ops
router.post('/p2/legal/holds', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const holdId = randomUUID();
  return withP2OperatorRole(req, res, 'legal_operator', 'hold_create', 'legal_hold', holdId, async (ctx) => {
    const { hold_type, title, reason, matter_reference } = req.body;
    
    await db.execute(sql`
      INSERT INTO cc_legal_hold_containers (
        id, tenant_id, hold_type, title, reason, matter_reference, status, initiated_at
      ) VALUES (
        ${holdId}, ${ctx.tenantId}, ${hold_type ?? 'litigation'}, ${title ?? 'Legal Hold'},
        ${reason ?? null}, ${matter_reference ?? null}, 'active', now()
      )
    `);
    
    return { holdId };
  });
});

router.post('/p2/legal/holds/:id/targets', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'legal_operator', 'hold_add_target', 'legal_hold', id, async (ctx) => {
    const { target_type, target_id, custodian_name, custodian_email } = req.body;
    
    const targetEntryId = randomUUID();
    
    await db.execute(sql`
      INSERT INTO cc_legal_hold_targets (
        id, container_id, target_type, target_id, custodian_name, custodian_email, status, added_at
      ) VALUES (
        ${targetEntryId}, ${id}, ${target_type ?? 'document'}, ${target_id ?? randomUUID()},
        ${custodian_name ?? null}, ${custodian_email ?? null}, 'active', now()
      )
    `);
    
    return { targetEntryId };
  });
});

router.post('/p2/legal/holds/:id/release', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'legal_operator', 'hold_release', 'legal_hold', id, async (ctx) => {
    const { release_reason } = req.body;
    
    await db.execute(sql`
      UPDATE cc_legal_hold_containers
      SET status = 'released', released_at = now(), release_reason = ${release_reason ?? null}
      WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
    `);
    
    return { released: true };
  });
});

// Dispute Ops
router.post('/p2/disputes/:id/assemble-defense-pack', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'legal_operator', 'dispute_assemble_defense_pack', 'dispute', id, async (ctx) => {
    const packId = randomUUID();
    const packJson = JSON.stringify({ dispute_id: id, assembled_by: ctx.individualId });
    const packSha256 = `pack-${packId.substring(0, 8)}`;
    
    await db.execute(sql`
      INSERT INTO cc_defense_packs (
        id, tenant_id, dispute_id, pack_type, pack_status, pack_json, pack_sha256,
        pack_version, export_artifacts, assembled_at, metadata
      ) VALUES (
        ${packId}, ${ctx.tenantId}, ${id}, 'generic_v1', 'assembled', ${packJson}::jsonb,
        ${packSha256}, 1, '[]'::jsonb, now(), '{}'::jsonb
      )
    `);
    
    return { packId };
  });
});

router.post('/p2/defense-packs/:id/export', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'legal_operator', 'defense_pack_export', 'defense_pack', id, async (ctx) => {
    const packResult = await db.execute(sql`
      SELECT * FROM cc_defense_packs WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
    `);
    
    if (packResult.rows.length === 0) {
      throw Object.assign(new Error('Defense pack not found'), { statusCode: 404 });
    }
    
    await db.execute(sql`
      UPDATE cc_defense_packs
      SET pack_status = 'exported', exported_at = now()
      WHERE id = ${id}
    `);
    
    return { exported: true, pack: packResult.rows[0] };
  });
});

router.post('/p2/defense-packs/:id/share-authority', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  const { id } = req.params;
  return withP2OperatorRole(req, res, 'legal_operator', 'defense_pack_share_authority', 'defense_pack', id, async (ctx) => {
    const { authority_email, scope, expires_at } = req.body;
    
    const grantId = randomUUID();
    const token = randomUUID();
    
    await db.execute(sql`
      INSERT INTO cc_authority_share_grants (
        id, tenant_id, bundle_id, grantee_type, grantee_email, scope, token, expires_at, is_active
      ) VALUES (
        ${grantId}, ${ctx.tenantId}, ${id}, 'authority', ${authority_email ?? null},
        ${scope ?? 'read_only'}, ${token}, ${expires_at ?? null}, true
      )
    `);
    
    return { grantId, token };
  });
});

// Role Management (for platform operators)
router.get('/p2/roles', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const ctx = await getP2OperatorContext(req);
    await requireOperatorRole('platform_operator', ctx);
    
    const result = await db.execute(sql`
      SELECT * FROM cc_operator_roles WHERE tenant_id = ${ctx.tenantId}
    `);
    
    res.json({ ok: true, roles: result.rows });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.post('/p2/roles/assign', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.configure for mutating operations)
  if (!(await can(req, 'tenant.configure'))) return denyCapability(res, 'tenant.configure');

  try {
    const ctx = await getP2OperatorContext(req);
    await requireOperatorRole('platform_operator', ctx);
    
    const { role_key, target_individual_id, circle_id } = req.body;
    
    const roleResult = await db.execute(sql`
      SELECT id FROM cc_operator_roles
      WHERE tenant_id = ${ctx.tenantId} AND role_key = ${role_key}
    `);
    
    let roleId: string;
    if (roleResult.rows.length === 0) {
      const createResult = await db.execute(sql`
        INSERT INTO cc_operator_roles (tenant_id, role_key, title)
        VALUES (${ctx.tenantId}, ${role_key}, ${(role_key as string).split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')})
        RETURNING id
      `);
      roleId = (createResult.rows[0] as { id: string }).id;
    } else {
      roleId = (roleResult.rows[0] as { id: string }).id;
    }
    
    const assignmentResult = await db.execute(sql`
      INSERT INTO cc_operator_role_assignments (
        tenant_id, circle_id, individual_id, role_id, assigned_by_individual_id
      ) VALUES (
        ${ctx.tenantId}, ${circle_id ?? null}, ${target_individual_id}, ${roleId}, ${ctx.individualId}
      )
      RETURNING id
    `);
    
    await logOperatorEvent({
      tenantId: ctx.tenantId,
      circleId: ctx.circleId,
      operatorIndividualId: ctx.individualId,
      actionKey: 'run_grant_scope',
      subjectType: 'operator_role_assignment',
      subjectId: (assignmentResult.rows[0] as { id: string }).id,
      payload: { role_key, target_individual_id },
    });
    
    res.json({ ok: true, assignmentId: (assignmentResult.rows[0] as { id: string }).id });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.get('/p2/events', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const ctx = await getP2OperatorContext(req);
    await requireOperatorRole('platform_operator', ctx);
    
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await db.execute(sql`
      SELECT * FROM cc_operator_events
      WHERE tenant_id = ${ctx.tenantId}
      ORDER BY occurred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    
    res.json({ ok: true, events: result.rows });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

/**
 * P2.15 Monetization Usage - Get event counts for a period
 * Returns counts only (no dollar amounts) for the Usage Summary UI
 */
router.get('/p2/monetization/usage', async (req: AuthRequest, res: Response) => {
  // PROMPT-17B: Capability gate (tenant.read for read operations)
  if (!(await can(req, 'tenant.read'))) return denyCapability(res, 'tenant.read');

  try {
    const ctx = await getP2OperatorContext(req);
    // Any authenticated tenant member can view usage - no special role required
    // Access is already validated by getP2OperatorContext which checks tenant membership
    
    const periodParam = req.query.period as string;
    const includeDrills = req.query.includeDrills === '1';
    
    // Default to current month if no period specified
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const period = periodParam || defaultPeriod;
    
    // Validate period format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ ok: false, error: 'Invalid period format. Use YYYY-MM.' });
    }
    
    // Build the query with optional drill exclusion
    let drillFilter = '';
    if (!includeDrills) {
      drillFilter = `AND (metadata->>'is_drill' IS NULL OR metadata->>'is_drill' != 'true')`;
    }
    
    const result = await db.execute(sql.raw(`
      SELECT event_type, COALESCE(SUM(quantity), 0)::int as count
      FROM cc_monetization_events
      WHERE tenant_id = '${ctx.tenantId}'::uuid
        AND period_key = '${period}'
        AND blocked = false
        ${drillFilter}
      GROUP BY event_type
      ORDER BY event_type ASC
    `));
    
    const counts = (result.rows ?? []).map((row: any) => ({
      eventType: row.event_type,
      count: parseInt(row.count, 10) || 0,
    }));
    
    res.json({ ok: true, period, counts });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

export default router;
