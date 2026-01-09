import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/guards';

const router = Router();

const capabilityUnitSchema = z.object({
  asset_id: z.string().uuid(),
  name: z.string().min(1),
  capability_type: z.string().min(1),
  status: z.enum(['operational', 'inoperable', 'maintenance']).default('operational'),
  notes: z.string().optional(),
});

const capacitySchema = z.object({
  asset_id: z.string().uuid(),
  capability_unit_id: z.string().uuid().optional().nullable(),
  key: z.string().min(1),
  value_num: z.number().optional().nullable(),
  value_text: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  applies_to: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const constraintSchema = z.object({
  asset_id: z.string().uuid(),
  capability_unit_id: z.string().uuid().optional().nullable(),
  constraint_type: z.string().min(1),
  severity: z.enum(['info', 'warning', 'blocking']).default('info'),
  details: z.string().optional().nullable(),
  active: z.boolean().default(true),
  start_date: z.string().datetime({ offset: true }).optional().nullable(),
  end_date: z.string().datetime({ offset: true }).optional().nullable(),
});

router.get('/assets/:assetId/capability-units', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const result = await req.tenantQuery(`
      SELECT id, asset_id, name, capability_type, status, notes, created_at, updated_at
      FROM cc_asset_capability_units
      WHERE asset_id = $1
      ORDER BY name
    `, [assetId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching capability units:', error);
    res.status(500).json({ error: 'Failed to fetch capability units' });
  }
});

router.post('/capability-units', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = capabilityUnitSchema.parse(req.body);
    
    const capResult = await req.tenantQuery(`
      INSERT INTO cc_asset_capability_units (asset_id, name, capability_type, status, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [data.asset_id, data.name, data.capability_type, data.status, data.notes || null]);
    
    const capUnit = capResult.rows[0];
    
    if (data.status === 'maintenance') {
      await req.tenantQuery(`
        INSERT INTO cc_resource_schedule_events (resource_id, event_type, start_date, end_date, title, notes, status, related_entity_type, related_entity_id)
        VALUES ($1, 'maintenance', NOW(), NOW() + INTERVAL '1 day', $2, 'Auto-created from capability maintenance status', 'active', 'capability_unit', $3)
      `, [data.asset_id, `${data.name} Maintenance`, capUnit.id]);
    }
    
    res.status(201).json(capUnit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating capability unit:', error);
    res.status(500).json({ error: 'Failed to create capability unit' });
  }
});

router.patch('/capability-units/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, capability_type, status, notes } = req.body;
    
    const existing = await req.tenantQuery('SELECT * FROM cc_asset_capability_units WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Capability unit not found' });
    }
    
    const oldStatus = existing.rows[0].status;
    const result = await req.tenantQuery(`
      UPDATE cc_asset_capability_units
      SET name = COALESCE($2, name),
          capability_type = COALESCE($3, capability_type),
          status = COALESCE($4, status),
          notes = COALESCE($5, notes),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, name, capability_type, status, notes]);
    
    if (status === 'maintenance' && oldStatus !== 'maintenance') {
      const assetId = existing.rows[0].asset_id;
      await req.tenantQuery(`
        INSERT INTO cc_resource_schedule_events (resource_id, event_type, start_date, end_date, title, notes, status, related_entity_type, related_entity_id)
        VALUES ($1, 'maintenance', NOW(), NOW() + INTERVAL '7 days', $2, 'Auto-created from capability maintenance status', 'active', 'capability_unit', $3)
      `, [assetId, `${result.rows[0].name} Maintenance`, id]);
    } else if (status !== 'maintenance' && oldStatus === 'maintenance') {
      await req.tenantQuery(`
        UPDATE cc_resource_schedule_events
        SET status = 'cancelled'
        WHERE related_entity_type = 'capability_unit'
          AND related_entity_id = $1
          AND event_type = 'maintenance'
          AND status = 'active'
      `, [id]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating capability unit:', error);
    res.status(500).json({ error: 'Failed to update capability unit' });
  }
});

router.delete('/capability-units/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await req.tenantQuery(`
      UPDATE cc_resource_schedule_events
      SET status = 'cancelled'
      WHERE related_entity_type = 'capability_unit'
        AND related_entity_id = $1
    `, [id]);
    await req.tenantQuery('DELETE FROM cc_asset_capability_units WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting capability unit:', error);
    res.status(500).json({ error: 'Failed to delete capability unit' });
  }
});

router.get('/assets/:assetId/capacities', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const result = await req.tenantQuery(`
      SELECT c.*, cu.name as capability_unit_name
      FROM cc_asset_capacities c
      LEFT JOIN cc_asset_capability_units cu ON c.capability_unit_id = cu.id
      WHERE c.asset_id = $1
      ORDER BY c.key
    `, [assetId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching capacities:', error);
    res.status(500).json({ error: 'Failed to fetch capacities' });
  }
});

router.post('/capacities', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = capacitySchema.parse(req.body);
    const result = await req.tenantQuery(`
      INSERT INTO cc_asset_capacities (asset_id, capability_unit_id, key, value_num, value_text, unit, applies_to, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [data.asset_id, data.capability_unit_id || null, data.key, data.value_num, data.value_text, data.unit, data.applies_to, data.notes]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating capacity:', error);
    res.status(500).json({ error: 'Failed to create capacity' });
  }
});

router.patch('/capacities/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { key, value_num, value_text, unit, applies_to, notes } = req.body;
    const result = await req.tenantQuery(`
      UPDATE cc_asset_capacities
      SET key = COALESCE($2, key),
          value_num = COALESCE($3, value_num),
          value_text = COALESCE($4, value_text),
          unit = COALESCE($5, unit),
          applies_to = COALESCE($6, applies_to),
          notes = COALESCE($7, notes),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, key, value_num, value_text, unit, applies_to, notes]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Capacity not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating capacity:', error);
    res.status(500).json({ error: 'Failed to update capacity' });
  }
});

router.delete('/capacities/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await req.tenantQuery('DELETE FROM cc_asset_capacities WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting capacity:', error);
    res.status(500).json({ error: 'Failed to delete capacity' });
  }
});

router.get('/assets/:assetId/constraints', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const result = await req.tenantQuery(`
      SELECT c.*, cu.name as capability_unit_name
      FROM cc_asset_constraints c
      LEFT JOIN cc_asset_capability_units cu ON c.capability_unit_id = cu.id
      WHERE c.asset_id = $1
      ORDER BY c.severity DESC, c.constraint_type
    `, [assetId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching constraints:', error);
    res.status(500).json({ error: 'Failed to fetch constraints' });
  }
});

router.post('/constraints', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = constraintSchema.parse(req.body);
    
    const startsAt = data.start_date ? new Date(data.start_date) : null;
    const endsAt = data.end_date ? new Date(data.end_date) : null;
    
    const result = await req.tenantQuery(`
      INSERT INTO cc_asset_constraints (asset_id, capability_unit_id, constraint_type, severity, details, active, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.asset_id, 
      data.capability_unit_id || null, 
      data.constraint_type, 
      data.severity, 
      data.details || null, 
      data.active,
      startsAt,
      endsAt
    ]);
    
    if (data.severity === 'blocking' && startsAt && endsAt) {
      await req.tenantQuery(`
        INSERT INTO cc_resource_schedule_events (resource_id, event_type, start_date, end_date, title, notes, status, related_entity_type, related_entity_id)
        VALUES ($1, 'maintenance', $2, $3, $4, $5, 'active', 'constraint', $6)
      `, [
        data.asset_id,
        startsAt,
        endsAt,
        `Block: ${data.constraint_type}`,
        data.details || '',
        result.rows[0].id
      ]);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating constraint:', error);
    res.status(500).json({ error: 'Failed to create constraint' });
  }
});

router.patch('/constraints/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { constraint_type, severity, details, active, start_date, end_date } = req.body;
    
    const startsAt = start_date ? new Date(start_date) : undefined;
    const endsAt = end_date ? new Date(end_date) : undefined;
    
    const result = await req.tenantQuery(`
      UPDATE cc_asset_constraints
      SET constraint_type = COALESCE($2, constraint_type),
          severity = COALESCE($3, severity),
          details = COALESCE($4, details),
          active = COALESCE($5, active),
          start_date = COALESCE($6, start_date),
          end_date = COALESCE($7, end_date),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, constraint_type, severity, details, active, startsAt, endsAt]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Constraint not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating constraint:', error);
    res.status(500).json({ error: 'Failed to update constraint' });
  }
});

router.delete('/constraints/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await req.tenantQuery(`
      UPDATE cc_resource_schedule_events
      SET status = 'cancelled'
      WHERE related_entity_type = 'constraint'
        AND related_entity_id = $1
    `, [id]);
    await req.tenantQuery('DELETE FROM cc_asset_constraints WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting constraint:', error);
    res.status(500).json({ error: 'Failed to delete constraint' });
  }
});

router.get('/check-reservable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { asset_id, capability_unit_id, start_time, end_time } = req.query;
    
    if (!asset_id) {
      return res.status(400).json({ error: 'asset_id is required' });
    }
    
    const startTimeDate = start_time ? new Date(start_time as string) : new Date();
    const endTimeDate = end_time ? new Date(end_time as string) : new Date();
    
    const result = await req.tenantQuery(
      `SELECT * FROM is_resource_reservable($1, $2, $3, $4)`,
      [
        asset_id,
        capability_unit_id || null,
        startTimeDate,
        endTimeDate
      ]
    );
    
    res.json(result.rows[0] || { reservable: true, reason: null });
  } catch (error) {
    console.error('Error checking bookability:', error);
    res.status(500).json({ error: 'Failed to check bookability' });
  }
});

export default router;
