/**
 * P2.8 Offline / Low-Signal Evidence Queue + Reconciliation
 * Server-side ingest and reconciliation module
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { 
  canonicalizeJson, 
  sha256Hex, 
  appendEvidenceEvent,
  type EvidenceSourceType
} from '../evidence/custody';
import { isRowOnActiveHold } from '../legal/holds';

// ============================================================
// TYPES
// ============================================================

export type IngestSourceType = 'manual_note' | 'file_r2' | 'url_snapshot' | 'json_snapshot';

export interface IngestItem {
  client_request_id: string;
  local_id: string;
  source_type: IngestSourceType;
  title: string;
  description?: string | null;
  created_at_device: string;
  occurred_at_device?: string | null;
  captured_at_device?: string | null;
  circle_id?: string | null;
  portal_id?: string | null;
  content_sha256?: string | null;
  content_mime?: string | null;
  content_bytes?: number | null;
  payload: {
    text?: string;
    json?: Record<string, unknown>;
    url?: string;
    fetched_at_device?: string;
    http_status?: number;
    headers?: Record<string, string>;
    r2_key?: string;
    upload_token?: string;
  };
  auto_seal?: boolean;
}

export interface IngestBatch {
  device_id: string;
  batch_client_request_id: string;
  batch_created_at: string;
  items: IngestItem[];
}

export type IngestResultStatus = 'created_new' | 'already_applied' | 'rejected';

export interface IngestResult {
  client_request_id: string;
  status: IngestResultStatus;
  evidence_object_id?: string;
  reason?: string;
}

export interface BatchIngestResponse {
  batch_client_request_id: string;
  results: IngestResult[];
  from_cache?: boolean; // True when returning cached results from a previously processed batch
}

export interface SyncSession {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  individualId: string | null;
  deviceId: string;
  appVersion: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface UploadInitResult {
  r2_key_hint: string;
  upload_url_or_token: string;
}

// ============================================================
// SYNC SESSION MANAGEMENT
// ============================================================

/**
 * Create or update a sync session for a device
 */
export async function upsertSyncSession(params: {
  tenantId: string;
  deviceId: string;
  individualId?: string | null;
  circleId?: string | null;
  portalId?: string | null;
  appVersion?: string | null;
}): Promise<SyncSession> {
  const result = await db.execute(sql`
    INSERT INTO cc_sync_sessions (
      tenant_id, device_id, individual_id, circle_id, portal_id, app_version, last_seen_at
    ) VALUES (
      ${params.tenantId}::uuid,
      ${params.deviceId},
      ${params.individualId || null}::uuid,
      ${params.circleId || null}::uuid,
      ${params.portalId || null}::uuid,
      ${params.appVersion || null},
      NOW()
    )
    ON CONFLICT (tenant_id, device_id) 
    DO UPDATE SET
      last_seen_at = NOW(),
      individual_id = COALESCE(EXCLUDED.individual_id, cc_sync_sessions.individual_id),
      circle_id = COALESCE(EXCLUDED.circle_id, cc_sync_sessions.circle_id),
      portal_id = COALESCE(EXCLUDED.portal_id, cc_sync_sessions.portal_id),
      app_version = COALESCE(EXCLUDED.app_version, cc_sync_sessions.app_version)
    RETURNING id, tenant_id, circle_id, portal_id, individual_id, device_id, 
              app_version, last_seen_at, created_at, metadata
  `);
  
  const row = result.rows[0] as any;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    portalId: row.portal_id,
    individualId: row.individual_id,
    deviceId: row.device_id,
    appVersion: row.app_version,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    metadata: row.metadata || {}
  };
}

// ============================================================
// UPLOAD MANAGEMENT
// ============================================================

/**
 * Initialize an upload for offline evidence
 * Returns a key hint for R2 storage
 */
export async function initializeUpload(params: {
  tenantId: string;
  deviceId: string;
  clientRequestId: string;
  contentMime?: string | null;
}): Promise<UploadInitResult> {
  const timestamp = Date.now();
  const r2KeyHint = `offline/${params.tenantId}/${params.deviceId}/${params.clientRequestId}_${timestamp}`;
  
  // Store pending upload in metadata (lightweight cache)
  await db.execute(sql`
    INSERT INTO cc_sync_sessions (
      tenant_id, device_id, metadata, last_seen_at
    ) VALUES (
      ${params.tenantId}::uuid,
      ${params.deviceId},
      jsonb_build_object('pending_uploads', jsonb_build_array(jsonb_build_object(
        'client_request_id', ${params.clientRequestId},
        'r2_key_hint', ${r2KeyHint},
        'content_mime', ${params.contentMime || null},
        'initiated_at', ${new Date().toISOString()}
      ))),
      NOW()
    )
    ON CONFLICT (tenant_id, device_id)
    DO UPDATE SET
      metadata = jsonb_set(
        COALESCE(cc_sync_sessions.metadata, '{}'::jsonb),
        '{pending_uploads}',
        COALESCE(cc_sync_sessions.metadata->'pending_uploads', '[]'::jsonb) || 
        jsonb_build_array(jsonb_build_object(
          'client_request_id', ${params.clientRequestId},
          'r2_key_hint', ${r2KeyHint},
          'content_mime', ${params.contentMime || null},
          'initiated_at', ${new Date().toISOString()}
        ))
      ),
      last_seen_at = NOW()
  `);
  
  return {
    r2_key_hint: r2KeyHint,
    upload_url_or_token: r2KeyHint // In a real implementation, this would be a presigned URL
  };
}

/**
 * Complete an upload - record that bytes are present in R2
 */
export async function completeUpload(params: {
  tenantId: string;
  deviceId: string;
  clientRequestId: string;
  r2Key: string;
  contentSha256?: string | null;
}): Promise<{ verified: boolean; computedSha256?: string }> {
  // In a real implementation, we would:
  // 1. Check that the object exists in R2
  // 2. Compute SHA256 if not provided
  // 3. Verify hash matches if provided
  
  // For now, just record completion in session metadata
  await db.execute(sql`
    UPDATE cc_sync_sessions
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{completed_uploads}',
      COALESCE(metadata->'completed_uploads', '[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object(
        'client_request_id', ${params.clientRequestId},
        'r2_key', ${params.r2Key},
        'content_sha256', ${params.contentSha256 || null},
        'completed_at', ${new Date().toISOString()}
      ))
    ),
    last_seen_at = NOW()
    WHERE tenant_id = ${params.tenantId}::uuid AND device_id = ${params.deviceId}
  `);
  
  return { verified: true, computedSha256: params.contentSha256 || undefined };
}

// ============================================================
// BATCH INGEST
// ============================================================

/**
 * Check if an evidence object already exists by client_request_id
 */
async function findExistingEvidence(
  tenantId: string,
  clientRequestId: string
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM cc_evidence_objects
    WHERE tenant_id = ${tenantId}::uuid AND client_request_id = ${clientRequestId}
    LIMIT 1
  `);
  
  if (result.rows && result.rows.length > 0) {
    return (result.rows[0] as any).id;
  }
  return null;
}

/**
 * Compute content SHA256 for an ingest item
 */
function computeItemContentSha256(item: IngestItem): string {
  if (item.content_sha256) {
    return item.content_sha256;
  }
  
  switch (item.source_type) {
    case 'manual_note':
      if (item.payload.text) {
        const canonical = canonicalizeJson({ text: item.payload.text });
        return sha256Hex(canonical);
      }
      break;
    case 'json_snapshot':
      if (item.payload.json) {
        const canonical = canonicalizeJson(item.payload.json);
        return sha256Hex(canonical);
      }
      break;
    case 'url_snapshot':
      if (item.payload.url) {
        // Hash URL + fetch metadata for now; actual content hash comes from server fetch
        const urlMeta = canonicalizeJson({
          url: item.payload.url,
          fetched_at: item.payload.fetched_at_device || null,
          http_status: item.payload.http_status || null
        });
        return sha256Hex(urlMeta);
      }
      break;
    case 'file_r2':
      // For files, content_sha256 should be provided or computed from bytes
      // Return placeholder that will be updated when bytes are uploaded
      return 'pending_' + item.client_request_id;
  }
  
  return sha256Hex('empty_' + item.client_request_id);
}

/**
 * Create an evidence object from an ingest item
 */
async function createEvidenceFromItem(
  tenantId: string,
  individualId: string | null,
  item: IngestItem
): Promise<string> {
  const contentSha256 = computeItemContentSha256(item);
  const isPendingBytes = item.source_type === 'file_r2' && !item.payload.r2_key;
  
  // Build content canonical JSON for manual_note and json_snapshot
  let contentCanonicalJson: Record<string, unknown> | null = null;
  if (item.source_type === 'manual_note' && item.payload.text) {
    contentCanonicalJson = { text: item.payload.text };
  } else if (item.source_type === 'json_snapshot' && item.payload.json) {
    contentCanonicalJson = item.payload.json;
  }
  
  // Build device metadata
  const deviceMetadata = {
    device: {
      created_at: item.created_at_device,
      captured_at: item.captured_at_device || null,
      occurred_at: item.occurred_at_device || null
    },
    offline: {
      pending_bytes: isPendingBytes,
      local_id: item.local_id
    }
  };
  
  const result = await db.execute(sql`
    INSERT INTO cc_evidence_objects (
      tenant_id, circle_id, portal_id, created_by_individual_id,
      source_type, title, description,
      occurred_at, captured_at,
      content_mime, content_bytes, content_sha256, content_canonical_json,
      r2_key, url, url_fetched_at, url_http_status,
      client_request_id, pending_bytes, metadata
    ) VALUES (
      ${tenantId}::uuid,
      ${item.circle_id || null}::uuid,
      ${item.portal_id || null}::uuid,
      ${individualId}::uuid,
      ${item.source_type as EvidenceSourceType}::cc_evidence_source_type_enum,
      ${item.title},
      ${item.description || null},
      ${item.occurred_at_device ? new Date(item.occurred_at_device) : null},
      ${item.captured_at_device ? new Date(item.captured_at_device) : null},
      ${item.content_mime || null},
      ${item.content_bytes || null},
      ${contentSha256},
      ${contentCanonicalJson ? JSON.stringify(contentCanonicalJson) : null}::jsonb,
      ${item.payload.r2_key || null},
      ${item.payload.url || null},
      ${item.payload.fetched_at_device ? new Date(item.payload.fetched_at_device) : null},
      ${item.payload.http_status || null},
      ${item.client_request_id},
      ${isPendingBytes},
      ${JSON.stringify(deviceMetadata)}::jsonb
    )
    RETURNING id
  `);
  
  const evidenceId = (result.rows[0] as any).id;
  
  // Append 'created' event
  await appendEvidenceEvent({
    evidenceId,
    tenantId,
    circleId: item.circle_id,
    eventType: 'created',
    payload: {
      source: 'offline_ingest',
      device_created_at: item.created_at_device,
      pending_bytes: isPendingBytes
    },
    actorIndividualId: individualId,
    clientRequestId: `${item.client_request_id}_created`
  });
  
  // For file_r2 with r2_key, append 'uploaded' event
  if (item.source_type === 'file_r2' && item.payload.r2_key) {
    await appendEvidenceEvent({
      evidenceId,
      tenantId,
      circleId: item.circle_id,
      eventType: 'uploaded',
      payload: {
        r2_key: item.payload.r2_key,
        content_sha256: contentSha256
      },
      actorIndividualId: individualId,
      clientRequestId: `${item.client_request_id}_uploaded`
    });
  }
  
  // For url_snapshot, append 'fetched' event
  if (item.source_type === 'url_snapshot' && item.payload.url) {
    await appendEvidenceEvent({
      evidenceId,
      tenantId,
      circleId: item.circle_id,
      eventType: 'fetched',
      payload: {
        url: item.payload.url,
        fetched_at_device: item.payload.fetched_at_device,
        http_status: item.payload.http_status
      },
      actorIndividualId: individualId,
      clientRequestId: `${item.client_request_id}_fetched`
    });
  }
  
  // For manual_note and json_snapshot, append 'annotated' event
  if (item.source_type === 'manual_note' || item.source_type === 'json_snapshot') {
    await appendEvidenceEvent({
      evidenceId,
      tenantId,
      circleId: item.circle_id,
      eventType: 'annotated',
      payload: {
        content_sha256: contentSha256
      },
      actorIndividualId: individualId,
      clientRequestId: `${item.client_request_id}_annotated`
    });
  }
  
  return evidenceId;
}

/**
 * Process a single ingest item
 */
async function processIngestItem(
  tenantId: string,
  individualId: string | null,
  item: IngestItem
): Promise<IngestResult> {
  try {
    // Check for existing evidence (idempotency)
    const existingId = await findExistingEvidence(tenantId, item.client_request_id);
    if (existingId) {
      // Check if held and would be mutated
      const isHeld = await isRowOnActiveHold(tenantId, 'evidence_object', existingId);
      if (isHeld) {
        return {
          client_request_id: item.client_request_id,
          status: 'rejected',
          evidence_object_id: existingId,
          reason: 'LEGAL_HOLD_ACTIVE'
        };
      }
      
      return {
        client_request_id: item.client_request_id,
        status: 'already_applied',
        evidence_object_id: existingId
      };
    }
    
    // Validate content hash if provided
    if (item.content_sha256 && item.source_type !== 'file_r2') {
      const computedSha = computeItemContentSha256({ ...item, content_sha256: undefined });
      if (computedSha !== item.content_sha256) {
        return {
          client_request_id: item.client_request_id,
          status: 'rejected',
          reason: 'HASH_MISMATCH'
        };
      }
    }
    
    // Create new evidence
    const evidenceId = await createEvidenceFromItem(tenantId, individualId, item);
    
    return {
      client_request_id: item.client_request_id,
      status: 'created_new',
      evidence_object_id: evidenceId
    };
  } catch (error) {
    return {
      client_request_id: item.client_request_id,
      status: 'rejected',
      reason: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Ingest a batch of offline evidence items
 */
export async function ingestBatch(
  tenantId: string,
  individualId: string | null,
  batch: IngestBatch
): Promise<BatchIngestResponse> {
  // Check for existing batch (idempotency)
  const existingBatch = await db.execute(sql`
    SELECT id, status, batch_json
    FROM cc_offline_ingest_queue
    WHERE tenant_id = ${tenantId}::uuid
      AND device_id = ${batch.device_id}
      AND batch_client_request_id = ${batch.batch_client_request_id}
    LIMIT 1
  `);
  
  if (existingBatch.rows && existingBatch.rows.length > 0) {
    const existing = existingBatch.rows[0] as any;
    if (existing.status === 'processed') {
      // Return cached results from the processed batch with from_cache indicator
      const batchJson = existing.batch_json as any;
      if (batchJson.results) {
        return {
          batch_client_request_id: batch.batch_client_request_id,
          results: batchJson.results,
          from_cache: true // Indicates this is a duplicate request - batch was already processed
        };
      }
    }
  }
  
  // Insert batch record
  await db.execute(sql`
    INSERT INTO cc_offline_ingest_queue (
      tenant_id, individual_id, device_id,
      batch_client_request_id, batch_created_at,
      batch_json, status
    ) VALUES (
      ${tenantId}::uuid,
      ${individualId}::uuid,
      ${batch.device_id},
      ${batch.batch_client_request_id},
      ${new Date(batch.batch_created_at)},
      ${JSON.stringify({ items: batch.items })}::jsonb,
      'received'
    )
    ON CONFLICT (tenant_id, device_id, batch_client_request_id) DO NOTHING
  `);
  
  // Process items synchronously
  const results: IngestResult[] = [];
  for (const item of batch.items) {
    const result = await processIngestItem(tenantId, individualId, item);
    results.push(result);
  }
  
  // Determine overall batch status
  const allApplied = results.every(r => r.status === 'created_new' || r.status === 'already_applied');
  const allRejected = results.every(r => r.status === 'rejected');
  const batchResult = allRejected ? 'rejected' : (allApplied ? 'applied' : 'partially_applied');
  
  // Update batch record with results
  await db.execute(sql`
    UPDATE cc_offline_ingest_queue
    SET status = 'processed',
        batch_json = jsonb_set(batch_json, '{results}', ${JSON.stringify(results)}::jsonb)
    WHERE tenant_id = ${tenantId}::uuid
      AND device_id = ${batch.device_id}
      AND batch_client_request_id = ${batch.batch_client_request_id}
  `);
  
  // Write reconciliation log
  await db.execute(sql`
    INSERT INTO cc_offline_reconcile_log (
      tenant_id, device_id, batch_client_request_id, result, details
    ) VALUES (
      ${tenantId}::uuid,
      ${batch.device_id},
      ${batch.batch_client_request_id},
      ${batchResult}::cc_reconcile_result,
      ${JSON.stringify({
        item_count: batch.items.length,
        created: results.filter(r => r.status === 'created_new').length,
        already_applied: results.filter(r => r.status === 'already_applied').length,
        rejected: results.filter(r => r.status === 'rejected').length
      })}::jsonb
    )
  `);
  
  return {
    batch_client_request_id: batch.batch_client_request_id,
    results
  };
}

// ============================================================
// SEAL AFTER SYNC
// ============================================================

/**
 * Seal multiple evidence objects after sync
 */
export async function sealEvidenceObjects(
  tenantId: string,
  individualId: string | null,
  evidenceObjectIds: string[],
  reason?: string
): Promise<{ id: string; sealed: boolean; error?: string }[]> {
  const results: { id: string; sealed: boolean; error?: string }[] = [];
  
  for (const id of evidenceObjectIds) {
    try {
      // Check if already sealed
      const check = await db.execute(sql`
        SELECT chain_status, pending_bytes
        FROM cc_evidence_objects
        WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      `);
      
      if (!check.rows || check.rows.length === 0) {
        results.push({ id, sealed: false, error: 'Not found' });
        continue;
      }
      
      const obj = check.rows[0] as any;
      if (obj.chain_status === 'sealed') {
        results.push({ id, sealed: true }); // Already sealed
        continue;
      }
      
      if (obj.pending_bytes) {
        results.push({ id, sealed: false, error: 'PENDING_BYTES' });
        continue;
      }
      
      // Seal the evidence
      await db.execute(sql`
        UPDATE cc_evidence_objects
        SET chain_status = 'sealed',
            sealed_at = NOW(),
            sealed_by_individual_id = ${individualId}::uuid,
            seal_reason = ${reason || 'Sealed after offline sync'}
        WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      `);
      
      // Append sealed event
      await appendEvidenceEvent({
        evidenceId: id,
        tenantId,
        eventType: 'sealed',
        payload: {
          reason: reason || 'Sealed after offline sync',
          source: 'offline_seal'
        },
        actorIndividualId: individualId
      });
      
      results.push({ id, sealed: true });
    } catch (error) {
      results.push({ 
        id, 
        sealed: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return results;
}

// ============================================================
// URL SNAPSHOT FETCH
// ============================================================

const MAX_FETCH_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/json', 'application/pdf'];

/**
 * Fetch a URL snapshot with safety caps
 */
export async function fetchUrlSnapshot(url: string): Promise<{
  success: boolean;
  content?: Buffer;
  contentType?: string;
  httpStatus?: number;
  headers?: Record<string, string>;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CommunityCanvas-EvidenceCollector/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get('content-type') || '';
    const isAllowed = ALLOWED_CONTENT_TYPES.some(t => contentType.includes(t));
    
    if (!isAllowed) {
      return {
        success: false,
        error: `Content type ${contentType} not allowed`
      };
    }
    
    // Read with size limit
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    
    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: 'No response body' };
    }
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalBytes += value.length;
      if (totalBytes > MAX_FETCH_BYTES) {
        reader.cancel();
        return { success: false, error: 'Response too large' };
      }
      
      chunks.push(Buffer.from(value));
    }
    
    const content = Buffer.concat(chunks);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    return {
      success: true,
      content,
      contentType,
      httpStatus: response.status,
      headers
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fetch failed'
    };
  }
}
