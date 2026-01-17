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

// ============================================
// COORDINATOR QUEUE - Application Triage
// ============================================

const statusChangeSchema = z.object({
  status: z.enum([
    'draft', 'submitted', 'under_review', 'shortlisted',
    'interview_scheduled', 'interviewed', 'offer_extended',
    'offer_accepted', 'offer_declined', 'rejected', 'withdrawn'
  ]),
  note: z.string().max(2000).optional()
});

const addNoteSchema = z.object({
  note: z.string().min(1).max(2000)
});

const sendReplySchema = z.object({
  templateCode: z.string(),
  mergeFields: z.record(z.string()).optional(),
  customMessage: z.string().max(5000).optional()
});

// Get coordinator queue - all applications for portal
router.get('/applications', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const campaignKey = req.query.campaign as string;
    const housingNeeded = req.query.housing_needed as string;
    const needsReply = req.query.needs_reply as string;

    let whereClause = 'WHERE jp.portal_id = $1';
    const params: any[] = [ctx.portal_id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND a.status = $${paramIndex}::job_application_status`;
      params.push(status);
      paramIndex++;
    }

    if (needsReply === 'true') {
      whereClause += ` AND a.needs_reply = true`;
    }

    if (housingNeeded === 'true') {
      whereClause += ` AND a.needs_accommodation = true`;
    }

    const result = await serviceQuery(`
      SELECT 
        a.id,
        a.application_number,
        a.status,
        a.submitted_at,
        a.last_activity_at,
        a.needs_reply,
        a.needs_accommodation,
        a.internal_notes,
        a.resume_url,
        a.cover_letter,
        j.id as job_id,
        j.title as job_title,
        j.role_category,
        j.location_text,
        jp.id as job_posting_id,
        jp.custom_title,
        i.id as individual_id,
        i.display_name as applicant_name,
        i.email as applicant_email,
        i.phone as applicant_phone,
        t.id as tenant_id,
        t.name as employer_name,
        EXTRACT(EPOCH FROM (now() - COALESCE(a.submitted_at, a.created_at))) / 3600 as hours_since_submission,
        (SELECT COUNT(*) FROM cc_job_application_bundle_items bi WHERE bi.application_id = a.id) as bundle_count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_jobs j ON j.id = a.job_id
      JOIN cc_tenants t ON t.id = a.tenant_id
      LEFT JOIN cc_individuals i ON i.id = a.applicant_individual_id
      ${whereClause}
      ORDER BY 
        CASE WHEN a.status = 'submitted' THEN 0 ELSE 1 END,
        a.submitted_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      ${whereClause}
    `, params);

    // Calculate SLA status for each application
    const applications = result.rows.map((app: any) => {
      const hours = parseFloat(app.hours_since_submission) || 0;
      let slaStatus: 'green' | 'yellow' | 'red' = 'green';
      if (hours > 24) slaStatus = 'red';
      else if (hours > 2) slaStatus = 'yellow';

      return {
        ...app,
        sla_status: slaStatus,
        hours_since_submission: Math.round(hours * 10) / 10
      };
    });

    res.json({
      ok: true,
      applications,
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Coordinator queue error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch applications'
    });
  }
});

// Get queue stats (MUST be before :applicationId route)
router.get('/applications/stats', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;

  try {
    const result = await serviceQuery(`
      SELECT 
        a.status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE a.needs_reply = true) as needs_reply_count,
        COUNT(*) FILTER (
          WHERE EXTRACT(EPOCH FROM (now() - COALESCE(a.submitted_at, a.created_at))) / 3600 > 24
        ) as sla_red_count,
        COUNT(*) FILTER (
          WHERE EXTRACT(EPOCH FROM (now() - COALESCE(a.submitted_at, a.created_at))) / 3600 BETWEEN 2 AND 24
        ) as sla_yellow_count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE jp.portal_id = $1
      GROUP BY a.status
    `, [ctx.portal_id]);

    const stats = result.rows.reduce((acc: any, row: any) => {
      acc[row.status] = {
        count: parseInt(row.count),
        needs_reply: parseInt(row.needs_reply_count),
        sla_red: parseInt(row.sla_red_count),
        sla_yellow: parseInt(row.sla_yellow_count)
      };
      return acc;
    }, {});

    res.json({
      ok: true,
      stats
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch stats'
    });
  }
});

// Get single application detail
router.get('/applications/:applicationId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { applicationId } = req.params;

  try {
    const result = await serviceQuery(`
      SELECT 
        a.*,
        j.id as job_id,
        j.title as job_title,
        j.role_category,
        j.location_text,
        j.description as job_description,
        jp.id as job_posting_id,
        jp.custom_title,
        i.id as individual_id,
        i.display_name as applicant_name,
        i.email as applicant_email,
        i.phone as applicant_phone,
        i.location_text as applicant_location,
        t.id as tenant_id,
        t.name as employer_name
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_jobs j ON j.id = a.job_id
      JOIN cc_tenants t ON t.id = a.tenant_id
      LEFT JOIN cc_individuals i ON i.id = a.applicant_individual_id
      WHERE a.id = $1 AND jp.portal_id = $2
    `, [applicationId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    // Get events
    const eventsResult = await serviceQuery(`
      SELECT e.*, u.display_name as actor_name
      FROM cc_job_application_events e
      LEFT JOIN cc_users u ON u.id = e.actor_user_id
      WHERE e.application_id = $1
      ORDER BY e.created_at DESC
      LIMIT 50
    `, [applicationId]);

    // Get bundle info if from campaign
    const bundleResult = await serviceQuery(`
      SELECT 
        b.id as bundle_id,
        b.campaign_key,
        b.applicant_name as bundle_applicant_name,
        b.housing_needed,
        b.work_permit_question,
        b.message as bundle_message
      FROM cc_job_application_bundle_items bi
      JOIN cc_job_application_bundles b ON b.id = bi.bundle_id
      WHERE bi.application_id = $1
      LIMIT 1
    `, [applicationId]);

    res.json({
      ok: true,
      application: result.rows[0],
      events: eventsResult.rows,
      bundle: bundleResult.rows[0] || null
    });
  } catch (error: any) {
    console.error('Application detail error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch application'
    });
  }
});

// Change application status
router.post('/applications/:applicationId/status', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { applicationId } = req.params;

  try {
    const parsed = statusChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten()
      });
    }

    const { status, note } = parsed.data;

    // Verify portal ownership
    const appCheck = await serviceQuery(`
      SELECT a.id, a.status as current_status, a.tenant_id, jp.portal_id
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE a.id = $1 AND jp.portal_id = $2
    `, [applicationId, ctx.portal_id]);

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    const currentStatus = appCheck.rows[0].current_status;
    const tenantId = appCheck.rows[0].tenant_id;

    await withServiceTransaction(async (client) => {
      // Update status
      await client.query(`
        UPDATE cc_job_applications 
        SET status = $1::job_application_status, 
            last_activity_at = now(),
            updated_at = now()
        WHERE id = $2
      `, [status, applicationId]);

      // Add event
      await client.query(`
        INSERT INTO cc_job_application_events (
          application_id, portal_id, tenant_id, actor_user_id,
          event_type, previous_status, new_status, note
        ) VALUES ($1, $2, $3, $4, 'status_changed', $5, $6, $7)
      `, [applicationId, ctx.portal_id, tenantId, null, currentStatus, status, note || null]);
    });

    res.json({
      ok: true,
      message: 'Status updated'
    });
  } catch (error: any) {
    console.error('Status change error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update status'
    });
  }
});

// Add note to application
router.post('/applications/:applicationId/notes', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { applicationId } = req.params;

  try {
    const parsed = addNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten()
      });
    }

    const { note } = parsed.data;

    // Verify portal ownership
    const appCheck = await serviceQuery(`
      SELECT a.id, a.tenant_id, jp.portal_id
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE a.id = $1 AND jp.portal_id = $2
    `, [applicationId, ctx.portal_id]);

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    const tenantId = appCheck.rows[0].tenant_id;

    await withServiceTransaction(async (client) => {
      // Update last activity
      await client.query(`
        UPDATE cc_job_applications 
        SET last_activity_at = now(),
            updated_at = now()
        WHERE id = $1
      `, [applicationId]);

      // Add event
      await client.query(`
        INSERT INTO cc_job_application_events (
          application_id, portal_id, tenant_id, actor_user_id,
          event_type, note
        ) VALUES ($1, $2, $3, $4, 'note_added', $5)
      `, [applicationId, ctx.portal_id, tenantId, null, note]);
    });

    res.json({
      ok: true,
      message: 'Note added'
    });
  } catch (error: any) {
    console.error('Add note error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to add note'
    });
  }
});

// Send reply using template
router.post('/applications/:applicationId/reply', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { applicationId } = req.params;

  try {
    const parsed = sendReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten()
      });
    }

    const { templateCode, mergeFields, customMessage } = parsed.data;

    // Verify portal ownership
    const appCheck = await serviceQuery(`
      SELECT a.id, a.tenant_id, jp.portal_id, i.email as applicant_email
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      LEFT JOIN cc_individuals i ON i.id = a.applicant_individual_id
      WHERE a.id = $1 AND jp.portal_id = $2
    `, [applicationId, ctx.portal_id]);

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    const tenantId = appCheck.rows[0].tenant_id;

    // Get template
    const templateResult = await serviceQuery(`
      SELECT id, code, subject_template, body_template
      FROM cc_notification_templates
      WHERE code = $1 AND is_active = true
    `, [templateCode]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND'
      });
    }

    const template = templateResult.rows[0];

    await withServiceTransaction(async (client) => {
      // Update application
      await client.query(`
        UPDATE cc_job_applications 
        SET needs_reply = false,
            last_activity_at = now(),
            updated_at = now()
        WHERE id = $1
      `, [applicationId]);

      // Add event with template info
      await client.query(`
        INSERT INTO cc_job_application_events (
          application_id, portal_id, tenant_id, actor_user_id,
          event_type, template_code, note, metadata
        ) VALUES ($1, $2, $3, $4, 'reply_sent', $5, $6, $7)
      `, [
        applicationId, 
        ctx.portal_id, 
        tenantId, 
        null, 
        templateCode,
        customMessage || null,
        JSON.stringify({ 
          template_id: template.id,
          merge_fields: mergeFields || {},
          subject: template.subject_template
        })
      ]);
    });

    res.json({
      ok: true,
      message: 'Reply recorded',
      template: {
        code: template.code,
        subject: template.subject_template
      }
    });
  } catch (error: any) {
    console.error('Send reply error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to send reply'
    });
  }
});

// Get reply templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const result = await serviceQuery(`
      SELECT id, code, name, description, subject_template, body_template, is_actionable
      FROM cc_notification_templates
      WHERE category = 'job' AND is_active = true
      ORDER BY name
    `);

    res.json({
      ok: true,
      templates: result.rows
    });
  } catch (error: any) {
    console.error('Templates fetch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch templates'
    });
  }
});

// ============================================================================
// HIRING PULSE - Cold-start health dashboard metrics
// ============================================================================

const hiringPulseRangeSchema = z.enum(['7d', '30d']).default('7d');

router.get('/hiring-pulse', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;

  const rangeResult = hiringPulseRangeSchema.safeParse(req.query.range);
  const range = rangeResult.success ? rangeResult.data : '7d';
  const days = range === '30d' ? 30 : 7;

  try {
    // Get portal info for share links
    const portalResult = await serviceQuery(`
      SELECT id, slug, name, config
      FROM cc_portals
      WHERE id = $1
    `, [ctx.portal_id]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Portal not found' });
    }

    const portal = portalResult.rows[0];

    // New applications in range
    const newAppsResult = await serviceQuery(`
      SELECT COUNT(*) as count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE jp.portal_id = $1
        AND a.created_at >= NOW() - INTERVAL '${days} days'
    `, [ctx.portal_id]);

    // Applications by status
    const byStatusResult = await serviceQuery(`
      SELECT a.status, COUNT(*) as count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE jp.portal_id = $1
        AND a.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY a.status
      ORDER BY count DESC
    `, [ctx.portal_id]);

    // Median first response time (minutes) from events
    const medianResponseResult = await serviceQuery(`
      WITH first_responses AS (
        SELECT 
          a.id as application_id,
          EXTRACT(EPOCH FROM (
            MIN(e.created_at) - COALESCE(a.submitted_at, a.created_at)
          )) / 60 as minutes_to_first_response
        FROM cc_job_applications a
        JOIN cc_job_postings jp ON jp.id = a.job_posting_id
        LEFT JOIN cc_job_application_events e ON e.application_id = a.id
          AND e.event_type IN ('reply_sent', 'status_changed')
        WHERE jp.portal_id = $1
          AND a.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY a.id, a.submitted_at, a.created_at
        HAVING MIN(e.created_at) IS NOT NULL
      )
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes_to_first_response) as median
      FROM first_responses
    `, [ctx.portal_id]);

    // Housing needed count (uses needs_accommodation column)
    const housingResult = await serviceQuery(`
      SELECT COUNT(*) as count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE jp.portal_id = $1
        AND a.created_at >= NOW() - INTERVAL '${days} days'
        AND a.needs_accommodation = true
    `, [ctx.portal_id]);

    // Work permit questions count (from screening_responses JSON if present)
    const workPermitResult = await serviceQuery(`
      SELECT COUNT(*) as count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE jp.portal_id = $1
        AND a.created_at >= NOW() - INTERVAL '${days} days'
        AND a.screening_responses IS NOT NULL
        AND a.screening_responses->>'work_permit_status' IS NOT NULL
        AND a.screening_responses->>'work_permit_status' != 'not_applicable'
    `, [ctx.portal_id]);

    // Needs reply count - applications with no reply_sent event
    const needsReplyResult = await serviceQuery(`
      SELECT COUNT(*) as count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE jp.portal_id = $1
        AND a.created_at >= NOW() - INTERVAL '${days} days'
        AND a.status IN ('new', 'reviewing')
        AND NOT EXISTS (
          SELECT 1 FROM cc_job_application_events e
          WHERE e.application_id = a.id
            AND e.event_type = 'reply_sent'
        )
    `, [ctx.portal_id]);

    // Top employers by application count
    const topEmployersResult = await serviceQuery(`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        COUNT(*) as application_count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_tenants t ON t.id = a.tenant_id
      WHERE jp.portal_id = $1
        AND a.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY t.id, t.name
      ORDER BY application_count DESC
      LIMIT 5
    `, [ctx.portal_id]);

    // Build share links
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : '';
    
    const shareLinks: { label: string; url: string }[] = [];
    
    // Portal jobs page
    shareLinks.push({
      label: 'Jobs Board',
      url: `${baseUrl}/b/${portal.slug}/jobs`
    });

    // Check for campaign apply pages
    const campaignsResult = await serviceQuery(`
      SELECT c.id, c.slug, c.name
      FROM cc_job_campaigns c
      WHERE c.portal_id = $1
        AND c.is_active = true
      ORDER BY c.name
      LIMIT 5
    `, [ctx.portal_id]);

    for (const campaign of campaignsResult.rows) {
      shareLinks.push({
        label: `Campaign: ${campaign.name}`,
        url: `${baseUrl}/b/${portal.slug}/apply/${campaign.slug}`
      });
    }

    res.json({
      ok: true,
      range,
      rangeDays: days,
      portalName: portal.name,
      metrics: {
        newApplicationsCount: parseInt(newAppsResult.rows[0]?.count || '0'),
        applicationsByStatus: byStatusResult.rows.reduce((acc: Record<string, number>, row: any) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        medianFirstReplyMinutes: medianResponseResult.rows[0]?.median 
          ? Math.round(parseFloat(medianResponseResult.rows[0].median))
          : null,
        needsReplyCount: parseInt(needsReplyResult.rows[0]?.count || '0'),
        housingNeededCount: parseInt(housingResult.rows[0]?.count || '0'),
        workPermitQuestionsCount: parseInt(workPermitResult.rows[0]?.count || '0'),
        topEmployersByApplications: topEmployersResult.rows.map((row: any) => ({
          tenantId: row.tenant_id,
          tenantName: row.tenant_name,
          applicationCount: parseInt(row.application_count)
        }))
      },
      shareLinks
    });
  } catch (error: any) {
    console.error('Hiring pulse error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch hiring pulse metrics'
    });
  }
});

// =============================================================================
// PORTAL GROWTH SWITCHES
// =============================================================================

const growthSwitchesPatchSchema = z.object({
  jobs_enabled: z.boolean().optional(),
  reservations_state: z.enum(['available', 'request_only', 'enabled']).optional(),
  assets_enabled: z.boolean().optional(),
  service_runs_enabled: z.boolean().optional(),
  leads_enabled: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

router.get('/portals/:portalId/growth-switches', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'Portal mismatch' });
  }

  try {
    // Ensure row exists (on-demand insert)
    await serviceQuery(`
      INSERT INTO cc_portal_growth_switches (portal_id)
      VALUES ($1)
      ON CONFLICT (portal_id) DO NOTHING
    `, [portalId]);

    const result = await serviceQuery(`
      SELECT 
        gs.*,
        p.name as portal_name,
        p.slug as portal_slug
      FROM cc_portal_growth_switches gs
      JOIN cc_portals p ON p.id = gs.portal_id
      WHERE gs.portal_id = $1
    `, [portalId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Growth switches not found' });
    }

    const gs = result.rows[0];

    // Determine next step for reservations
    let reservationsNextStep: { action: string; route: string } | null = null;
    switch (gs.reservations_state) {
      case 'available':
        reservationsNextStep = { action: 'enable', route: '/app/reservations' };
        break;
      case 'request_only':
        reservationsNextStep = { action: 'request', route: '/app/mod/support?topic=reservations' };
        break;
      case 'enabled':
        reservationsNextStep = { action: 'manage', route: '/app/reservations' };
        break;
    }

    res.json({
      ok: true,
      portalId,
      portalName: gs.portal_name,
      switches: {
        jobs_enabled: gs.jobs_enabled,
        reservations_state: gs.reservations_state,
        assets_enabled: gs.assets_enabled,
        service_runs_enabled: gs.service_runs_enabled,
        leads_enabled: gs.leads_enabled
      },
      reservationsNextStep,
      updatedAt: gs.updated_at
    });
  } catch (error: any) {
    console.error('Get growth switches error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch growth switches' });
  }
});

router.patch('/portals/:portalId/growth-switches', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'Portal mismatch' });
  }

  const parseResult = growthSwitchesPatchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ 
      ok: false, 
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten() 
    });
  }

  const updates = parseResult.data;

  try {
    // Build dynamic update
    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [portalId, ctx.individual_id];
    let paramIndex = 3;

    if (updates.jobs_enabled !== undefined) {
      setClauses.push(`jobs_enabled = $${paramIndex++}`);
      params.push(updates.jobs_enabled);
    }
    if (updates.reservations_state !== undefined) {
      setClauses.push(`reservations_state = $${paramIndex++}`);
      params.push(updates.reservations_state);
    }
    if (updates.assets_enabled !== undefined) {
      setClauses.push(`assets_enabled = $${paramIndex++}`);
      params.push(updates.assets_enabled);
    }
    if (updates.service_runs_enabled !== undefined) {
      setClauses.push(`service_runs_enabled = $${paramIndex++}`);
      params.push(updates.service_runs_enabled);
    }
    if (updates.leads_enabled !== undefined) {
      setClauses.push(`leads_enabled = $${paramIndex++}`);
      params.push(updates.leads_enabled);
    }

    setClauses.push('updated_by_identity_id = $2');

    await serviceQuery(`
      UPDATE cc_portal_growth_switches
      SET ${setClauses.join(', ')}
      WHERE portal_id = $1
    `, params);

    res.json({ ok: true, updated: Object.keys(updates) });
  } catch (error: any) {
    console.error('Patch growth switches error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update growth switches' });
  }
});

// Growth Metrics - Adoption proof counts for bench/housing/emergency
router.get('/portals/:portalId/growth-metrics', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'Portal mismatch' });
  }

  const range = req.query.range as string || '7d';
  const rangeDays = range === '30d' ? 30 : 7;
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - rangeDays);

  try {
    // Bench metrics by readiness state
    const benchResult = await serviceQuery(`
      SELECT 
        COUNT(*) FILTER (WHERE readiness_state = 'ready') as ready_count,
        COUNT(*) FILTER (WHERE readiness_state = 'on_site') as on_site_count,
        COUNT(*) FILTER (WHERE readiness_state = 'cleared') as cleared_count,
        COUNT(*) FILTER (WHERE readiness_state = 'prospect') as prospect_count
      FROM cc_portal_candidate_bench
      WHERE portal_id = $1
    `, [portalId]);

    // Housing waitlist metrics
    const housingResult = await serviceQuery(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status IN ('new', 'contacted', 'waitlisted')) as open_count
      FROM cc_portal_housing_waitlist_entries
      WHERE portal_id = $1
    `, [portalId]);

    // Emergency metrics within range
    const emergencyResult = await serviceQuery(`
      SELECT 
        COUNT(*) as created_count,
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'filled') as filled_count
      FROM cc_emergency_replacement_requests
      WHERE portal_id = $1 AND created_at >= $2
    `, [portalId, rangeStart.toISOString()]);

    const bench = benchResult.rows[0] || {};
    const housing = housingResult.rows[0] || {};
    const emergency = emergencyResult.rows[0] || {};

    res.json({
      ok: true,
      rangeDays,
      metrics: {
        bench: {
          readyCount: parseInt(bench.ready_count || '0'),
          onSiteCount: parseInt(bench.on_site_count || '0'),
          clearedCount: parseInt(bench.cleared_count || '0'),
          prospectCount: parseInt(bench.prospect_count || '0')
        },
        housing: {
          waitlistNewCount: parseInt(housing.new_count || '0'),
          waitlistOpenCount: parseInt(housing.open_count || '0')
        },
        emergency: {
          createdCount: parseInt(emergency.created_count || '0'),
          openCount: parseInt(emergency.open_count || '0'),
          filledCount: parseInt(emergency.filled_count || '0')
        }
      }
    });
  } catch (error: any) {
    console.error('Get growth metrics error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch growth metrics' });
  }
});

// =============================================================================
// HOUSING WAITLIST (Staff)
// =============================================================================

const waitlistPatchSchema = z.object({
  status: z.enum(['new', 'contacted', 'matched', 'waitlisted', 'closed']).optional(),
  assigned_to_identity_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  housing_tier_assigned: z.enum(['premium', 'standard', 'temporary', 'emergency']).nullable().optional(),
  staging_location_note: z.string().max(500).nullable().optional(),
  staging_start_date: z.string().nullable().optional(),
  staging_end_date: z.string().nullable().optional(),
  matched_housing_offer_id: z.string().uuid().nullable().optional(),
  priority_score: z.number().int().min(0).max(100).optional()
});

router.get('/portals/:portalId/housing-waitlist', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'Portal mismatch' });
  }

  try {
    const status = req.query.status as string || null;
    const search = req.query.q as string || null;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    let whereClause = 'WHERE w.portal_id = $1';
    const params: any[] = [portalId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND w.status = $${paramIndex++}`;
      params.push(status);
    }
    if (search) {
      whereClause += ` AND (w.applicant_name ILIKE $${paramIndex} OR w.applicant_email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await serviceQuery(`
      SELECT 
        w.*,
        EXTRACT(EPOCH FROM (now() - w.created_at)) / 3600 as hours_since_created
      FROM cc_portal_housing_waitlist_entries w
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_portal_housing_waitlist_entries w
      ${whereClause}
    `, params.slice(0, -2));

    res.json({
      ok: true,
      entries: result.rows.map((row: any) => ({
        id: row.id,
        portalId: row.portal_id,
        bundleId: row.bundle_id,
        applicationId: row.application_id,
        applicantName: row.applicant_name,
        applicantEmail: row.applicant_email,
        preferredStartDate: row.preferred_start_date,
        preferredEndDate: row.preferred_end_date,
        budgetNote: row.budget_note,
        status: row.status,
        assignedToIdentityId: row.assigned_to_identity_id,
        notes: row.notes,
        housingTierAssigned: row.housing_tier_assigned,
        stagingLocationNote: row.staging_location_note,
        stagingStartDate: row.staging_start_date,
        stagingEndDate: row.staging_end_date,
        matchedHousingOfferId: row.matched_housing_offer_id,
        priorityScore: row.priority_score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        hoursSinceCreated: Math.round(parseFloat(row.hours_since_created || '0'))
      })),
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Get housing waitlist error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch housing waitlist' });
  }
});

router.patch('/housing-waitlist/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { id } = req.params;

  const parseResult = waitlistPatchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ 
      ok: false, 
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten() 
    });
  }

  const updates = parseResult.data;

  try {
    // Verify entry belongs to staff's portal
    const entryCheck = await serviceQuery(`
      SELECT id FROM cc_portal_housing_waitlist_entries
      WHERE id = $1 AND portal_id = $2
    `, [id, ctx.portal_id]);

    if (entryCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Entry not found' });
    }

    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.assigned_to_identity_id !== undefined) {
      setClauses.push(`assigned_to_identity_id = $${paramIndex++}`);
      params.push(updates.assigned_to_identity_id);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(updates.notes);
    }
    if (updates.housing_tier_assigned !== undefined) {
      setClauses.push(`housing_tier_assigned = $${paramIndex++}`);
      params.push(updates.housing_tier_assigned);
    }
    if (updates.staging_location_note !== undefined) {
      setClauses.push(`staging_location_note = $${paramIndex++}`);
      params.push(updates.staging_location_note);
    }
    if (updates.staging_start_date !== undefined) {
      setClauses.push(`staging_start_date = $${paramIndex++}`);
      params.push(updates.staging_start_date);
    }
    if (updates.staging_end_date !== undefined) {
      setClauses.push(`staging_end_date = $${paramIndex++}`);
      params.push(updates.staging_end_date);
    }
    if (updates.matched_housing_offer_id !== undefined) {
      setClauses.push(`matched_housing_offer_id = $${paramIndex++}`);
      params.push(updates.matched_housing_offer_id);
    }
    if (updates.priority_score !== undefined) {
      setClauses.push(`priority_score = $${paramIndex++}`);
      params.push(updates.priority_score);
    }

    await serviceQuery(`
      UPDATE cc_portal_housing_waitlist_entries
      SET ${setClauses.join(', ')}
      WHERE id = $1
    `, params);

    res.json({ ok: true, updated: Object.keys(updates) });
  } catch (error: any) {
    console.error('Patch housing waitlist error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update waitlist entry' });
  }
});

export default router;
