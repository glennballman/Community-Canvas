import express, { Request, Response } from 'express';
import { z } from 'zod';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';
import { 
  getTieringAvailability, 
  computeTierPrice, 
  isValidAttentionTier, 
  isValidAssistanceTier,
  type AttentionTier,
  type AssistanceTier
} from '../services/jobs/tiering';
import { postIntentCharge, type IntentRecord } from '../services/jobs/jobPublicationAccounting';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const q = req.query.q as string;
    const portalId = req.query.portalId as string;

    let whereClause = `WHERE j.tenant_id = $1`;
    const params: any[] = [ctx.tenant_id];

    if (status) {
      params.push(status);
      whereClause += ` AND j.status = $${params.length}`;
    }
    
    if (q) {
      params.push(`%${q}%`);
      whereClause += ` AND (j.title ILIKE $${params.length} OR j.role_category ILIKE $${params.length})`;
    }
    
    if (portalId) {
      params.push(portalId);
      whereClause += ` AND EXISTS (SELECT 1 FROM cc_job_postings jp WHERE jp.job_id = j.id AND jp.portal_id = $${params.length})`;
    }

    params.push(limit, offset);

    const result = await serviceQuery(`
      SELECT 
        j.*,
        (SELECT COUNT(*) FROM cc_job_applications WHERE job_id = j.id) as total_applications,
        (SELECT COUNT(*) FROM cc_job_postings WHERE job_id = j.id AND publish_state = 'published') as active_postings,
        (SELECT json_agg(json_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug
        )) FROM cc_job_postings jp 
          JOIN cc_portals p ON jp.portal_id = p.id 
          WHERE jp.job_id = j.id
        ) as portals
      FROM cc_jobs j
      ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total FROM cc_jobs j ${whereClause}
    `, params.slice(0, -2));

    res.json({
      ok: true,
      data: {
        jobs: result.rows,
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Jobs list error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch jobs'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT j.*,
        (SELECT json_agg(row_to_json(jp)) FROM cc_job_postings jp WHERE jp.job_id = j.id) as postings,
        (SELECT COUNT(*) FROM cc_job_applications WHERE job_id = j.id) as total_applications
      FROM cc_jobs j
      WHERE j.id = $1 AND j.tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      data: { job: result.rows[0] }
    });

  } catch (error: any) {
    console.error('Job detail error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch job'
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const {
      title, roleCategory, employmentType, description,
      locationText, latitude, longitude,
      responsibilities, requirements, niceToHave,
      startDate, endDate, isFlexibleDates, hoursPerWeek, shiftDetails,
      urgency, housingProvided, housingType, housingDescription,
      rvFriendly, mealsProvided, transportAssistance, relocationAssistance,
      payType, payMin, payMax, currency, benefitsDescription,
      disclosedPayMin, disclosedPayMax, showPay,
      nocCode, socCode, occupationalCategory, taxonomy,
      brandTenantId, portalId
    } = req.body;

    if (!title || !roleCategory || !employmentType || !description) {
      return res.status(400).json({
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'title, roleCategory, employmentType, and description are required'
      });
    }

    let brandNameSnapshot = null;
    let legalNameSnapshot = null;
    let legalTradeNameSnapshot = null;
    let legalPartyId = null;

    const legalEntityResult = await serviceQuery(`
      SELECT tle.legal_party_id, tle.dba_name_snapshot, p.name as legal_name, p.display_name as trade_name
      FROM cc_tenant_legal_entities tle
      JOIN cc_parties p ON p.id = tle.legal_party_id
      WHERE tle.tenant_id = $1
    `, [brandTenantId || ctx.tenant_id]);

    if (legalEntityResult.rows.length > 0) {
      const le = legalEntityResult.rows[0];
      legalPartyId = le.legal_party_id;
      brandNameSnapshot = le.dba_name_snapshot;
      legalNameSnapshot = le.legal_name;
      legalTradeNameSnapshot = le.trade_name;
    }

    const result = await serviceQuery(`
      INSERT INTO cc_jobs (
        tenant_id, portal_id, title, role_category, employment_type, description,
        location_text, latitude, longitude,
        responsibilities, requirements, nice_to_have,
        start_date, end_date, is_flexible_dates, hours_per_week, shift_details,
        urgency, housing_provided, housing_type, housing_description,
        rv_friendly, meals_provided, transport_assistance, relocation_assistance,
        pay_type, pay_min, pay_max, currency, benefits_description,
        disclosed_pay_min, disclosed_pay_max, show_pay,
        noc_code, soc_code, occupational_category, taxonomy,
        brand_tenant_id, brand_name_snapshot, legal_party_id, legal_name_snapshot, legal_trade_name_snapshot,
        status, source_type, verification_state
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28, $29, $30,
        $31, $32, $33,
        $34, $35, $36, $37,
        $38, $39, $40, $41, $42,
        'open', 'manual', 'draft'
      ) RETURNING id
    `, [
      ctx.tenant_id, portalId, title, roleCategory, employmentType, description,
      locationText, latitude, longitude,
      responsibilities, requirements, niceToHave,
      startDate, endDate, isFlexibleDates, hoursPerWeek, shiftDetails,
      urgency || 'normal', housingProvided, housingType, housingDescription,
      rvFriendly, mealsProvided, transportAssistance, relocationAssistance,
      payType, payMin, payMax, currency || 'CAD', benefitsDescription,
      disclosedPayMin, disclosedPayMax, showPay ?? true,
      nocCode, socCode, occupationalCategory, JSON.stringify(taxonomy || {}),
      brandTenantId || ctx.tenant_id, brandNameSnapshot, legalPartyId, legalNameSnapshot, legalTradeNameSnapshot
    ]);

    res.status(201).json({
      ok: true,
      jobId: result.rows[0].id
    });

  } catch (error: any) {
    console.error('Create job error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create job'
    });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const existsResult = await serviceQuery(`
      SELECT id FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'title', 'role_category', 'employment_type', 'description',
      'location_text', 'latitude', 'longitude',
      'responsibilities', 'requirements', 'nice_to_have',
      'start_date', 'end_date', 'is_flexible_dates', 'hours_per_week', 'shift_details',
      'urgency', 'housing_provided', 'housing_type', 'housing_description',
      'rv_friendly', 'meals_provided', 'transport_assistance', 'relocation_assistance',
      'pay_type', 'pay_min', 'pay_max', 'currency', 'benefits_description',
      'disclosed_pay_min', 'disclosed_pay_max', 'show_pay',
      'noc_code', 'soc_code', 'occupational_category', 'taxonomy',
      'status'
    ];

    const fieldMap: Record<string, string> = {
      roleCategory: 'role_category',
      employmentType: 'employment_type',
      locationText: 'location_text',
      niceToHave: 'nice_to_have',
      startDate: 'start_date',
      endDate: 'end_date',
      isFlexibleDates: 'is_flexible_dates',
      hoursPerWeek: 'hours_per_week',
      shiftDetails: 'shift_details',
      housingProvided: 'housing_provided',
      housingType: 'housing_type',
      housingDescription: 'housing_description',
      rvFriendly: 'rv_friendly',
      mealsProvided: 'meals_provided',
      transportAssistance: 'transport_assistance',
      relocationAssistance: 'relocation_assistance',
      payType: 'pay_type',
      payMin: 'pay_min',
      payMax: 'pay_max',
      benefitsDescription: 'benefits_description',
      disclosedPayMin: 'disclosed_pay_min',
      disclosedPayMax: 'disclosed_pay_max',
      showPay: 'show_pay',
      nocCode: 'noc_code',
      socCode: 'soc_code',
      occupationalCategory: 'occupational_category'
    };

    for (const [key, value] of Object.entries(req.body)) {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField) && value !== undefined) {
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(dbField === 'taxonomy' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_FIELDS_TO_UPDATE'
      });
    }

    updates.push(`updated_at = now()`);
    values.push(id, ctx.tenant_id);

    await serviceQuery(`
      UPDATE cc_jobs SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
    `, values);

    res.json({
      ok: true,
      message: 'Job updated'
    });

  } catch (error: any) {
    console.error('Update job error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update job'
    });
  }
});

router.post('/:id/close', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: { code: 'TENANT_REQUIRED', message: 'Tenant context required' }
    });
  }

  try {
    const existsResult = await serviceQuery(`
      SELECT id, status FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found' }
      });
    }

    const job = existsResult.rows[0];
    if (job.status === 'closed') {
      return res.status(400).json({
        ok: false,
        error: { code: 'ALREADY_CLOSED', message: 'Job posting is already closed' }
      });
    }

    await serviceQuery(`
      UPDATE cc_jobs 
      SET status = 'closed', updated_at = now() 
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    res.json({
      ok: true,
      data: { message: 'Job posting closed successfully' }
    });

  } catch (error: any) {
    console.error('Close job error:', error);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: 'Failed to close job posting' }
    });
  }
});

router.get('/:id/applications', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const jobCheck = await serviceQuery(`
      SELECT id FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let whereClause = `WHERE ja.job_id = $1 AND ja.tenant_id = $2`;
    const params: any[] = [id, ctx.tenant_id];

    if (status) {
      params.push(status);
      whereClause += ` AND ja.status = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await serviceQuery(`
      SELECT ja.*
      FROM cc_job_applications ja
      ${whereClause}
      ORDER BY ja.submitted_at DESC NULLS LAST, ja.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total FROM cc_job_applications ja ${whereClause}
    `, params.slice(0, -2));

    res.json({
      ok: true,
      applications: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Job applications error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch applications'
    });
  }
});

router.post('/:id/postings', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { portalIds } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!portalIds || !Array.isArray(portalIds) || portalIds.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'portalIds array is required'
    });
  }

  try {
    const jobCheck = await serviceQuery(`
      SELECT id FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const policyResult = await serviceQuery(`
      SELECT pdp.portal_id, pdp.requires_moderation, pdp.is_accepting_job_postings,
             pdp.accepts_external_postings,
             p.tenant_id as portal_tenant_id
      FROM cc_portal_distribution_policies pdp
      JOIN cc_portals p ON p.id = pdp.portal_id
      WHERE pdp.portal_id = ANY($1)
    `, [portalIds]);

    const policyMap = new Map<string, { 
      requiresModeration: boolean; 
      isAccepting: boolean; 
      acceptsExternal: boolean;
      portalTenantId: string | null 
    }>();
    for (const row of policyResult.rows) {
      policyMap.set(row.portal_id, {
        requiresModeration: row.requires_moderation,
        isAccepting: row.is_accepting_job_postings,
        acceptsExternal: row.accepts_external_postings ?? true,
        portalTenantId: row.portal_tenant_id
      });
    }

    const rejectedPortals: { portalId: string; reason: string }[] = [];
    const postingResults = [];

    for (const portalId of portalIds) {
      const policy = policyMap.get(portalId);
      
      if (!policy) {
        rejectedPortals.push({ portalId, reason: 'PORTAL_NOT_FOUND' });
        continue;
      }

      if (!policy.isAccepting) {
        rejectedPortals.push({ portalId, reason: 'NOT_ACCEPTING_POSTINGS' });
        continue;
      }

      const isTenantOwnedPortal = policy.portalTenantId === ctx.tenant_id;
      const canPostExternal = policy.acceptsExternal;

      if (!isTenantOwnedPortal && !canPostExternal) {
        rejectedPortals.push({ portalId, reason: 'EXTERNAL_POSTINGS_NOT_ALLOWED' });
        continue;
      }

      const requiresModeration = policy.requiresModeration;
      const publishState = requiresModeration ? 'pending_review' : 'published';
      const publishedAt = requiresModeration ? null : new Date();

      const result = await serviceQuery(`
        INSERT INTO cc_job_postings (job_id, portal_id, publish_state, published_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (job_id, portal_id) DO UPDATE SET
          publish_state = EXCLUDED.publish_state,
          published_at = EXCLUDED.published_at,
          is_hidden = false
        RETURNING id, portal_id, publish_state
      `, [id, portalId, publishState, publishedAt]);

      postingResults.push(result.rows[0]);
    }

    res.status(201).json({
      ok: true,
      postings: postingResults,
      rejectedPortals: rejectedPortals.length > 0 ? rejectedPortals : undefined,
      message: rejectedPortals.length > 0 
        ? `${postingResults.length} postings created. ${rejectedPortals.length} portal(s) rejected.`
        : undefined
    });

  } catch (error: any) {
    console.error('Create postings error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create postings'
    });
  }
});

router.get('/portal-policies', async (req: Request, res: Response) => {
  try {
    const result = await serviceQuery(`
      SELECT 
        pdp.*,
        p.name as portal_name,
        p.slug as portal_slug
      FROM cc_portal_distribution_policies pdp
      JOIN cc_portals p ON p.id = pdp.portal_id
      WHERE pdp.is_accepting_job_postings = true
      ORDER BY pdp.default_selected DESC, p.name ASC
    `, []);

    res.json({
      ok: true,
      policies: result.rows
    });

  } catch (error: any) {
    console.error('Portal policies error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch portal policies'
    });
  }
});

router.get('/:id/destinations', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const jobCheck = await serviceQuery(`
      SELECT id FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const portalsResult = await serviceQuery(`
      SELECT 
        p.id, p.name, p.slug,
        pdp.default_selected,
        pdp.pricing_model,
        pdp.price_cents,
        pdp.currency,
        pdp.billing_unit,
        pdp.requires_checkout,
        pdp.requires_moderation,
        jp.publish_state,
        jp.published_at,
        ppi.id as intent_id,
        ppi.status as intent_status,
        ppi.amount_cents as intent_amount
      FROM cc_portals p
      JOIN cc_portal_distribution_policies pdp ON pdp.portal_id = p.id
      LEFT JOIN cc_job_postings jp ON jp.portal_id = p.id AND jp.job_id = $1
      LEFT JOIN cc_paid_publication_intents ppi ON ppi.portal_id = p.id AND ppi.job_id = $1
      WHERE pdp.is_accepting_job_postings = true
        AND p.status = 'active'
      ORDER BY pdp.default_selected DESC, p.name ASC
    `, [id]);

    const embedsResult = await serviceQuery(`
      SELECT 
        es.id, es.label,
        jep.publish_state,
        jep.published_at
      FROM cc_embed_surfaces es
      LEFT JOIN cc_job_embed_publications jep ON jep.embed_surface_id = es.id AND jep.job_id = $1
      WHERE es.tenant_id = $2 AND es.is_active = true
      ORDER BY es.label ASC
    `, [id, ctx.tenant_id]);

    const destinations: any[] = [];

    for (const portal of portalsResult.rows) {
      const isPaid = portal.pricing_model === 'paid';
      let tiering = null;

      if (isPaid) {
        const tieringAvailability = await getTieringAvailability({ 
          tenantId: ctx.tenant_id, 
          portalId: portal.id 
        });
        
        tiering = {
          enabled: tieringAvailability.enabled,
          source: tieringAvailability.source,
          currency: tieringAvailability.currency,
          attentionTiers: tieringAvailability.attentionTiers,
          assistanceTiers: tieringAvailability.assistanceTiers
        };
      }

      destinations.push({
        destinationType: 'portal',
        id: portal.id,
        name: portal.name,
        slug: portal.slug,
        defaultSelected: portal.default_selected,
        pricing: {
          pricingModel: portal.pricing_model,
          priceCents: portal.price_cents,
          currency: portal.currency || 'CAD',
          billingUnit: portal.billing_unit,
          requiresCheckout: portal.requires_checkout || false
        },
        moderation: {
          requiresModeration: portal.requires_moderation || false
        },
        state: portal.publish_state ? {
          publishState: portal.publish_state,
          publishedAt: portal.published_at
        } : null,
        paymentIntent: portal.intent_id ? {
          intentId: portal.intent_id,
          status: portal.intent_status,
          amountCents: portal.intent_amount
        } : null,
        tiering
      });
    }

    for (const embed of embedsResult.rows) {
      destinations.push({
        destinationType: 'embed',
        id: embed.id,
        name: embed.label,
        defaultSelected: true,
        pricing: {
          pricingModel: 'free',
          priceCents: null,
          currency: 'CAD',
          billingUnit: null,
          requiresCheckout: false
        },
        moderation: {
          requiresModeration: false
        },
        state: embed.publish_state ? {
          publishState: embed.publish_state,
          publishedAt: embed.published_at
        } : null
      });
    }

    res.json({
      ok: true,
      jobId: id,
      destinations
    });

  } catch (error: any) {
    console.error('Destinations error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch destinations'
    });
  }
});

router.post('/:id/publish', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { 
    portalIds, 
    embedSurfaceIds,
    attentionTier = 'standard',
    assistanceTier = 'none'
  } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if ((!portalIds || portalIds.length === 0) && (!embedSurfaceIds || embedSurfaceIds.length === 0)) {
    return res.status(400).json({
      ok: false,
      error: 'NO_DESTINATIONS_SELECTED',
      message: 'At least one portal or embed surface must be selected'
    });
  }

  try {
    const jobResult = await serviceQuery(`
      SELECT id, title, pay_min, pay_max, pay_unit, housing_status, 
             housing_cost_min_cents, housing_cost_max_cents,
             work_permit_support, work_permit_conditions
      FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const job = jobResult.rows[0];

    const STRICT_VALIDATION_SLUGS = ['canadadirect', 'adrenalinecanada'];

    if (portalIds && portalIds.length > 0) {
      const strictPortalsResult = await serviceQuery(`
        SELECT p.id, p.slug, p.name FROM cc_portals p
        WHERE p.id = ANY($1) AND p.slug = ANY($2)
      `, [portalIds, STRICT_VALIDATION_SLUGS]);

      const strictPortals = strictPortalsResult.rows;

      if (strictPortals.length > 0) {
        const missing: string[] = [];
        const invalid: string[] = [];

        if (job.pay_min == null) missing.push('pay_min');
        if (job.pay_max == null) missing.push('pay_max');
        if (job.pay_min != null && job.pay_max != null && parseFloat(job.pay_max) < parseFloat(job.pay_min)) {
          invalid.push('pay_max must be >= pay_min');
        }

        if (!job.housing_status || job.housing_status === 'unknown') {
          missing.push('housing_status');
        }

        if (job.housing_cost_min_cents != null || job.housing_cost_max_cents != null) {
          if (job.housing_cost_min_cents != null && job.housing_cost_max_cents == null) {
            invalid.push('housing_cost_max_cents required when housing_cost_min_cents provided');
          }
          if (job.housing_cost_min_cents == null && job.housing_cost_max_cents != null) {
            invalid.push('housing_cost_min_cents required when housing_cost_max_cents provided');
          }
          if (job.housing_cost_min_cents != null && job.housing_cost_max_cents != null) {
            if (job.housing_cost_min_cents < 0) invalid.push('housing_cost_min_cents must be non-negative');
            if (job.housing_cost_max_cents < job.housing_cost_min_cents) {
              invalid.push('housing_cost_max_cents must be >= housing_cost_min_cents');
            }
          }
        }

        if (!job.work_permit_support || job.work_permit_support === 'unknown') {
          missing.push('work_permit_support');
        }

        if (missing.length > 0 || invalid.length > 0) {
          return res.status(400).json({
            ok: false,
            error: 'JOB_PUBLISH_VALIDATION_FAILED',
            details: {
              missing: missing.length > 0 ? missing : undefined,
              invalid: invalid.length > 0 ? invalid : undefined,
              destinationsRequiringValidation: strictPortals.map((p: any) => ({
                portalId: p.id,
                portalSlug: p.slug,
                portalName: p.name
              }))
            }
          });
        }
      }
    }

    let hasNonStrictDestinations = false;
    if (portalIds && portalIds.length > 0) {
      const nonStrictResult = await serviceQuery(`
        SELECT COUNT(*) as count FROM cc_portals p
        WHERE p.id = ANY($1) AND p.slug NOT IN ('canadadirect', 'adrenalinecanada')
      `, [portalIds]);
      hasNonStrictDestinations = parseInt(nonStrictResult.rows[0]?.count || '0') > 0;
    }
    if (embedSurfaceIds && embedSurfaceIds.length > 0) {
      hasNonStrictDestinations = true;
    }

    const softValidationWarnings: string[] = [];
    if (hasNonStrictDestinations) {
      if (job.pay_min == null || job.pay_max == null) {
        softValidationWarnings.push('pay_range_missing');
      }
      if (!job.housing_status || job.housing_status === 'unknown') {
        softValidationWarnings.push('housing_status_unknown');
      }
      if (!job.work_permit_support || job.work_permit_support === 'unknown') {
        softValidationWarnings.push('work_permit_support_unknown');
      }
    }

    const validAttentionTier: AttentionTier = isValidAttentionTier(attentionTier) ? attentionTier : 'standard';
    const validAssistanceTier: AssistanceTier = isValidAssistanceTier(assistanceTier) ? assistanceTier : 'none';
    
    const tiersRequested = validAttentionTier !== 'standard' || validAssistanceTier !== 'none';
    const tieringAvailability = await getTieringAvailability({ tenantId: ctx.tenant_id });
    const tieringEnabled = tieringAvailability.enabled;
    
    let tierWarning: string | undefined;
    if (tiersRequested && !tieringEnabled) {
      tierWarning = 'TIERS_DISABLED';
    }

    const publishedDestinations: any[] = [];
    const paymentRequiredDestinations: any[] = [];

    if (portalIds && portalIds.length > 0) {
      const policiesResult = await serviceQuery(`
        SELECT 
          p.id as portal_id, p.name as portal_name,
          pdp.requires_moderation, pdp.requires_checkout,
          pdp.price_cents, pdp.currency, pdp.billing_unit
        FROM cc_portals p
        JOIN cc_portal_distribution_policies pdp ON pdp.portal_id = p.id
        WHERE p.id = ANY($1)
          AND pdp.is_accepting_job_postings = true
      `, [portalIds]);

      const policyMap = new Map();
      for (const row of policiesResult.rows) {
        policyMap.set(row.portal_id, row);
      }

      for (const portalId of portalIds) {
        const policy = policyMap.get(portalId);
        if (!policy) continue;

        if (policy.requires_checkout && policy.price_cents > 0) {
          await serviceQuery(`
            INSERT INTO cc_job_postings (job_id, portal_id, publish_state, is_hidden)
            VALUES ($1, $2, 'draft', true)
            ON CONFLICT (job_id, portal_id) DO UPDATE SET
              updated_at = now()
            RETURNING id
          `, [id, portalId]);

          const baseBillingInterval = policy.billing_unit === 'monthly' ? 'month' : 'day';
          const baseDurationDays = baseBillingInterval === 'month' ? 30 : 30;
          
          const tierPriceResult = tieringEnabled 
            ? await computeTierPrice({
                tenantId: ctx.tenant_id,
                portalId,
                attentionTier: validAttentionTier,
                assistanceTier: validAssistanceTier,
                baseBillingInterval: baseBillingInterval as 'day' | 'month',
                baseDurationDays
              })
            : { 
                tierPriceCents: 0, 
                breakdown: { 
                  attentionPriceCents: 0, 
                  assistancePriceCents: 0,
                  attentionTier: validAttentionTier,
                  assistanceTier: validAssistanceTier
                }, 
                enabled: false,
                source: 'default' as const,
                warning: 'TIERS_DISABLED'
              };

          const tierMetadata = {
            breakdown: tierPriceResult.breakdown,
            tieringEnabled,
            baseBillingInterval,
            baseDurationDays,
            urgentEndsAt: tierPriceResult.urgentEndsAt || null,
            source: tierPriceResult.source,
            warning: tierPriceResult.warning || null
          };

          const intentResult = await serviceQuery(`
            INSERT INTO cc_paid_publication_intents (
              tenant_id, job_id, portal_id, amount_cents, currency, billing_unit, status,
              attention_tier, assistance_tier, tier_price_cents, tier_currency, tier_metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, 'requires_action', $7, $8, $9, $10, $11)
            ON CONFLICT (job_id, portal_id) DO UPDATE SET
              amount_cents = EXCLUDED.amount_cents,
              attention_tier = EXCLUDED.attention_tier,
              assistance_tier = EXCLUDED.assistance_tier,
              tier_price_cents = EXCLUDED.tier_price_cents,
              tier_metadata = EXCLUDED.tier_metadata,
              status = CASE 
                WHEN cc_paid_publication_intents.status IN ('paid', 'refunded') 
                THEN cc_paid_publication_intents.status 
                ELSE 'requires_action' 
              END,
              updated_at = now()
            RETURNING id, status, attention_tier, assistance_tier, tier_price_cents, ledger_charge_entry_id
          `, [
            ctx.tenant_id, id, portalId, policy.price_cents, policy.currency || 'CAD', policy.billing_unit || 'perPosting',
            validAttentionTier, validAssistanceTier, tierPriceResult.tierPriceCents, 'CAD',
            JSON.stringify(tierMetadata)
          ]);

          const intentRow = intentResult.rows[0];
          
          if (intentRow.status === 'requires_action' && !intentRow.ledger_charge_entry_id && ctx.tenant_id) {
            try {
              await withServiceTransaction(async (client) => {
                const intentRecord: IntentRecord = {
                  id: intentRow.id,
                  tenant_id: ctx.tenant_id!,
                  job_id: id,
                  portal_id: portalId,
                  amount_cents: policy.price_cents,
                  tier_price_cents: tierPriceResult.tierPriceCents,
                  currency: policy.currency || 'CAD',
                  status: intentRow.status,
                  tier_metadata: tierMetadata,
                  attention_tier: validAttentionTier,
                  assistance_tier: validAssistanceTier
                };
                await postIntentCharge(client, intentRecord);
              });
            } catch (chargeErr) {
              console.error('Failed to post GL charge for intent:', chargeErr);
            }
          }

          paymentRequiredDestinations.push({
            portalId,
            portalName: policy.portal_name,
            intentId: intentResult.rows[0].id,
            amountCents: policy.price_cents,
            currency: policy.currency || 'CAD',
            status: intentResult.rows[0].status,
            pricing: {
              currency: 'CAD',
              basePriceCents: policy.price_cents,
              tierPriceCents: tierPriceResult.tierPriceCents,
              totalPriceCents: policy.price_cents + tierPriceResult.tierPriceCents,
              breakdown: {
                portal: {
                  portalId,
                  name: policy.portal_name,
                  basePriceCents: policy.price_cents,
                  billingInterval: baseBillingInterval,
                  durationDays: baseDurationDays
                },
                tiers: {
                  attentionTier: tierPriceResult.breakdown.attentionTier,
                  assistanceTier: tierPriceResult.breakdown.assistanceTier,
                  tierPriceCents: tierPriceResult.tierPriceCents,
                  urgentEndsAt: tierPriceResult.urgentEndsAt || null
                },
                flags: {
                  tiersEnabled: tierPriceResult.enabled,
                  source: tierPriceResult.source,
                  warning: tierPriceResult.warning || null
                }
              }
            }
          });
        } else {
          const publishState = policy.requires_moderation ? 'pending_review' : 'published';
          const publishedAt = policy.requires_moderation ? null : new Date();

          const postingResult = await serviceQuery(`
            INSERT INTO cc_job_postings (job_id, portal_id, publish_state, published_at, is_hidden)
            VALUES ($1, $2, $3, $4, false)
            ON CONFLICT (job_id, portal_id) DO UPDATE SET
              publish_state = EXCLUDED.publish_state,
              published_at = COALESCE(cc_job_postings.published_at, EXCLUDED.published_at),
              is_hidden = false,
              updated_at = now()
            RETURNING id, publish_state
          `, [id, portalId, publishState, publishedAt]);

          publishedDestinations.push({
            destinationType: 'portal',
            portalId,
            portalName: policy.portal_name,
            postingId: postingResult.rows[0].id,
            publishState: postingResult.rows[0].publish_state
          });
        }
      }
    }

    if (embedSurfaceIds && embedSurfaceIds.length > 0) {
      for (const surfaceId of embedSurfaceIds) {
        const surfaceCheck = await serviceQuery(`
          SELECT id, label FROM cc_embed_surfaces WHERE id = $1 AND tenant_id = $2 AND is_active = true
        `, [surfaceId, ctx.tenant_id]);

        if (surfaceCheck.rows.length === 0) continue;

        await serviceQuery(`
          INSERT INTO cc_job_embed_publications (job_id, embed_surface_id, publish_state, published_at)
          VALUES ($1, $2, 'published', now())
          ON CONFLICT (job_id, embed_surface_id) DO UPDATE SET
            publish_state = 'published',
            published_at = COALESCE(cc_job_embed_publications.published_at, now()),
            updated_at = now()
          RETURNING id
        `, [id, surfaceId]);

        publishedDestinations.push({
          destinationType: 'embed',
          embedSurfaceId: surfaceId,
          embedSurfaceName: surfaceCheck.rows[0].label,
          publishState: 'published'
        });
      }
    }

    res.json({
      ok: true,
      jobId: id,
      publishedDestinations,
      paymentRequiredDestinations: paymentRequiredDestinations.length > 0 ? paymentRequiredDestinations : undefined,
      ...(tierWarning ? { warning: tierWarning } : {}),
      ...(softValidationWarnings.length > 0 ? { 
        validationWarnings: softValidationWarnings,
        validationWarningMessage: 'Job published but missing some recommended fields for premium portals'
      } : {})
    });

  } catch (error: any) {
    console.error('Publish error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to publish job'
    });
  }
});

// ============================================
// EMPLOYER PIPELINE - Applicant Management
// ============================================

const employerStatusChangeSchema = z.object({
  status: z.enum([
    'draft', 'submitted', 'under_review', 'shortlisted',
    'interview_scheduled', 'interviewed', 'offer_extended',
    'offer_accepted', 'offer_declined', 'rejected', 'withdrawn'
  ]),
  note: z.string().max(2000).optional()
});

const employerNoteSchema = z.object({
  note: z.string().min(1).max(2000)
});

// Get applications for a specific job (employer view)
router.get('/:jobId/applications', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    // Verify job belongs to tenant
    const jobCheck = await serviceQuery(`
      SELECT id, title FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [jobId, ctx.tenant_id]);

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let whereClause = 'WHERE a.job_id = $1 AND a.tenant_id = $2';
    const params: any[] = [jobId, ctx.tenant_id];
    let paramIndex = 3;

    if (status) {
      whereClause += ` AND a.status = $${paramIndex}::job_application_status`;
      params.push(status);
      paramIndex++;
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
        a.resume_url,
        a.cover_letter,
        a.interview_scheduled_at,
        a.interview_completed_at,
        a.rating,
        a.internal_notes,
        jp.id as job_posting_id,
        jp.custom_title,
        p.name as portal_name,
        p.slug as portal_slug,
        i.id as individual_id,
        i.display_name as applicant_name,
        i.email as applicant_email,
        i.phone as applicant_phone,
        i.location_text as applicant_location,
        (SELECT COUNT(*) FROM cc_job_application_bundle_items bi WHERE bi.application_id = a.id) as bundle_count
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_portals p ON p.id = jp.portal_id
      LEFT JOIN cc_individuals i ON i.id = a.applicant_individual_id
      ${whereClause}
      ORDER BY 
        CASE a.status
          WHEN 'submitted' THEN 0
          WHEN 'under_review' THEN 1
          WHEN 'shortlisted' THEN 2
          WHEN 'interview_scheduled' THEN 3
          WHEN 'interviewed' THEN 4
          WHEN 'offer_extended' THEN 5
          ELSE 6
        END,
        a.submitted_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_job_applications a
      ${whereClause}
    `, params);

    // Get status counts for kanban
    const statusCounts = await serviceQuery(`
      SELECT status, COUNT(*) as count
      FROM cc_job_applications
      WHERE job_id = $1 AND tenant_id = $2
      GROUP BY status
    `, [jobId, ctx.tenant_id]);

    res.json({
      ok: true,
      job: jobCheck.rows[0],
      applications: result.rows,
      statusCounts: statusCounts.rows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });
  } catch (error: any) {
    console.error('Employer applications error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch applications'
    });
  }
});

// Get single application detail (employer view)
router.get('/:jobId/applications/:applicationId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId, applicationId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        a.*,
        jp.id as job_posting_id,
        jp.custom_title,
        p.name as portal_name,
        p.slug as portal_slug,
        i.id as individual_id,
        i.display_name as applicant_name,
        i.email as applicant_email,
        i.phone as applicant_phone,
        i.location_text as applicant_location
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_portals p ON p.id = jp.portal_id
      LEFT JOIN cc_individuals i ON i.id = a.applicant_individual_id
      WHERE a.id = $1 AND a.job_id = $2 AND a.tenant_id = $3
    `, [applicationId, jobId, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    // Get events
    const eventsResult = await serviceQuery(`
      SELECT e.*
      FROM cc_job_application_events e
      WHERE e.application_id = $1 AND e.tenant_id = $2
      ORDER BY e.created_at DESC
      LIMIT 50
    `, [applicationId, ctx.tenant_id]);

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
    console.error('Employer application detail error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch application'
    });
  }
});

// Change application status (employer)
router.post('/:jobId/applications/:applicationId/status', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId, applicationId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const parsed = employerStatusChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten()
      });
    }

    const { status, note } = parsed.data;

    // Verify ownership
    const appCheck = await serviceQuery(`
      SELECT a.id, a.status as current_status, jp.portal_id
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE a.id = $1 AND a.job_id = $2 AND a.tenant_id = $3
    `, [applicationId, jobId, ctx.tenant_id]);

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    const currentStatus = appCheck.rows[0].current_status;
    const portalId = appCheck.rows[0].portal_id;

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
          application_id, portal_id, tenant_id,
          event_type, previous_status, new_status, note
        ) VALUES ($1, $2, $3, 'status_changed', $4, $5, $6)
      `, [applicationId, portalId, ctx.tenant_id, currentStatus, status, note || null]);
    });

    res.json({
      ok: true,
      message: 'Status updated'
    });
  } catch (error: any) {
    console.error('Employer status change error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update status'
    });
  }
});

// Add note to application (employer)
router.post('/:jobId/applications/:applicationId/notes', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId, applicationId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const parsed = employerNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten()
      });
    }

    const { note } = parsed.data;

    // Verify ownership
    const appCheck = await serviceQuery(`
      SELECT a.id, jp.portal_id
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      WHERE a.id = $1 AND a.job_id = $2 AND a.tenant_id = $3
    `, [applicationId, jobId, ctx.tenant_id]);

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'APPLICATION_NOT_FOUND'
      });
    }

    const portalId = appCheck.rows[0].portal_id;

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
          application_id, portal_id, tenant_id,
          event_type, note
        ) VALUES ($1, $2, $3, 'note_added', $4)
      `, [applicationId, portalId, ctx.tenant_id, note]);
    });

    res.json({
      ok: true,
      message: 'Note added'
    });
  } catch (error: any) {
    console.error('Employer add note error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to add note'
    });
  }
});

// =====================================================
// TENANT EMERGENCY REPLACEMENT REQUESTS
// =====================================================

// Helper to map routing action to privacy-safe state
function mapActionToState(action: string): 'contacted' | 'responded' | 'declined' | 'unknown' {
  switch (action) {
    case 'contact':
    case 'contacted':
    case 'offered':
      return 'contacted';
    case 'accepted':
    case 'confirmed':
    case 'responded':
      return 'responded';
    case 'declined':
    case 'rejected':
    case 'unavailable':
      return 'declined';
    default:
      return 'unknown';
  }
}

const emergencyRequestSchema = z.object({
  portal_id: z.string().uuid().optional(),
  urgency: z.enum(['now', 'today', 'this_week']).default('today'),
  notes: z.string().max(2000).optional()
});

router.post('/:jobId/emergency-replacement-request', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const parsed = emergencyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten()
      });
    }

    const { portal_id: requestedPortalId, urgency, notes } = parsed.data;

    const jobResult = await serviceQuery(`
      SELECT j.id, j.title, j.tenant_id
      FROM cc_jobs j
      WHERE j.id = $1 AND j.tenant_id = $2
    `, [jobId, ctx.tenant_id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const job = jobResult.rows[0];

    const postingsResult = await serviceQuery(`
      SELECT jp.id, jp.portal_id, jp.custom_title, p.name as portal_name
      FROM cc_job_postings jp
      JOIN cc_portals p ON p.id = jp.portal_id
      WHERE jp.job_id = $1 AND jp.publish_state = 'published'
    `, [jobId]);

    let selectedPortalId: string;
    let selectedPostingId: string | null = null;
    let roleTitle: string;

    if (requestedPortalId) {
      const posting = postingsResult.rows.find((p: any) => p.portal_id === requestedPortalId);
      if (!posting) {
        return res.status(400).json({
          ok: false,
          error: 'PORTAL_NOT_FOUND_FOR_JOB',
          message: 'Job has no active posting in the specified portal'
        });
      }
      selectedPortalId = posting.portal_id;
      selectedPostingId = posting.id;
      roleTitle = posting.custom_title || job.title;
    } else if (postingsResult.rows.length === 1) {
      const posting = postingsResult.rows[0];
      selectedPortalId = posting.portal_id;
      selectedPostingId = posting.id;
      roleTitle = posting.custom_title || job.title;
    } else if (postingsResult.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_ACTIVE_POSTINGS',
        message: 'Job has no active portal postings'
      });
    } else {
      return res.status(400).json({
        ok: false,
        error: 'PORTAL_REQUIRED_FOR_EMERGENCY_REQUEST',
        message: 'Job is posted to multiple portals. Please specify which portal.',
        choices: postingsResult.rows.map((p: any) => ({
          portal_id: p.portal_id,
          portal_name: p.portal_name,
          posting_id: p.id
        }))
      });
    }

    const insertResult = await serviceQuery(`
      INSERT INTO cc_emergency_replacement_requests (
        portal_id, tenant_id, job_id, job_posting_id,
        role_title_snapshot, urgency, notes, status,
        created_by_identity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
      RETURNING id, status, created_at
    `, [
      selectedPortalId,
      ctx.tenant_id,
      jobId,
      selectedPostingId,
      roleTitle,
      urgency,
      notes || null,
      ctx.individual_id || null
    ]);

    const request = insertResult.rows[0];

    // Notify portal staff about emergency request
    try {
      await serviceQuery(`
        SELECT cc_notify_portal_staff_emergency($1, $2, $3, $4)
      `, [selectedPortalId, request.id, roleTitle, urgency]);
    } catch (notifyErr: any) {
      // Log but don't fail the request creation
      console.error('Failed to notify portal staff:', notifyErr.message);
    }

    res.status(201).json({
      ok: true,
      requestId: request.id,
      portalId: selectedPortalId,
      status: request.status,
      employerConfirmationRoute: `/app/jobs/${jobId}/emergency/${request.id}`
    });
  } catch (error: any) {
    console.error('Create emergency request error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create emergency request'
    });
  }
});

router.get('/:jobId/emergency-replacement-request/:requestId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId, requestId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        er.id,
        er.status,
        er.role_title_snapshot,
        er.urgency,
        er.notes,
        er.created_at,
        er.updated_at,
        er.portal_id,
        p.name as portal_name,
        j.title as job_title
      FROM cc_emergency_replacement_requests er
      JOIN cc_portals p ON p.id = er.portal_id
      LEFT JOIN cc_jobs j ON j.id = er.job_id
      WHERE er.id = $1 
        AND er.job_id = $2 
        AND er.tenant_id = $3
    `, [requestId, jobId, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'REQUEST_NOT_FOUND'
      });
    }

    const request = result.rows[0];

    // Privacy-safe: Return redacted routing summary for tenant view
    // Employers see counts and anonymized labels only, not candidate PII
    const routingsResult = await serviceQuery(`
      SELECT 
        rr.id,
        rr.action,
        rr.created_at,
        ROW_NUMBER() OVER (ORDER BY rr.created_at ASC) as candidate_index
      FROM cc_emergency_routing_records rr
      WHERE rr.emergency_request_id = $1
      ORDER BY rr.created_at ASC
    `, [requestId]);

    // Build privacy-safe routing summary with anonymized labels
    const contacted = routingsResult.rows.map((r: any) => ({
      label: `Candidate ${String.fromCharCode(64 + parseInt(r.candidate_index))}`, // A, B, C...
      state: mapActionToState(r.action),
      contactedAt: r.created_at
    }));

    res.json({
      ok: true,
      request: {
        ...request,
        // Deprecated: routings no longer returned (privacy)
        routings: undefined
      },
      routingSummary: {
        contactedCount: routingsResult.rows.length,
        contacted
      }
    });
  } catch (error: any) {
    console.error('Get emergency request error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch emergency request'
    });
  }
});

router.patch('/:jobId/emergency-replacement-request/:requestId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { jobId, requestId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const { action, notes } = req.body;

    if (action !== 'cancel' && !notes) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_ACTION',
        message: 'Only cancel action or notes update allowed'
      });
    }

    const checkResult = await serviceQuery(`
      SELECT id, status FROM cc_emergency_replacement_requests
      WHERE id = $1 AND job_id = $2 AND tenant_id = $3
    `, [requestId, jobId, ctx.tenant_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'REQUEST_NOT_FOUND'
      });
    }

    const current = checkResult.rows[0];

    if (action === 'cancel') {
      if (current.status === 'filled' || current.status === 'cancelled') {
        return res.status(400).json({
          ok: false,
          error: 'CANNOT_CANCEL',
          message: `Request is already ${current.status}`
        });
      }

      await serviceQuery(`
        UPDATE cc_emergency_replacement_requests
        SET status = 'cancelled', updated_at = now()
        WHERE id = $1
      `, [requestId]);

      return res.json({
        ok: true,
        status: 'cancelled'
      });
    }

    if (notes) {
      await serviceQuery(`
        UPDATE cc_emergency_replacement_requests
        SET notes = $2, updated_at = now()
        WHERE id = $1
      `, [requestId, notes]);

      return res.json({
        ok: true,
        message: 'Notes updated'
      });
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Update emergency request error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update emergency request'
    });
  }
});

export default router;
