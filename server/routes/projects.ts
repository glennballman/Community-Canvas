/**
 * PROJECTS ROUTES - The Actual Job
 * 
 * A Project is ONE record from first contact to final payment.
 * Supports both "New Job" and "I Already Did This Job" (backwards entry) modes.
 * 
 * Endpoints:
 * - GET /api/projects - List projects with status filter
 * - GET /api/projects/:id - Get single project with photos/notes
 * - POST /api/projects - Create new project
 * - PUT /api/projects/:id - Update project
 * - PUT /api/projects/:id/status - Update project status
 * - POST /api/projects/:id/photos - Upload photo
 * - GET /api/projects/:id/photos - Get photos by stage
 * - POST /api/projects/:id/notes - Add note
 * - GET /api/projects/:id/notes - Get notes
 * - POST /api/projects/:id/change-order - Create change order snapshot
 * - POST /api/projects/:id/line-items - Add line item
 * - GET /api/projects/:id/line-items - Get line items
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

// List projects with optional status filter
router.get('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { status, search, contact_id, property_id, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    const whereClauses: string[] = [];
    
    if (status && status !== 'all') {
      whereClauses.push(`p.status = $${paramIndex}::project_status`);
      params.push(status);
      paramIndex++;
    }
    
    if (contact_id) {
      whereClauses.push(`p.contact_id = $${paramIndex}`);
      params.push(contact_id);
      paramIndex++;
    }
    
    if (property_id) {
      whereClauses.push(`p.property_id = $${paramIndex}`);
      params.push(property_id);
      paramIndex++;
    }
    
    if (search) {
      whereClauses.push(`(
        p.title ILIKE $${paramIndex} 
        OR p.description ILIKE $${paramIndex}
        OR c.first_name ILIKE $${paramIndex}
        OR c.last_name ILIKE $${paramIndex}
        OR prop.name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        p.id, p.title, p.description, p.status,
        p.quoted_amount, p.final_amount, p.deposit_required, p.deposit_received,
        p.scheduled_start, p.scheduled_end, p.completed_at,
        p.created_at, p.updated_at,
        c.id as contact_id, c.first_name as contact_first_name, c.last_name as contact_last_name,
        o.id as organization_id, o.name as organization_name,
        prop.id as property_id, prop.name as property_name, prop.address_line1 as property_address,
        (SELECT COUNT(*) FROM project_photos pp WHERE pp.project_id = p.id) as photos_count,
        (SELECT COUNT(*) FROM project_notes pn WHERE pn.project_id = p.id) as notes_count
      FROM projects p
      LEFT JOIN people c ON p.contact_id = c.id
      LEFT JOIN organizations o ON p.organization_id = o.id
      LEFT JOIN crm_properties prop ON p.property_id = prop.id
      ${whereClause}
      ORDER BY 
        CASE WHEN p.status IN ('scheduled', 'in_progress') THEN 0 ELSE 1 END,
        p.scheduled_start ASC NULLS LAST,
        p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'lead') as count_lead,
        COUNT(*) FILTER (WHERE status = 'quote') as count_quote,
        COUNT(*) FILTER (WHERE status = 'approved') as count_approved,
        COUNT(*) FILTER (WHERE status = 'scheduled') as count_scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress') as count_in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as count_completed,
        COUNT(*) FILTER (WHERE status = 'invoiced') as count_invoiced,
        COUNT(*) FILTER (WHERE status = 'paid') as count_paid,
        COUNT(*) FILTER (WHERE status = 'cancelled') as count_cancelled,
        COUNT(*) FILTER (WHERE status = 'warranty') as count_warranty
      FROM projects`,
      []
    );

    const counts = countResult.rows[0];

    res.json({
      projects: result.rows,
      total: parseInt(counts.total, 10),
      counts: {
        lead: parseInt(counts.count_lead, 10),
        quote: parseInt(counts.count_quote, 10),
        approved: parseInt(counts.count_approved, 10),
        scheduled: parseInt(counts.count_scheduled, 10),
        in_progress: parseInt(counts.count_in_progress, 10),
        completed: parseInt(counts.count_completed, 10),
        invoiced: parseInt(counts.count_invoiced, 10),
        paid: parseInt(counts.count_paid, 10),
        cancelled: parseInt(counts.count_cancelled, 10),
        warranty: parseInt(counts.count_warranty, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        p.*,
        c.first_name as contact_first_name, c.last_name as contact_last_name, 
        c.phone as contact_phone, c.email as contact_email,
        o.name as organization_name,
        prop.name as property_name, prop.address_line1 as property_address, prop.city as property_city
      FROM projects p
      LEFT JOIN people c ON p.contact_id = c.id
      LEFT JOIN organizations o ON p.organization_id = o.id
      LEFT JOIN crm_properties prop ON p.property_id = prop.id
      WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get photos grouped by stage
    const photosResult = await tenantReq.tenantQuery!(
      `SELECT * FROM project_photos WHERE project_id = $1 ORDER BY stage, uploaded_at DESC`,
      [id]
    );

    // Get notes
    const notesResult = await tenantReq.tenantQuery!(
      `SELECT * FROM project_notes WHERE project_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Get line items
    const lineItemsResult = await tenantReq.tenantQuery!(
      `SELECT * FROM project_line_items WHERE project_id = $1 ORDER BY sort_order, created_at`,
      [id]
    );

    // Get scope snapshots
    const snapshotsResult = await tenantReq.tenantQuery!(
      `SELECT * FROM project_scope_snapshots WHERE project_id = $1 ORDER BY version DESC`,
      [id]
    );

    res.json({
      project: result.rows[0],
      photos: {
        before: photosResult.rows.filter((p: any) => p.stage === 'before'),
        during: photosResult.rows.filter((p: any) => p.stage === 'during'),
        after: photosResult.rows.filter((p: any) => p.stage === 'after')
      },
      notes: notesResult.rows,
      lineItems: lineItemsResult.rows,
      scopeSnapshots: snapshotsResult.rows
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
// Supports both "New Job" (status=lead) and "I Already Did This Job" (status=completed)
router.post('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';

    const {
      title,
      description,
      contact_id,
      organization_id,
      property_id,
      unit_id,
      location_text,
      status = 'lead',
      quoted_amount,
      final_amount,
      deposit_required,
      deposit_received,
      scheduled_start,
      scheduled_end,
      completed_at,
      warranty_months = 12,
      warranty_notes,
      source,
      settlement_type,
      settlement_notes
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Handle "I Already Did This Job" mode
    const isBackwardsEntry = status === 'completed';
    const actualCompletedAt = isBackwardsEntry ? (completed_at || new Date().toISOString()) : null;
    const warrantyExpires = isBackwardsEntry && warranty_months ? 
      new Date(new Date(actualCompletedAt!).getTime() + (warranty_months * 30 * 24 * 60 * 60 * 1000)) : null;

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO projects (
        tenant_id, title, description,
        contact_id, organization_id, property_id, unit_id, location_text,
        status, quoted_amount, final_amount,
        deposit_required, deposit_received,
        scheduled_start, scheduled_end, completed_at,
        warranty_months, warranty_expires_at, warranty_notes,
        source, settlement_type, settlement_notes,
        created_by_actor_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9::project_status, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        tenantId, title, description || null,
        contact_id || null, organization_id || null, property_id || null, unit_id || null, location_text || null,
        status, quoted_amount || null, final_amount || null,
        deposit_required || null, deposit_received || false,
        scheduled_start || null, scheduled_end || null, actualCompletedAt,
        warranty_months, warrantyExpires, warranty_notes || null,
        source || null, settlement_type || null, settlement_notes || null,
        actorId
      ]
    );

    // Create initial scope snapshot if there's a quoted amount
    if (quoted_amount) {
      await tenantReq.tenantQuery!(
        `INSERT INTO project_scope_snapshots (project_id, version, description, amount, reason, created_by_actor_id)
         VALUES ($1, 1, $2, $3, 'original', $4)`,
        [result.rows[0].id, description || title, quoted_amount, actorId]
      );
    }

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const {
      title,
      description,
      contact_id,
      organization_id,
      property_id,
      unit_id,
      location_text,
      quoted_amount,
      final_amount,
      deposit_required,
      deposit_received,
      deposit_received_at,
      scheduled_start,
      scheduled_end,
      warranty_months,
      warranty_notes,
      settlement_type,
      settlement_notes
    } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE projects SET
        title = COALESCE($2, title),
        description = $3,
        contact_id = $4,
        organization_id = $5,
        property_id = $6,
        unit_id = $7,
        location_text = $8,
        quoted_amount = $9,
        final_amount = $10,
        deposit_required = $11,
        deposit_received = COALESCE($12, deposit_received),
        deposit_received_at = $13,
        scheduled_start = $14,
        scheduled_end = $15,
        warranty_months = COALESCE($16, warranty_months),
        warranty_notes = $17,
        settlement_type = $18,
        settlement_notes = $19
      WHERE id = $1
      RETURNING *`,
      [
        id, title, description, contact_id, organization_id, property_id, unit_id, location_text,
        quoted_amount, final_amount, deposit_required, deposit_received, deposit_received_at,
        scheduled_start, scheduled_end, warranty_months, warranty_notes, settlement_type, settlement_notes
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Update project status with automatic timestamp handling
router.put('/:id/status', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Build dynamic updates based on status
    let additionalUpdates = '';
    const params: any[] = [id, status];
    
    if (status === 'approved') {
      additionalUpdates = ', approved_at = NOW()';
    } else if (status === 'in_progress') {
      additionalUpdates = ', started_at = COALESCE(started_at, NOW())';
    } else if (status === 'completed') {
      additionalUpdates = ', completed_at = COALESCE(completed_at, NOW()), warranty_expires_at = COALESCE(warranty_expires_at, NOW() + (COALESCE(warranty_months, 12) * INTERVAL \'1 month\'))';
    } else if (status === 'invoiced') {
      additionalUpdates = ', invoiced_at = COALESCE(invoiced_at, NOW())';
    } else if (status === 'paid') {
      additionalUpdates = ', paid_at = COALESCE(paid_at, NOW())';
    }

    const result = await tenantReq.tenantQuery!(
      `UPDATE projects SET 
        status = $2::project_status
        ${additionalUpdates}
      WHERE id = $1
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
});

// Add photo to project
router.post('/:id/photos', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const tenantId = tenantReq.ctx!.tenant_id;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';

    const {
      stage,
      storage_key,
      storage_url,
      filename,
      mime_type,
      size_bytes,
      caption,
      taken_at,
      device_info,
      geo_lat,
      geo_lng
    } = req.body;

    if (!stage || !['before', 'during', 'after'].includes(stage)) {
      return res.status(400).json({ error: 'Valid stage (before, during, after) is required' });
    }

    if (!storage_url && !storage_key) {
      return res.status(400).json({ error: 'Either storage_url or storage_key is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO project_photos (
        project_id, tenant_id, stage,
        storage_key, storage_url, filename, mime_type, size_bytes,
        caption, taken_at, device_info, geo_lat, geo_lng,
        uploaded_by_actor_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING *`,
      [
        id, tenantId, stage,
        storage_key || null, storage_url || null, filename || null, mime_type || null, size_bytes || null,
        caption || null, taken_at || null, device_info || null, geo_lat || null, geo_lng || null,
        actorId
      ]
    );

    res.status(201).json({ photo: result.rows[0] });
  } catch (error) {
    console.error('Error adding photo:', error);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// Get photos for project
router.get('/:id/photos', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { stage } = req.query;

    let query = `SELECT * FROM project_photos WHERE project_id = $1`;
    const params: any[] = [id];

    if (stage) {
      query += ` AND stage = $2`;
      params.push(stage);
    }

    query += ` ORDER BY stage, uploaded_at DESC`;

    const result = await tenantReq.tenantQuery!(query, params);

    res.json({ photos: result.rows });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// Add note to project
router.post('/:id/notes', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';
    const { content, note_type = 'note' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO project_notes (project_id, note_type, content, created_by_actor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, note_type, content, actorId]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get notes for project
router.get('/:id/notes', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT * FROM project_notes WHERE project_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create change order (scope snapshot)
router.post('/:id/change-order', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const actorId = tenantReq.ctx!.individual_id || '00000000-0000-0000-0000-000000000000';
    const { description, amount, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'New amount is required for change order' });
    }

    // Get current version
    const versionResult = await tenantReq.tenantQuery!(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM project_scope_snapshots WHERE project_id = $1`,
      [id]
    );
    const nextVersion = versionResult.rows[0].next_version;

    // Create snapshot
    const snapshotResult = await tenantReq.tenantQuery!(
      `INSERT INTO project_scope_snapshots (project_id, version, description, amount, reason, notes, created_by_actor_id)
       VALUES ($1, $2, $3, $4, 'change_order', $5, $6)
       RETURNING *`,
      [id, nextVersion, description || null, amount, notes || null, actorId]
    );

    // Update project quoted amount
    await tenantReq.tenantQuery!(
      `UPDATE projects SET quoted_amount = $2 WHERE id = $1`,
      [id, amount]
    );

    // Add note about change order
    await tenantReq.tenantQuery!(
      `INSERT INTO project_notes (project_id, note_type, content, created_by_actor_id)
       VALUES ($1, 'change_order', $2, $3)`,
      [id, `Change order #${nextVersion}: Amount updated to $${amount}${notes ? `. ${notes}` : ''}`, actorId]
    );

    res.status(201).json({ 
      scopeSnapshot: snapshotResult.rows[0],
      message: 'Change order created' 
    });
  } catch (error) {
    console.error('Error creating change order:', error);
    res.status(500).json({ error: 'Failed to create change order' });
  }
});

// Add line item
router.post('/:id/line-items', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { description, quantity = 1, unit_price, total, sort_order = 0 } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const calculatedTotal = total || (quantity * (unit_price || 0));

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO project_line_items (project_id, description, quantity, unit_price, total, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, description, quantity, unit_price || null, calculatedTotal, sort_order]
    );

    res.status(201).json({ lineItem: result.rows[0] });
  } catch (error) {
    console.error('Error adding line item:', error);
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

// Get line items for project
router.get('/:id/line-items', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT * FROM project_line_items WHERE project_id = $1 ORDER BY sort_order, created_at`,
      [id]
    );

    res.json({ lineItems: result.rows });
  } catch (error) {
    console.error('Error fetching line items:', error);
    res.status(500).json({ error: 'Failed to fetch line items' });
  }
});

// Delete line item
router.delete('/:id/line-items/:lineItemId', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { lineItemId } = req.params;

    const result = await tenantReq.tenantQuery!(
      `DELETE FROM project_line_items WHERE id = $1 RETURNING id`,
      [lineItemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting line item:', error);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

export default router;
