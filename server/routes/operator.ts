import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, AuthRequest } from './foundation';
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

const router = express.Router();

router.get('/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/hold-request', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/call-log', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/incidents', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.get('/incidents', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.get('/incidents/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/incidents/:id/dispatch', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/incidents/:id/resolve', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.get('/incidents/test/lifecycle', async (_req, res: Response) => {
  try {
    const result = await testIncidentLifecycle();
    res.json(result);
  } catch (error: any) {
    console.error('Test incident lifecycle error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DASHBOARD AVAILABILITY ROUTES
// ============================================================================

router.get('/dashboard/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/reservations/bundle', authenticateToken, async (req: AuthRequest, res: Response) => {
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
        action: 'federation.booking',
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

router.get('/dashboard/availability/test', async (_req, res: Response) => {
  try {
    const result = await testOperatorAvailability();
    res.json(result);
  } catch (error: any) {
    console.error('Test availability error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Access Credentials Routes
// ============================================================================

router.post('/credentials/validate', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/credentials/:id/revoke', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.post('/credentials/:id/extend', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.get('/reservations/:id/credentials', authenticateToken, async (req: AuthRequest, res: Response) => {
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

router.get('/credentials/test', async (_req, res: Response) => {
  try {
    const result = await testAccessCredentials();
    res.json(result);
  } catch (error: any) {
    console.error('Test credentials error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
