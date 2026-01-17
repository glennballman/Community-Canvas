import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';
import { 
  getTieringAvailability, 
  computeTierPrice, 
  isValidAttentionTier, 
  isValidAssistanceTier,
  type AttentionTier,
  type AssistanceTier
} from '../services/jobs/tiering';

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

    let whereClause = `WHERE j.tenant_id = $1`;
    const params: any[] = [ctx.tenant_id];

    if (status) {
      params.push(status);
      whereClause += ` AND j.status = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await serviceQuery(`
      SELECT 
        j.*,
        (SELECT COUNT(*) FROM cc_job_applications WHERE job_id = j.id) as total_applications,
        (SELECT COUNT(*) FROM cc_job_postings WHERE job_id = j.id AND publish_state = 'published') as active_postings
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
      jobs: result.rows,
      pagination: {
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
      job: result.rows[0]
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
        } : null
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
    const jobCheck = await serviceQuery(`
      SELECT id FROM cc_jobs WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
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

          const tierPriceResult = tieringEnabled 
            ? await computeTierPrice({
                tenantId: ctx.tenant_id,
                portalId,
                attentionTier: validAttentionTier,
                assistanceTier: validAssistanceTier,
                durationDays: 30
              })
            : { tierPriceCents: 0, breakdown: { attentionPriceCents: 0, assistancePriceCents: 0 }, enabled: false };

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
            RETURNING id, status, attention_tier, assistance_tier, tier_price_cents
          `, [
            ctx.tenant_id, id, portalId, policy.price_cents, policy.currency || 'CAD', policy.billing_unit || 'perPosting',
            validAttentionTier, validAssistanceTier, tierPriceResult.tierPriceCents, 'CAD',
            JSON.stringify({ breakdown: tierPriceResult.breakdown, tieringEnabled })
          ]);

          paymentRequiredDestinations.push({
            portalId,
            portalName: policy.portal_name,
            intentId: intentResult.rows[0].id,
            amountCents: policy.price_cents,
            currency: policy.currency || 'CAD',
            status: intentResult.rows[0].status
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
      ...(tierWarning ? { warning: tierWarning } : {})
    });

  } catch (error: any) {
    console.error('Publish error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to publish job'
    });
  }
});

export default router;
