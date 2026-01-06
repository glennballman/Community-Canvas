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
        OR c.first_name ILIKE $${paramIndex}
        OR c.last_name ILIKE $${paramIndex}
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
        c.id as contact_id, c.first_name as contact_first_name, c.last_name as contact_last_name,
        p.id as property_id, p.name as property_name, p.address_line1 as property_address,
        (SELECT COUNT(*) FROM work_request_notes wn WHERE wn.work_request_id = wr.id) as notes_count
      FROM work_requests wr
      LEFT JOIN crm_contacts c ON wr.contact_id = c.id
      LEFT JOIN crm_properties p ON wr.property_id = p.id
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
        COUNT(*) FILTER (WHERE status = 'converted') as count_converted,
        COUNT(*) FILTER (WHERE status = 'closed') as count_closed,
        COUNT(*) FILTER (WHERE status = 'spam') as count_spam
      FROM work_requests wr
      LEFT JOIN crm_contacts c ON wr.contact_id = c.id`,
      []
    );

    res.json({
      workRequests: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      counts: {
        new: parseInt(countResult.rows[0].count_new, 10),
        contacted: parseInt(countResult.rows[0].count_contacted, 10),
        quoted: parseInt(countResult.rows[0].count_quoted, 10),
        converted: parseInt(countResult.rows[0].count_converted, 10),
        closed: parseInt(countResult.rows[0].count_closed, 10),
        spam: parseInt(countResult.rows[0].count_spam, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching work requests:', error);
    res.status(500).json({ error: 'Failed to fetch work requests' });
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
        c.first_name as contact_first_name, c.last_name as contact_last_name, 
        c.phone as contact_phone, c.email as contact_email,
        o.name as organization_name,
        p.name as property_name, p.address_line1 as property_address, p.city as property_city
      FROM work_requests wr
      LEFT JOIN crm_contacts c ON wr.contact_id = c.id
      LEFT JOIN crm_organizations o ON wr.organization_id = o.id
      LEFT JOIN crm_properties p ON wr.property_id = p.id
      WHERE wr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const notesResult = await tenantReq.tenantQuery!(
      `SELECT * FROM work_request_notes WHERE work_request_id = $1 ORDER BY created_at DESC`,
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
      contact_id,
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
      `INSERT INTO work_requests (
        tenant_id, contact_channel_value, contact_channel_type, contact_channel_notes,
        contact_id, organization_id, property_id, unit_id, location_text,
        summary, description, category, priority, source, referral_source,
        created_by_actor_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *`,
      [
        tenantId, contact_channel_value, contact_channel_type, contact_channel_notes || null,
        contact_id || null, organization_id || null, property_id || null, unit_id || null, location_text || null,
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
      contact_id,
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
      `UPDATE work_requests SET
        contact_channel_value = COALESCE($2, contact_channel_value),
        contact_channel_type = COALESCE($3, contact_channel_type),
        contact_channel_notes = $4,
        contact_id = $5,
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
        contact_id, organization_id, property_id, unit_id, location_text,
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

// Convert work request to project
router.post('/:id/convert', requireAuth, requireTenant, async (req: Request, res: Response) => {
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
      `SELECT * FROM work_requests WHERE id = $1`,
      [id]
    );

    if (wrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const wr = wrResult.rows[0];

    if (wr.status === 'converted') {
      return res.status(400).json({ error: 'Work request already converted' });
    }

    // Create the project
    const projectResult = await tenantReq.tenantQuery!(
      `INSERT INTO projects (
        tenant_id, title, description, contact_id, organization_id, property_id, unit_id, location_text,
        status, quoted_amount, scheduled_start, source_work_request_id, source, created_by_actor_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::project_status, $10, $11, $12, 'work_request', $13
      ) RETURNING *`,
      [
        tenantId,
        title || wr.summary || `Project from Work Request`,
        description || wr.description,
        wr.contact_id,
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

    // Update work request status to converted
    await tenantReq.tenantQuery!(
      `UPDATE work_requests SET 
        status = 'converted',
        converted_to_project_id = $2,
        converted_at = NOW(),
        converted_by_actor_id = $3
      WHERE id = $1`,
      [id, project.id, actorId]
    );

    res.status(201).json({ 
      project,
      message: 'Work request converted to project'
    });
  } catch (error) {
    console.error('Error converting work request:', error);
    res.status(500).json({ error: 'Failed to convert work request' });
  }
});

// Close work request
router.post('/:id/close', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { reason, mark_as_spam = false } = req.body;

    const status = mark_as_spam ? 'spam' : 'closed';

    const result = await tenantReq.tenantQuery!(
      `UPDATE work_requests SET 
        status = $2::work_request_status,
        closed_reason = $3
      WHERE id = $1
      RETURNING *`,
      [id, status, reason || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    res.json({ workRequest: result.rows[0] });
  } catch (error) {
    console.error('Error closing work request:', error);
    res.status(500).json({ error: 'Failed to close work request' });
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
      `INSERT INTO work_request_notes (work_request_id, content, created_by_actor_id)
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
      `SELECT * FROM work_request_notes WHERE work_request_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

export default router;
