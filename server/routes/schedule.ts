import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';
import { authenticateToken } from './foundation';

const router = Router();

// Apply JWT authentication to all schedule routes
// This sets req.user which tenantContext then uses to set req.ctx.individual_id
router.use(authenticateToken);

router.use((req, res, next) => {
  next();
});

function getTenantId(req: Request): string | null {
  const tenantReq = req as TenantRequest;
  return tenantReq.ctx?.tenant_id || null;
}

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

interface ConflictBlock {
  id: string;
  type: 'booking' | 'schedule_event';
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

async function checkTimeConflicts(
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  excludeEventId?: string
): Promise<ConflictBlock[]> {
  const conflicts: ConflictBlock[] = [];

  let scheduleQuery = `
    SELECT id, event_type, title, starts_at, ends_at
    FROM resource_schedule_events
    WHERE resource_id = $1
      AND status = 'active'
      AND starts_at < $3
      AND ends_at > $2
  `;
  const scheduleParams: any[] = [resourceId, startsAt, endsAt];
  
  if (excludeEventId) {
    scheduleQuery += ` AND id != $4`;
    scheduleParams.push(excludeEventId);
  }

  const scheduleResult = await pool.query(scheduleQuery, scheduleParams);
  for (const row of scheduleResult.rows) {
    conflicts.push({
      id: row.id,
      type: 'schedule_event',
      event_type: row.event_type,
      title: row.title || row.event_type,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
    });
  }

  const bookingsResult = await pool.query(`
    SELECT b.id, 'booked' as event_type, 
           COALESCE(b.primary_guest_name, 'Booking') as title,
           b.starts_at, b.ends_at
    FROM unified_bookings b
    WHERE b.asset_id = $1
      AND b.status NOT IN ('cancelled', 'no_show')
      AND b.starts_at < $3
      AND b.ends_at > $2
  `, [resourceId, startsAt, endsAt]);

  for (const row of bookingsResult.rows) {
    conflicts.push({
      id: row.id,
      type: 'booking',
      event_type: row.event_type,
      title: row.title,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
    });
  }

  return conflicts;
}

export async function checkMaintenanceConflict(
  assetId: string,
  startsAt: Date,
  endsAt: Date
): Promise<{ hasConflict: boolean; conflicts: ConflictBlock[] }> {
  const result = await pool.query(`
    SELECT id, event_type, title, starts_at, ends_at
    FROM resource_schedule_events
    WHERE resource_id = $1
      AND event_type = 'maintenance'
      AND status = 'active'
      AND starts_at < $3
      AND ends_at > $2
  `, [assetId, startsAt, endsAt]);

  const conflicts: ConflictBlock[] = result.rows.map(row => ({
    id: row.id,
    type: 'schedule_event' as const,
    event_type: row.event_type,
    title: row.title || 'Maintenance',
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  }));

  return { hasConflict: conflicts.length > 0, conflicts };
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
    const tenantId = getTenantId(req);
    
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

    const tenantId = getTenantId(req);
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    
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

    const conflicts = await checkTimeConflicts(resource_id, snappedStart, snappedEnd);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'That time is already booked out.',
        code: 'RESOURCE_TIME_CONFLICT',
        conflict_with: conflicts,
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

    const tenantId = getTenantId(req);
    
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

    const existingEvent = eventCheck.rows[0];
    const checkStart = data.starts_at ? snapTo15Min(new Date(data.starts_at)) : new Date(existingEvent.starts_at);
    const checkEnd = data.ends_at ? snapTo15Min(new Date(data.ends_at)) : new Date(existingEvent.ends_at);
    
    const conflicts = await checkTimeConflicts(existingEvent.resource_id, checkStart, checkEnd, id);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'That time is already booked out.',
        code: 'RESOURCE_TIME_CONFLICT',
        conflict_with: conflicts,
      });
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
    const tenantId = getTenantId(req);
    
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
    const tenantReq = req as TenantRequest;
    const tenantId = getTenantId(req);
    const { type, includeInactive, search, includeCapabilities } = req.query;
    
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    let query = `
      SELECT 
        a.id,
        a.name,
        a.asset_type,
        a.status,
        a.thumbnail_url,
        a.is_accommodation,
        a.is_parkable_spot,
        a.is_equipment,
        a.source_table,
        NULL as parent_asset_id,
        NULL as capability_type,
        NULL as capability_status,
        false as is_capability_unit,
        CASE WHEN EXISTS (
          SELECT 1 FROM resource_schedule_events e
          WHERE e.resource_id = a.id
            AND e.event_type = 'maintenance'
            AND e.status = 'active'
            AND e.starts_at <= now()
            AND e.ends_at > now()
        ) THEN true ELSE false END as is_under_maintenance
       FROM unified_assets a
       WHERE a.owner_tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (includeInactive !== 'true') {
      query += ` AND a.status = 'active'`;
    }

    if (type) {
      const types = (type as string).split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        query += ` AND a.asset_type = ANY($${paramIdx}::text[])`;
        params.push(types);
        paramIdx++;
      }
    }

    if (search) {
      query += ` AND a.name ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += ` ORDER BY a.asset_type, a.name`;

    const result = await pool.query(query, params);
    
    let capabilityUnitsMap: Record<string, any[]> = {};
    if (includeCapabilities === 'true') {
      const assetIds = result.rows.map(r => r.id);
      if (assetIds.length > 0) {
        const capQuery = await pool.query(`
          SELECT 
            cu.id,
            cu.name,
            cu.capability_type,
            cu.status as capability_status,
            cu.asset_id as parent_asset_id,
            cu.notes,
            true as is_capability_unit,
            'capability' as asset_type,
            NULL as source_table,
            NULL as thumbnail_url,
            false as is_accommodation,
            false as is_parkable_spot,
            false as is_equipment,
            CASE 
              WHEN cu.status != 'operational' THEN true
              WHEN EXISTS (
                SELECT 1 FROM asset_constraints c
                WHERE c.capability_unit_id = cu.id
                  AND c.severity = 'blocking'
                  AND c.active = true
                  AND (c.starts_at IS NULL OR c.starts_at <= now())
                  AND (c.ends_at IS NULL OR c.ends_at >= now())
              ) THEN true
              ELSE false 
            END as is_under_maintenance
          FROM asset_capability_units cu
          WHERE cu.asset_id = ANY($1::uuid[])
          ORDER BY cu.name
        `, [assetIds]);
        
        for (const cap of capQuery.rows) {
          if (!capabilityUnitsMap[cap.parent_asset_id]) {
            capabilityUnitsMap[cap.parent_asset_id] = [];
          }
          capabilityUnitsMap[cap.parent_asset_id].push(cap);
        }
      }
    }

    const resourcesWithChildren = result.rows.map(asset => ({
      ...asset,
      capability_units: capabilityUnitsMap[asset.id] || [],
    }));

    const flatResources: any[] = [];
    for (const asset of resourcesWithChildren) {
      flatResources.push(asset);
      for (const cap of asset.capability_units) {
        flatResources.push({
          ...cap,
          indent_level: 1,
        });
      }
    }

    const grouped: Record<string, typeof result.rows> = {};
    for (const row of result.rows) {
      const type = row.asset_type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        ...row,
        capability_units: capabilityUnitsMap[row.id] || [],
      });
    }

    return res.json({
      success: true,
      resources: flatResources,
      grouped,
      asset_types: Object.keys(grouped).sort(),
    });
  } catch (error) {
    console.error('Resources fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch resources' });
  }
});

// ============================================================================
// BOOKINGS ENDPOINTS
// ============================================================================

const createBookingSchema = z.object({
  asset_id: z.string().uuid(),
  primary_guest_name: z.string().min(1, 'Guest name is required'),
  primary_guest_email: z.string().email().optional(),
  primary_guest_phone: z.string().optional(),
  starts_at: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid starts_at'),
  ends_at: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid ends_at'),
  num_guests: z.number().int().positive().optional(),
  special_requests: z.string().optional(),
  status: z.enum(['pending', 'confirmed']).optional(),
});

// GET /api/schedule/bookings - Get tenant bookings
router.get('/bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const { from, to, status, assetId } = req.query;

    let query = `
      SELECT 
        b.id,
        b.booking_ref,
        b.asset_id,
        a.name as asset_name,
        a.asset_type,
        b.primary_guest_name,
        b.primary_guest_email,
        b.primary_guest_phone,
        b.num_guests,
        b.starts_at,
        b.ends_at,
        b.status,
        b.payment_status,
        b.total,
        b.special_requests,
        b.created_at
      FROM unified_bookings b
      JOIN unified_assets a ON a.id = b.asset_id
      WHERE a.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIdx = 1;

    if (from) {
      paramIdx++;
      query += ` AND b.starts_at >= $${paramIdx}`;
      params.push(from);
    }
    if (to) {
      paramIdx++;
      query += ` AND b.ends_at <= $${paramIdx}`;
      params.push(to);
    }
    if (status) {
      paramIdx++;
      query += ` AND b.status = $${paramIdx}`;
      params.push(status);
    }
    if (assetId) {
      paramIdx++;
      query += ` AND b.asset_id = $${paramIdx}`;
      params.push(assetId);
    }

    query += ' ORDER BY b.starts_at DESC';

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      bookings: result.rows,
    });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

// POST /api/schedule/bookings - Create booking
router.post('/bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid booking data',
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;
    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(data.ends_at);

    if (endsAt <= startsAt) {
      return res.status(400).json({ 
        success: false, 
        error: 'End time must be after start time' 
      });
    }

    // Verify asset belongs to tenant
    const assetCheck = await pool.query(
      'SELECT id, name FROM unified_assets WHERE id = $1 AND tenant_id = $2',
      [data.asset_id, tenantId]
    );
    if (assetCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    // Check for conflicts
    const conflicts = await checkTimeConflicts(data.asset_id, startsAt, endsAt);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Time conflict with existing booking or event',
        conflicts 
      });
    }

    // Create booking
    const result = await pool.query(`
      INSERT INTO unified_bookings (
        asset_id,
        primary_guest_name,
        primary_guest_email,
        primary_guest_phone,
        starts_at,
        ends_at,
        num_guests,
        special_requests,
        status,
        booking_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'direct')
      RETURNING *
    `, [
      data.asset_id,
      data.primary_guest_name,
      data.primary_guest_email || null,
      data.primary_guest_phone || null,
      startsAt,
      endsAt,
      data.num_guests || 1,
      data.special_requests || null,
      data.status || 'pending'
    ]);

    return res.status(201).json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error) {
    console.error('Booking create error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

// PUT /api/schedule/bookings/:id/status - Update booking status
router.put('/bookings/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Verify booking belongs to tenant's asset
    const booking = await pool.query(`
      SELECT b.id FROM unified_bookings b
      JOIN unified_assets a ON a.id = b.asset_id
      WHERE b.id = $1 AND a.tenant_id = $2
    `, [id, tenantId]);

    if (booking.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const updateFields: string[] = ['status = $2'];
    const params: any[] = [id, status];

    if (status === 'cancelled') {
      updateFields.push('cancelled_at = now()');
    }

    const result = await pool.query(`
      UPDATE unified_bookings 
      SET ${updateFields.join(', ')}, updated_at = now()
      WHERE id = $1
      RETURNING *
    `, params);

    return res.json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error) {
    console.error('Booking status update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update booking' });
  }
});

export default router;
