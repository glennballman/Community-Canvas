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

import { Router, Request, Response, NextFunction } from 'express';
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

// Admin/owner guard for mutation endpoints
function requireTenantAdminOrOwner(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const roles = tenantReq.ctx?.roles || [];
  
  const isAdminOrOwner = 
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin') ||
    !!tenantReq.user?.isPlatformAdmin;
  
  if (!isAdminOrOwner) {
    return res.status(403).json({ 
      error: 'Owner or admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
}

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
 * GET /api/work-requests/coordination/readiness
 * Zone-level coordination readiness heat map
 * 
 * Query params:
 * - portalId: required
 * - windowDays: optional, default 14, clamp 1-60
 * - zoneId: optional, 'none' for unzoned only, or specific zone id
 * 
 * Role gating: admin/owner only
 */
router.get('/coordination/readiness', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { portalId, windowDays: windowDaysParam, zoneId } = req.query;

    if (!portalId) {
      return res.status(400).json({ error: 'portalId is required' });
    }

    const roles = tenantReq.ctx?.roles || [];
    const isAdminOrOwner = 
      roles.includes('owner') || 
      roles.includes('admin') || 
      roles.includes('tenant_admin') ||
      !!tenantReq.user?.isPlatformAdmin;
    
    if (!isAdminOrOwner) {
      return res.status(403).json({ 
        error: 'Coordination readiness requires admin or owner access',
        code: 'COORDINATION_READINESS_ACCESS_DENIED'
      });
    }

    const windowDays = clampWindowDays(windowDaysParam as string | undefined);
    const activeStatusList = ACTIVE_STATUSES.map(s => `'${s}'`).join(',');

    let zoneFilter = '';
    const params: any[] = [portalId, windowDays];
    let paramIndex = 3;

    if (zoneId === 'none') {
      zoneFilter = 'AND zone_id IS NULL';
    } else if (zoneId && zoneId !== 'all') {
      zoneFilter = `AND zone_id = $${paramIndex}`;
      params.push(zoneId);
      paramIndex++;
    }

    const zonesQuery = `
      WITH active_requests AS (
        SELECT 
          wr.id, wr.zone_id, wr.coordination_intent, wr.updated_at
        FROM cc_work_requests wr
        WHERE wr.portal_id = $1
          AND wr.status IN (${activeStatusList})
          AND wr.updated_at >= NOW() - ($2 || ' days')::interval
          ${zoneFilter}
      ),
      zone_stats AS (
        SELECT 
          ar.zone_id,
          COUNT(*) as active_count,
          COUNT(*) FILTER (WHERE ar.coordination_intent = true) as coord_ready_count,
          MAX(ar.updated_at) as last_activity_at
        FROM active_requests ar
        GROUP BY ar.zone_id
      )
      SELECT 
        zs.zone_id,
        z.key as zone_key,
        z.name as zone_name,
        z.badge_label_resident,
        z.badge_label_contractor,
        z.badge_label_visitor,
        zs.active_count::int,
        zs.coord_ready_count::int,
        ROUND(zs.coord_ready_count::numeric / NULLIF(zs.active_count, 0), 2) as coord_ready_ratio,
        zs.last_activity_at
      FROM zone_stats zs
      LEFT JOIN cc_zones z ON zs.zone_id = z.id
      ORDER BY zs.coord_ready_count DESC, zs.active_count DESC, z.name ASC NULLS LAST
    `;

    const zonesResult = await tenantReq.tenantQuery!(zonesQuery, params);

    const rollupQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status IN (${activeStatusList}) AND updated_at >= NOW() - ($2 || ' days')::interval) as total_active,
        COUNT(*) FILTER (WHERE status IN (${activeStatusList}) AND updated_at >= NOW() - ($2 || ' days')::interval AND coordination_intent = true) as total_coord_ready,
        COUNT(*) FILTER (WHERE status IN (${activeStatusList}) AND updated_at >= NOW() - ($2 || ' days')::interval AND zone_id IS NULL) as unzoned_active,
        COUNT(*) FILTER (WHERE status IN (${activeStatusList}) AND updated_at >= NOW() - ($2 || ' days')::interval AND zone_id IS NULL AND coordination_intent = true) as unzoned_coord_ready
      FROM cc_work_requests
      WHERE portal_id = $1
    `;

    const rollupResult = await tenantReq.tenantQuery!(rollupQuery, [portalId, windowDays]);
    const rollup = rollupResult.rows[0];

    res.json({
      ok: true,
      portal_id: portalId,
      window_days: windowDays,
      rollups: {
        total_active: parseInt(rollup.total_active, 10),
        total_coord_ready: parseInt(rollup.total_coord_ready, 10),
        unzoned_active: parseInt(rollup.unzoned_active, 10),
        unzoned_coord_ready: parseInt(rollup.unzoned_coord_ready, 10),
      },
      zones: zonesResult.rows.map(row => ({
        zone_id: row.zone_id,
        zone_key: row.zone_key,
        zone_name: row.zone_name,
        badge_label_resident: row.badge_label_resident,
        badge_label_contractor: row.badge_label_contractor,
        badge_label_visitor: row.badge_label_visitor,
        active_count: row.active_count,
        coord_ready_count: row.coord_ready_count,
        coord_ready_ratio: parseFloat(row.coord_ready_ratio) || 0,
        last_activity_at: row.last_activity_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching coordination readiness:', error);
    res.status(500).json({ error: 'Failed to fetch coordination readiness' });
  }
});

/**
 * GET /api/work-requests/coordination/readiness/buckets
 * Category buckets for zone drill-down
 * 
 * Query params:
 * - portalId: required
 * - zoneId: optional, 'none' for unzoned, or specific zone id (omit for portal-wide)
 * - windowDays: optional, default 14, clamp 1-60
 * - limit: optional, default 10, clamp 1-50
 * 
 * Role gating: admin/owner only
 */
router.get('/coordination/readiness/buckets', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { portalId, zoneId, windowDays: windowDaysParam, limit: limitParam } = req.query;

    if (!portalId) {
      return res.status(400).json({ error: 'portalId is required' });
    }

    const roles = tenantReq.ctx?.roles || [];
    const isAdminOrOwner = 
      roles.includes('owner') || 
      roles.includes('admin') || 
      roles.includes('tenant_admin') ||
      !!tenantReq.user?.isPlatformAdmin;
    
    if (!isAdminOrOwner) {
      return res.status(403).json({ 
        error: 'Coordination readiness buckets requires admin or owner access',
        code: 'COORDINATION_BUCKETS_ACCESS_DENIED'
      });
    }

    const windowDays = clampWindowDays(windowDaysParam as string | undefined);
    const limit = Math.max(1, Math.min(50, parseInt(limitParam as string || '10', 10) || 10));
    const activeStatusList = ACTIVE_STATUSES.map(s => `'${s}'`).join(',');

    let zoneFilter = '';
    const params: any[] = [portalId, windowDays, limit];
    let paramIndex = 4;

    if (zoneId === 'none') {
      zoneFilter = 'AND zone_id IS NULL';
    } else if (zoneId && zoneId !== 'all') {
      zoneFilter = `AND zone_id = $${paramIndex}`;
      params.push(zoneId);
      paramIndex++;
    }

    const bucketsQuery = `
      WITH active_requests AS (
        SELECT 
          id, 
          COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') as category,
          coordination_intent
        FROM cc_work_requests
        WHERE portal_id = $1
          AND status IN (${activeStatusList})
          AND updated_at >= NOW() - ($2 || ' days')::interval
          ${zoneFilter}
      )
      SELECT 
        category,
        COUNT(*) as active_count,
        COUNT(*) FILTER (WHERE coordination_intent = true) as coord_ready_count,
        ROUND(COUNT(*) FILTER (WHERE coordination_intent = true)::numeric / NULLIF(COUNT(*), 0), 2) as coord_ready_ratio
      FROM active_requests
      GROUP BY category
      ORDER BY coord_ready_count DESC, active_count DESC, category ASC
      LIMIT $3
    `;

    const bucketsResult = await tenantReq.tenantQuery!(bucketsQuery, params);

    res.json({
      ok: true,
      portal_id: portalId,
      zone_id: zoneId === 'none' ? null : (zoneId || null),
      window_days: windowDays,
      buckets: bucketsResult.rows.map(row => ({
        category: row.category,
        active_count: parseInt(row.active_count, 10),
        coord_ready_count: parseInt(row.coord_ready_count, 10),
        coord_ready_ratio: parseFloat(row.coord_ready_ratio) || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching coordination buckets:', error);
    res.status(500).json({ error: 'Failed to fetch coordination buckets' });
  }
});

/**
 * POST /api/work-requests/coordination/suggest-windows
 * Advisory: Suggest schedule windows based on coordination density
 * 
 * No persistence, no Service Run creation, no side effects.
 * Admin/owner only.
 */
router.post('/coordination/suggest-windows', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { 
      portal_id, 
      zone_id, 
      category,
      lookahead_days: lookaheadParam,
      window_size_days: windowSizeParam,
      desired_windows: desiredParam,
    } = req.body;

    if (!portal_id) {
      return res.status(400).json({ error: 'portal_id is required' });
    }

    const roles = tenantReq.ctx?.roles || [];
    const isAdminOrOwner = 
      roles.includes('owner') || 
      roles.includes('admin') || 
      roles.includes('tenant_admin') ||
      !!tenantReq.user?.isPlatformAdmin;
    
    if (!isAdminOrOwner) {
      return res.status(403).json({ 
        error: 'Suggest windows requires admin or owner access',
        code: 'SUGGEST_WINDOWS_ACCESS_DENIED'
      });
    }

    const lookaheadDays = Math.max(7, Math.min(60, parseInt(lookaheadParam) || 21));
    const windowSizeDays = Math.max(1, Math.min(14, parseInt(windowSizeParam) || 3));
    const desiredWindows = Math.max(1, Math.min(5, parseInt(desiredParam) || 3));

    const activeStatusList = ACTIVE_STATUSES.map(s => `'${s}'`).join(',');

    let zoneFilter = '';
    const params: any[] = [portal_id];
    let paramIndex = 2;

    if (zone_id === null || zone_id === 'none') {
      zoneFilter = 'AND zone_id IS NULL';
    } else if (zone_id) {
      zoneFilter = `AND zone_id = $${paramIndex}`;
      params.push(zone_id);
      paramIndex++;
    }

    let categoryFilter = '';
    if (category === 'Uncategorized' || category === 'uncategorized') {
      categoryFilter = `AND (category IS NULL OR TRIM(category) = '')`;
    } else if (category) {
      categoryFilter = `AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    const countsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE coordination_intent = true) as coord_ready_count,
        COUNT(*) as active_count
      FROM cc_work_requests
      WHERE portal_id = $1
        AND status IN (${activeStatusList})
        ${zoneFilter}
        ${categoryFilter}
    `;

    const countsResult = await tenantReq.tenantQuery!(countsQuery, params);
    const coordReadyCount = parseInt(countsResult.rows[0]?.coord_ready_count || '0', 10);
    const activeCount = parseInt(countsResult.rows[0]?.active_count || '0', 10);

    const windows: Array<{
      start_date: string;
      end_date: string;
      coord_ready_count: number;
      active_count: number;
      readiness_ratio: number;
      confidence: number;
      explanation: string;
    }> = [];

    if (activeCount > 0) {
      const today = new Date();
      const spacing = Math.floor(lookaheadDays / (desiredWindows + 1));

      for (let i = 1; i <= desiredWindows; i++) {
        const centerDay = spacing * i;
        const startOffset = centerDay - Math.floor(windowSizeDays / 2);
        const endOffset = startOffset + windowSizeDays - 1;

        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() + Math.max(1, startOffset));
        
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + endOffset);

        const readinessRatio = activeCount > 0 ? coordReadyCount / activeCount : 0;

        let confidence = Math.min(60, coordReadyCount * 10);
        confidence += Math.round(readinessRatio * 30);
        confidence += Math.min(10, Math.floor(activeCount / 5) * 2);
        if (zone_id === null || zone_id === 'none') {
          confidence -= 10;
        }
        confidence = Math.max(0, Math.min(100, confidence));

        let explanation = `${coordReadyCount} coordination-ready out of ${activeCount} active requests`;
        if (zone_id === null || zone_id === 'none') {
          explanation += ' (unzoned area).';
        } else {
          explanation += ' in this zone.';
        }
        explanation += ' Higher readiness increases the chance a scheduled window fills efficiently.';

        windows.push({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          coord_ready_count: coordReadyCount,
          active_count: activeCount,
          readiness_ratio: Math.round(readinessRatio * 100) / 100,
          confidence,
          explanation,
        });
      }
    }

    res.json({
      ok: true,
      portal_id,
      zone_id: zone_id === 'none' ? null : (zone_id || null),
      category: category || null,
      params: {
        lookahead_days: lookaheadDays,
        window_size_days: windowSizeDays,
        desired_windows: desiredWindows,
      },
      windows,
      notes: [
        'Suggestions are advisory only.',
        'Counts are aggregated; no identities are shown.',
        'Actual scheduling depends on contractor availability and constraints.',
      ],
    });
  } catch (error) {
    console.error('Error suggesting coordination windows:', error);
    res.status(500).json({ error: 'Failed to suggest coordination windows' });
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

// ============================================
// MAINTENANCE REQUESTS - Coordination Opt-In
// ============================================

/**
 * PUT /api/work-requests/maintenance/:id/coordination-opt-in
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
 */
router.put('/maintenance/:id/coordination-opt-in', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req: Request, res: Response) => {
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
