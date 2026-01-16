/**
 * P2.12 Emergency Templates & Runs API Routes
 */

import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import { serviceQuery, tenantQuery } from '../db/tenantDb.js';
import {
  startEmergencyRun,
  resolveEmergencyRun,
  cancelEmergencyRun,
  createScopeGrant,
  attachEvidenceToRun,
} from '../lib/emergency/orchestrate.js';
import {
  validateGrantExpiration,
  revokeEmergencyGrant,
  expireEmergencyGrants,
} from '../lib/emergency/scopes.js';
import { exportPlaybook } from '../lib/emergency/playbook.js';

const router = Router();

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalizeJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

const templateTypes = ['tsunami', 'wildfire', 'power_outage', 'storm', 'medical', 'security', 'evacuation', 'other'] as const;
const grantTypes = ['asset_control', 'tool_access', 'vehicle_access', 'lodging_access', 'communications_interrupt', 'procurement_override', 'gate_access', 'other'] as const;

const CreateTemplateSchema = z.object({
  template_type: z.enum(templateTypes),
  title: z.string().min(1),
  description: z.string().optional(),
  template_json: z.record(z.unknown()),
  portal_id: z.string().uuid().optional(),
  circle_id: z.string().uuid().optional(),
  client_request_id: z.string().optional(),
});

const CreatePropertySchema = z.object({
  property_label: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  hazard_overrides: z.record(z.unknown()).optional(),
  contacts: z.record(z.unknown()).optional(),
  dependencies: z.record(z.unknown()).optional(),
  property_asset_id: z.string().uuid().optional(),
  portal_id: z.string().uuid().optional(),
  client_request_id: z.string().optional(),
});

const CreateRunSchema = z.object({
  run_type: z.enum(templateTypes),
  template_id: z.string().uuid().optional(),
  property_profile_id: z.string().uuid().optional(),
  circle_id: z.string().uuid().optional(),
  portal_id: z.string().uuid().optional(),
  summary: z.string().optional(),
  client_request_id: z.string().optional(),
});

const CreateGrantSchema = z.object({
  grantee_individual_id: z.string().uuid(),
  grant_type: z.enum(grantTypes),
  scope_json: z.record(z.unknown()),
  expires_at: z.string().datetime(),
  client_request_id: z.string().optional(),
});

const AttachEvidenceSchema = z.object({
  evidence_object_id: z.string().uuid().optional(),
  evidence_bundle_id: z.string().uuid().optional(),
  label: z.string().optional(),
  notes: z.string().optional(),
});

const ResolveRunSchema = z.object({
  summary: z.string().optional(),
  auto_share: z.boolean().optional(),
});

const RevokeGrantSchema = z.object({
  reason: z.string().min(1),
});

router.post('/templates', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const individualId = req.ctx.individual_id;

    const parsed = CreateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;
    const templateSha256 = sha256Hex(canonicalizeJson(data.template_json));

    const versionResult = await tenantQuery<{ max_version: number }>(
      req,
      `SELECT COALESCE(MAX(version), 0) as max_version FROM cc_emergency_templates
       WHERE tenant_id = $1::uuid AND template_type = $2`,
      [tenantId, data.template_type]
    );
    const newVersion = (versionResult.rows[0]?.max_version || 0) + 1;

    const result = await tenantQuery<{ id: string }>(
      req,
      `INSERT INTO cc_emergency_templates (
         tenant_id, portal_id, circle_id, template_type, title, description,
         version, status, template_json, template_sha256, created_by_individual_id, client_request_id
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'draft', $8::jsonb, $9, $10, $11)
       RETURNING id`,
      [
        tenantId,
        data.portal_id || null,
        data.circle_id || null,
        data.template_type,
        data.title,
        data.description || null,
        newVersion,
        JSON.stringify(data.template_json),
        templateSha256,
        individualId || null,
        data.client_request_id || null,
      ]
    );

    res.status(201).json({ id: result.rows[0].id, version: newVersion, template_sha256: templateSha256 });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.post('/templates/:id/activate', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const templateId = req.params.id;

    const templateResult = await tenantQuery<{ template_type: string; status: string }>(
      req,
      `SELECT template_type, status FROM cc_emergency_templates WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { template_type } = templateResult.rows[0];

    await tenantQuery(
      req,
      `UPDATE cc_emergency_templates SET status = 'retired'
       WHERE tenant_id = $1::uuid AND template_type = $2 AND status = 'active'`,
      [tenantId, template_type]
    );

    await tenantQuery(
      req,
      `UPDATE cc_emergency_templates SET status = 'active' WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, templateId]
    );

    res.json({ success: true, message: 'Template activated' });
  } catch (err) {
    console.error('Error activating template:', err);
    res.status(500).json({ error: 'Failed to activate template' });
  }
});

router.get('/templates', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const { template_type, status } = req.query;

    let query = `SELECT id, template_type, title, description, version, status, template_sha256, created_at
                 FROM cc_emergency_templates WHERE tenant_id = $1::uuid`;
    const params: (string | undefined)[] = [tenantId];

    if (template_type) {
      params.push(template_type as string);
      query += ` AND template_type = $${params.length}`;
    }
    if (status) {
      params.push(status as string);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY template_type, version DESC';

    const result = await tenantQuery(req, query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing templates:', err);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

router.post('/properties', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const individualId = req.ctx.individual_id;

    const parsed = CreatePropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    const result = await tenantQuery<{ id: string }>(
      req,
      `INSERT INTO cc_property_emergency_profiles (
         tenant_id, portal_id, property_asset_id, property_label, address,
         lat, lon, hazard_overrides, contacts, dependencies,
         created_by_individual_id, client_request_id
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12)
       RETURNING id`,
      [
        tenantId,
        data.portal_id || null,
        data.property_asset_id || null,
        data.property_label,
        data.address || null,
        data.lat || null,
        data.lon || null,
        JSON.stringify(data.hazard_overrides || {}),
        JSON.stringify(data.contacts || {}),
        JSON.stringify(data.dependencies || {}),
        individualId || null,
        data.client_request_id || null,
      ]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating property profile:', err);
    res.status(500).json({ error: 'Failed to create property profile' });
  }
});

router.get('/properties', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;

    const result = await tenantQuery(
      req,
      `SELECT id, property_label, address, lat, lon, hazard_overrides, contacts, dependencies, created_at
       FROM cc_property_emergency_profiles WHERE tenant_id = $1::uuid ORDER BY created_at DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error listing properties:', err);
    res.status(500).json({ error: 'Failed to list properties' });
  }
});

router.post('/runs', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const individualId = req.ctx.individual_id;

    const parsed = CreateRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    const result = await startEmergencyRun({
      tenantId,
      runType: data.run_type,
      templateId: data.template_id,
      propertyProfileId: data.property_profile_id,
      circleId: data.circle_id,
      portalId: data.portal_id,
      summary: data.summary,
      startedByIndividualId: individualId || undefined,
      clientRequestId: data.client_request_id,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error starting run:', err);
    res.status(500).json({ error: 'Failed to start emergency run' });
  }
});

router.get('/runs', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const { status } = req.query;

    let query = `SELECT id, run_type, status, template_id, property_profile_id,
                        started_at, resolved_at, summary, legal_hold_id, coordination_bundle_id
                 FROM cc_emergency_runs WHERE tenant_id = $1::uuid`;
    const params: string[] = [tenantId];

    if (status) {
      params.push(status as string);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY started_at DESC';

    const result = await tenantQuery(req, query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing runs:', err);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

router.get('/runs/:id', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const runId = req.params.id;

    const runResult = await tenantQuery(
      req,
      `SELECT * FROM cc_emergency_runs WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, runId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const grantsResult = await tenantQuery(
      req,
      `SELECT id, grantee_individual_id, grant_type, scope_json, granted_at, expires_at, status
       FROM cc_emergency_scope_grants WHERE tenant_id = $1::uuid AND run_id = $2::uuid`,
      [tenantId, runId]
    );

    const eventsResult = await tenantQuery(
      req,
      `SELECT id, event_type, event_at, actor_individual_id, event_payload
       FROM cc_emergency_run_events WHERE tenant_id = $1::uuid AND run_id = $2::uuid ORDER BY event_at DESC`,
      [tenantId, runId]
    );

    res.json({
      ...runResult.rows[0],
      grants: grantsResult.rows,
      events: eventsResult.rows,
    });
  } catch (err) {
    console.error('Error getting run:', err);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

router.post('/runs/:id/grants', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const runId = req.params.id;
    const individualId = req.ctx.individual_id;

    const parsed = CreateGrantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;
    const expiresAt = new Date(data.expires_at);

    const validation = validateGrantExpiration(expiresAt);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await expireEmergencyGrants(tenantId);

    const grantId = await createScopeGrant({
      tenantId,
      runId,
      granteeIndividualId: data.grantee_individual_id,
      grantType: data.grant_type,
      scopeJson: data.scope_json,
      expiresAt,
      grantedByIndividualId: individualId || undefined,
      clientRequestId: data.client_request_id,
    });

    res.status(201).json({ id: grantId });
  } catch (err) {
    console.error('Error creating grant:', err);
    res.status(500).json({ error: 'Failed to create grant' });
  }
});

router.post('/runs/:id/grants/:grantId/revoke', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const { grantId } = req.params;
    const individualId = req.ctx.individual_id;

    const parsed = RevokeGrantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    await revokeEmergencyGrant(tenantId, grantId, individualId || null, parsed.data.reason);

    res.json({ success: true });
  } catch (err) {
    console.error('Error revoking grant:', err);
    res.status(500).json({ error: 'Failed to revoke grant' });
  }
});

router.post('/runs/:id/attach-evidence', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const runId = req.params.id;
    const individualId = req.ctx.individual_id;

    const parsed = AttachEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const data = parsed.data;

    if (!data.evidence_object_id && !data.evidence_bundle_id) {
      return res.status(400).json({ error: 'Must provide evidence_object_id or evidence_bundle_id' });
    }

    await attachEvidenceToRun({
      tenantId,
      runId,
      evidenceObjectId: data.evidence_object_id,
      evidenceBundleId: data.evidence_bundle_id,
      label: data.label,
      notes: data.notes,
      actorIndividualId: individualId || undefined,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error attaching evidence:', err);
    res.status(500).json({ error: 'Failed to attach evidence' });
  }
});

router.post('/runs/:id/share-authority', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const runId = req.params.id;
    const individualId = req.ctx.individual_id;

    const runResult = await tenantQuery<{ coordination_bundle_id: string | null }>(
      req,
      `SELECT coordination_bundle_id FROM cc_emergency_runs WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, runId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (!runResult.rows[0].coordination_bundle_id) {
      return res.status(400).json({ error: 'No coordination bundle to share' });
    }

    const grantResult = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_authority_access_grants (
         tenant_id, grant_type, recipient_name, recipient_organization,
         expires_at, max_views, created_by_individual_id
       )
       VALUES ($1::uuid, 'emergency', 'Emergency Share', 'Authority/Adjuster',
               $2, 1000, $3)
       RETURNING id`,
      [
        tenantId,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        individualId || null,
      ]
    );
    const grantId = grantResult.rows[0].id;

    await serviceQuery(
      `INSERT INTO cc_authority_access_scopes (tenant_id, grant_id, scope_type, scope_id)
       VALUES ($1::uuid, $2::uuid, 'evidence_bundle', $3::uuid)`,
      [tenantId, grantId, runResult.rows[0].coordination_bundle_id]
    );

    await serviceQuery(
      `UPDATE cc_emergency_runs SET authority_grant_id = $3::uuid WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, runId, grantId]
    );

    await serviceQuery(
      `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
       VALUES ($1::uuid, $2::uuid, 'authority_shared', $3, $4::jsonb)`,
      [tenantId, runId, individualId || null, JSON.stringify({ grant_id: grantId })]
    );

    const tokenResult = await serviceQuery<{ token: string }>(
      `SELECT token FROM cc_authority_access_tokens WHERE grant_id = $1::uuid LIMIT 1`,
      [grantId]
    );

    let shareUrl = `/p/authority/${grantId}`;
    if (tokenResult.rows.length > 0) {
      shareUrl = `/p/authority/${grantId}?token=${tokenResult.rows[0].token}`;
    }

    res.json({ grant_id: grantId, share_url: shareUrl });
  } catch (err) {
    console.error('Error sharing authority:', err);
    res.status(500).json({ error: 'Failed to share authority' });
  }
});

router.post('/runs/:id/resolve', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const runId = req.params.id;
    const individualId = req.ctx.individual_id;

    const parsed = ResolveRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const result = await resolveEmergencyRun({
      tenantId,
      runId,
      summary: parsed.data.summary,
      resolvedByIndividualId: individualId || undefined,
      autoShare: parsed.data.auto_share,
    });

    res.json({ success: true, authority_grant_id: result.authorityGrantId });
  } catch (err: unknown) {
    console.error('Error resolving run:', err);
    const message = err instanceof Error ? err.message : 'Failed to resolve run';
    res.status(500).json({ error: message });
  }
});

router.post('/runs/:id/export-playbook', async (req: any, res: Response) => {
  try {
    const tenantId = req.ctx.tenant_id!;
    const runId = req.params.id;
    const individualId = req.ctx.individual_id;

    const result = await exportPlaybook(tenantId, runId, individualId || null);

    res.json(result);
  } catch (err: unknown) {
    console.error('Error exporting playbook:', err);
    const message = err instanceof Error ? err.message : 'Failed to export playbook';
    res.status(500).json({ error: message });
  }
});

export default router;
