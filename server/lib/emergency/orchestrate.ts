/**
 * P2.12 Emergency Run Orchestrator
 * Manages emergency run lifecycle with auto-preserve and share
 */

import { serviceQuery } from '../../db/tenantDb.js';
import {
  createCoordinationBundle,
  getTemplateById,
  getPropertyProfile,
} from './bindings.js';
import { expireEmergencyGrants } from './scopes.js';

export interface StartEmergencyRunParams {
  tenantId: string;
  runType: string;
  templateId?: string;
  propertyProfileId?: string;
  circleId?: string;
  portalId?: string;
  summary?: string;
  startedByIndividualId?: string;
  clientRequestId?: string;
}

export interface StartEmergencyRunResult {
  runId: string;
  bundleId: string;
  holdId: string;
}

/**
 * Start an emergency run with auto-preservation
 * Creates: run row, legal hold, sealed coordination bundle, run event
 */
export async function startEmergencyRun(
  params: StartEmergencyRunParams
): Promise<StartEmergencyRunResult> {
  const {
    tenantId,
    runType,
    templateId,
    propertyProfileId,
    circleId,
    portalId,
    summary,
    startedByIndividualId,
    clientRequestId,
  } = params;

  await expireEmergencyGrants(tenantId);

  const template = templateId ? await getTemplateById(tenantId, templateId) : null;
  const property = propertyProfileId ? await getPropertyProfile(tenantId, propertyProfileId) : null;

  const runResult = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_emergency_runs (
       tenant_id, portal_id, circle_id, template_id, property_profile_id,
       run_type, status, started_by_individual_id, summary, client_request_id
     )
     VALUES ($1::uuid, $2, $3, $4, $5, $6, 'active', $7, $8, $9)
     RETURNING id`,
    [
      tenantId,
      portalId || null,
      circleId || null,
      templateId || null,
      propertyProfileId || null,
      runType,
      startedByIndividualId || null,
      summary || null,
      clientRequestId || null,
    ]
  );
  const runId = runResult.rows[0].id;

  const { bundleId } = await createCoordinationBundle(
    tenantId,
    runId,
    runType,
    template,
    property,
    summary || null
  );

  const holdResult = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_legal_holds (
       tenant_id, hold_type, title, hold_status, metadata
     )
     VALUES ($1::uuid, 'emergency', $2, 'active', $3::jsonb)
     RETURNING id`,
    [
      tenantId,
      `Emergency Hold: ${runType} - ${new Date().toISOString().split('T')[0]}`,
      JSON.stringify({
        run_id: runId,
        run_type: runType,
        coordination_bundle_id: bundleId,
      }),
    ]
  );
  const holdId = holdResult.rows[0].id;

  await serviceQuery(
    `INSERT INTO cc_legal_hold_targets (tenant_id, hold_id, target_type, table_name, scope_filter)
     VALUES ($1::uuid, $2::uuid, 'table_scope', 'cc_emergency_runs', $3::jsonb)`,
    [tenantId, holdId, JSON.stringify({ id: runId })]
  );

  await serviceQuery(
    `INSERT INTO cc_legal_hold_targets (tenant_id, hold_id, target_type, target_id)
     VALUES ($1::uuid, $2::uuid, 'evidence_bundle', $3::uuid)`,
    [tenantId, holdId, bundleId]
  );

  await serviceQuery(
    `INSERT INTO cc_legal_hold_events (tenant_id, hold_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, 'created', $3::jsonb)`,
    [tenantId, holdId, JSON.stringify({ reason: 'Emergency run started', run_id: runId })]
  );

  await serviceQuery(
    `UPDATE cc_emergency_runs
     SET legal_hold_id = $3::uuid, coordination_bundle_id = $4::uuid
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, runId, holdId, bundleId]
  );

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'run_started', $3, $4::jsonb)`,
    [
      tenantId,
      runId,
      startedByIndividualId || null,
      JSON.stringify({
        run_type: runType,
        template_id: templateId,
        property_profile_id: propertyProfileId,
        bundle_id: bundleId,
        hold_id: holdId,
      }),
    ]
  );

  return { runId, bundleId, holdId };
}

export interface ResolveEmergencyRunParams {
  tenantId: string;
  runId: string;
  summary?: string;
  resolvedByIndividualId?: string;
  autoShare?: boolean;
}

export interface ResolveEmergencyRunResult {
  authorityGrantId: string | null;
}

/**
 * Resolve an emergency run
 * Sets status to resolved, optionally creates authority share
 */
export async function resolveEmergencyRun(
  params: ResolveEmergencyRunParams
): Promise<ResolveEmergencyRunResult> {
  const { tenantId, runId, summary, resolvedByIndividualId, autoShare } = params;

  const runResult = await serviceQuery<{
    coordination_bundle_id: string | null;
    legal_hold_id: string | null;
  }>(
    `UPDATE cc_emergency_runs
     SET status = 'resolved', resolved_at = now(), resolved_by_individual_id = $3, summary = COALESCE($4, summary)
     WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'active'
     RETURNING coordination_bundle_id, legal_hold_id`,
    [tenantId, runId, resolvedByIndividualId || null, summary || null]
  );

  if (runResult.rows.length === 0) {
    throw new Error('Run not found or already resolved');
  }

  let authorityGrantId: string | null = null;

  if (autoShare && runResult.rows[0].coordination_bundle_id) {
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
        resolvedByIndividualId || null,
      ]
    );
    authorityGrantId = grantResult.rows[0].id;

    await serviceQuery(
      `INSERT INTO cc_authority_access_scopes (tenant_id, grant_id, scope_type, scope_id)
       VALUES ($1::uuid, $2::uuid, 'evidence_bundle', $3::uuid)`,
      [tenantId, authorityGrantId, runResult.rows[0].coordination_bundle_id]
    );

    await serviceQuery(
      `UPDATE cc_emergency_runs SET authority_grant_id = $3::uuid WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, runId, authorityGrantId]
    );

    await serviceQuery(
      `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
       VALUES ($1::uuid, $2::uuid, 'authority_shared', $3, $4::jsonb)`,
      [tenantId, runId, resolvedByIndividualId || null, JSON.stringify({ grant_id: authorityGrantId })]
    );
  }

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'resolved', $3, $4::jsonb)`,
    [tenantId, runId, resolvedByIndividualId || null, JSON.stringify({ summary })]
  );

  return { authorityGrantId };
}

/**
 * Cancel an emergency run
 */
export async function cancelEmergencyRun(
  tenantId: string,
  runId: string,
  cancelledByIndividualId: string | null,
  reason: string
): Promise<void> {
  await serviceQuery(
    `UPDATE cc_emergency_runs
     SET status = 'cancelled', resolved_at = now(), resolved_by_individual_id = $3
     WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'active'`,
    [tenantId, runId, cancelledByIndividualId]
  );

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'cancelled', $3, $4::jsonb)`,
    [tenantId, runId, cancelledByIndividualId, JSON.stringify({ reason })]
  );
}

/**
 * Create scope grant for emergency run
 */
export async function createScopeGrant(params: {
  tenantId: string;
  runId: string;
  granteeIndividualId: string;
  grantType: string;
  scopeJson: unknown;
  expiresAt: Date;
  grantedByIndividualId?: string;
  circleId?: string;
  clientRequestId?: string;
}): Promise<string> {
  const result = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_emergency_scope_grants (
       tenant_id, circle_id, run_id, grantee_individual_id, grant_type,
       scope_json, expires_at, granted_by_individual_id, client_request_id
     )
     VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6::jsonb, $7, $8, $9)
     RETURNING id`,
    [
      params.tenantId,
      params.circleId || null,
      params.runId,
      params.granteeIndividualId,
      params.grantType,
      JSON.stringify(params.scopeJson),
      params.expiresAt.toISOString(),
      params.grantedByIndividualId || null,
      params.clientRequestId || null,
    ]
  );

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'scope_granted', $3, $4::jsonb)`,
    [
      params.tenantId,
      params.runId,
      params.grantedByIndividualId || null,
      JSON.stringify({
        grant_id: result.rows[0].id,
        grantee_individual_id: params.granteeIndividualId,
        grant_type: params.grantType,
        expires_at: params.expiresAt.toISOString(),
      }),
    ]
  );

  return result.rows[0].id;
}

/**
 * Attach evidence to emergency run
 */
export async function attachEvidenceToRun(params: {
  tenantId: string;
  runId: string;
  evidenceObjectId?: string;
  evidenceBundleId?: string;
  label?: string;
  notes?: string;
  actorIndividualId?: string;
}): Promise<void> {
  const runResult = await serviceQuery<{ metadata: Record<string, unknown>; legal_hold_id: string | null }>(
    `SELECT metadata, legal_hold_id FROM cc_emergency_runs WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [params.tenantId, params.runId]
  );

  if (runResult.rows.length === 0) {
    throw new Error('Run not found');
  }

  const metadata = runResult.rows[0].metadata || {};
  const attachments = (metadata.attachments as Array<unknown>) || [];
  attachments.push({
    evidence_object_id: params.evidenceObjectId,
    evidence_bundle_id: params.evidenceBundleId,
    label: params.label,
    notes: params.notes,
    attached_at: new Date().toISOString(),
    attached_by: params.actorIndividualId,
  });

  await serviceQuery(
    `UPDATE cc_emergency_runs SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{attachments}', $3::jsonb)
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [params.tenantId, params.runId, JSON.stringify(attachments)]
  );

  if (runResult.rows[0].legal_hold_id && params.evidenceBundleId) {
    await serviceQuery(
      `INSERT INTO cc_legal_hold_targets (tenant_id, hold_id, target_type, target_id)
       VALUES ($1::uuid, $2::uuid, 'evidence_bundle', $3::uuid)
       ON CONFLICT DO NOTHING`,
      [params.tenantId, runResult.rows[0].legal_hold_id, params.evidenceBundleId]
    );
  }

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'evidence_attached', $3, $4::jsonb)`,
    [
      params.tenantId,
      params.runId,
      params.actorIndividualId || null,
      JSON.stringify({
        evidence_object_id: params.evidenceObjectId,
        evidence_bundle_id: params.evidenceBundleId,
        label: params.label,
      }),
    ]
  );
}
