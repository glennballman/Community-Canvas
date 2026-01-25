import { Router, Request, Response } from 'express';
import { TenantRequest } from '../middleware/tenantContext';
import { requireAuth, requireTenant, requireRole } from '../middleware/guards';
import { pool } from '../db';

const router = Router();

interface AuditEventRow {
  id: string;
  created_at: string;
  portal_id: string | null;
  run_id: string;
  actor_type: string;
  actor_tenant_membership_id: string | null;
  negotiation_type: string;
  effective_source: string;
  effective_policy_id: string;
  effective_policy_updated_at: string;
  effective_policy_hash: string;
  request_fingerprint: string;
}

router.get(
  '/',
  requireAuth,
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest;
    try {
      const tenantId = tenantReq.ctx?.tenant_id;
      if (!tenantId) {
        return res.status(401).json({ ok: false, error: 'Tenant context required' });
      }

      const {
        negotiation_type = 'schedule',
        run_id,
        actor_type,
        effective_source,
        policy_hash,
        date_from,
        date_to,
        limit: limitStr = '50',
        offset: offsetStr = '0',
      } = req.query;

      const limit = Math.min(Math.max(1, parseInt(String(limitStr), 10) || 50), 200);
      const offset = Math.max(0, parseInt(String(offsetStr), 10) || 0);

      const conditions: string[] = ['tenant_id = $1'];
      const params: any[] = [tenantId];
      let paramIdx = 2;

      if (negotiation_type) {
        conditions.push(`negotiation_type = $${paramIdx}`);
        params.push(negotiation_type);
        paramIdx++;
      }

      if (run_id) {
        conditions.push(`run_id = $${paramIdx}`);
        params.push(run_id);
        paramIdx++;
      }

      if (actor_type) {
        conditions.push(`actor_type = $${paramIdx}`);
        params.push(actor_type);
        paramIdx++;
      }

      if (effective_source) {
        conditions.push(`effective_source = $${paramIdx}`);
        params.push(effective_source);
        paramIdx++;
      }

      if (policy_hash) {
        conditions.push(`effective_policy_hash = $${paramIdx}`);
        params.push(policy_hash);
        paramIdx++;
      }

      if (date_from) {
        conditions.push(`created_at >= $${paramIdx}`);
        params.push(date_from);
        paramIdx++;
      }

      if (date_to) {
        conditions.push(`created_at <= $${paramIdx}`);
        params.push(date_to);
        paramIdx++;
      }

      const whereClause = conditions.join(' AND ');

      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM cc_negotiation_policy_audit_events WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      params.push(limit);
      params.push(offset);

      const result = await pool.query<AuditEventRow>(
        `SELECT 
          id,
          created_at,
          portal_id,
          run_id,
          actor_type,
          actor_tenant_membership_id,
          negotiation_type,
          effective_source,
          effective_policy_id,
          effective_policy_updated_at,
          effective_policy_hash,
          request_fingerprint
        FROM cc_negotiation_policy_audit_events 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        params
      );

      const items = result.rows.map(row => ({
        id: row.id,
        created_at: row.created_at,
        portal_id: row.portal_id,
        run_id: row.run_id,
        actor_type: row.actor_type,
        actor_tenant_membership_id: row.actor_tenant_membership_id,
        negotiation_type: row.negotiation_type,
        effective_source: row.effective_source,
        effective_policy_id: row.effective_policy_id,
        effective_policy_updated_at: row.effective_policy_updated_at,
        effective_policy_hash: row.effective_policy_hash,
        request_fingerprint: row.request_fingerprint,
      }));

      const hasMore = offset + items.length < total;
      const nextOffset = hasMore ? offset + limit : null;

      return res.json({
        ok: true,
        items,
        total,
        limit,
        offset,
        next_offset: nextOffset,
      });
    } catch (error) {
      console.error('Error fetching negotiation audit events:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch audit events' });
    }
  }
);

router.get(
  '/runs/:id',
  requireAuth,
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest;
    try {
      const tenantId = tenantReq.ctx?.tenant_id;
      if (!tenantId) {
        return res.status(401).json({ ok: false, error: 'Tenant context required' });
      }

      const runId = req.params.id;
      if (!runId) {
        return res.status(400).json({ ok: false, error: 'Run ID required' });
      }

      const result = await pool.query<AuditEventRow>(
        `SELECT 
          id,
          created_at,
          portal_id,
          run_id,
          actor_type,
          actor_tenant_membership_id,
          negotiation_type,
          effective_source,
          effective_policy_id,
          effective_policy_updated_at,
          effective_policy_hash,
          request_fingerprint
        FROM cc_negotiation_policy_audit_events 
        WHERE tenant_id = $1 AND run_id = $2
        ORDER BY created_at DESC
        LIMIT 100`,
        [tenantId, runId]
      );

      const items = result.rows.map(row => ({
        id: row.id,
        created_at: row.created_at,
        portal_id: row.portal_id,
        run_id: row.run_id,
        actor_type: row.actor_type,
        actor_tenant_membership_id: row.actor_tenant_membership_id,
        negotiation_type: row.negotiation_type,
        effective_source: row.effective_source,
        effective_policy_id: row.effective_policy_id,
        effective_policy_updated_at: row.effective_policy_updated_at,
        effective_policy_hash: row.effective_policy_hash,
        request_fingerprint: row.request_fingerprint,
      }));

      return res.json({
        ok: true,
        run_id: runId,
        items,
      });
    } catch (error) {
      console.error('Error fetching run audit events:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch audit events' });
    }
  }
);

export default router;
