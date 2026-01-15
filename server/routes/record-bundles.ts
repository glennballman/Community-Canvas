import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';

const router = Router();

const createBundleSchema = z.object({
  bundleType: z.enum([
    'incident_defence',
    'emergency_response',
    'employment_action',
    'chargeback_dispute',
    'contract_dispute',
    'general_legal'
  ]),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  visibility: z.enum(['owner_only', 'legal_team', 'explicit_delegates']).optional(),
  incidentId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  chargebackCaseId: z.string().uuid().optional(),
});

const createNoteSchema = z.object({
  scope: z.enum([
    'incident',
    'bundle',
    'worker',
    'facility',
    'asset',
    'contract',
    'work_order',
    'general'
  ]),
  title: z.string().max(500).optional(),
  noteText: z.string().min(1).max(50000),
  visibility: z.enum(['internal', 'owner_only', 'legal_only']).optional(),
  occurredAt: z.string().datetime().optional(),
  incidentId: z.string().uuid().optional(),
  bundleId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
});

/**
 * Helper to set GUCs for RLS and ensure cleanup
 */
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

/**
 * Check if current user is tenant owner/admin
 */
async function isOwnerOrAdmin(client: any, tenantId: string, individualId: string): Promise<boolean> {
  const result = await client.query(`
    SELECT 1 FROM cc_individual_memberships 
    WHERE tenant_id = $1 
      AND individual_id = $2 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    LIMIT 1
  `, [tenantId, individualId]);
  return result.rows.length > 0;
}

/**
 * GET /api/record-bundles
 * List bundles visible to the current user under RLS
 */
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    await setRlsContext(client, ctx);

    const { incidentId, workerId, status } = req.query;
    
    let sql = `
      SELECT 
        rb.id,
        rb.tenant_id,
        rb.bundle_type,
        rb.title,
        rb.description,
        rb.status,
        rb.visibility,
        rb.incident_id,
        rb.worker_id,
        rb.created_at,
        rb.sealed_at,
        rb.created_by_individual_id,
        (SELECT COUNT(*) FROM cc_record_bundle_artifacts WHERE bundle_id = rb.id) as artifact_count,
        (SELECT COUNT(*) FROM cc_contemporaneous_notes WHERE bundle_id = rb.id) as note_count
      FROM cc_record_bundles rb
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (incidentId) {
      sql += ` AND rb.incident_id = $${paramIndex}`;
      params.push(incidentId);
      paramIndex++;
    }

    if (workerId) {
      sql += ` AND rb.worker_id = $${paramIndex}`;
      params.push(workerId);
      paramIndex++;
    }

    if (status) {
      sql += ` AND rb.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY rb.created_at DESC LIMIT 100`;

    const result = await client.query(sql, params);

    res.json({
      bundles: result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        bundleType: row.bundle_type,
        title: row.title,
        description: row.description,
        status: row.status,
        visibility: row.visibility,
        incidentId: row.incident_id,
        workerId: row.worker_id,
        createdAt: row.created_at,
        sealedAt: row.sealed_at,
        createdByIndividualId: row.created_by_individual_id,
        artifactCount: parseInt(row.artifact_count),
        noteCount: parseInt(row.note_count),
      })),
    });
  } catch (error) {
    console.error('Error listing record bundles:', error);
    res.status(500).json({ error: 'Failed to list record bundles' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * GET /api/record-bundles/:id
 * Get bundle details including artifacts and ACL (redacts grantee identities unless owner/admin)
 */
router.get('/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    await setRlsContext(client, ctx);

    const { id } = req.params;

    const bundleResult = await client.query(`
      SELECT 
        rb.*,
        i.display_name as created_by_name
      FROM cc_record_bundles rb
      LEFT JOIN cc_individuals i ON i.id = rb.created_by_individual_id
      WHERE rb.id = $1
    `, [id]);

    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const bundle = bundleResult.rows[0];
    
    // Check if user is owner/admin to determine ACL visibility
    const canSeeAclDetails = ctx.individual_id && 
      await isOwnerOrAdmin(client, ctx.tenant_id, ctx.individual_id);

    const artifactsResult = await client.query(`
      SELECT id, artifact_type, file_name, content_type, byte_size, hash, created_at
      FROM cc_record_bundle_artifacts
      WHERE bundle_id = $1
      ORDER BY created_at ASC
    `, [id]);

    // ACL query - only return full details for owner/admin
    let aclData: any[] = [];
    if (canSeeAclDetails) {
      const aclResult = await client.query(`
        SELECT 
          acl.id,
          acl.scope,
          acl.is_active,
          acl.expires_at,
          acl.created_at,
          acl.grantee_individual_id,
          acl.grantee_circle_id,
          CASE 
            WHEN acl.grantee_individual_id IS NOT NULL THEN 'individual'
            WHEN acl.grantee_circle_id IS NOT NULL THEN 'circle'
          END as grantee_type,
          i.display_name as grantee_name,
          c.name as circle_name
        FROM cc_record_bundle_acl acl
        LEFT JOIN cc_individuals i ON i.id = acl.grantee_individual_id
        LEFT JOIN cc_coordination_circles c ON c.id = acl.grantee_circle_id
        WHERE acl.bundle_id = $1 AND acl.is_active = true
        ORDER BY acl.created_at DESC
      `, [id]);
      
      aclData = aclResult.rows.map((row: any) => ({
        id: row.id,
        granteeType: row.grantee_type,
        granteeIndividualId: row.grantee_individual_id,
        granteeCircleId: row.grantee_circle_id,
        granteeName: row.grantee_name || row.circle_name,
        scope: row.scope,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
    } else {
      // Redacted ACL - just show count
      const aclCountResult = await client.query(`
        SELECT COUNT(*) as count FROM cc_record_bundle_acl 
        WHERE bundle_id = $1 AND is_active = true
      `, [id]);
      aclData = [{ redacted: true, activeCount: parseInt(aclCountResult.rows[0].count) }];
    }

    const notesResult = await client.query(`
      SELECT 
        n.id,
        n.scope,
        n.title,
        n.note_text,
        n.visibility,
        n.occurred_at,
        n.created_at,
        n.is_locked,
        i.display_name as created_by_name
      FROM cc_contemporaneous_notes n
      LEFT JOIN cc_individuals i ON i.id = n.created_by_individual_id
      WHERE n.bundle_id = $1
      ORDER BY n.occurred_at ASC
    `, [id]);

    res.json({
      bundle: {
        id: bundle.id,
        tenantId: bundle.tenant_id,
        bundleType: bundle.bundle_type,
        title: bundle.title,
        description: bundle.description,
        status: bundle.status,
        visibility: bundle.visibility,
        incidentId: bundle.incident_id,
        workerId: bundle.worker_id,
        contractId: bundle.contract_id,
        workOrderId: bundle.work_order_id,
        chargebackCaseId: bundle.chargeback_case_id,
        bundleHash: bundle.bundle_hash,
        bundleHashAlg: bundle.bundle_hash_alg,
        createdAt: bundle.created_at,
        sealedAt: bundle.sealed_at,
        revokedAt: bundle.revoked_at,
        createdByIndividualId: bundle.created_by_individual_id,
        createdByName: bundle.created_by_name,
      },
      artifacts: artifactsResult.rows.map((row: any) => ({
        id: row.id,
        artifactType: row.artifact_type,
        fileName: row.file_name,
        contentType: row.content_type,
        byteSize: row.byte_size,
        hash: row.hash,
        createdAt: row.created_at,
      })),
      acl: aclData,
      notes: notesResult.rows.map((row: any) => ({
        id: row.id,
        scope: row.scope,
        title: row.title,
        noteText: row.note_text,
        visibility: row.visibility,
        occurredAt: row.occurred_at,
        createdAt: row.created_at,
        isLocked: row.is_locked,
        createdByName: row.created_by_name,
      })),
    });
  } catch (error) {
    console.error('Error getting record bundle:', error);
    res.status(500).json({ error: 'Failed to get record bundle' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * POST /api/record-bundles
 * Create a new draft bundle
 */
router.post('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id || !ctx?.individual_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = createBundleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    const scopeCount = [
      data.incidentId,
      data.workerId,
      data.contractId,
      data.workOrderId,
      data.chargebackCaseId
    ].filter(Boolean).length;

    if (scopeCount !== 1) {
      return res.status(400).json({ 
        error: 'Exactly one scope must be specified (incidentId, workerId, contractId, workOrderId, or chargebackCaseId)' 
      });
    }

    await client.query('BEGIN');
    await setRlsContext(client, ctx);

    const result = await client.query(`
      INSERT INTO cc_record_bundles (
        tenant_id,
        portal_id,
        circle_id,
        bundle_type,
        title,
        description,
        visibility,
        incident_id,
        worker_id,
        contract_id,
        work_order_id,
        chargeback_case_id,
        created_by_individual_id
      ) VALUES (
        current_tenant_id(),
        current_portal_id(),
        current_circle_id(),
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        current_individual_id()
      )
      RETURNING id, created_at
    `, [
      data.bundleType,
      data.title,
      data.description || null,
      data.visibility || 'owner_only',
      data.incidentId || null,
      data.workerId || null,
      data.contractId || null,
      data.workOrderId || null,
      data.chargebackCaseId || null,
    ]);

    const bundleId = result.rows[0].id;

    await client.query('COMMIT');

    await serviceQuery(`
      INSERT INTO cc_folio_ledger (
        tenant_id,
        individual_id,
        action,
        entity_type,
        entity_id,
        payload,
        created_at
      ) VALUES (
        $1, $2, 'record_bundle.create', 'record_bundle', $3, $4, now()
      )
    `, [
      ctx.tenant_id,
      ctx.individual_id,
      bundleId,
      JSON.stringify({ bundleType: data.bundleType, title: data.title }),
    ]);

    res.status(201).json({
      id: bundleId,
      createdAt: result.rows[0].created_at,
      status: 'draft',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating record bundle:', error);
    res.status(500).json({ error: 'Failed to create record bundle' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * POST /api/record-bundles/:id/seal
 * Seal a bundle and lock linked contemporaneous notes
 */
router.post('/:id/seal', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id || !ctx?.individual_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    await client.query('BEGIN');
    await setRlsContext(client, ctx);

    const checkResult = await client.query(`
      SELECT id, status FROM cc_record_bundles WHERE id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bundle not found' });
    }

    if (checkResult.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Cannot seal bundle with status '${checkResult.rows[0].status}'` 
      });
    }

    await client.query(`
      UPDATE cc_record_bundles
      SET status = 'sealed', sealed_at = now()
      WHERE id = $1
    `, [id]);

    const lockedNotes = await client.query(`
      UPDATE cc_contemporaneous_notes
      SET is_locked = true, locked_at = now()
      WHERE bundle_id = $1 AND is_locked = false
      RETURNING id
    `, [id]);

    await client.query('COMMIT');

    await serviceQuery(`
      INSERT INTO cc_folio_ledger (
        tenant_id,
        individual_id,
        action,
        entity_type,
        entity_id,
        payload,
        created_at
      ) VALUES (
        $1, $2, 'record_bundle.seal', 'record_bundle', $3, $4, now()
      )
    `, [
      ctx.tenant_id,
      ctx.individual_id,
      id,
      JSON.stringify({ notesLocked: lockedNotes.rows.length }),
    ]);

    res.json({
      sealed: true,
      sealedAt: new Date().toISOString(),
      notesLocked: lockedNotes.rows.length,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error sealing record bundle:', error);
    res.status(500).json({ error: 'Failed to seal record bundle' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * POST /api/record-bundles/notes
 * Create a contemporaneous note
 */
router.post('/notes', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id || !ctx?.individual_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    if (data.scope === 'incident' && !data.incidentId) {
      return res.status(400).json({ error: 'incidentId required for incident scope' });
    }
    if (data.scope === 'bundle' && !data.bundleId) {
      return res.status(400).json({ error: 'bundleId required for bundle scope' });
    }
    if (data.scope === 'worker' && !data.workerId) {
      return res.status(400).json({ error: 'workerId required for worker scope' });
    }

    await client.query('BEGIN');
    await setRlsContext(client, ctx);

    if (data.bundleId) {
      const bundleCheck = await client.query(`
        SELECT status FROM cc_record_bundles WHERE id = $1
      `, [data.bundleId]);
      
      if (bundleCheck.rows.length > 0 && bundleCheck.rows[0].status === 'sealed') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot add notes to a sealed bundle' });
      }
    }

    const result = await client.query(`
      INSERT INTO cc_contemporaneous_notes (
        tenant_id,
        portal_id,
        circle_id,
        scope,
        title,
        note_text,
        visibility,
        occurred_at,
        incident_id,
        bundle_id,
        worker_id,
        facility_id,
        asset_id,
        contract_id,
        work_order_id,
        created_by_individual_id
      ) VALUES (
        current_tenant_id(),
        current_portal_id(),
        current_circle_id(),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        current_individual_id()
      )
      RETURNING id, created_at, occurred_at
    `, [
      data.scope,
      data.title || null,
      data.noteText,
      data.visibility || 'internal',
      data.occurredAt ? new Date(data.occurredAt) : new Date(),
      data.incidentId || null,
      data.bundleId || null,
      data.workerId || null,
      data.facilityId || null,
      data.assetId || null,
      data.contractId || null,
      data.workOrderId || null,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
      occurredAt: result.rows[0].occurred_at,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating contemporaneous note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

/**
 * GET /api/record-bundles/notes
 * List notes by scope
 */
router.get('/notes', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    await setRlsContext(client, ctx);

    const { incidentId, bundleId, workerId, scope } = req.query;

    let sql = `
      SELECT 
        n.id,
        n.scope,
        n.title,
        n.note_text,
        n.visibility,
        n.occurred_at,
        n.created_at,
        n.is_locked,
        n.created_by_individual_id,
        i.display_name as created_by_name
      FROM cc_contemporaneous_notes n
      LEFT JOIN cc_individuals i ON i.id = n.created_by_individual_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (incidentId) {
      sql += ` AND n.incident_id = $${paramIndex}`;
      params.push(incidentId);
      paramIndex++;
    }

    if (bundleId) {
      sql += ` AND n.bundle_id = $${paramIndex}`;
      params.push(bundleId);
      paramIndex++;
    }

    if (workerId) {
      sql += ` AND n.worker_id = $${paramIndex}`;
      params.push(workerId);
      paramIndex++;
    }

    if (scope) {
      sql += ` AND n.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }

    sql += ` ORDER BY n.occurred_at DESC LIMIT 200`;

    const result = await client.query(sql, params);

    res.json({
      notes: result.rows.map((row: any) => ({
        id: row.id,
        scope: row.scope,
        title: row.title,
        noteText: row.note_text,
        visibility: row.visibility,
        occurredAt: row.occurred_at,
        createdAt: row.created_at,
        isLocked: row.is_locked,
        createdByIndividualId: row.created_by_individual_id,
        createdByName: row.created_by_name,
      })),
    });
  } catch (error) {
    console.error('Error listing notes:', error);
    res.status(500).json({ error: 'Failed to list notes' });
  } finally {
    await clearRlsContext(client).catch(() => {});
    client.release();
  }
});

export default router;
