import { serviceQuery } from '../../db/tenantDb';
import { uploadToR2 } from '../media/r2Storage';
import crypto from 'crypto';

interface GeneratePackParams {
  runId: string;
  tenantId: string;
  title?: string;
  includeTypes?: string[];
  sealBundle?: boolean;
  generatedBy?: string;
}

interface PackResult {
  bundleId: string;
  manifestSha256: string;
  count: number;
}

export async function generateEmergencyRecordPack(params: GeneratePackParams): Promise<PackResult> {
  const {
    runId,
    tenantId,
    title,
    includeTypes,
    sealBundle = true,
    generatedBy,
  } = params;

  // Get run details
  const runResult = await serviceQuery<{
    id: string;
    run_type: string;
    status: string;
    coordination_bundle_id: string | null;
    legal_hold_id: string | null;
    property_profile_id: string | null;
    metadata: any;
  }>(
    `SELECT id, run_type, status, coordination_bundle_id, legal_hold_id, 
            property_profile_id, metadata
     FROM cc_emergency_runs WHERE id = $1 AND tenant_id = $2`,
    [runId, tenantId]
  );

  if (runResult.rows.length === 0) {
    throw new Error('RUN_NOT_FOUND');
  }

  const run = runResult.rows[0];

  // Create legal hold if missing
  let legalHoldId = run.legal_hold_id;
  if (!legalHoldId) {
    const holdResult = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_legal_holds (
        tenant_id, hold_type, title, reason, initiated_by_individual_id
      ) VALUES ($1, 'emergency', $2, $3, $4)
      RETURNING id`,
      [tenantId, `Emergency Record Pack - ${run.run_type}`, 'Auto-created for record pack', generatedBy]
    );
    legalHoldId = holdResult.rows[0].id;

    await serviceQuery(
      `UPDATE cc_emergency_runs SET legal_hold_id = $2 WHERE id = $1`,
      [runId, legalHoldId]
    );

    await serviceQuery(
      `INSERT INTO cc_legal_hold_events (
        tenant_id, hold_id, event_type, event_at, actor_individual_id, event_payload
      ) VALUES ($1, $2, 'created', now(), $3, $4)`,
      [tenantId, legalHoldId, generatedBy, JSON.stringify({ run_id: runId, auto_created: true })]
    );
  }

  // Get property label if available
  let propertyLabel = 'Unknown Property';
  if (run.property_profile_id) {
    const propResult = await serviceQuery<{ property_label: string }>(
      `SELECT property_label FROM cc_property_emergency_profiles WHERE id = $1`,
      [run.property_profile_id]
    );
    if (propResult.rows.length > 0) {
      propertyLabel = propResult.rows[0].property_label;
    }
  }

  // Gather all evidence objects from captures
  let captureQuery = `
    SELECT rc.id as capture_id, rc.target_url, rc.http_status, rc.content_sha256,
           rc.content_mime, rc.content_bytes, rc.r2_key, rc.requested_at,
           rc.evidence_object_id, rc.capture_type, rc.status as capture_status,
           eo.chain_status, eo.sealed_at
    FROM cc_record_captures rc
    LEFT JOIN cc_evidence_objects eo ON rc.evidence_object_id = eo.id
    WHERE rc.tenant_id = $1 AND rc.run_id = $2 AND rc.evidence_object_id IS NOT NULL
  `;
  const queryParams: any[] = [tenantId, runId];

  if (includeTypes && includeTypes.length > 0) {
    captureQuery += ` AND rc.capture_type = ANY($3)`;
    queryParams.push(includeTypes);
  }

  captureQuery += ` ORDER BY rc.requested_at`;

  const capturesResult = await serviceQuery<{
    capture_id: string;
    target_url: string;
    http_status: number;
    content_sha256: string;
    content_mime: string;
    content_bytes: number;
    r2_key: string;
    requested_at: Date;
    evidence_object_id: string;
    capture_type: string;
    capture_status: string;
    chain_status: string;
    sealed_at: Date | null;
  }>(captureQuery, queryParams);

  const captures = capturesResult.rows;

  // Seal any unsealed evidence objects
  for (const capture of captures) {
    if (capture.chain_status === 'open' && capture.evidence_object_id) {
      await serviceQuery(
        `UPDATE cc_evidence_objects SET chain_status = 'sealed', sealed_at = now(), sealed_by_individual_id = $2 WHERE id = $1`,
        [capture.evidence_object_id, generatedBy]
      );
    }
  }

  // Build manifest
  const packTitle = title || `Emergency Record Pack: ${run.run_type} - ${propertyLabel}`;
  const manifest = {
    pack_version: '1.0',
    generated_at: new Date().toISOString(),
    generated_by: generatedBy,
    run: {
      id: runId,
      run_type: run.run_type,
      status: run.status,
      legal_hold_id: legalHoldId,
      coordination_bundle_id: run.coordination_bundle_id,
    },
    title: packTitle,
    evidence_count: captures.length,
    evidence_objects: captures.map(c => ({
      evidence_object_id: c.evidence_object_id,
      capture_id: c.capture_id,
      capture_type: c.capture_type,
      target_url: c.target_url,
      http_status: c.http_status,
      content_sha256: c.content_sha256,
      content_mime: c.content_mime,
      content_bytes: c.content_bytes,
      r2_key: c.r2_key,
      fetched_at: c.requested_at,
    })),
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestSha256 = crypto.createHash('sha256').update(manifestJson).digest('hex');

  // Create or update pack bundle
  const bundleResult = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_evidence_bundles (
      tenant_id, bundle_type, title, owner_individual_id, manifest_sha256
    ) VALUES ($1, 'emergency_pack', $2, $3, $4)
    RETURNING id`,
    [tenantId, packTitle, generatedBy, manifestSha256]
  );
  const bundleId = bundleResult.rows[0].id;

  // Store manifest to R2
  const manifestR2Key = `record-packs/${tenantId}/${bundleId}/manifest.json`;
  await uploadToR2(manifestR2Key, Buffer.from(manifestJson), 'application/json');

  // Add bundle event
  await serviceQuery(
    `INSERT INTO cc_evidence_bundle_events (
      tenant_id, bundle_id, event_type, event_at, actor_individual_id, event_payload
    ) VALUES ($1, $2, 'created', now(), $3, $4)`,
    [tenantId, bundleId, generatedBy, JSON.stringify({
      run_id: runId,
      evidence_count: captures.length,
      manifest_sha256: manifestSha256,
    })]
  );

  // Seal bundle if requested
  if (sealBundle) {
    await serviceQuery(
      `UPDATE cc_evidence_bundles SET is_sealed = true WHERE id = $1`,
      [bundleId]
    );
    await serviceQuery(
      `INSERT INTO cc_evidence_bundle_events (
        tenant_id, bundle_id, event_type, event_at, actor_individual_id, event_payload
      ) VALUES ($1, $2, 'sealed', now(), $3, $4)`,
      [tenantId, bundleId, generatedBy, JSON.stringify({ manifest_sha256: manifestSha256 })]
    );
  }

  // Store pack bundle reference in run metadata
  const updatedMetadata = {
    ...(run.metadata || {}),
    record_pack_bundle_id: bundleId,
    record_pack_generated_at: new Date().toISOString(),
  };
  await serviceQuery(
    `UPDATE cc_emergency_runs SET metadata = $2 WHERE id = $1`,
    [runId, JSON.stringify(updatedMetadata)]
  );

  // Log run event
  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (
      tenant_id, run_id, event_type, event_at, actor_individual_id, event_payload
    ) VALUES ($1, $2, 'pack_generated', now(), $3, $4)`,
    [tenantId, runId, generatedBy, JSON.stringify({
      bundle_id: bundleId,
      manifest_sha256: manifestSha256,
      evidence_count: captures.length,
    })]
  );

  return {
    bundleId,
    manifestSha256,
    count: captures.length,
  };
}
