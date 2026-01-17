/**
 * Feature Flags Admin Routes
 * 
 * Service/admin-only endpoints for managing feature flags.
 * These routes require service mode authentication.
 */

import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  try {
    const result = await serviceQuery(`
      SELECT 
        key, is_enabled, scope_type, scope_id, config, description, updated_at, created_at
      FROM cc_feature_flags
      ORDER BY key
    `);

    res.json({
      ok: true,
      flags: result.rows
    });
  } catch (error: any) {
    console.error('[feature-flags] List error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch feature flags'
    });
  }
});

router.get('/:key', async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    const result = await serviceQuery(`
      SELECT 
        key, is_enabled, scope_type, scope_id, config, description, updated_at, created_at
      FROM cc_feature_flags
      WHERE key = $1
    `, [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'FLAG_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      flag: result.rows[0]
    });
  } catch (error: any) {
    console.error('[feature-flags] Get error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch feature flag'
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { key, is_enabled = false, scope_type = 'global', scope_id = null, config = {}, description = null } = req.body;

  if (!key || typeof key !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_KEY',
      message: 'key is required and must be a string'
    });
  }

  if (!['global', 'portal', 'tenant'].includes(scope_type)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_SCOPE_TYPE',
      message: 'scope_type must be global, portal, or tenant'
    });
  }

  try {
    const result = await serviceQuery(`
      INSERT INTO cc_feature_flags (key, is_enabled, scope_type, scope_id, config, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (key) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        scope_type = EXCLUDED.scope_type,
        scope_id = EXCLUDED.scope_id,
        config = EXCLUDED.config,
        description = EXCLUDED.description,
        updated_at = now()
      RETURNING key, is_enabled, scope_type, scope_id, config, description, updated_at
    `, [key, is_enabled, scope_type, scope_id, JSON.stringify(config), description]);

    res.json({
      ok: true,
      flag: result.rows[0]
    });
  } catch (error: any) {
    console.error('[feature-flags] Create/update error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create/update feature flag'
    });
  }
});

router.patch('/:key', async (req: Request, res: Response) => {
  const { key } = req.params;
  const { is_enabled, scope_type, scope_id, config, description } = req.body;

  try {
    const existing = await serviceQuery(`
      SELECT key FROM cc_feature_flags WHERE key = $1
    `, [key]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'FLAG_NOT_FOUND'
      });
    }

    const updates: string[] = ['updated_at = now()'];
    const values: any[] = [];
    let paramCount = 0;

    if (is_enabled !== undefined) {
      paramCount++;
      updates.push(`is_enabled = $${paramCount}`);
      values.push(is_enabled);
    }
    if (scope_type !== undefined) {
      paramCount++;
      updates.push(`scope_type = $${paramCount}`);
      values.push(scope_type);
    }
    if (scope_id !== undefined) {
      paramCount++;
      updates.push(`scope_id = $${paramCount}`);
      values.push(scope_id);
    }
    if (config !== undefined) {
      paramCount++;
      updates.push(`config = $${paramCount}`);
      values.push(JSON.stringify(config));
    }
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }

    paramCount++;
    values.push(key);

    const result = await serviceQuery(`
      UPDATE cc_feature_flags
      SET ${updates.join(', ')}
      WHERE key = $${paramCount}
      RETURNING key, is_enabled, scope_type, scope_id, config, description, updated_at
    `, values);

    res.json({
      ok: true,
      flag: result.rows[0]
    });
  } catch (error: any) {
    console.error('[feature-flags] Update error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update feature flag'
    });
  }
});

router.delete('/:key', async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    const result = await serviceQuery(`
      DELETE FROM cc_feature_flags WHERE key = $1 RETURNING key
    `, [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'FLAG_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      deleted: key
    });
  } catch (error: any) {
    console.error('[feature-flags] Delete error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete feature flag'
    });
  }
});

export default router;
