/**
 * P2.11: Anonymous Interest Groups API Routes
 * 
 * Admin endpoints for group management
 * Public endpoints for anonymous signal submission
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';
import { encryptContact, isEncryptionAvailable } from '../lib/crypto/sealContact';
import { evaluateGroupTriggers, closeGroup } from '../lib/interestGroups/evaluateTriggers';
import { sha256Hex, canonicalizeJson } from '../lib/evidence/custody';

const router = Router();

// Rate limiting state (in-memory for simplicity)
const rateLimitState = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per hour per IP per group
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string, groupId: string): boolean {
  const key = `${ip}:${groupId}`;
  const now = Date.now();
  const state = rateLimitState.get(key);

  if (!state || now > state.resetAt) {
    rateLimitState.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (state.count >= RATE_LIMIT) {
    return false;
  }

  state.count++;
  return true;
}

// Generate random anonymized handle
function generateAnonymizedHandle(): string {
  return `anon_${crypto.randomBytes(8).toString('hex')}`;
}

// ==================== Admin Endpoints ====================

// Create interest group
const createGroupSchema = z.object({
  group_type: z.enum(['class_action', 'insurance_mass_claim', 'regulatory_petition', 'community_issue', 'other']),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  portal_id: z.string().uuid().optional(),
  circle_id: z.string().uuid().optional(),
  anonymity_mode: z.enum(['strict', 'relaxed']).optional(),
  client_request_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const individualId = (req as any).session?.individualId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = createGroupSchema.parse(req.body);

    const result = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_interest_groups (
         tenant_id, portal_id, circle_id, group_type, title, description,
         anonymity_mode, created_by_individual_id, client_request_id, metadata
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL
       DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [
        tenantId,
        body.portal_id || null,
        body.circle_id || null,
        body.group_type,
        body.title,
        body.description || null,
        body.anonymity_mode || 'strict',
        individualId || null,
        body.client_request_id || null,
        JSON.stringify(body.metadata || {}),
      ]
    );

    const groupId = result.rows[0].id;

    // Log event
    await serviceQuery(
      `INSERT INTO cc_interest_group_events (tenant_id, group_id, event_type, actor_individual_id, event_payload)
       VALUES ($1::uuid, $2::uuid, 'group_created', $3, $4::jsonb)`,
      [tenantId, groupId, individualId || null, JSON.stringify({ group_type: body.group_type })]
    );

    return res.json({ ok: true, id: groupId });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add trigger to group
const addTriggerSchema = z.object({
  trigger_type: z.enum(['headcount', 'geo_quorum', 'time_window', 'composite']),
  params: z.record(z.any()),
});

router.post('/:id/triggers', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const groupId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = addTriggerSchema.parse(req.body);

    const result = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)
       RETURNING id`,
      [tenantId, groupId, body.trigger_type, JSON.stringify(body.params)]
    );

    return res.json({ ok: true, id: result.rows[0].id });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Add trigger error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List groups
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await serviceQuery<{
      id: string;
      group_type: string;
      title: string;
      status: string;
      anonymity_mode: string;
      created_at: Date;
      triggered_at: Date | null;
    }>(
      `SELECT id, group_type, title, status, anonymity_mode, created_at, triggered_at
       FROM cc_interest_groups
       WHERE tenant_id = $1::uuid
       ORDER BY created_at DESC`,
      [tenantId]
    );

    // Get aggregate counts for each group
    const groups = await Promise.all(
      result.rows.map(async (group) => {
        const countResult = await serviceQuery<{ count: string }>(
          `SELECT COUNT(*) as count FROM cc_interest_group_signals
           WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND signal_status = 'active'`,
          [tenantId, group.id]
        );

        return {
          ...group,
          signal_count: parseInt(countResult.rows[0].count),
        };
      })
    );

    return res.json({ groups });
  } catch (error: any) {
    console.error('List groups error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get group summary (aggregates only)
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const groupId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use SECURITY DEFINER function for k-anonymity
    const result = await pool.query<{ cc_get_group_aggregates: any }>(
      `SELECT cc_get_group_aggregates($1::uuid, $2::uuid, 5)`,
      [tenantId, groupId]
    );

    const aggregates = result.rows[0].cc_get_group_aggregates;

    if (aggregates.error) {
      return res.status(404).json({ error: aggregates.error });
    }

    // Get triggers
    const triggersResult = await serviceQuery<{
      id: string;
      trigger_type: string;
      params: any;
      enabled: boolean;
    }>(
      `SELECT id, trigger_type, params, enabled
       FROM cc_interest_group_triggers
       WHERE tenant_id = $1::uuid AND group_id = $2::uuid`,
      [tenantId, groupId]
    );

    return res.json({
      ...aggregates,
      triggers: triggersResult.rows,
    });
  } catch (error: any) {
    console.error('Get summary error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Force evaluate triggers
router.post('/:id/evaluate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const groupId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await evaluateGroupTriggers(tenantId, groupId);

    return res.json({
      ok: true,
      triggered: result.triggered,
      reason: result.reason,
      total_signals: result.aggregates.activeSignals,
    });
  } catch (error: any) {
    console.error('Evaluate error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Close group
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const groupId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await closeGroup(tenantId, groupId);

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('Close group error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// ==================== Public Endpoints (separate router) ====================

export const publicRouter = Router();

// Submit anonymous signal
const submitSignalSchema = z.object({
  client_request_id: z.string().optional(),
  geo_key: z.string().optional(),
  geo_value: z.string().optional(),
  contact_channel: z.enum(['email', 'phone']).optional(),
  contact: z.string().optional(),
  proof_bundle_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

publicRouter.post('/:groupId/signal', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.groupId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Rate limiting
    if (!checkRateLimit(ip, groupId)) {
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    const body = submitSignalSchema.parse(req.body);

    // Look up group to get tenant_id
    const groupResult = await pool.query<{
      tenant_id: string;
      status: string;
      portal_id: string | null;
    }>(
      `SELECT tenant_id, status, portal_id FROM cc_interest_groups WHERE id = $1::uuid`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'GROUP_NOT_FOUND' });
    }

    const group = groupResult.rows[0];

    if (group.status !== 'open') {
      return res.status(400).json({ error: 'GROUP_NOT_OPEN' });
    }

    // Encrypt contact if provided
    let contactEncrypted: string | null = null;
    if (body.contact) {
      if (!isEncryptionAvailable()) {
        return res.status(400).json({ error: 'ENCRYPTION_NOT_CONFIGURED' });
      }
      contactEncrypted = encryptContact(body.contact);
      if (!contactEncrypted) {
        return res.status(500).json({ error: 'ENCRYPTION_FAILED' });
      }
    }

    // Generate anonymized handle
    const anonymizedHandle = generateAnonymizedHandle();

    // Compute signal hash
    const signalPayload = {
      group_id: groupId,
      client_request_id: body.client_request_id,
      geo_key: body.geo_key,
      geo_value: body.geo_value,
      contact_channel: body.contact_channel,
      proof_bundle_id: body.proof_bundle_id,
    };
    const signalHash = sha256Hex(canonicalizeJson(signalPayload));

    // Submit via SECURITY DEFINER function
    const result = await pool.query<{ cc_submit_anonymous_signal: any }>(
      `SELECT cc_submit_anonymous_signal(
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11::jsonb
       )`,
      [
        group.tenant_id,
        groupId,
        anonymizedHandle,
        signalHash,
        body.client_request_id || null,
        body.geo_key || null,
        body.geo_value || null,
        body.contact_channel || null,
        contactEncrypted,
        body.proof_bundle_id || null,
        JSON.stringify(body.metadata || {}),
      ]
    );

    const submitResult = result.rows[0].cc_submit_anonymous_signal;

    if (!submitResult.ok) {
      return res.status(400).json({ error: submitResult.error });
    }

    // Trigger evaluation (safe + rate-limited by the earlier check)
    try {
      await evaluateGroupTriggers(group.tenant_id, groupId);
    } catch (evalError) {
      console.error('Trigger evaluation error:', evalError);
      // Don't fail the submission if evaluation fails
    }

    return res.json({ ok: true, anonymized_handle: submitResult.anonymized_handle });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Submit signal error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Withdraw signal (non-enumerable)
const withdrawSignalSchema = z.object({
  client_request_id: z.string(),
  anonymized_handle: z.string(),
});

publicRouter.post('/:groupId/withdraw', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.groupId;

    const body = withdrawSignalSchema.parse(req.body);

    // Look up group to get tenant_id
    const groupResult = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM cc_interest_groups WHERE id = $1::uuid`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      // Non-enumerable: always return ok
      return res.json({ ok: true });
    }

    const tenantId = groupResult.rows[0].tenant_id;

    // Withdraw via SECURITY DEFINER function
    await pool.query(
      `SELECT cc_withdraw_anonymous_signal($1::uuid, $2::uuid, $3, $4)`,
      [tenantId, groupId, body.client_request_id, body.anonymized_handle]
    );

    // Always return ok (anti-enumeration)
    return res.json({ ok: true });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Withdraw signal error:', error);
    // Non-enumerable: always return ok
    return res.json({ ok: true });
  }
});
