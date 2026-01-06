import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/guards';

const router = Router();

const scheduleQuerySchema = z.object({
  resourceIds: z.string().optional(),
  from: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid from date'),
  to: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid to date'),
});

const createEventSchema = z.object({
  resource_id: z.string().uuid(),
  event_type: z.enum(['hold', 'maintenance', 'buffer']),
  starts_at: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid starts_at'),
  ends_at: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid ends_at'),
  title: z.string().optional(),
  notes: z.string().optional(),
  related_entity_type: z.string().optional(),
  related_entity_id: z.string().uuid().optional(),
});

const updateEventSchema = z.object({
  event_type: z.enum(['hold', 'maintenance', 'buffer']).optional(),
  starts_at: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid starts_at').optional(),
  ends_at: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid ends_at').optional(),
  status: z.enum(['active', 'cancelled']).optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

function snapTo15Min(date: Date): Date {
  const minutes = Math.floor(date.getMinutes() / 15) * 15;
  const snapped = new Date(date);
  snapped.setMinutes(minutes, 0, 0);
  return snapped;
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = scheduleQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid query parameters',
        details: parsed.error.errors 
      });
    }

    const { resourceIds, from, to } = parsed.data;
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const resourceIdArray = resourceIds 
      ? resourceIds.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    let query = `
      SELECT 
        e.id,
        e.tenant_id,
        e.resource_id,
        e.event_type,
        e.starts_at,
        e.ends_at,
        e.status,
        e.title,
        e.notes,
        e.related_entity_type,
        e.related_entity_id,
        e.created_at,
        a.name as resource_name,
        a.asset_type as resource_type
      FROM resource_schedule_events e
      JOIN unified_assets a ON a.id = e.resource_id
      WHERE e.tenant_id = $1
        AND e.status = 'active'
        AND e.starts_at < $3
        AND e.ends_at > $2
    `;
    
    const params: any[] = [tenantId, from, to];
    
    if (resourceIdArray.length > 0) {
      query += ` AND e.resource_id = ANY($4::uuid[])`;
      params.push(resourceIdArray);
    }
    
    query += ` ORDER BY e.starts_at`;

    const result = await pool.query(query, params);

    let bookingsQuery = `
      SELECT 
        b.id,
        b.asset_id as resource_id,
        'booked' as event_type,
        b.starts_at,
        b.ends_at,
        'active' as status,
        COALESCE(b.primary_guest_name, 'Booking') as title,
        b.booking_ref as notes,
        'booking' as related_entity_type,
        b.id as related_entity_id,
        b.created_at,
        a.name as resource_name,
        a.asset_type as resource_type
      FROM unified_bookings b
      JOIN unified_assets a ON a.id = b.asset_id
      WHERE (a.owner_tenant_id = $1 OR b.booker_tenant_id = $1)
        AND b.status NOT IN ('cancelled', 'no_show')
        AND b.starts_at < $3
        AND b.ends_at > $2
    `;
    
    const bookingsParams: any[] = [tenantId, from, to];
    
    if (resourceIdArray.length > 0) {
      bookingsQuery += ` AND b.asset_id = ANY($4::uuid[])`;
      bookingsParams.push(resourceIdArray);
    }
    
    bookingsQuery += ` ORDER BY b.starts_at`;

    const bookingsResult = await pool.query(bookingsQuery, bookingsParams);

    const allEvents = [
      ...result.rows,
      ...bookingsResult.rows.map(b => ({
        ...b,
        is_booking: true
      }))
    ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    return res.json({
      success: true,
      events: allEvents,
      query: { from, to, resourceIds: resourceIdArray }
    });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch schedule' });
  }
});

router.post('/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid event data',
        details: parsed.error.errors 
      });
    }

    const tenantId = (req as any).tenantId;
    const individualId = (req as any).user?.individual_id;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const { resource_id, event_type, starts_at, ends_at, title, notes, related_entity_type, related_entity_id } = parsed.data;

    const snappedStart = snapTo15Min(new Date(starts_at));
    const snappedEnd = snapTo15Min(new Date(ends_at));

    if (snappedEnd <= snappedStart) {
      return res.status(400).json({ 
        success: false, 
        error: 'End time must be after start time' 
      });
    }

    const assetCheck = await pool.query(
      `SELECT id FROM unified_assets WHERE id = $1 AND (owner_tenant_id = $2 OR owner_tenant_id IS NULL)`,
      [resource_id, tenantId]
    );

    if (assetCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Resource not found or not accessible' 
      });
    }

    const result = await pool.query(
      `INSERT INTO resource_schedule_events 
        (tenant_id, resource_id, event_type, starts_at, ends_at, title, notes, created_by_actor_id, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenantId, resource_id, event_type, snappedStart, snappedEnd, title || event_type, notes, individualId, related_entity_type, related_entity_id]
    );

    return res.status(201).json({
      success: true,
      event: result.rows[0]
    });
  } catch (error: any) {
    console.error('Schedule event create error:', error);
    
    if (error.message?.includes('valid_15min')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Times must be on 15-minute boundaries' 
      });
    }
    
    return res.status(500).json({ success: false, error: 'Failed to create schedule event' });
  }
});

router.patch('/events/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateEventSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid update data',
        details: parsed.error.errors 
      });
    }

    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const eventCheck = await pool.query(
      `SELECT * FROM resource_schedule_events WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const data = parsed.data;

    if (data.event_type) {
      updates.push(`event_type = $${paramIdx++}`);
      values.push(data.event_type);
    }
    
    if (data.starts_at) {
      const snapped = snapTo15Min(new Date(data.starts_at));
      updates.push(`starts_at = $${paramIdx++}`);
      values.push(snapped);
    }
    
    if (data.ends_at) {
      const snapped = snapTo15Min(new Date(data.ends_at));
      updates.push(`ends_at = $${paramIdx++}`);
      values.push(snapped);
    }
    
    if (data.status) {
      updates.push(`status = $${paramIdx++}`);
      values.push(data.status);
    }
    
    if (data.title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      values.push(data.title);
    }
    
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIdx++}`);
      values.push(data.notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push(`updated_at = now()`);

    values.push(id, tenantId);
    
    const result = await pool.query(
      `UPDATE resource_schedule_events 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}
       RETURNING *`,
      values
    );

    return res.json({
      success: true,
      event: result.rows[0]
    });
  } catch (error: any) {
    console.error('Schedule event update error:', error);
    
    if (error.message?.includes('valid_15min')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Times must be on 15-minute boundaries' 
      });
    }
    
    return res.status(500).json({ success: false, error: 'Failed to update schedule event' });
  }
});

router.delete('/events/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const result = await pool.query(
      `UPDATE resource_schedule_events 
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    return res.json({
      success: true,
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Schedule event delete error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete schedule event' });
  }
});

router.get('/resources', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const result = await pool.query(
      `SELECT 
        id,
        name,
        asset_type,
        status,
        thumbnail_url,
        is_accommodation,
        is_parkable_spot,
        is_equipment
       FROM unified_assets 
       WHERE owner_tenant_id = $1 
         AND status = 'active'
       ORDER BY asset_type, name`,
      [tenantId]
    );

    return res.json({
      success: true,
      resources: result.rows
    });
  } catch (error) {
    console.error('Resources fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch resources' });
  }
});

export default router;
