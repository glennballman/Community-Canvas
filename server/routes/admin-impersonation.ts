/**
 * ADMIN IMPERSONATION ROUTES
 * 
 * Endpoints:
 * - POST /api/admin/impersonation/start - Start impersonating a tenant
 * - POST /api/admin/impersonation/stop - Stop impersonation
 * - GET /api/admin/impersonation/status - Get current impersonation status
 * 
 * All endpoints require platform admin access.
 */

import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from './foundation';

const router = express.Router();

// All routes require platform admin
router.use(authenticateToken, requirePlatformAdmin);

/**
 * POST /api/admin/impersonation/start
 * 
 * Starts an impersonation session for a tenant.
 * Stores impersonation state in session.
 * Logs the impersonation for audit.
 */
router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user?.userId;
    const { tenant_id, reason } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    // Get tenant info
    const tenantResult = await serviceQuery(`
      SELECT id, name, tenant_type, slug
      FROM cc_tenants
      WHERE id = $1
    `, [tenant_id]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = tenantResult.rows[0];
    
    // Set expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // Store impersonation in session
    const session = (req as any).session;
    if (session) {
      session.impersonation = {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_type: tenant.tenant_type,
        admin_user_id: adminUserId,
        reason: reason || 'Admin access',
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
      };
      
      // Also set as current tenant
      session.current_tenant_id = tenant.id;
    }
    
    // Log the impersonation (table might not exist yet)
    try {
      await serviceQuery(`
        INSERT INTO cc_impersonation_logs (
          admin_user_id,
          tenant_id,
          reason,
          started_at,
          ip_address
        ) VALUES ($1, $2, $3, NOW(), $4)
      `, [
        adminUserId,
        tenant_id,
        reason || 'Admin access',
        req.ip || 'unknown',
      ]);
    } catch (logError) {
      // Log table might not exist yet, that's okay
      console.warn('Could not log impersonation:', logError);
    }
    
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.tenant_type,
      },
      expires_at: expiresAt,
    });
    
  } catch (error) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({ error: 'Failed to start impersonation' });
  }
});

/**
 * POST /api/admin/impersonation/stop
 * 
 * Stops the current impersonation session.
 */
router.post('/stop', async (req: AuthRequest, res: Response) => {
  try {
    const session = (req as any).session;
    const impersonation = session?.impersonation;
    
    if (impersonation) {
      // Log the end of impersonation
      try {
        await serviceQuery(`
          UPDATE cc_impersonation_logs
          SET ended_at = NOW()
          WHERE admin_user_id = $1 
            AND tenant_id = $2
            AND ended_at IS NULL
        `, [impersonation.admin_user_id, impersonation.tenant_id]);
      } catch (logError) {
        console.warn('Could not update impersonation log:', logError);
      }
      
      // Clear impersonation
      delete session.impersonation;
      delete session.current_tenant_id;
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    res.status(500).json({ error: 'Failed to stop impersonation' });
  }
});

/**
 * GET /api/admin/impersonation/status
 * 
 * Gets the current impersonation status.
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  const session = (req as any).session;
  const impersonation = session?.impersonation;
  
  if (!impersonation || new Date(impersonation.expires_at) <= new Date()) {
    return res.json({ is_impersonating: false });
  }
  
  res.json({
    is_impersonating: true,
    tenant_id: impersonation.tenant_id,
    tenant_name: impersonation.tenant_name,
    tenant_type: impersonation.tenant_type,
    expires_at: impersonation.expires_at,
  });
});

export default router;
