import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';
import { hashToken, generateSecureToken, hashIp, hashUserAgent } from '../lib/tokenHash';

const router = Router();

// ============================================================
// SCHEMAS
// ============================================================

const createPromptSchema = z.object({
  promptType: z.enum([
    'headcount',
    'location',
    'status',
    'acknowledge',
    'freeform',
    'medical_dependency',
    'resource_need'
  ]),
  title: z.string().max(500).optional(),
  promptText: z.string().min(1).max(5000),
  isRequired: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
  options: z.any().optional(),
  validation: z.any().optional(),
  targetType: z.enum([
    'individual',
    'party',
    'tenant',
    'circle',
    'portal',
    'public_link'
  ]).optional().default('public_link'),
  targetIndividualId: z.string().uuid().optional(),
  targetPartyId: z.string().uuid().optional(),
  targetTenantId: z.string().uuid().optional(),
  targetCircleId: z.string().uuid().optional(),
  targetPortalId: z.string().uuid().optional(),
  publicTokenTtlMinutes: z.number().int().positive().optional(),
  maxResponses: z.number().int().positive().optional(),
});

const publicResponseSchema = z.object({
  responseData: z.record(z.any()),
  occurredAt: z.string().datetime().optional(),
  publicResponderKey: z.string().max(200).optional(),
  locationLabel: z.string().max(500).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  locationAccuracyM: z.number().optional(),
  adultsCount: z.number().int().min(0).optional(),
  childrenCount: z.number().int().min(0).optional(),
  petsCount: z.number().int().min(0).optional(),
});

const voidResponseSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// ============================================================
// HELPERS
// ============================================================

async function setRlsContext(client: any, ctx: any): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.circle_id', $1, true)`, [ctx.circle_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [ctx.individual_id || '']);
}

async function clearRlsContext(client: any): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', '', true)`);
  await client.query(`SELECT set_config('app.portal_id', '', true)`);
  await client.query(`SELECT set_config('app.circle_id', '', true)`);
  await client.query(`SELECT set_config('app.individual_id', '', true)`);
}

async function logActivity(
  tenantId: string,
  individualId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  payload: any,
  portalId?: string,
  circleId?: string
): Promise<void> {
  await serviceQuery(`
    INSERT INTO cc_activity_ledger (
      tenant_id,
      portal_id,
      circle_id,
      individual_id,
      action,
      entity_type,
      entity_id,
      payload,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
  `, [
    tenantId,
    portalId || null,
    circleId || null,
    individualId,
    action,
    entityType,
    entityId,
    JSON.stringify(payload),
  ]);
}

// ============================================================
// OPERATOR ENDPOINTS
// ============================================================

/**
 * POST /api/incidents/:incidentId/prompts
 * Create a new incident prompt
 */
router.post('/:incidentId/prompts', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id || !ctx?.individual_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { incidentId } = req.params;
    
    const parsed = createPromptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    await client.query('BEGIN');
    await setRlsContext(client, ctx);

    // Verify incident exists and caller has access
    const incidentCheck = await client.query(`
      SELECT id, tenant_id, portal_id, circle_id, community_id
      FROM cc_incidents WHERE id = $1
    `, [incidentId]);

    if (incidentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Incident not found' });
    }

    const incident = incidentCheck.rows[0];

    // Generate token for public_link
    let publicToken: string | null = null;
    let publicTokenHash: string | null = null;
    let publicTokenExpiresAt: Date | null = null;

    if (data.targetType === 'public_link') {
      publicToken = generateSecureToken(32);
      publicTokenHash = hashToken(publicToken);
      
      if (data.publicTokenTtlMinutes) {
        publicTokenExpiresAt = new Date(Date.now() + data.publicTokenTtlMinutes * 60 * 1000);
      }
    }

    // Validate target based on targetType
    if (data.targetType === 'individual' && !data.targetIndividualId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'targetIndividualId required for individual target' });
    }
    if (data.targetType === 'party' && !data.targetPartyId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'targetPartyId required for party target' });
    }
    if (data.targetType === 'tenant' && !data.targetTenantId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'targetTenantId required for tenant target' });
    }
    if (data.targetType === 'circle' && !data.targetCircleId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'targetCircleId required for circle target' });
    }
    if (data.targetType === 'portal' && !data.targetPortalId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'targetPortalId required for portal target' });
    }

    const result = await client.query(`
      INSERT INTO cc_incident_prompts (
        tenant_id,
        community_id,
        portal_id,
        circle_id,
        incident_id,
        prompt_type,
        title,
        prompt_text,
        is_required,
        expires_at,
        options,
        validation,
        target_type,
        target_individual_id,
        target_party_id,
        target_tenant_id,
        target_circle_id,
        target_portal_id,
        public_token_hash,
        public_token_expires_at,
        max_responses,
        created_by_individual_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
      RETURNING id, created_at
    `, [
      ctx.tenant_id,
      incident.community_id,
      ctx.portal_id || incident.portal_id,
      ctx.circle_id || incident.circle_id,
      incidentId,
      data.promptType,
      data.title || null,
      data.promptText,
      data.isRequired || false,
      data.expiresAt ? new Date(data.expiresAt) : null,
      data.options ? JSON.stringify(data.options) : null,
      data.validation ? JSON.stringify(data.validation) : null,
      data.targetType,
      data.targetIndividualId || null,
      data.targetPartyId || null,
      data.targetTenantId || null,
      data.targetCircleId || null,
      data.targetPortalId || null,
      publicTokenHash,
      publicTokenExpiresAt,
      data.maxResponses || null,
      ctx.individual_id,
    ]);

    const promptId = result.rows[0].id;

    await client.query('COMMIT');

    // Log activity
    await logActivity(
      ctx.tenant_id,
      ctx.individual_id,
      'incident_prompt.create',
      'incident_prompt',
      promptId,
      { promptType: data.promptType, incidentId, targetType: data.targetType },
      ctx.portal_id,
      ctx.circle_id
    ).catch(console.error);

    const response: any = {
      success: true,
      data: {
        prompt: {
          id: promptId,
          createdAt: result.rows[0].created_at,
          promptType: data.promptType,
          targetType: data.targetType,
        },
      },
    };

    // Return token ONCE for public_link
    if (publicToken) {
      response.data.publicToken = publicToken;
      response.data.responseLink = `/api/public/incident-prompts/${publicToken}/respond`;
    }

    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating incident prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * GET /api/incidents/:incidentId/prompts
 * List prompts for an incident
 */
router.get('/:incidentId/prompts', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { incidentId } = req.params;
    
    await setRlsContext(client, ctx);

    const result = await client.query(`
      SELECT 
        p.id,
        p.prompt_type,
        p.title,
        p.prompt_text,
        p.is_required,
        p.expires_at,
        p.options,
        p.validation,
        p.target_type,
        p.is_active,
        p.max_responses,
        p.created_at,
        p.created_by_individual_id,
        i.display_name as created_by_name,
        (SELECT COUNT(*) FROM cc_incident_responses r WHERE r.prompt_id = p.id AND r.state != 'voided') as response_count
      FROM cc_incident_prompts p
      LEFT JOIN cc_individuals i ON i.id = p.created_by_individual_id
      WHERE p.incident_id = $1
      ORDER BY p.created_at DESC
    `, [incidentId]);

    res.json({
      prompts: result.rows.map((row: any) => ({
        id: row.id,
        promptType: row.prompt_type,
        title: row.title,
        promptText: row.prompt_text,
        isRequired: row.is_required,
        expiresAt: row.expires_at,
        options: row.options,
        validation: row.validation,
        targetType: row.target_type,
        isActive: row.is_active,
        maxResponses: row.max_responses,
        responseCount: parseInt(row.response_count),
        createdAt: row.created_at,
        createdByName: row.created_by_name,
      })),
    });
  } catch (error) {
    console.error('Error listing prompts:', error);
    res.status(500).json({ error: 'Failed to list prompts' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * GET /api/incidents/:incidentId/responses
 * List responses for an incident with aggregations
 */
router.get('/:incidentId/responses', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { incidentId } = req.params;
    const { promptId, state } = req.query;
    
    await setRlsContext(client, ctx);

    let sql = `
      SELECT 
        r.id,
        r.prompt_id,
        r.respondent_individual_id,
        r.public_responder_key,
        r.response_data,
        r.response_channel,
        r.state,
        r.location_label,
        r.location_lat,
        r.location_lng,
        r.adults_count,
        r.children_count,
        r.pets_count,
        r.occurred_at,
        r.responded_at,
        i.display_name as respondent_name,
        p.prompt_type,
        p.title as prompt_title
      FROM cc_incident_responses r
      LEFT JOIN cc_individuals i ON i.id = r.respondent_individual_id
      LEFT JOIN cc_incident_prompts p ON p.id = r.prompt_id
      WHERE r.incident_id = $1
    `;
    const params: any[] = [incidentId];
    let paramIndex = 2;

    if (promptId) {
      sql += ` AND r.prompt_id = $${paramIndex}`;
      params.push(promptId);
      paramIndex++;
    }

    if (state) {
      sql += ` AND r.state = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    sql += ` ORDER BY r.responded_at DESC LIMIT 500`;

    const responsesResult = await client.query(sql, params);

    // Calculate aggregations
    const aggregationsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT COALESCE(r.respondent_individual_id::text, r.public_responder_key)) as total_responders,
        SUM(COALESCE(r.adults_count, 0)) as total_adults,
        SUM(COALESCE(r.children_count, 0)) as total_children,
        SUM(COALESCE(r.pets_count, 0)) as total_pets
      FROM cc_incident_responses r
      WHERE r.incident_id = $1 AND r.state != 'voided'
    `, [incidentId]);

    const locationBreakdown = await client.query(`
      SELECT 
        r.location_label,
        COUNT(*) as count
      FROM cc_incident_responses r
      WHERE r.incident_id = $1 
        AND r.state != 'voided'
        AND r.location_label IS NOT NULL
      GROUP BY r.location_label
      ORDER BY count DESC
      LIMIT 20
    `, [incidentId]);

    const agg = aggregationsResult.rows[0] || {};

    res.json({
      responses: responsesResult.rows.map((row: any) => ({
        id: row.id,
        promptId: row.prompt_id,
        promptType: row.prompt_type,
        promptTitle: row.prompt_title,
        respondentIndividualId: row.respondent_individual_id,
        respondentName: row.respondent_name,
        publicResponderKey: row.public_responder_key,
        responseData: row.response_data,
        responseChannel: row.response_channel,
        state: row.state,
        locationLabel: row.location_label,
        locationLat: row.location_lat,
        locationLng: row.location_lng,
        adultsCount: row.adults_count,
        childrenCount: row.children_count,
        petsCount: row.pets_count,
        occurredAt: row.occurred_at,
        respondedAt: row.responded_at,
      })),
      aggregations: {
        totalResponders: parseInt(agg.total_responders || '0'),
        totalAdults: parseInt(agg.total_adults || '0'),
        totalChildren: parseInt(agg.total_children || '0'),
        totalPets: parseInt(agg.total_pets || '0'),
        totalHeadcount: parseInt(agg.total_adults || '0') + parseInt(agg.total_children || '0'),
        locationBreakdown: locationBreakdown.rows.map((row: any) => ({
          label: row.location_label,
          count: parseInt(row.count),
        })),
      },
    });
  } catch (error) {
    console.error('Error listing responses:', error);
    res.status(500).json({ error: 'Failed to list responses' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * POST /api/incidents/:incidentId/responses/:responseId/void
 * Void a response (moderation)
 */
router.post('/:incidentId/responses/:responseId/void', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id || !ctx?.individual_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { incidentId, responseId } = req.params;
    
    const parsed = voidResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await client.query('BEGIN');
    await setRlsContext(client, ctx);

    const result = await client.query(`
      UPDATE cc_incident_responses
      SET state = 'voided', updated_at = now()
      WHERE id = $1 AND incident_id = $2
      RETURNING id
    `, [responseId, incidentId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Response not found' });
    }

    await client.query('COMMIT');

    // Log activity
    await logActivity(
      ctx.tenant_id,
      ctx.individual_id,
      'incident_response.void',
      'incident_response',
      responseId,
      { reason: parsed.data.reason, incidentId },
      ctx.portal_id,
      ctx.circle_id
    ).catch(console.error);

    res.json({ success: true, voided: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error voiding response:', error);
    res.status(500).json({ error: 'Failed to void response' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

export default router;

// ============================================================
// PUBLIC RESPONDER ROUTER (separate for clarity)
// ============================================================

export const publicIncidentRouter = Router();

/**
 * POST /api/public/incident-prompts/:token/respond
 * Public responder endpoint - NO AUTH REQUIRED
 */
publicIncidentRouter.post('/:token/respond', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const parsed = publicResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    // Extract anti-spam hashes
    const ipRaw = req.ip || req.headers['x-forwarded-for'] as string || '';
    const uaRaw = req.headers['user-agent'] || '';
    const ipHash = hashIp(ipRaw);
    const userAgentHash = hashUserAgent(uaRaw);

    // Call the SECURITY DEFINER function
    const result = await serviceQuery(`
      SELECT * FROM submit_incident_response_public(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
    `, [
      token,
      JSON.stringify(data.responseData),
      data.locationLabel || null,
      data.locationLat || null,
      data.locationLng || null,
      data.locationAccuracyM || null,
      data.adultsCount || null,
      data.childrenCount || null,
      data.petsCount || null,
      data.publicResponderKey || null,
      data.occurredAt ? new Date(data.occurredAt) : null,
      ipHash,
      userAgentHash,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Failed to submit response' });
    }

    const row = result.rows[0];

    // Log activity via service
    await serviceQuery(`
      INSERT INTO cc_activity_ledger (
        tenant_id,
        action,
        entity_type,
        entity_id,
        payload,
        created_at
      ) VALUES (
        (SELECT tenant_id FROM cc_incident_prompts WHERE id = $1),
        'incident_response.submit',
        'incident_response',
        $2,
        $3,
        now()
      )
    `, [
      row.prompt_id,
      row.response_id,
      JSON.stringify({ channel: 'web', public: true }),
    ]).catch(console.error);

    res.json({
      success: true,
      incidentId: row.incident_id,
      promptId: row.prompt_id,
      responseId: row.response_id,
      next: {
        type: 'invite',
        message: 'Thanks — you can create an account to receive updates',
      },
    });
  } catch (error: any) {
    console.error('Error submitting public response:', error);
    
    // Handle specific errors from the function
    if (error.message?.includes('Invalid or inactive')) {
      return res.status(404).json({ error: 'Invalid or expired prompt link' });
    }
    if (error.message?.includes('expired')) {
      return res.status(410).json({ error: 'This prompt has expired' });
    }
    if (error.message?.includes('Maximum responses')) {
      return res.status(429).json({ error: 'Maximum responses reached' });
    }
    if (error.message?.includes('duplicate key')) {
      return res.status(409).json({ error: 'You have already responded to this prompt' });
    }
    
    res.status(500).json({ error: 'Failed to submit response' });
  }
});
