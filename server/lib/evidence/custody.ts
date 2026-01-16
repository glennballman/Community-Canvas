/**
 * P2.5 Evidence Chain-of-Custody Engine
 * Server utilities for canonical hashing, event chain management, and verification
 */

import { createHash } from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

// ============================================================
// TYPES
// ============================================================

export type EvidenceSourceType = 'file_r2' | 'url_snapshot' | 'json_snapshot' | 'manual_note' | 'external_feed';
export type EvidenceChainStatus = 'open' | 'sealed' | 'superseded' | 'revoked';
export type EvidenceEventType = 'created' | 'uploaded' | 'fetched' | 'sealed' | 'transferred' | 'accessed' | 'exported' | 'superseded' | 'revoked' | 'annotated';
export type EvidenceBundleType = 'emergency_pack' | 'insurance_claim' | 'dispute_defense' | 'class_action' | 'generic';
export type EvidenceBundleStatus = 'open' | 'sealed' | 'exported';

export interface EvidenceObject {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  createdByIndividualId: string | null;
  sourceType: EvidenceSourceType;
  title: string | null;
  description: string | null;
  occurredAt: Date | null;
  createdAt: Date;
  capturedAt: Date | null;
  contentMime: string | null;
  contentBytes: number | null;
  contentSha256: string;
  contentCanonicalJson: Record<string, unknown> | null;
  r2Bucket: string | null;
  r2Key: string | null;
  url: string | null;
  urlFetchedAt: Date | null;
  urlHttpStatus: number | null;
  urlResponseHeaders: Record<string, string> | null;
  urlExtractedText: string | null;
  chainStatus: EvidenceChainStatus;
  sealedAt: Date | null;
  sealedByIndividualId: string | null;
  sealReason: string | null;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface EvidenceEvent {
  id: string;
  tenantId: string;
  circleId: string | null;
  evidenceObjectId: string;
  eventType: EvidenceEventType;
  eventAt: Date;
  actorIndividualId: string | null;
  actorRole: string | null;
  eventPayload: Record<string, unknown>;
  prevEventId: string | null;
  eventCanonicalJson: Record<string, unknown>;
  eventSha256: string;
  prevEventSha256: string | null;
  clientRequestId: string | null;
}

export interface EvidenceBundle {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  bundleType: EvidenceBundleType;
  title: string;
  description: string | null;
  createdByIndividualId: string | null;
  createdAt: Date;
  bundleStatus: EvidenceBundleStatus;
  manifestJson: Record<string, unknown> | null;
  manifestSha256: string | null;
  sealedAt: Date | null;
  sealedByIndividualId: string | null;
  exportedAt: Date | null;
  exportedByIndividualId: string | null;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface AppendEventInput {
  evidenceId: string;
  tenantId: string;
  circleId?: string | null;
  eventType: EvidenceEventType;
  payload: Record<string, unknown>;
  actorIndividualId?: string | null;
  actorRole?: string | null;
  clientRequestId?: string | null;
}

export interface VerificationResult {
  valid: boolean;
  evidenceObject: EvidenceObject | null;
  eventChain: EvidenceEvent[];
  firstFailureIndex: number | null;
  failureReason: string | null;
}

// ============================================================
// CANONICAL HASHING UTILITIES
// ============================================================

/**
 * Deterministic JSON stringify with sorted keys
 * - Sorts object keys recursively
 * - Preserves array order
 * - No whitespace
 */
export function canonicalizeJson(input: unknown): string {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  if (typeof input === 'boolean' || typeof input === 'number') {
    return JSON.stringify(input);
  }
  
  if (typeof input === 'string') {
    return JSON.stringify(input);
  }
  
  if (Array.isArray(input)) {
    const items = input.map(item => canonicalizeJson(item));
    return `[${items.join(',')}]`;
  }
  
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
      const value = canonicalizeJson(obj[key]);
      return `${JSON.stringify(key)}:${value}`;
    });
    return `{${pairs.join(',')}}`;
  }
  
  return 'null';
}

/**
 * Compute SHA256 hex digest of bytes or string
 */
export function sha256Hex(input: Buffer | string): string {
  const hash = createHash('sha256');
  hash.update(typeof input === 'string' ? Buffer.from(input, 'utf-8') : input);
  return hash.digest('hex');
}

/**
 * Compute content SHA256 based on source type
 * - json_snapshot: hash canonical JSON string bytes
 * - file_r2: should pass actual file bytes
 * - url_snapshot: hash fetched raw bytes
 */
export function computeEvidenceContentSha256(
  sourceType: EvidenceSourceType,
  content: Buffer | string | Record<string, unknown>
): string {
  if (sourceType === 'json_snapshot') {
    const canonical = canonicalizeJson(content);
    return sha256Hex(canonical);
  }
  
  if (typeof content === 'string') {
    return sha256Hex(content);
  }
  
  if (Buffer.isBuffer(content)) {
    return sha256Hex(content);
  }
  
  // Fallback for object content
  const canonical = canonicalizeJson(content);
  return sha256Hex(canonical);
}

// ============================================================
// EVENT CHAIN MANAGEMENT
// ============================================================

/**
 * Get the tip (latest) event for an evidence object
 */
export async function getEvidenceTipEvent(evidenceObjectId: string): Promise<{
  id: string;
  eventSha256: string;
  eventAt: Date;
} | null> {
  const result = await db.execute(sql`
    SELECT id, event_sha256, event_at
    FROM cc_evidence_events
    WHERE evidence_object_id = ${evidenceObjectId}
    ORDER BY event_at DESC, id DESC
    LIMIT 1
  `);
  
  if (!result.rows || result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0] as { id: string; event_sha256: string; event_at: Date };
  return {
    id: row.id,
    eventSha256: row.event_sha256,
    eventAt: row.event_at
  };
}

/**
 * Get full event chain for an evidence object (ordered by time ascending)
 */
export async function getEvidenceEventChain(evidenceObjectId: string): Promise<EvidenceEvent[]> {
  const result = await db.execute(sql`
    SELECT 
      id, tenant_id, circle_id, evidence_object_id, event_type,
      event_at, actor_individual_id, actor_role, event_payload,
      prev_event_id, event_canonical_json, event_sha256, prev_event_sha256,
      client_request_id
    FROM cc_evidence_events
    WHERE evidence_object_id = ${evidenceObjectId}
    ORDER BY event_at ASC, id ASC
  `);
  
  return (result.rows || []).map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    evidenceObjectId: row.evidence_object_id,
    eventType: row.event_type as EvidenceEventType,
    eventAt: row.event_at,
    actorIndividualId: row.actor_individual_id,
    actorRole: row.actor_role,
    eventPayload: row.event_payload || {},
    prevEventId: row.prev_event_id,
    eventCanonicalJson: row.event_canonical_json || {},
    eventSha256: row.event_sha256,
    prevEventSha256: row.prev_event_sha256,
    clientRequestId: row.client_request_id
  }));
}

/**
 * Append a new event to the evidence chain
 * - Computes hash chain (prev_hash + canonical_event_json)
 * - Handles idempotency via client_request_id
 */
export async function appendEvidenceEvent(input: AppendEventInput): Promise<EvidenceEvent> {
  // Check idempotency first
  if (input.clientRequestId) {
    const existing = await db.execute(sql`
      SELECT id, tenant_id, circle_id, evidence_object_id, event_type,
             event_at, actor_individual_id, actor_role, event_payload,
             prev_event_id, event_canonical_json, event_sha256, prev_event_sha256,
             client_request_id
      FROM cc_evidence_events
      WHERE tenant_id = ${input.tenantId}
        AND client_request_id = ${input.clientRequestId}
      LIMIT 1
    `);
    
    if (existing.rows && existing.rows.length > 0) {
      const row = existing.rows[0] as any;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        circleId: row.circle_id,
        evidenceObjectId: row.evidence_object_id,
        eventType: row.event_type,
        eventAt: row.event_at,
        actorIndividualId: row.actor_individual_id,
        actorRole: row.actor_role,
        eventPayload: row.event_payload || {},
        prevEventId: row.prev_event_id,
        eventCanonicalJson: row.event_canonical_json || {},
        eventSha256: row.event_sha256,
        prevEventSha256: row.prev_event_sha256,
        clientRequestId: row.client_request_id
      };
    }
  }
  
  // Get previous event (tip)
  const tipEvent = await getEvidenceTipEvent(input.evidenceId);
  
  // Build canonical event JSON
  const eventCanonical = {
    evidence_object_id: input.evidenceId,
    event_type: input.eventType,
    timestamp: new Date().toISOString(),
    payload: input.payload,
    actor_individual_id: input.actorIndividualId || null
  };
  
  const eventCanonicalStr = canonicalizeJson(eventCanonical);
  
  // Compute hash: sha256(prev_hash + canonical_event_json)
  const prevHash = tipEvent?.eventSha256 || '';
  const eventHash = sha256Hex(prevHash + eventCanonicalStr);
  
  // Insert event
  const result = await db.execute(sql`
    INSERT INTO cc_evidence_events (
      tenant_id, circle_id, evidence_object_id, event_type,
      event_at, actor_individual_id, actor_role, event_payload,
      prev_event_id, event_canonical_json, event_sha256, prev_event_sha256,
      client_request_id
    ) VALUES (
      ${input.tenantId},
      ${input.circleId || null},
      ${input.evidenceId},
      ${input.eventType}::cc_evidence_event_type_enum,
      now(),
      ${input.actorIndividualId || null},
      ${input.actorRole || null},
      ${JSON.stringify(input.payload)}::jsonb,
      ${tipEvent?.id || null},
      ${JSON.stringify(eventCanonical)}::jsonb,
      ${eventHash},
      ${tipEvent?.eventSha256 || null},
      ${input.clientRequestId || null}
    )
    RETURNING id, tenant_id, circle_id, evidence_object_id, event_type,
              event_at, actor_individual_id, actor_role, event_payload,
              prev_event_id, event_canonical_json, event_sha256, prev_event_sha256,
              client_request_id
  `);
  
  const row = result.rows[0] as any;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    evidenceObjectId: row.evidence_object_id,
    eventType: row.event_type,
    eventAt: row.event_at,
    actorIndividualId: row.actor_individual_id,
    actorRole: row.actor_role,
    eventPayload: row.event_payload || {},
    prevEventId: row.prev_event_id,
    eventCanonicalJson: row.event_canonical_json || {},
    eventSha256: row.event_sha256,
    prevEventSha256: row.prev_event_sha256,
    clientRequestId: row.client_request_id
  };
}

// ============================================================
// VERIFICATION
// ============================================================

/**
 * Verify the entire event chain for an evidence object
 * - Recomputes hashes and validates chain integrity
 */
export async function verifyEvidenceChain(evidenceObjectId: string): Promise<VerificationResult> {
  // Get evidence object
  const objResult = await db.execute(sql`
    SELECT id, tenant_id, circle_id, portal_id, created_by_individual_id,
           source_type, title, description, occurred_at, created_at, captured_at,
           content_mime, content_bytes, content_sha256, content_canonical_json,
           r2_bucket, r2_key, url, url_fetched_at, url_http_status,
           url_response_headers, url_extracted_text, chain_status,
           sealed_at, sealed_by_individual_id, seal_reason,
           client_request_id, metadata
    FROM cc_evidence_objects
    WHERE id = ${evidenceObjectId}
  `);
  
  if (!objResult.rows || objResult.rows.length === 0) {
    return {
      valid: false,
      evidenceObject: null,
      eventChain: [],
      firstFailureIndex: null,
      failureReason: 'Evidence object not found'
    };
  }
  
  const row = objResult.rows[0] as any;
  const evidenceObject: EvidenceObject = {
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    portalId: row.portal_id,
    createdByIndividualId: row.created_by_individual_id,
    sourceType: row.source_type,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    capturedAt: row.captured_at,
    contentMime: row.content_mime,
    contentBytes: row.content_bytes,
    contentSha256: row.content_sha256,
    contentCanonicalJson: row.content_canonical_json,
    r2Bucket: row.r2_bucket,
    r2Key: row.r2_key,
    url: row.url,
    urlFetchedAt: row.url_fetched_at,
    urlHttpStatus: row.url_http_status,
    urlResponseHeaders: row.url_response_headers,
    urlExtractedText: row.url_extracted_text,
    chainStatus: row.chain_status,
    sealedAt: row.sealed_at,
    sealedByIndividualId: row.sealed_by_individual_id,
    sealReason: row.seal_reason,
    clientRequestId: row.client_request_id,
    metadata: row.metadata || {}
  };
  
  // Get event chain
  const eventChain = await getEvidenceEventChain(evidenceObjectId);
  
  if (eventChain.length === 0) {
    return {
      valid: false,
      evidenceObject,
      eventChain: [],
      firstFailureIndex: null,
      failureReason: 'No events in chain'
    };
  }
  
  // Verify each event's hash
  let prevHash = '';
  for (let i = 0; i < eventChain.length; i++) {
    const event = eventChain[i];
    
    // Recompute hash
    const canonicalStr = canonicalizeJson(event.eventCanonicalJson);
    const recomputedHash = sha256Hex(prevHash + canonicalStr);
    
    // Check stored hash matches
    if (recomputedHash !== event.eventSha256) {
      return {
        valid: false,
        evidenceObject,
        eventChain,
        firstFailureIndex: i,
        failureReason: `Hash mismatch at event index ${i}: expected ${recomputedHash}, got ${event.eventSha256}`
      };
    }
    
    // Check prev_event_sha256 matches previous
    if (i > 0 && event.prevEventSha256 !== eventChain[i - 1].eventSha256) {
      return {
        valid: false,
        evidenceObject,
        eventChain,
        firstFailureIndex: i,
        failureReason: `Previous hash mismatch at event index ${i}`
      };
    }
    
    prevHash = event.eventSha256;
  }
  
  return {
    valid: true,
    evidenceObject,
    eventChain,
    firstFailureIndex: null,
    failureReason: null
  };
}

// ============================================================
// ACCESS LOGGING (RATE LIMITED)
// ============================================================

/**
 * Log access to evidence with 5-minute dedupe window
 */
export async function logEvidenceAccess(
  tenantId: string,
  evidenceObjectId: string,
  actorIndividualId: string | null,
  action: string
): Promise<void> {
  // Check for recent access (within 5 minutes)
  const recentAccess = await db.execute(sql`
    SELECT id FROM cc_evidence_access_log
    WHERE tenant_id = ${tenantId}
      AND evidence_object_id = ${evidenceObjectId}
      AND actor_individual_id IS NOT DISTINCT FROM ${actorIndividualId}
      AND action = ${action}
      AND accessed_at > now() - interval '5 minutes'
    LIMIT 1
  `);
  
  // Skip if already logged recently
  if (recentAccess.rows && recentAccess.rows.length > 0) {
    return;
  }
  
  // Insert access log
  await db.execute(sql`
    INSERT INTO cc_evidence_access_log (tenant_id, evidence_object_id, actor_individual_id, action)
    VALUES (${tenantId}, ${evidenceObjectId}, ${actorIndividualId}, ${action})
  `);
}

// ============================================================
// BUNDLE MANIFEST
// ============================================================

export interface BundleManifest {
  bundleId: string;
  bundleType: EvidenceBundleType;
  title: string;
  description: string | null;
  createdAt: string;
  sealedAt: string;
  sealedByIndividualId: string | null;
  items: {
    evidenceObjectId: string;
    label: string | null;
    sortOrder: number;
    contentSha256: string;
    tipEventSha256: string;
  }[];
}

export interface CompileBundleManifestOptions {
  /** Explicit sealedAt timestamp for deterministic manifest. If not provided, uses current time. */
  sealedAt?: Date | string;
  /** Individual ID of sealer (optional, for sealed bundles) */
  sealedByIndividualId?: string | null;
}

/**
 * Compile bundle manifest for sealing
 * 
 * For deterministic manifest hashing, pass an explicit sealedAt timestamp.
 * When called without options during the seal operation, a fresh timestamp is used.
 */
export async function compileBundleManifest(
  bundleId: string,
  options?: CompileBundleManifestOptions
): Promise<{
  manifest: BundleManifest;
  manifestSha256: string;
}> {
  // Get bundle info
  const bundleResult = await db.execute(sql`
    SELECT id, bundle_type, title, description, created_at, sealed_at
    FROM cc_evidence_bundles
    WHERE id = ${bundleId}
  `);
  
  if (!bundleResult.rows || bundleResult.rows.length === 0) {
    throw new Error('Bundle not found');
  }
  
  const bundle = bundleResult.rows[0] as any;
  
  // Get items with evidence details
  const itemsResult = await db.execute(sql`
    SELECT 
      bi.evidence_object_id,
      bi.label,
      bi.sort_order,
      eo.content_sha256,
      (
        SELECT event_sha256 
        FROM cc_evidence_events 
        WHERE evidence_object_id = bi.evidence_object_id 
        ORDER BY event_at DESC, id DESC 
        LIMIT 1
      ) as tip_event_sha256
    FROM cc_evidence_bundle_items bi
    JOIN cc_evidence_objects eo ON eo.id = bi.evidence_object_id
    WHERE bi.bundle_id = ${bundleId}
    ORDER BY bi.sort_order ASC, bi.added_at ASC
  `);
  
  // Handle created_at which may be a Date or string depending on driver
  const createdAt = bundle.created_at instanceof Date 
    ? bundle.created_at.toISOString() 
    : String(bundle.created_at);

  // Use explicit sealedAt if provided, otherwise use bundle's sealed_at or current time
  let sealedAt: string;
  if (options?.sealedAt) {
    sealedAt = options.sealedAt instanceof Date 
      ? options.sealedAt.toISOString() 
      : String(options.sealedAt);
  } else if (bundle.sealed_at) {
    sealedAt = bundle.sealed_at instanceof Date 
      ? bundle.sealed_at.toISOString() 
      : String(bundle.sealed_at);
  } else {
    sealedAt = new Date().toISOString();
  }

  const manifest: BundleManifest = {
    bundleId: bundle.id,
    bundleType: bundle.bundle_type,
    title: bundle.title,
    description: bundle.description,
    createdAt,
    sealedAt,
    sealedByIndividualId: options?.sealedByIndividualId ?? null,
    items: (itemsResult.rows || []).map((row: any) => ({
      evidenceObjectId: row.evidence_object_id,
      label: row.label,
      sortOrder: row.sort_order,
      contentSha256: row.content_sha256,
      tipEventSha256: row.tip_event_sha256 || ''
    }))
  };
  
  // Compute manifest hash
  const canonicalManifest = canonicalizeJson(manifest);
  const manifestSha256 = sha256Hex(canonicalManifest);
  
  return { manifest, manifestSha256 };
}
