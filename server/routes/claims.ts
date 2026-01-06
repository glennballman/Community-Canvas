import express, { Request, Response } from 'express';
import { pool } from '../db';
import { tenantQuery, serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { 
  requireAuth, 
  requireTenant, 
  requireTenantAdminOrService,
  isServiceKeyRequest,
  createServiceKeyAuditEvent
} from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

// Helper to detect DB trigger transition errors and return 409
function isTransitionError(error: any): boolean {
  return error?.message?.includes('Invalid inventory_claims status transition');
}

function handleTransitionError(res: Response, error: any, currentStatus?: string): Response {
  if (isTransitionError(error)) {
    return res.status(409).json({
      success: false,
      error: 'Invalid status transition',
      code: 'INVALID_TRANSITION',
      current_status: currentStatus || null
    });
  }
  console.error('Unexpected error:', error);
  return res.status(500).json({ success: false, error: error.message });
}

// Log service-key audit event to database
// For security audit events, claim_id may be NULL if the claim doesn't exist
// The attempted claim_id is always stored in the payload for forensics
async function logServiceKeyAudit(
  claimId: string, 
  action: string, 
  req: Request
): Promise<void> {
  const auditEvent = createServiceKeyAuditEvent(req, action, claimId);
  try {
    await withServiceTransaction(async (client) => {
      // Check if claim exists for FK constraint
      const claimExists = await client.query(
        `SELECT 1 FROM inventory_claims WHERE id = $1`, 
        [claimId]
      );
      const validClaimId = claimExists.rows.length > 0 ? claimId : null;
      
      await client.query(`
        INSERT INTO inventory_claim_events (claim_id, event_type, actor_individual_id, payload)
        VALUES ($1, $2, NULL, $3::jsonb)
      `, [validClaimId, `service_key_${action}`, JSON.stringify(auditEvent)]);
    });
    console.log(`[AUDIT] Service-key access: ${action} on claim ${claimId} from ${auditEvent.ip}`);
  } catch (e) {
    console.error(`[AUDIT ERROR] Failed to log service-key access:`, e);
  }
}

const router = express.Router();

// 1) Create draft claim
// POST /api/v1/inventory/claims
router.post('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const { 
      target_type, 
      inventory_vehicle_id, 
      inventory_trailer_id, 
      inventory_listing_id, 
      claim_note, 
      nickname 
    } = req.body;

    if (!target_type || !['vehicle', 'trailer'].includes(target_type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'target_type must be "vehicle" or "trailer"' 
      });
    }

    if (target_type === 'vehicle' && inventory_trailer_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'inventory_trailer_id must be null when target_type is vehicle' 
      });
    }

    if (target_type === 'trailer' && inventory_vehicle_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'inventory_vehicle_id must be null when target_type is trailer' 
      });
    }

    if (!inventory_listing_id && !inventory_vehicle_id && !inventory_trailer_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Must provide inventory_listing_id or inventory_vehicle_id/inventory_trailer_id' 
      });
    }

    const result = await tenantQuery(req, `
      INSERT INTO inventory_claims (
        target_type, 
        claimant, 
        tenant_id, 
        individual_id,
        inventory_listing_id, 
        vehicle_inventory_id, 
        trailer_inventory_id,
        nickname, 
        notes, 
        status
      )
      VALUES ($1, 'tenant', $2, $3, $4, $5, $6, $7, $8, 'draft')
      RETURNING id
    `, [
      target_type,
      tenantReq.ctx.tenant_id,
      tenantReq.ctx.individual_id,
      inventory_listing_id || null,
      inventory_vehicle_id || null,
      inventory_trailer_id || null,
      nickname || null,
      claim_note || null
    ]);

    res.status(201).json({ 
      claim_id: result.rows[0].id, 
      status: 'draft' 
    });
  } catch (e: any) {
    console.error('Create claim error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2) Add evidence
// POST /api/v1/inventory/claims/:claimId/evidence
router.post('/:claimId/evidence', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const { claimId } = req.params;
    const { evidence_type, inventory_media_id, url, notes } = req.body;

    if (!evidence_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'evidence_type is required' 
      });
    }

    if (!inventory_media_id && !url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Must provide inventory_media_id or url' 
      });
    }

    const claimCheck = await tenantQuery(req, `
      SELECT id, tenant_id, status FROM inventory_claims WHERE id = $1
    `, [claimId]);

    if (claimCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = claimCheck.rows[0];
    if (claim.tenant_id !== tenantReq.ctx.tenant_id) {
      return res.status(403).json({ success: false, error: 'Claim belongs to another tenant' });
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        error: 'Evidence can only be added to draft claims' 
      });
    }

    const result = await tenantQuery(req, `
      INSERT INTO inventory_claim_evidence (
        claim_id, 
        evidence_type, 
        inventory_media_id, 
        url, 
        notes,
        created_by_individual_id,
        raw
      )
      VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
      RETURNING id
    `, [
      claimId,
      evidence_type,
      inventory_media_id || null,
      url || null,
      notes || null,
      tenantReq.ctx.individual_id
    ]);

    res.status(201).json({ evidence_id: result.rows[0].id });
  } catch (e: any) {
    console.error('Add evidence error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 3) Submit claim
// POST /api/v1/inventory/claims/:claimId/submit
router.post('/:claimId/submit', requireAuth, requireTenant, async (req: Request, res: Response) => {
  let currentStatus: string | undefined;
  try {
    const tenantReq = req as TenantRequest;
    const { claimId } = req.params;

    const claimCheck = await tenantQuery(req, `
      SELECT c.id, c.tenant_id, c.status, COUNT(e.id) as evidence_count
      FROM inventory_claims c
      LEFT JOIN inventory_claim_evidence e ON e.claim_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [claimId]);

    if (claimCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = claimCheck.rows[0];
    currentStatus = claim.status;
    
    if (claim.tenant_id !== tenantReq.ctx.tenant_id) {
      return res.status(403).json({ success: false, error: 'Claim belongs to another tenant' });
    }

    // User-friendly check: require at least 1 evidence item
    if (parseInt(claim.evidence_count) < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Claim must have at least 1 evidence item to submit' 
      });
    }

    // DB trigger enforces valid transitions (draft -> submitted)
    await tenantQuery(req, `
      UPDATE inventory_claims 
      SET status = 'submitted', submitted_at = now(), updated_at = now()
      WHERE id = $1
    `, [claimId]);

    await withServiceTransaction(async (client) => {
      await client.query(`
        INSERT INTO inventory_claim_events (claim_id, event_type, actor_individual_id, payload)
        VALUES ($1, 'submitted', $2, '{}'::jsonb)
      `, [claimId, tenantReq.ctx.individual_id]);
    });

    res.json({ claim_id: claimId, status: 'submitted' });
  } catch (e: any) {
    // Let DB trigger reject invalid transitions with 409
    return handleTransitionError(res, e, currentStatus);
  }
});

// 4) List tenant claims
// GET /api/v1/inventory/claims
router.get('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT 
        id as claim_id,
        target_type,
        status,
        created_at,
        nickname,
        inventory_listing_id,
        vehicle_inventory_id as inventory_vehicle_id,
        trailer_inventory_id as inventory_trailer_id,
        applied_at
      FROM inventory_claims
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset as string));

    const result = await tenantQuery(req, query, params);
    res.json({ items: result.rows });
  } catch (e: any) {
    console.error('List claims error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5) Claim detail
// GET /api/v1/inventory/claims/:claimId
router.get('/:claimId', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const { claimId } = req.params;

    const claimResult = await tenantQuery(req, `
      SELECT 
        id as claim_id,
        status,
        target_type,
        notes as claim_note,
        nickname,
        decision,
        created_at,
        applied_at,
        created_tenant_vehicle_id,
        created_tenant_trailer_id,
        created_asset_id,
        tenant_id
      FROM inventory_claims
      WHERE id = $1
    `, [claimId]);

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = claimResult.rows[0];
    if (claim.tenant_id !== tenantReq.ctx.tenant_id) {
      return res.status(403).json({ success: false, error: 'Claim belongs to another tenant' });
    }

    const evidenceResult = await tenantQuery(req, `
      SELECT 
        id as evidence_id,
        evidence_type,
        COALESCE(url, (SELECT url FROM inventory_media WHERE id = inventory_media_id)) as url,
        created_at
      FROM inventory_claim_evidence
      WHERE claim_id = $1
      ORDER BY created_at
    `, [claimId]);

    delete claim.tenant_id;
    res.json({ claim, evidence: evidenceResult.rows });
  } catch (e: any) {
    console.error('Claim detail error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 6) Start review
// POST /api/v1/inventory/claims/:claimId/review/start
router.post('/:claimId/review/start', requireTenantAdminOrService, async (req: Request, res: Response) => {
  let currentStatus: string | undefined;
  try {
    const tenantReq = req as TenantRequest;
    const { claimId } = req.params;
    const isServiceMode = isServiceKeyRequest(req);

    // MANDATORY AUDIT: Log service-key access before any business logic
    if (isServiceMode) {
      await logServiceKeyAudit(claimId, 'review_start_attempt', req);
    }

    const claimCheck = isServiceMode 
      ? await serviceQuery(`SELECT id, tenant_id, status FROM inventory_claims WHERE id = $1`, [claimId])
      : await tenantQuery(req, `SELECT id, tenant_id, status FROM inventory_claims WHERE id = $1`, [claimId]);

    if (claimCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = claimCheck.rows[0];
    currentStatus = claim.status;
    
    if (!isServiceMode && claim.tenant_id !== tenantReq.ctx.tenant_id) {
      return res.status(403).json({ success: false, error: 'Claim belongs to another tenant' });
    }

    // DB trigger enforces valid transitions (submitted -> under_review)
    const actorId = tenantReq.ctx?.individual_id || null;

    await withServiceTransaction(async (client) => {
      await client.query(`
        UPDATE inventory_claims 
        SET status = 'under_review', reviewed_by_individual_id = $2, updated_at = now()
        WHERE id = $1
      `, [claimId, actorId]);

      await client.query(`
        INSERT INTO inventory_claim_events (claim_id, event_type, actor_individual_id, payload)
        VALUES ($1, 'review_started', $2, $3::jsonb)
      `, [claimId, actorId, JSON.stringify({ via_service_key: isServiceMode })]);
    });

    res.json({ claim_id: claimId, status: 'under_review' });
  } catch (e: any) {
    // Let DB trigger reject invalid transitions with 409
    return handleTransitionError(res, e, currentStatus);
  }
});

// 7) Decision (approve/reject)
// POST /api/v1/inventory/claims/:claimId/decision
router.post('/:claimId/decision', requireTenantAdminOrService, async (req: Request, res: Response) => {
  let currentStatus: string | undefined;
  try {
    const tenantReq = req as TenantRequest;
    const { claimId } = req.params;
    const { decision, review_note } = req.body;
    const isServiceMode = isServiceKeyRequest(req);

    // MANDATORY AUDIT: Log service-key access before any business logic
    if (isServiceMode) {
      await logServiceKeyAudit(claimId, `decision_${decision || 'unknown'}_attempt`, req);
    }

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ 
        success: false, 
        error: 'decision must be "approve" or "reject"' 
      });
    }

    const claimCheck = isServiceMode 
      ? await serviceQuery(`SELECT id, tenant_id, status FROM inventory_claims WHERE id = $1`, [claimId])
      : await tenantQuery(req, `SELECT id, tenant_id, status FROM inventory_claims WHERE id = $1`, [claimId]);

    if (claimCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = claimCheck.rows[0];
    currentStatus = claim.status;
    
    if (!isServiceMode && claim.tenant_id !== tenantReq.ctx.tenant_id) {
      return res.status(403).json({ success: false, error: 'Claim belongs to another tenant' });
    }

    // DB trigger enforces valid transitions (under_review/submitted -> approved/rejected)
    const actorId = tenantReq.ctx?.individual_id || null;

    if (decision === 'reject') {
      await withServiceTransaction(async (client) => {
        await client.query(`
          UPDATE inventory_claims 
          SET status = 'rejected', 
              decision = 'rejected',
              decision_reason = $2,
              decided_at = now(),
              reviewed_by_individual_id = COALESCE(reviewed_by_individual_id, $3),
              updated_at = now()
          WHERE id = $1
        `, [claimId, review_note || null, actorId]);

        await client.query(`
          INSERT INTO inventory_claim_events (claim_id, event_type, actor_individual_id, payload)
          VALUES ($1, 'rejected', $2, $3::jsonb)
        `, [claimId, actorId, JSON.stringify({ reason: review_note })]);
      });

      return res.json({ claim_id: claimId, status: 'rejected', created: null });
    }

    const result = await withServiceTransaction(async (client) => {
      await client.query(`
        UPDATE inventory_claims 
        SET status = 'approved',
            decision = 'approved',
            decision_reason = $2,
            decided_at = now(),
            reviewed_by_individual_id = COALESCE(reviewed_by_individual_id, $3),
            updated_at = now()
        WHERE id = $1
      `, [claimId, review_note || null, actorId]);

      await client.query(`SELECT fn_apply_inventory_claim($1)`, [claimId]);

      const appliedClaim = await client.query(`
        SELECT 
          status,
          created_tenant_vehicle_id,
          created_tenant_trailer_id,
          created_asset_id
        FROM inventory_claims WHERE id = $1
      `, [claimId]);

      return appliedClaim.rows[0];
    });

    res.json({ 
      claim_id: claimId, 
      status: result.status,
      created: {
        tenant_vehicle_id: result.created_tenant_vehicle_id || null,
        tenant_trailer_id: result.created_tenant_trailer_id || null,
        asset_id: result.created_asset_id || null
      }
    });
  } catch (e: any) {
    // Let DB trigger reject invalid transitions with 409
    return handleTransitionError(res, e, currentStatus);
  }
});

export default router;
