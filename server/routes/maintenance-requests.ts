/**
 * MAINTENANCE REQUESTS ROUTES
 * Canonical API namespace for maintenance request operations
 * 
 * Endpoints:
 * - PUT /api/maintenance-requests/:id/coordination-opt-in - Toggle coordination opt-in
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';
import { can } from '../auth/authorize';

const router = Router();

/**
 * Admin/owner guard for mutation endpoints
 * PROMPT-10: Uses capability check instead of isPlatformAdmin flag
 */
async function requireTenantAdminOrOwner(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const roles = tenantReq.ctx?.roles || [];
  
  // Check tenant roles first
  const hasTenantAdminRole = 
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin');
  
  // PROMPT-10: Use capability check instead of isPlatformAdmin flag
  const hasPlatformCapability = await can(req, 'platform.configure');
  
  if (!hasTenantAdminRole && !hasPlatformCapability) {
    return res.status(403).json({ 
      error: 'Owner or admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * PUT /api/maintenance-requests/:id/coordination-opt-in
 * 
 * Toggle coordination opt-in status for a maintenance request.
 * Allows requests to be eligible for N3 Service Run attachment.
 * 
 * Request body:
 * - coordination_opt_in: boolean (required)
 * - note: string (optional, max 280 chars)
 * 
 * Responses:
 * - 200: Success with updated opt-in state
 * - 404: Maintenance request not found
 * - 400: Validation error
 * - 403: Admin/owner access required
 */
router.put('/:id/coordination-opt-in', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const { id } = req.params;
  const { coordination_opt_in, note } = req.body;
  const actorId = tenantReq.user?.id || 'system';

  try {
    // Validate required field
    if (typeof coordination_opt_in !== 'boolean') {
      return res.status(400).json({ 
        error: 'validation_error',
        message: 'coordination_opt_in must be a boolean'
      });
    }

    // Validate note length if provided
    if (note && typeof note === 'string' && note.length > 280) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Note cannot exceed 280 characters'
      });
    }

    // Check if maintenance request exists
    const existingResult = await tenantReq.tenantQuery!(
      `SELECT id, portal_id, zone_id, coordination_opt_in 
       FROM cc_maintenance_requests 
       WHERE id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    const existing = existingResult.rows[0];
    let result;

    if (coordination_opt_in) {
      // Set coordination opt-in
      result = await tenantReq.tenantQuery!(
        `UPDATE cc_maintenance_requests 
         SET coordination_opt_in = true,
             coordination_opt_in_set_at = NOW(),
             coordination_opt_in_set_by = $2,
             coordination_opt_in_note = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, coordination_opt_in, coordination_opt_in_set_at, coordination_opt_in_note`,
        [id, actorId, note || null]
      );

      console.log('[N3 AUDIT] maintenance_coordination_opt_in_set', {
        event: 'maintenance_coordination_opt_in_set',
        maintenance_request_id: id,
        portal_id: existing.portal_id,
        zone_id: existing.zone_id,
        actor_id: actorId,
        note: note || null,
        occurred_at: new Date().toISOString(),
      });
    } else {
      // Clear coordination opt-in
      result = await tenantReq.tenantQuery!(
        `UPDATE cc_maintenance_requests 
         SET coordination_opt_in = false,
             coordination_opt_in_set_at = NULL,
             coordination_opt_in_set_by = NULL,
             coordination_opt_in_note = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, coordination_opt_in, coordination_opt_in_set_at, coordination_opt_in_note`,
        [id]
      );

      console.log('[N3 AUDIT] maintenance_coordination_opt_in_cleared', {
        event: 'maintenance_coordination_opt_in_cleared',
        maintenance_request_id: id,
        portal_id: existing.portal_id,
        zone_id: existing.zone_id,
        actor_id: actorId,
        occurred_at: new Date().toISOString(),
      });
    }

    const updated = result.rows[0];
    const response: any = {
      ok: true,
      maintenance_request_id: updated.id,
      coordination_opt_in: updated.coordination_opt_in,
      coordination_opt_in_set_at: updated.coordination_opt_in_set_at,
      coordination_opt_in_note: updated.coordination_opt_in_note,
    };

    if (!existing.portal_id) {
      response.portal_required_for_matching = true;
    }

    res.json(response);
  } catch (error) {
    console.error('Error setting coordination opt-in:', error);
    res.status(500).json({ error: 'Failed to set coordination opt-in' });
  }
});

export default router;
