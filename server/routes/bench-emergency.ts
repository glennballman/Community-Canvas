import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

async function requirePortalStaff(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED',
      message: 'Portal context required'
    });
  }

  if (!ctx?.individual_id) {
    return res.status(401).json({
      ok: false,
      error: 'AUTH_REQUIRED',
      message: 'Authentication required'
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
        message: 'Portal staff access required'
      });
    }

    next();
  } catch (error: any) {
    console.error('Portal staff check error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Authorization check failed'
    });
  }
}

const benchUpdateSchema = z.object({
  readiness_state: z.enum(['prospect', 'cleared', 'ready', 'on_site', 'placed', 'inactive']).optional(),
  available_from_date: z.string().nullable().optional(),
  available_to_date: z.string().nullable().optional(),
  location_note: z.string().nullable().optional(),
  housing_needed: z.boolean().optional(),
  housing_tier_preference: z.enum(['premium', 'standard', 'temporary', 'emergency']).nullable().optional()
});

const emergencyCreateSchema = z.object({
  tenant_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  job_posting_id: z.string().uuid().nullable().optional(),
  role_title_snapshot: z.string().min(1).max(255),
  urgency: z.enum(['now', 'today', 'this_week']).default('today'),
  start_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

const emergencyUpdateSchema = z.object({
  status: z.enum(['open', 'triaging', 'filled', 'cancelled']).optional(),
  notes: z.string().nullable().optional()
});

const routeCandidateSchema = z.object({
  bench_id: z.string().uuid(),
  application_id: z.string().uuid().nullable().optional(),
  action: z.enum(['notify', 'advance_status', 'mark_filled'])
});

router.get('/portals/:portalId/bench', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'PORTAL_MISMATCH' });
  }

  try {
    const { state, q, available, housing_needed, tier_preference } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let whereConditions = ['b.portal_id = $1'];
    const params: any[] = [portalId];
    let paramIndex = 2;

    if (state && typeof state === 'string') {
      whereConditions.push(`b.readiness_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    if (q && typeof q === 'string') {
      whereConditions.push(`(i.full_name ILIKE $${paramIndex} OR i.email ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (available === 'now') {
      whereConditions.push(`(b.available_from_date IS NULL OR b.available_from_date <= CURRENT_DATE)`);
      whereConditions.push(`(b.available_to_date IS NULL OR b.available_to_date >= CURRENT_DATE)`);
    } else if (available === '7d') {
      whereConditions.push(`(b.available_from_date IS NULL OR b.available_from_date <= CURRENT_DATE + interval '7 days')`);
      whereConditions.push(`(b.available_to_date IS NULL OR b.available_to_date >= CURRENT_DATE)`);
    }

    if (housing_needed === 'true') {
      whereConditions.push('b.housing_needed = true');
    }

    if (tier_preference && typeof tier_preference === 'string') {
      whereConditions.push(`b.housing_tier_preference = $${paramIndex}`);
      params.push(tier_preference);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await serviceQuery(`
      SELECT 
        b.id,
        b.portal_id,
        b.individual_id,
        b.readiness_state,
        b.available_from_date,
        b.available_to_date,
        b.location_note,
        b.housing_needed,
        b.housing_tier_preference,
        b.last_activity_at,
        b.created_at,
        b.updated_at,
        i.full_name,
        i.email,
        i.phone,
        (SELECT COUNT(*) FROM cc_job_applications a WHERE a.applicant_individual_id = b.individual_id) as application_count
      FROM cc_portal_candidate_bench b
      JOIN cc_individuals i ON i.id = b.individual_id
      WHERE ${whereClause}
      ORDER BY b.last_activity_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_portal_candidate_bench b
      JOIN cc_individuals i ON i.id = b.individual_id
      WHERE ${whereClause}
    `, params);

    res.json({
      ok: true,
      candidates: result.rows.map(r => ({
        id: r.id,
        portalId: r.portal_id,
        individualId: r.individual_id,
        readinessState: r.readiness_state,
        availableFromDate: r.available_from_date,
        availableToDate: r.available_to_date,
        locationNote: r.location_note,
        housingNeeded: r.housing_needed,
        housingTierPreference: r.housing_tier_preference,
        lastActivityAt: r.last_activity_at,
        createdAt: r.created_at,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        applicationCount: parseInt(r.application_count)
      })),
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset
    });

  } catch (error: any) {
    console.error('Bench list error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch bench candidates' });
  }
});

router.patch('/bench/:id', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { id } = req.params;

  const parseResult = benchUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  try {
    const checkResult = await serviceQuery(
      'SELECT id, portal_id FROM cc_portal_candidate_bench WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'BENCH_ENTRY_NOT_FOUND' });
    }

    if (checkResult.rows[0].portal_id !== ctx.portal_id) {
      return res.status(403).json({ ok: false, error: 'PORTAL_MISMATCH' });
    }

    const updates = parseResult.data;
    const setClauses: string[] = ['updated_at = now()', 'last_activity_at = now()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.readiness_state !== undefined) {
      setClauses.push(`readiness_state = $${paramIndex}`);
      values.push(updates.readiness_state);
      paramIndex++;
    }
    if (updates.available_from_date !== undefined) {
      setClauses.push(`available_from_date = $${paramIndex}`);
      values.push(updates.available_from_date);
      paramIndex++;
    }
    if (updates.available_to_date !== undefined) {
      setClauses.push(`available_to_date = $${paramIndex}`);
      values.push(updates.available_to_date);
      paramIndex++;
    }
    if (updates.location_note !== undefined) {
      setClauses.push(`location_note = $${paramIndex}`);
      values.push(updates.location_note);
      paramIndex++;
    }
    if (updates.housing_needed !== undefined) {
      setClauses.push(`housing_needed = $${paramIndex}`);
      values.push(updates.housing_needed);
      paramIndex++;
    }
    if (updates.housing_tier_preference !== undefined) {
      setClauses.push(`housing_tier_preference = $${paramIndex}`);
      values.push(updates.housing_tier_preference);
      paramIndex++;
    }

    values.push(id);

    await serviceQuery(
      `UPDATE cc_portal_candidate_bench SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    res.json({ ok: true, updated: Object.keys(updates) });

  } catch (error: any) {
    console.error('Bench update error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update bench entry' });
  }
});

router.get('/bench/:id/timeline', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { id } = req.params;

  try {
    const benchResult = await serviceQuery(`
      SELECT b.*, i.full_name, i.email
      FROM cc_portal_candidate_bench b
      JOIN cc_individuals i ON i.id = b.individual_id
      WHERE b.id = $1 AND b.portal_id = $2
    `, [id, ctx.portal_id]);

    if (benchResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'BENCH_ENTRY_NOT_FOUND' });
    }

    const bench = benchResult.rows[0];
    const individualId = bench.individual_id;

    const applicationsResult = await serviceQuery(`
      SELECT 
        a.id, a.status, a.submitted_at, a.created_at,
        j.title as job_title,
        jp.id as posting_id,
        p.name as portal_name
      FROM cc_job_applications a
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_jobs j ON j.id = a.job_id
      JOIN cc_portals p ON p.id = jp.portal_id
      WHERE a.applicant_individual_id = $1
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [individualId]);

    const eventsResult = await serviceQuery(`
      SELECT 
        e.id, e.application_id, e.event_type, e.note, e.created_at, e.new_status, e.previous_status
      FROM cc_job_application_events e
      JOIN cc_job_applications a ON a.id = e.application_id
      WHERE a.applicant_individual_id = $1
      ORDER BY e.created_at DESC
      LIMIT 100
    `, [individualId]);

    const housingResult = await serviceQuery(`
      SELECT id, status, housing_tier_assigned, staging_location_note, created_at
      FROM cc_portal_housing_waitlist_entries
      WHERE applicant_individual_id = $1 AND portal_id = $2
      ORDER BY created_at DESC
      LIMIT 10
    `, [individualId, ctx.portal_id]);

    res.json({
      ok: true,
      candidate: {
        id: bench.id,
        individualId: bench.individual_id,
        fullName: bench.full_name,
        email: bench.email,
        readinessState: bench.readiness_state,
        housingNeeded: bench.housing_needed,
        housingTierPreference: bench.housing_tier_preference,
        locationNote: bench.location_note,
        availableFromDate: bench.available_from_date,
        availableToDate: bench.available_to_date,
        lastActivityAt: bench.last_activity_at
      },
      applications: applicationsResult.rows,
      events: eventsResult.rows,
      housingWaitlist: housingResult.rows
    });

  } catch (error: any) {
    console.error('Bench timeline error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch timeline' });
  }
});

router.get('/portals/:portalId/emergency-replacements', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'PORTAL_MISMATCH' });
  }

  try {
    const { status } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let whereConditions = ['er.portal_id = $1'];
    const params: any[] = [portalId];
    let paramIndex = 2;

    if (status && typeof status === 'string') {
      whereConditions.push(`er.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const result = await serviceQuery(`
      SELECT 
        er.*,
        t.name as tenant_name,
        j.title as job_title,
        p.name as portal_name
      FROM cc_emergency_replacement_requests er
      LEFT JOIN cc_tenants t ON t.id = er.tenant_id
      LEFT JOIN cc_jobs j ON j.id = er.job_id
      JOIN cc_portals p ON p.id = er.portal_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE er.urgency 
          WHEN 'now' THEN 1 
          WHEN 'today' THEN 2 
          ELSE 3 
        END,
        er.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_emergency_replacement_requests er
      WHERE ${whereConditions.join(' AND ')}
    `, params);

    res.json({
      ok: true,
      requests: result.rows.map(r => ({
        id: r.id,
        portalId: r.portal_id,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        jobId: r.job_id,
        jobTitle: r.job_title,
        jobPostingId: r.job_posting_id,
        roleTitleSnapshot: r.role_title_snapshot,
        urgency: r.urgency,
        startDate: r.start_date,
        notes: r.notes,
        status: r.status,
        filledByBenchId: r.filled_by_bench_id,
        createdAt: r.created_at
      })),
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset
    });

  } catch (error: any) {
    console.error('Emergency replacements list error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch emergency replacements' });
  }
});

router.post('/portals/:portalId/emergency-replacements', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  if (portalId !== ctx.portal_id) {
    return res.status(403).json({ ok: false, error: 'PORTAL_MISMATCH' });
  }

  const parseResult = emergencyCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  try {
    const data = parseResult.data;

    const result = await serviceQuery(`
      INSERT INTO cc_emergency_replacement_requests (
        portal_id, tenant_id, job_id, job_posting_id, role_title_snapshot,
        urgency, start_date, notes, created_by_identity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      portalId,
      data.tenant_id || null,
      data.job_id || null,
      data.job_posting_id || null,
      data.role_title_snapshot,
      data.urgency,
      data.start_date || null,
      data.notes || null,
      ctx.individual_id || null
    ]);

    res.json({
      ok: true,
      id: result.rows[0].id,
      message: 'Emergency replacement request created'
    });

  } catch (error: any) {
    console.error('Create emergency replacement error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create emergency replacement request' });
  }
});

router.patch('/emergency-replacements/:id', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { id } = req.params;

  const parseResult = emergencyUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  try {
    const checkResult = await serviceQuery(
      'SELECT id, portal_id FROM cc_emergency_replacement_requests WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' });
    }

    if (checkResult.rows[0].portal_id !== ctx.portal_id) {
      return res.status(403).json({ ok: false, error: 'PORTAL_MISMATCH' });
    }

    const updates = parseResult.data;
    const setClauses: string[] = ['updated_at = now()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(updates.notes);
      paramIndex++;
    }

    values.push(id);

    await serviceQuery(
      `UPDATE cc_emergency_replacement_requests SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    res.json({ ok: true, updated: Object.keys(updates) });

  } catch (error: any) {
    console.error('Update emergency replacement error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update request' });
  }
});

router.get('/emergency-replacements/:id/candidates', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { id } = req.params;

  try {
    const requestResult = await serviceQuery(`
      SELECT er.*
      FROM cc_emergency_replacement_requests er
      WHERE er.id = $1 AND er.portal_id = $2
    `, [id, ctx.portal_id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' });
    }

    const request = requestResult.rows[0];
    const startDate = request.start_date || new Date().toISOString().split('T')[0];

    const candidatesResult = await serviceQuery(`
      SELECT 
        b.id,
        b.individual_id,
        b.readiness_state,
        b.available_from_date,
        b.available_to_date,
        b.location_note,
        b.housing_needed,
        b.housing_tier_preference,
        b.last_activity_at,
        i.full_name,
        i.email,
        i.phone,
        COALESCE(hw.priority_score, 0) as priority_score,
        hw.housing_tier_assigned,
        hw.matched_housing_offer_id,
        CASE 
          WHEN b.readiness_state = 'on_site' THEN 1
          WHEN b.readiness_state = 'ready' THEN 2
          ELSE 3
        END as readiness_rank
      FROM cc_portal_candidate_bench b
      JOIN cc_individuals i ON i.id = b.individual_id
      LEFT JOIN cc_portal_housing_waitlist_entries hw 
        ON hw.applicant_individual_id = b.individual_id AND hw.portal_id = b.portal_id
      WHERE b.portal_id = $1
        AND b.readiness_state IN ('ready', 'on_site')
        AND (b.available_from_date IS NULL OR b.available_from_date <= $2::date)
        AND (b.available_to_date IS NULL OR b.available_to_date >= $2::date)
      ORDER BY 
        readiness_rank ASC,
        b.last_activity_at DESC,
        COALESCE(hw.priority_score, 0) DESC
      LIMIT 20
    `, [ctx.portal_id, startDate]);

    res.json({
      ok: true,
      request: {
        id: request.id,
        roleTitleSnapshot: request.role_title_snapshot,
        urgency: request.urgency,
        startDate: request.start_date,
        status: request.status
      },
      candidates: candidatesResult.rows.map(r => ({
        id: r.id,
        individualId: r.individual_id,
        readinessState: r.readiness_state,
        availableFromDate: r.available_from_date,
        availableToDate: r.available_to_date,
        locationNote: r.location_note,
        housingNeeded: r.housing_needed,
        housingTierPreference: r.housing_tier_preference,
        lastActivityAt: r.last_activity_at,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        priorityScore: r.priority_score,
        housingTierAssigned: r.housing_tier_assigned,
        hasHousingMatch: !!r.matched_housing_offer_id
      }))
    });

  } catch (error: any) {
    console.error('Emergency candidates error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch candidates' });
  }
});

router.post('/emergency-replacements/:id/route', requirePortalStaff, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { id } = req.params;

  const parseResult = routeCandidateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  try {
    const requestCheck = await serviceQuery(
      'SELECT * FROM cc_emergency_replacement_requests WHERE id = $1 AND portal_id = $2',
      [id, ctx.portal_id]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' });
    }

    const request = requestCheck.rows[0];
    const { bench_id, application_id, action } = parseResult.data;

    const benchCheck = await serviceQuery(
      'SELECT * FROM cc_portal_candidate_bench WHERE id = $1 AND portal_id = $2',
      [bench_id, ctx.portal_id]
    );

    if (benchCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'BENCH_CANDIDATE_NOT_FOUND' });
    }

    const bench = benchCheck.rows[0];

    await withServiceTransaction(async (client) => {
      if (application_id) {
        await client.query(`
          INSERT INTO cc_job_application_events (
            application_id, portal_id, event_type, note, metadata
          ) VALUES ($1, $2, 'emergency_routed', $3, $4)
        `, [
          application_id,
          ctx.portal_id,
          `Emergency routed for: ${request.role_title_snapshot}`,
          JSON.stringify({ emergency_request_id: id, bench_id, action })
        ]);

        if (action === 'advance_status') {
          await client.query(`
            UPDATE cc_job_applications 
            SET status = 'interview', updated_at = now()
            WHERE id = $1
          `, [application_id]);
        }
      }

      await client.query(`
        UPDATE cc_portal_candidate_bench
        SET last_activity_at = now(), updated_at = now()
        WHERE id = $1
      `, [bench_id]);

      if (action === 'mark_filled') {
        await client.query(`
          UPDATE cc_emergency_replacement_requests
          SET status = 'filled', filled_by_bench_id = $1, updated_at = now()
          WHERE id = $2
        `, [bench_id, id]);
      } else {
        await client.query(`
          UPDATE cc_emergency_replacement_requests
          SET status = 'triaging', updated_at = now()
          WHERE id = $1 AND status = 'open'
        `, [id]);
      }
    });

    res.json({
      ok: true,
      action,
      benchId: bench_id,
      requestId: id,
      message: action === 'mark_filled' 
        ? 'Emergency replacement filled' 
        : action === 'advance_status'
          ? 'Candidate advanced to interview'
          : 'Candidate notified'
    });

  } catch (error: any) {
    console.error('Route candidate error:', error);
    res.status(500).json({ ok: false, error: 'Failed to route candidate' });
  }
});

export default router;
