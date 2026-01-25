import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { z } from 'zod';
import { loadNegotiationPolicy } from '../lib/negotiation-policy';
import type { NegotiationType } from '@shared/schema';
import { requireTenant, requireRole } from '../middleware/guards';

const router = Router();

const VALID_NEGOTIATION_TYPES: readonly NegotiationType[] = ['schedule', 'scope', 'pricing'];

const tenantPolicyPatchSchema = z.object({
  max_turns: z.number().int().min(1).max(20).nullable().optional(),
  allow_counter: z.boolean().nullable().optional(),
  close_on_accept: z.boolean().nullable().optional(),
  close_on_decline: z.boolean().nullable().optional(),
  provider_can_initiate: z.boolean().nullable().optional(),
  stakeholder_can_initiate: z.boolean().nullable().optional(),
  allow_proposal_context: z.boolean().nullable().optional(),
});

router.get(
  '/negotiation-policies/:negotiationType',
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).ctx?.tenant_id;
      const { negotiationType } = req.params;

      if (!tenantId) {
        return res.status(400).json({ ok: false, error: 'Tenant context required' });
      }

      if (!VALID_NEGOTIATION_TYPES.includes(negotiationType as NegotiationType)) {
        return res.status(400).json({ ok: false, error: 'Invalid negotiation type' });
      }

      const resolved = await loadNegotiationPolicy(tenantId, negotiationType as NegotiationType);

      const platformResult = await pool.query(
        `SELECT max_turns, allow_counter, close_on_accept, close_on_decline, 
                provider_can_initiate, stakeholder_can_initiate, allow_proposal_context
         FROM cc_platform_negotiation_policy WHERE negotiation_type = $1`,
        [negotiationType]
      );

      const tenantResult = await pool.query(
        `SELECT max_turns, allow_counter, close_on_accept, close_on_decline,
                provider_can_initiate, stakeholder_can_initiate, allow_proposal_context
         FROM cc_tenant_negotiation_policy WHERE tenant_id = $1 AND negotiation_type = $2`,
        [tenantId, negotiationType]
      );

      const platformDefaults = platformResult.rows[0] || {};
      const tenantOverrides = tenantResult.rows[0] || {};

      res.json({
        ok: true,
        negotiation_type: negotiationType,
        resolved,
        platform_defaults: {
          max_turns: platformDefaults.max_turns,
          allow_counter: platformDefaults.allow_counter,
          close_on_accept: platformDefaults.close_on_accept,
          close_on_decline: platformDefaults.close_on_decline,
          provider_can_initiate: platformDefaults.provider_can_initiate,
          stakeholder_can_initiate: platformDefaults.stakeholder_can_initiate,
          allow_proposal_context: platformDefaults.allow_proposal_context,
        },
        tenant_overrides: {
          max_turns: tenantOverrides.max_turns ?? null,
          allow_counter: tenantOverrides.allow_counter ?? null,
          close_on_accept: tenantOverrides.close_on_accept ?? null,
          close_on_decline: tenantOverrides.close_on_decline ?? null,
          provider_can_initiate: tenantOverrides.provider_can_initiate ?? null,
          stakeholder_can_initiate: tenantOverrides.stakeholder_can_initiate ?? null,
          allow_proposal_context: tenantOverrides.allow_proposal_context ?? null,
        },
      });
    } catch (error) {
      console.error('Error fetching negotiation policy:', error);
      res.status(500).json({ ok: false, error: 'Failed to fetch negotiation policy' });
    }
  }
);

router.get(
  '/negotiation-policies',
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).ctx?.tenant_id;

      if (!tenantId) {
        return res.status(400).json({ ok: false, error: 'Tenant context required' });
      }

      const policies = await Promise.all(
        VALID_NEGOTIATION_TYPES.map(async (type) => {
          const resolved = await loadNegotiationPolicy(tenantId, type);

          const tenantResult = await pool.query(
            `SELECT max_turns, allow_counter, close_on_accept, close_on_decline,
                    provider_can_initiate, stakeholder_can_initiate, allow_proposal_context
             FROM cc_tenant_negotiation_policy WHERE tenant_id = $1 AND negotiation_type = $2`,
            [tenantId, type]
          );

          const tenantOverrides = tenantResult.rows[0] || {};
          const hasOverrides = Object.values(tenantOverrides).some(v => v !== undefined && v !== null);

          return {
            negotiation_type: type,
            resolved,
            has_overrides: hasOverrides,
          };
        })
      );

      res.json({ ok: true, policies });
    } catch (error) {
      console.error('Error fetching negotiation policies:', error);
      res.status(500).json({ ok: false, error: 'Failed to fetch negotiation policies' });
    }
  }
);

router.patch(
  '/negotiation-policies/:negotiationType',
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).ctx?.tenant_id;
      const { negotiationType } = req.params;

      if (!tenantId) {
        return res.status(400).json({ ok: false, error: 'Tenant context required' });
      }

      if (!VALID_NEGOTIATION_TYPES.includes(negotiationType as NegotiationType)) {
        return res.status(400).json({ ok: false, error: 'Invalid negotiation type' });
      }

      const parsed = tenantPolicyPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.errors });
      }

      const updates = parsed.data;

      const existingResult = await pool.query(
        `SELECT id FROM cc_tenant_negotiation_policy WHERE tenant_id = $1 AND negotiation_type = $2`,
        [tenantId, negotiationType]
      );

      if (existingResult.rows.length > 0) {
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined) {
            setClauses.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        });

        if (setClauses.length > 0) {
          values.push(tenantId, negotiationType);
          await pool.query(
            `UPDATE cc_tenant_negotiation_policy 
             SET ${setClauses.join(', ')}, updated_at = NOW()
             WHERE tenant_id = $${paramIndex} AND negotiation_type = $${paramIndex + 1}`,
            values
          );
        }
      } else {
        const columns = ['tenant_id', 'negotiation_type'];
        const placeholders = ['$1', '$2'];
        const values: unknown[] = [tenantId, negotiationType];
        let paramIndex = 3;

        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined) {
            columns.push(key);
            placeholders.push(`$${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        });

        await pool.query(
          `INSERT INTO cc_tenant_negotiation_policy (${columns.join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );
      }

      const resolved = await loadNegotiationPolicy(tenantId, negotiationType as NegotiationType);

      res.json({
        ok: true,
        message: 'Policy updated successfully',
        resolved,
      });
    } catch (error) {
      console.error('Error updating negotiation policy:', error);
      res.status(500).json({ ok: false, error: 'Failed to update negotiation policy' });
    }
  }
);

router.delete(
  '/negotiation-policies/:negotiationType',
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).ctx?.tenant_id;
      const { negotiationType } = req.params;

      if (!tenantId) {
        return res.status(400).json({ ok: false, error: 'Tenant context required' });
      }

      if (!VALID_NEGOTIATION_TYPES.includes(negotiationType as NegotiationType)) {
        return res.status(400).json({ ok: false, error: 'Invalid negotiation type' });
      }

      await pool.query(
        `DELETE FROM cc_tenant_negotiation_policy WHERE tenant_id = $1 AND negotiation_type = $2`,
        [tenantId, negotiationType]
      );

      const resolved = await loadNegotiationPolicy(tenantId, negotiationType as NegotiationType);

      res.json({
        ok: true,
        message: 'Policy overrides reset to platform defaults',
        resolved,
      });
    } catch (error) {
      console.error('Error resetting negotiation policy:', error);
      res.status(500).json({ ok: false, error: 'Failed to reset negotiation policy' });
    }
  }
);

export default router;
