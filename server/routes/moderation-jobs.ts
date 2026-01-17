import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';
import { 
  recordIntentPayment, 
  recordIntentRefund,
  getIntentAuditTrail,
  generateReceiptPayload,
  type IntentRecord,
  type PaymentInfo,
  type RefundInfo
} from '../services/jobs/jobPublicationAccounting';

const markPaidSchema = z.object({
  pspProvider: z.string().max(50).default('manual'),
  pspReference: z.string().max(255).optional(),
  pspMetadata: z.record(z.any()).optional(),
  note: z.string().max(1000).optional()
});

const refundSchema = z.object({
  reason: z.string().min(1).max(1000),
  amountCents: z.number().int().positive().optional(),
  note: z.string().max(1000).optional()
});

const router = express.Router();

async function requirePortalStaff(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED',
      message: 'Moderation requires portal context'
    });
  }

  if (!ctx?.individual_id) {
    return res.status(401).json({
      ok: false,
      error: 'AUTH_REQUIRED',
      message: 'Authentication required for moderation actions'
    });
  }

  try {
    const staffCheck = await serviceQuery(`
      SELECT 1 FROM cc_portal_staff ps
      WHERE ps.portal_id = $1 
        AND ps.individual_id = $2
        AND ps.is_active = true
        AND (ps.role IN ('admin', 'moderator', 'staff') OR ps.can_moderate_content = true)
      UNION
      SELECT 1 FROM cc_tenant_memberships tm
      JOIN cc_portals p ON p.tenant_id = tm.tenant_id
      WHERE p.id = $1 
        AND tm.individual_id = $2 
        AND tm.is_active = true
        AND tm.role IN ('admin', 'owner')
    `, [ctx.portal_id, ctx.individual_id]);

    if (staffCheck.rows.length === 0) {
      return res.status(403).json({
        ok: false,
        error: 'PORTAL_STAFF_REQUIRED',
        message: 'Portal staff or admin access required for moderation'
      });
    }

    next();
  } catch (error: any) {
    console.error('Portal staff check error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to verify authorization'
    });
  }
}

router.use(requirePortalStaff);

router.get('/pending', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await serviceQuery(`
      SELECT 
        jp.id as posting_id,
        jp.job_id,
        jp.portal_id,
        jp.publish_state,
        jp.posted_at,
        jp.custom_title,
        jp.custom_description,
        j.title,
        j.description,
        j.role_category,
        j.employment_type,
        j.location_text,
        j.brand_name_snapshot,
        j.legal_name_snapshot,
        j.created_at as job_created_at,
        t.name as tenant_name,
        p.name as portal_name,
        p.slug as portal_slug
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      JOIN cc_portals p ON p.id = jp.portal_id
      LEFT JOIN cc_tenants t ON t.id = j.tenant_id
      WHERE jp.portal_id = $1
        AND jp.publish_state = 'pending_review'
      ORDER BY jp.posted_at ASC
      LIMIT $2 OFFSET $3
    `, [ctx.portal_id, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_job_postings jp
      WHERE jp.portal_id = $1 AND jp.publish_state = 'pending_review'
    `, [ctx.portal_id]);

    res.json({
      ok: true,
      postings: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Pending moderation list error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch pending postings'
    });
  }
});

router.post('/:postingId/approve', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const checkResult = await serviceQuery(`
      SELECT id, publish_state FROM cc_job_postings
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND'
      });
    }

    if (checkResult.rows[0].publish_state !== 'pending_review') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: 'Posting is not pending review'
      });
    }

    await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'published',
        published_at = now(),
        reviewed_at = now(),
        reviewed_by_identity_id = $3::uuid,
        rejection_reason = NULL
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id, ctx.individual_id || null]);

    res.json({
      ok: true,
      message: 'Posting approved and published'
    });

  } catch (error: any) {
    console.error('Approve posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to approve posting'
    });
  }
});

router.post('/:postingId/reject', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;
  const { reason } = req.body;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'Rejection reason is required'
    });
  }

  try {
    const checkResult = await serviceQuery(`
      SELECT id, publish_state FROM cc_job_postings
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND'
      });
    }

    if (checkResult.rows[0].publish_state !== 'pending_review') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: 'Posting is not pending review'
      });
    }

    await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'rejected',
        reviewed_at = now(),
        reviewed_by_identity_id = $3::uuid,
        rejection_reason = $4
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id, ctx.individual_id || null, reason.trim()]);

    res.json({
      ok: true,
      message: 'Posting rejected'
    });

  } catch (error: any) {
    console.error('Reject posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to reject posting'
    });
  }
});

router.post('/:postingId/pause', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'paused',
        paused_at = now()
      WHERE id = $1 AND portal_id = $2 AND publish_state = 'published'
      RETURNING id
    `, [postingId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Posting paused'
    });

  } catch (error: any) {
    console.error('Pause posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to pause posting'
    });
  }
});

router.post('/:postingId/resume', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'published',
        paused_at = NULL
      WHERE id = $1 AND portal_id = $2 AND publish_state = 'paused'
      RETURNING id
    `, [postingId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Posting resumed'
    });

  } catch (error: any) {
    console.error('Resume posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to resume posting'
    });
  }
});

router.post('/:postingId/archive', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'archived',
        archived_at = now()
      WHERE id = $1 AND portal_id = $2 AND publish_state IN ('published', 'paused', 'rejected')
      RETURNING id
    `, [postingId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Posting archived'
    });

  } catch (error: any) {
    console.error('Archive posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to archive posting'
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        publish_state,
        COUNT(*) as count
      FROM cc_job_postings
      WHERE portal_id = $1
      GROUP BY publish_state
    `, [ctx.portal_id]);

    const stats: Record<string, number> = {
      draft: 0,
      pending_review: 0,
      published: 0,
      rejected: 0,
      paused: 0,
      archived: 0
    };

    for (const row of result.rows) {
      stats[row.publish_state] = parseInt(row.count);
    }

    res.json({
      ok: true,
      stats
    });

  } catch (error: any) {
    console.error('Moderation stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch moderation stats'
    });
  }
});

router.post('/paid-publications/:intentId/mark-paid', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { intentId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  const parseResult = markPaidSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  const { pspProvider, pspReference, pspMetadata, note } = parseResult.data;

  try {
    const intentCheck = await serviceQuery(`
      SELECT ppi.*
      FROM cc_paid_publication_intents ppi
      WHERE ppi.id = $1 AND ppi.portal_id = $2
    `, [intentId, ctx.portal_id]);

    if (intentCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'INTENT_NOT_FOUND'
      });
    }

    const intentRow = intentCheck.rows[0];

    if (intentRow.status === 'paid') {
      return res.status(400).json({
        ok: false,
        error: 'ALREADY_PAID',
        message: 'This payment intent has already been marked as paid'
      });
    }

    if (intentRow.status === 'refunded' || intentRow.status === 'cancelled') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: `Cannot mark ${intentRow.status} intent as paid`
      });
    }

    const result = await withServiceTransaction(async (client) => {
      const intent: IntentRecord = {
        id: intentRow.id,
        tenant_id: intentRow.tenant_id,
        job_id: intentRow.job_id,
        portal_id: intentRow.portal_id,
        amount_cents: intentRow.amount_cents,
        tier_price_cents: intentRow.tier_price_cents || 0,
        currency: intentRow.currency || 'CAD',
        status: intentRow.status,
        tier_metadata: intentRow.tier_metadata || {},
        attention_tier: intentRow.attention_tier,
        assistance_tier: intentRow.assistance_tier,
        psp_provider: intentRow.psp_provider,
        psp_reference: intentRow.psp_reference,
        ledger_charge_entry_id: intentRow.ledger_charge_entry_id
      };

      const paymentInfo: PaymentInfo = {
        pspProvider: pspProvider || 'manual',
        pspReference,
        pspMetadata,
        note,
        actorIndividualId: ctx.individual_id || undefined
      };

      return recordIntentPayment(client, intent, paymentInfo);
    });

    res.json({
      ok: true,
      intentId,
      jobId: intentRow.job_id,
      portalId: intentRow.portal_id,
      ledgerPaymentEntryId: result.ledgerEntryId,
      message: 'Payment confirmed and job posting published'
    });

  } catch (error: any) {
    console.error('Mark paid error:', error);
    
    if (error.message?.includes('Cannot record payment')) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: error.message
      });
    }
    
    res.status(500).json({
      ok: false,
      error: 'Failed to mark payment as paid'
    });
  }
});

router.get('/paid-publications/pending', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await serviceQuery(`
      SELECT 
        ppi.id as intent_id,
        ppi.job_id,
        ppi.portal_id,
        ppi.amount_cents,
        ppi.currency,
        ppi.status,
        ppi.created_at,
        j.title as job_title,
        j.brand_name_snapshot,
        t.name as tenant_name
      FROM cc_paid_publication_intents ppi
      JOIN cc_jobs j ON j.id = ppi.job_id
      LEFT JOIN cc_tenants t ON t.id = j.tenant_id
      WHERE ppi.portal_id = $1
        AND ppi.status IN ('requires_action', 'pending_payment')
      ORDER BY ppi.created_at ASC
      LIMIT $2 OFFSET $3
    `, [ctx.portal_id, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_paid_publication_intents
      WHERE portal_id = $1 AND status IN ('requires_action', 'pending_payment')
    `, [ctx.portal_id]);

    res.json({
      ok: true,
      intents: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Pending payments list error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch pending payments'
    });
  }
});

router.post('/paid-publications/:intentId/refund', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { intentId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  const parseResult = refundSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  const { reason, amountCents, note } = parseResult.data;

  try {
    const intentCheck = await serviceQuery(`
      SELECT ppi.*
      FROM cc_paid_publication_intents ppi
      WHERE ppi.id = $1 AND ppi.portal_id = $2
    `, [intentId, ctx.portal_id]);

    if (intentCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'INTENT_NOT_FOUND'
      });
    }

    const intentRow = intentCheck.rows[0];

    if (intentRow.status !== 'paid') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: `Cannot refund intent in ${intentRow.status} status - must be paid`
      });
    }

    const result = await withServiceTransaction(async (client) => {
      const intent: IntentRecord = {
        id: intentRow.id,
        tenant_id: intentRow.tenant_id,
        job_id: intentRow.job_id,
        portal_id: intentRow.portal_id,
        amount_cents: intentRow.amount_cents,
        tier_price_cents: intentRow.tier_price_cents || 0,
        currency: intentRow.currency || 'CAD',
        status: intentRow.status,
        tier_metadata: intentRow.tier_metadata || {},
        attention_tier: intentRow.attention_tier,
        assistance_tier: intentRow.assistance_tier,
        psp_provider: intentRow.psp_provider,
        psp_reference: intentRow.psp_reference,
        ledger_charge_entry_id: intentRow.ledger_charge_entry_id,
        ledger_payment_entry_id: intentRow.ledger_payment_entry_id
      };

      const refundInfo: RefundInfo = {
        reason,
        amountCents,
        note,
        actorIndividualId: ctx.individual_id || undefined
      };

      return recordIntentRefund(client, intent, refundInfo);
    });

    res.json({
      ok: true,
      intentId,
      jobId: intentRow.job_id,
      portalId: intentRow.portal_id,
      ledgerRefundEntryId: result.ledgerEntryId,
      message: 'Refund processed and job posting archived'
    });

  } catch (error: any) {
    console.error('Refund error:', error);
    
    if (error.message?.includes('Cannot refund')) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: error.message
      });
    }
    
    res.status(500).json({
      ok: false,
      error: 'Failed to process refund'
    });
  }
});

router.get('/paid-publications/:intentId', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { intentId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const intentCheck = await serviceQuery(`
      SELECT ppi.tenant_id, ppi.portal_id
      FROM cc_paid_publication_intents ppi
      WHERE ppi.id = $1 AND ppi.portal_id = $2
    `, [intentId, ctx.portal_id]);

    if (intentCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'INTENT_NOT_FOUND'
      });
    }

    const tenantId = intentCheck.rows[0].tenant_id;

    const auditTrail = await withServiceTransaction(async (client) => {
      return getIntentAuditTrail(client, intentId, tenantId);
    });

    res.json({
      ok: true,
      intent: auditTrail.intent,
      ledgerEntries: auditTrail.ledgerEntries,
      events: auditTrail.events
    });

  } catch (error: any) {
    console.error('Intent audit error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch intent audit trail'
    });
  }
});

router.get('/paid-publications/:intentId/receipt', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { intentId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const intentCheck = await serviceQuery(`
      SELECT ppi.tenant_id, ppi.portal_id, ppi.status
      FROM cc_paid_publication_intents ppi
      WHERE ppi.id = $1 AND ppi.portal_id = $2
    `, [intentId, ctx.portal_id]);

    if (intentCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'INTENT_NOT_FOUND'
      });
    }

    if (intentCheck.rows[0].status !== 'paid' && intentCheck.rows[0].status !== 'refunded') {
      return res.status(400).json({
        ok: false,
        error: 'RECEIPT_NOT_AVAILABLE',
        message: 'Receipt is only available for paid or refunded intents'
      });
    }

    const tenantId = intentCheck.rows[0].tenant_id;

    const receipt = await withServiceTransaction(async (client) => {
      return generateReceiptPayload(client, intentId, tenantId);
    });

    res.json({
      ok: true,
      receipt
    });

  } catch (error: any) {
    console.error('Receipt generation error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate receipt'
    });
  }
});

export default router;
