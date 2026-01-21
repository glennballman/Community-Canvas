/**
 * WORK REQUESTS ROUTES - Intake Inbox
 * "Faster than a sticky note" - 10 second max capture
 * 
 * Endpoints:
 * - GET /api/work-requests - List work requests with optional status filter
 * - GET /api/work-requests/:id - Get single work request
 * - POST /api/work-requests - Create new work request (minimal: contact_channel_value)
 * - PUT /api/work-requests/:id - Update work request
 * - POST /api/work-requests/:id/convert - Convert to project
 * - POST /api/work-requests/:id/close - Close with reason
 * - POST /api/work-requests/:id/notes - Add note
 * - GET /api/work-requests/:id/notes - Get notes
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';
import { 
  buildSimilarityKey, 
  ACTIVE_STATUSES, 
  NEW_STATUSES, 
  clampWindowDays,
  type SimilarityKey 
} from '../lib/coordination';

const router = Router();

// List work requests with optional status filter
router.get('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { status, search, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    const whereClauses: string[] = [];
    
    if (status && status !== 'all') {
      whereClauses.push(`wr.status = $${paramIndex}::work_request_status`);
      params.push(status);
      paramIndex++;
    }
    
    if (search) {
      whereClauses.push(`(
        wr.contact_channel_value ILIKE $${paramIndex} 
        OR wr.summary ILIKE $${paramIndex}
        OR wr.description ILIKE $${paramIndex}
        OR c.given_name ILIKE $${paramIndex}
        OR c.family_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        wr.id, wr.contact_channel_value, wr.contact_channel_type, wr.status,
        wr.summary, wr.description, wr.category, wr.priority,
        wr.source, wr.referral_source, wr.location_text,
        wr.created_at, wr.updated_at,
        wr.converted_to_project_id, wr.converted_at,
        wr.zone_id, wr.portal_id,
        c.id as person_id, c.given_name as contact_given_name, c.family_name as contact_family_name,
        p.id as property_id, p.name as property_name, p.address_line1 as property_address,
        z.name as zone_name,
        (SELECT COUNT(*) FROM cc_work_request_notes wn WHERE wn.work_request_id = wr.id) as notes_count
      FROM cc_work_requests wr
      LEFT JOIN cc_people c ON wr.person_id = c.id
      LEFT JOIN cc_crm_properties p ON wr.property_id = p.id
      LEFT JOIN cc_zones z ON wr.zone_id = z.id
      ${whereClause}
      ORDER BY wr.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as count_new,
        COUNT(*) FILTER (WHERE status = 'contacted') as count_contacted,
        COUNT(*) FILTER (WHERE status = 'quoted') as count_quoted,
        COUNT(*) FILTER (WHERE status = 'scheduled') as count_scheduled,
        COUNT(*) FILTER (WHERE status = 'completed') as count_completed,
        COUNT(*) FILTER (WHERE status = 'dropped') as count_dropped,
        COUNT(*) FILTER (WHERE status = 'spam') as count_spam
      FROM cc_work_requests wr
      LEFT JOIN cc_people c ON wr.person_id = c.id`,
      []
    );

    res.json({
      workRequests: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      counts: {
        new: parseInt(countResult.rows[0].count_new, 10),
        contacted: parseInt(countResult.rows[0].count_contacted, 10),
        quoted: parseInt(countResult.rows[0].count_quoted, 10),
        scheduled: parseInt(countResult.rows[0].count_scheduled, 10),
        completed: parseInt(countResult.rows[0].count_completed, 10),
        dropped: parseInt(countResult.rows[0].count_dropped, 10),
        spam: parseInt(countResult.rows[0].count_spam, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching work requests:', error);
    res.status(500).json({ error: 'Failed to fetch work requests' });
  }
});

// Get zones for a portal (for dropdown in work request detail)
// NOTE: Must be defined BEFORE /:id routes to avoid route shadowing
router.get('/zones', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { portalId } = req.query;

    if (!portalId) {
      return res.status(400).json({ error: 'portalId is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT id, key, name, kind, 
              badge_label_resident, badge_label_contractor, badge_label_visitor,
              pricing_modifiers
       FROM cc_zones 
       WHERE portal_id = $1 
       ORDER BY name ASC`,
      [portalId]
    );

    // Map snake_case to camelCase for frontend
    const zones = result.rows.map((row: any) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      kind: row.kind,
      badge_label_resident: row.badge_label_resident,
      badge_label_contractor: row.badge_label_contractor,
      badge_label_visitor: row.badge_label_visitor,
      pricingModifiers: row.pricing_modifiers || {},
    }));

    res.json({ ok: true, zones });
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

/**
 * GET /api/work-requests/coordination/zone-rollup
 * Zone coordination rollups (counts-only) - for resident/admin ops UI
 * 
 * Query params:
 * - portalId (required)
 * - zoneId (optional, 'none' for unzoned)
 * - windowDays (optional, default 14, range 1-60)
 */
router.get('/coordination/zone-rollup', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { portalId, zoneId, windowDays: windowDaysParam } = req.query;
    
    if (!portalId) {
      return res.status(400).json({ error: 'portalId is required' });
    }

    const roles = tenantReq.ctx?.roles || [];
    const isAdminOrOwner = 
      roles.includes('owner') || 
      roles.includes('admin') || 
      roles.includes('tenant_admin') ||
      roles.includes('resident') ||
      !!tenantReq.user?.isPlatformAdmin;
    
    if (!isAdminOrOwner) {
      return res.status(403).json({ 
        error: 'Coordination signals require resident or admin access',
        code: 'COORDINATION_ACCESS_DENIED'
      });
    }

    const windowDays = clampWindowDays(windowDaysParam as string);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const isUnzoned = zoneId === 'none';
    const zoneFilter = isUnzoned ? null : (zoneId as string | undefined);

    const activeStatusList = ACTIVE_STATUSES.join("','");
    const newStatusList = NEW_STATUSES.join("','");

    let zoneCondition = '';
    const params: any[] = [portalId, windowStart];
    let paramIndex = 3;

    if (isUnzoned) {
      zoneCondition = 'AND wr.zone_id IS NULL';
    } else if (zoneFilter) {
      zoneCondition = `AND wr.zone_id = $${paramIndex}`;
      params.push(zoneFilter);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        wr.category,
        COUNT(*) FILTER (WHERE wr.status IN ('${activeStatusList}')) as active_count,
        COUNT(*) FILTER (WHERE wr.status IN ('${newStatusList}')) as new_count
      FROM cc_work_requests wr
      WHERE wr.portal_id = $1
        AND wr.created_at >= $2
        AND wr.status IN ('${activeStatusList}')
        ${zoneCondition}
      GROUP BY wr.category
      ORDER BY active_count DESC`,
      params
    );

    const buckets = result.rows.map((row: any) => ({
      label: row.category || 'Uncategorized',
      key: { category: row.category || null } as SimilarityKey,
      active_count: parseInt(row.active_count, 10),
      new_count: parseInt(row.new_count, 10),
    }));

    res.json({
      ok: true,
      window_days: windowDays,
      portal_id: portalId,
      zone_id: isUnzoned ? null : (zoneFilter || null),
      buckets,
    });
  } catch (error) {
    console.error('Error fetching zone coordination rollup:', error);
    res.status(500).json({ error: 'Failed to fetch coordination rollup' });
  }
});

// Get single work request
router.get('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        wr.*,
        c.given_name as contact_given_name, c.family_name as contact_family_name, 
        c.telephone as contact_telephone, c.email as contact_email,
        o.name as organization_name,
        p.name as property_name, p.address_line1 as property_address, p.city as property_city,
        z.name as zone_name
      FROM cc_work_requests wr
      LEFT JOIN cc_people c ON wr.person_id = c.id
      LEFT JOIN cc_organizations o ON wr.organization_id = o.id
      LEFT JOIN cc_crm_properties p ON wr.property_id = p.id
      LEFT JOIN cc_zones z ON wr.zone_id = z.id
      WHERE wr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const notesResult = await tenantReq.tenantQuery!(
      `SELECT * FROM cc_work_request_notes WHERE work_request_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      workRequest: result.rows[0],
      notes: notesResult.rows
    });
  } catch (error) {
    console.error('Error fetching work request:', error);
    res.status(500).json({ error: 'Failed to fetch work request' });
  }
});

/**
 * GET /api/work-requests/:id/coordination
 * Similarity summary for a single work request (counts only, no PII)
 * 
 * Query params:
 * - windowDays (optional, default 14, range 1-60)
 */
router.get('/:id/coordination', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { windowDays: windowDaysParam } = req.query;

    const roles = tenantReq.ctx?.roles || [];
    const isAdminOrOwner = 
      roles.includes('owner') || 
      roles.includes('admin') || 
      roles.includes('tenant_admin') ||
      roles.includes('resident') ||
      !!tenantReq.user?.isPlatformAdmin;
    
    if (!isAdminOrOwner) {
      return res.status(403).json({ 
        error: 'Coordination signals require resident or admin access',
        code: 'COORDINATION_ACCESS_DENIED'
      });
    }

    const wrResult = await tenantReq.tenantQuery!(
      `SELECT id, portal_id, zone_id, category FROM cc_work_requests WHERE id = $1`,
      [id]
    );

    if (wrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const wr = wrResult.rows[0];
    
    if (!wr.portal_id) {
      return res.json({
        ok: true,
        window_days: 14,
        portal_id: null,
        zone_id: wr.zone_id,
        similarity_key: buildSimilarityKey(wr),
        totals: {
          similar_active_count: 0,
          similar_new_count: 0,
          unzoned_similar_count: 0,
        },
        message: 'No portal assigned - coordination signals unavailable',
      });
    }

    const windowDays = clampWindowDays(windowDaysParam as string);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const similarityKey = buildSimilarityKey(wr);
    const activeStatusList = ACTIVE_STATUSES.join("','");
    const newStatusList = NEW_STATUSES.join("','");

    const params: any[] = [wr.portal_id, windowStart, id];
    let paramIndex = 4;
    
    let categoryCondition = '';
    if (similarityKey.category) {
      categoryCondition = `AND wr.category = $${paramIndex}`;
      params.push(similarityKey.category);
      paramIndex++;
    } else {
      categoryCondition = 'AND wr.category IS NULL';
    }

    let zoneCondition = '';
    if (wr.zone_id) {
      zoneCondition = `AND wr.zone_id = $${paramIndex}`;
      params.push(wr.zone_id);
      paramIndex++;
    } else {
      zoneCondition = 'AND wr.zone_id IS NULL';
    }

    const countResult = await tenantReq.tenantQuery!(
      `SELECT 
        COUNT(*) FILTER (WHERE wr.status IN ('${activeStatusList}')) as similar_active_count,
        COUNT(*) FILTER (WHERE wr.status IN ('${newStatusList}')) as similar_new_count,
        COUNT(*) FILTER (WHERE wr.status IN ('${activeStatusList}') AND wr.coordination_intent = true) as coordination_ready_similar_count
      FROM cc_work_requests wr
      WHERE wr.portal_id = $1
        AND wr.created_at >= $2
        AND wr.id != $3
        ${categoryCondition}
        ${zoneCondition}`,
      params
    );

    let unzonedSimilarCount = 0;
    if (wr.zone_id) {
      const unzonedParams = [wr.portal_id, windowStart, id];
      let unzonedParamIndex = 4;
      let unzonedCategoryCondition = '';
      if (similarityKey.category) {
        unzonedCategoryCondition = `AND wr.category = $${unzonedParamIndex}`;
        unzonedParams.push(similarityKey.category);
      } else {
        unzonedCategoryCondition = 'AND wr.category IS NULL';
      }

      const unzonedResult = await tenantReq.tenantQuery!(
        `SELECT COUNT(*) as cnt
         FROM cc_work_requests wr
         WHERE wr.portal_id = $1
           AND wr.created_at >= $2
           AND wr.id != $3
           ${unzonedCategoryCondition}
           AND wr.zone_id IS NULL
           AND wr.status IN ('${activeStatusList}')`,
        unzonedParams
      );
      unzonedSimilarCount = parseInt(unzonedResult.rows[0]?.cnt || '0', 10);
    }

    res.json({
      ok: true,
      window_days: windowDays,
      portal_id: wr.portal_id,
      zone_id: wr.zone_id,
      similarity_key: similarityKey,
      totals: {
        similar_active_count: parseInt(countResult.rows[0]?.similar_active_count || '0', 10),
        similar_new_count: parseInt(countResult.rows[0]?.similar_new_count || '0', 10),
        unzoned_similar_count: unzonedSimilarCount,
        coordination_ready_similar_count: parseInt(countResult.rows[0]?.coordination_ready_similar_count || '0', 10),
      },
    });
  } catch (error) {
    console.error('Error fetching work request coordination:', error);
    res.status(500).json({ error: 'Failed to fetch coordination data' });
  }
});

// Create new work request - "Faster than a sticky note"
// Only contact_channel_value is truly required
router.post('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';

    const {
      contact_channel_value,
      contact_channel_type = 'phone',
      contact_channel_notes,
      person_id,
      organization_id,
      property_id,
      unit_id,
      location_text,
      summary,
      description,
      category,
      priority = 'normal',
      source,
      referral_source
    } = req.body;

    if (!contact_channel_value) {
      return res.status(400).json({ error: 'Contact channel value is required (phone number, email, etc.)' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO cc_work_requests (
        tenant_id, contact_channel_value, contact_channel_type, contact_channel_notes,
        person_id, organization_id, property_id, unit_id, location_text,
        summary, description, category, priority, source, referral_source,
        created_by_actor_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *`,
      [
        tenantId, contact_channel_value, contact_channel_type, contact_channel_notes || null,
        person_id || null, organization_id || null, property_id || null, unit_id || null, location_text || null,
        summary || null, description || null, category || null, priority, source || null, referral_source || null,
        actorId
      ]
    );

    res.status(201).json({ workRequest: result.rows[0] });
  } catch (error) {
    console.error('Error creating work request:', error);
    res.status(500).json({ error: 'Failed to create work request' });
  }
});

// Update work request
router.put('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const {
      contact_channel_value,
      contact_channel_type,
      contact_channel_notes,
      person_id,
      organization_id,
      property_id,
      unit_id,
      location_text,
      summary,
      description,
      category,
      priority,
      source,
      referral_source,
      status
    } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE cc_work_requests SET
        contact_channel_value = COALESCE($2, contact_channel_value),
        contact_channel_type = COALESCE($3, contact_channel_type),
        contact_channel_notes = $4,
        person_id = $5,
        organization_id = $6,
        property_id = $7,
        unit_id = $8,
        location_text = $9,
        summary = $10,
        description = $11,
        category = $12,
        priority = COALESCE($13, priority),
        source = $14,
        referral_source = $15,
        status = COALESCE($16::work_request_status, status)
      WHERE id = $1
      RETURNING *`,
      [
        id, contact_channel_value, contact_channel_type, contact_channel_notes,
        person_id, organization_id, property_id, unit_id, location_text,
        summary, description, category, priority, source, referral_source, status
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    res.json({ workRequest: result.rows[0] });
  } catch (error) {
    console.error('Error updating work request:', error);
    res.status(500).json({ error: 'Failed to update work request' });
  }
});

// Reserve work request as project
router.post('/:id/reserve', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const tenantId = tenantReq.ctx!.tenant_id;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';

    const {
      title,
      description,
      quoted_amount,
      scheduled_start,
      status = 'quote'
    } = req.body;

    // Get the work request
    const wrResult = await tenantReq.tenantQuery!(
      `SELECT * FROM cc_work_requests WHERE id = $1`,
      [id]
    );

    if (wrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const wr = wrResult.rows[0];

    if (wr.status === 'scheduled') {
      return res.status(400).json({ error: 'Work request already scheduled' });
    }

    // Create the project
    const projectResult = await tenantReq.tenantQuery!(
      `INSERT INTO cc_projects (
        tenant_id, title, description, person_id, organization_id, property_id, unit_id, location_text,
        status, quoted_amount, scheduled_start, source_work_request_id, source, created_by_actor_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::project_status, $10, $11, $12, 'work_request', $13
      ) RETURNING *`,
      [
        tenantId,
        title || wr.summary || `Project from Work Request`,
        description || wr.description,
        wr.person_id,
        wr.organization_id,
        wr.property_id,
        wr.unit_id,
        wr.location_text,
        status,
        quoted_amount || null,
        scheduled_start || null,
        id,
        actorId
      ]
    );

    const project = projectResult.rows[0];

    // Update work request status to scheduled
    await tenantReq.tenantQuery!(
      `UPDATE cc_work_requests SET 
        status = 'scheduled',
        converted_to_project_id = $2,
        converted_at = NOW(),
        converted_by_actor_id = $3
      WHERE id = $1`,
      [id, project.id, actorId]
    );

    res.status(201).json({ 
      project,
      project_id: project.id,
      message: 'Work request scheduled as project'
    });
  } catch (error) {
    console.error('Error reserving work request:', error);
    res.status(500).json({ error: 'Failed to reserve work request' });
  }
});

// Drop work request (won't proceed)
router.post('/:id/drop', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE cc_work_requests SET 
        status = 'dropped'::work_request_status,
        closed_reason = $2
      WHERE id = $1
      RETURNING *`,
      [id, reason || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    res.json({ workRequest: result.rows[0] });
  } catch (error) {
    console.error('Error dropping work request:', error);
    res.status(500).json({ error: 'Failed to drop work request' });
  }
});

// Add note to work request
router.post('/:id/notes', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO cc_work_request_notes (work_request_id, content, created_by_actor_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, content, actorId]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get notes for work request
router.get('/:id/notes', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT * FROM cc_work_request_notes WHERE work_request_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Assign zone to work request
router.put('/:id/zone', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { zoneId } = req.body;
    const tenantId = tenantReq.ctx!.tenant_id;

    // Verify work request exists
    const wrCheck = await tenantReq.tenantQuery!(
      `SELECT wr.id, wr.portal_id FROM cc_work_requests wr WHERE wr.id = $1`,
      [id]
    );

    if (wrCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const workRequest = wrCheck.rows[0];

    // Validate zone assignment
    if (zoneId) {
      // If work request has no portal_id, reject zone assignment
      if (!workRequest.portal_id) {
        return res.status(400).json({ error: 'Cannot assign zone to work request without a portal' });
      }
      
      // Verify zone belongs to the same portal
      const zoneCheck = await tenantReq.tenantQuery!(
        `SELECT id FROM cc_zones WHERE id = $1 AND portal_id = $2`,
        [zoneId, workRequest.portal_id]
      );

      if (zoneCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Zone not found or does not belong to the same portal' });
      }
    }

    await tenantReq.tenantQuery!(
      `UPDATE cc_work_requests SET zone_id = $1, updated_at = NOW() WHERE id = $2`,
      [zoneId || null, id]
    );

    res.json({ ok: true, workRequestId: id, zoneId: zoneId || null });
  } catch (error) {
    console.error('Error assigning zone to work request:', error);
    res.status(500).json({ error: 'Failed to assign zone' });
  }
});

/**
 * PUT /api/work-requests/:id/coordination-intent
 * Set or clear coordination intent (opt-in flag for coordination)
 * 
 * Request body:
 * - coordination_intent: boolean (required)
 * - note?: string | null (max 280 chars, trimmed)
 * 
 * Role gating: resident/admin/owner only; contractors denied
 */
router.put('/:id/coordination-intent', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { coordination_intent, note } = req.body;

    const roles = tenantReq.ctx?.roles || [];
    const isContractor = roles.includes('contractor');
    const isResidentOrAdmin = 
      roles.includes('owner') || 
      roles.includes('admin') || 
      roles.includes('tenant_admin') ||
      roles.includes('resident') ||
      !!tenantReq.user?.isPlatformAdmin;
    
    if (isContractor || !isResidentOrAdmin) {
      return res.status(403).json({ 
        error: 'Coordination intent requires resident or admin access',
        code: 'COORDINATION_INTENT_ACCESS_DENIED'
      });
    }

    if (typeof coordination_intent !== 'boolean') {
      return res.status(400).json({ 
        error: 'coordination_intent must be a boolean',
        code: 'INVALID_INTENT_VALUE'
      });
    }

    const wrResult = await tenantReq.tenantQuery!(
      `SELECT id, portal_id, zone_id FROM cc_work_requests WHERE id = $1`,
      [id]
    );

    if (wrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const wr = wrResult.rows[0];
    const actorId = tenantReq.ctx?.individual_id || tenantReq.user?.id || null;

    let result;
    if (coordination_intent) {
      const trimmedNote = note?.trim()?.substring(0, 280) || null;
      
      result = await tenantReq.tenantQuery!(
        `UPDATE cc_work_requests 
         SET coordination_intent = true,
             coordination_intent_set_at = NOW(),
             coordination_intent_set_by = $1,
             coordination_intent_note = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, coordination_intent, coordination_intent_set_at, coordination_intent_note`,
        [actorId, trimmedNote, id]
      );

      console.log('[audit] coordination_intent_set', {
        work_request_id: id,
        portal_id: wr.portal_id,
        zone_id: wr.zone_id,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
      });
    } else {
      result = await tenantReq.tenantQuery!(
        `UPDATE cc_work_requests 
         SET coordination_intent = false,
             coordination_intent_set_at = NULL,
             coordination_intent_set_by = NULL,
             coordination_intent_note = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, coordination_intent, coordination_intent_set_at, coordination_intent_note`,
        [id]
      );

      console.log('[audit] coordination_intent_cleared', {
        work_request_id: id,
        portal_id: wr.portal_id,
        zone_id: wr.zone_id,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
      });
    }

    const updated = result.rows[0];
    const response: any = {
      ok: true,
      work_request_id: updated.id,
      coordination_intent: updated.coordination_intent,
      coordination_intent_set_at: updated.coordination_intent_set_at,
      coordination_intent_note: updated.coordination_intent_note,
    };

    if (!wr.portal_id) {
      response.portal_required_for_matching = true;
    }

    res.json(response);
  } catch (error) {
    console.error('Error setting coordination intent:', error);
    res.status(500).json({ error: 'Failed to set coordination intent' });
  }
});

export default router;
