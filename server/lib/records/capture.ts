import { serviceQuery } from '../../db/tenantDb';
import { uploadToR2, getR2SignedUrl } from '../media/r2Storage';
import crypto from 'crypto';

const MAX_BYTES_DEFAULT = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 30000;
const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/pdf',
  'application/json',
  'text/plain',
  'text/xml',
  'application/xml',
  'application/rss+xml',
  'application/atom+xml',
];

interface FetchSnapshotParams {
  tenantId: string;
  runId?: string;
  url: string;
  includeHeaders?: boolean;
  captureType: 'evac_order' | 'utility_outage' | 'media_article' | 'advisory' | 'alert' | 'generic';
  requestedBy?: string;
  clientRequestId?: string;
  sourceId?: string;
  maxBytes?: number;
  autoSeal?: boolean;
  deferIfFail?: boolean;
}

interface CaptureResult {
  captureId: string;
  status: 'fetched' | 'stored' | 'sealed' | 'failed' | 'deferred';
  evidenceObjectId?: string;
  contentSha256?: string;
  r2Key?: string;
  error?: any;
}

function computeEventHash(tenantId: string, evidenceObjectId: string, eventType: string, payload: any, prevHash?: string): { canonical: any; sha256: string } {
  const canonical = {
    tenant_id: tenantId,
    evidence_object_id: evidenceObjectId,
    event_type: eventType,
    payload,
    prev_event_sha256: prevHash || null,
  };
  const sha256 = crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return { canonical, sha256 };
}

export async function fetchAndStoreUrlSnapshot(params: FetchSnapshotParams): Promise<CaptureResult> {
  const {
    tenantId,
    runId,
    url,
    includeHeaders = true,
    captureType,
    requestedBy,
    clientRequestId,
    sourceId,
    maxBytes = MAX_BYTES_DEFAULT,
    autoSeal = true,
    deferIfFail = false,
  } = params;

  // Create capture record
  const captureResult = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_record_captures (
      tenant_id, run_id, source_id, capture_type, requested_by_individual_id,
      status, target_url, client_request_id
    ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
    RETURNING id`,
    [tenantId, runId, sourceId, captureType, requestedBy, url, clientRequestId]
  );
  const captureId = captureResult.rows[0].id;

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CommunityCanvas-RecordCapture/1.0',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const httpStatus = response.status;
    const contentType = response.headers.get('content-type') || '';
    const mimeBase = contentType.split(';')[0].trim().toLowerCase();

    // Check content type
    if (!ALLOWED_CONTENT_TYPES.some(t => mimeBase.startsWith(t))) {
      throw new Error(`CONTENT_TYPE_NOT_ALLOWED: ${mimeBase}`);
    }

    // Read body with size limit
    const reader = response.body?.getReader();
    if (!reader) throw new Error('NO_RESPONSE_BODY');

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel();
          throw new Error(`MAX_BYTES_EXCEEDED: ${totalBytes} > ${maxBytes}`);
        }
        chunks.push(value);
      }
    }

    const rawBytes = Buffer.concat(chunks);
    const contentSha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');

    // Store to R2
    const r2Key = `record-captures/${tenantId}/${captureId}/${contentSha256.substring(0, 16)}`;
    await uploadToR2(r2Key, rawBytes, mimeBase);

    // Extract headers if requested
    const responseHeaders = includeHeaders
      ? Object.fromEntries(response.headers.entries())
      : null;

    // Update capture with fetched data
    await serviceQuery(
      `UPDATE cc_record_captures SET
        status = 'stored',
        http_status = $2,
        response_headers = $3,
        content_mime = $4,
        content_bytes = $5,
        content_sha256 = $6,
        r2_key = $7
      WHERE id = $1`,
      [captureId, httpStatus, JSON.stringify(responseHeaders), mimeBase, rawBytes.length, contentSha256, r2Key]
    );

    // Create evidence object (P2.5) using correct column names
    const evidenceResult = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_evidence_objects (
        tenant_id, source_type, occurred_at, content_sha256, r2_key,
        content_mime, content_bytes, url, url_fetched_at, url_http_status,
        url_response_headers, created_by_individual_id, metadata
      ) VALUES ($1, 'url_snapshot', now(), $2, $3, $4, $5, $6, now(), $7, $8, $9, $10)
      RETURNING id`,
      [
        tenantId,
        contentSha256,
        r2Key,
        mimeBase,
        rawBytes.length,
        url,
        httpStatus,
        JSON.stringify(responseHeaders),
        requestedBy,
        JSON.stringify({ capture_type: captureType, capture_id: captureId }),
      ]
    );
    const evidenceObjectId = evidenceResult.rows[0].id;

    // Link capture to evidence object
    await serviceQuery(
      `UPDATE cc_record_captures SET evidence_object_id = $2 WHERE id = $1`,
      [captureId, evidenceObjectId]
    );

    // Add custody event for creation
    const createEvent = computeEventHash(tenantId, evidenceObjectId, 'created', { url, capture_id: captureId });
    await serviceQuery(
      `INSERT INTO cc_evidence_events (
        tenant_id, evidence_object_id, event_type, event_at, actor_individual_id, 
        event_payload, event_canonical_json, event_sha256
      ) VALUES ($1, $2, 'created', now(), $3, $4, $5, $6)`,
      [tenantId, evidenceObjectId, requestedBy, JSON.stringify({ url, capture_id: captureId }), createEvent.canonical, createEvent.sha256]
    );

    // Auto-seal if requested
    let status: 'stored' | 'sealed' = 'stored';
    if (autoSeal) {
      await serviceQuery(
        `UPDATE cc_evidence_objects SET chain_status = 'sealed', sealed_at = now(), sealed_by_individual_id = $2 WHERE id = $1`,
        [evidenceObjectId, requestedBy]
      );
      
      const sealEvent = computeEventHash(tenantId, evidenceObjectId, 'sealed', { auto_sealed: true }, createEvent.sha256);
      await serviceQuery(
        `INSERT INTO cc_evidence_events (
          tenant_id, evidence_object_id, event_type, event_at, actor_individual_id, 
          event_payload, event_canonical_json, event_sha256, prev_event_sha256
        ) VALUES ($1, $2, 'sealed', now(), $3, $4, $5, $6, $7)`,
        [tenantId, evidenceObjectId, requestedBy, JSON.stringify({ auto_sealed: true }), sealEvent.canonical, sealEvent.sha256, createEvent.sha256]
      );
      
      await serviceQuery(
        `UPDATE cc_record_captures SET status = 'sealed' WHERE id = $1`,
        [captureId]
      );
      status = 'sealed';
    }

    // Log run event if attached to a run
    if (runId) {
      await serviceQuery(
        `INSERT INTO cc_emergency_run_events (
          tenant_id, run_id, event_type, event_at, actor_individual_id, event_payload
        ) VALUES ($1, $2, 'record_captured', now(), $3, $4)`,
        [tenantId, runId, requestedBy, JSON.stringify({
          capture_id: captureId,
          evidence_object_id: evidenceObjectId,
          url,
          content_sha256: contentSha256,
        })]
      );
    }

    return {
      captureId,
      status,
      evidenceObjectId,
      contentSha256,
      r2Key,
    };
  } catch (err: any) {
    const errorPayload = {
      message: err.message || String(err),
      code: err.code,
      name: err.name,
    };

    if (deferIfFail) {
      // Queue for later
      await serviceQuery(
        `UPDATE cc_record_captures SET status = 'deferred', error = $2 WHERE id = $1`,
        [captureId, JSON.stringify(errorPayload)]
      );
      await serviceQuery(
        `INSERT INTO cc_record_capture_queue (tenant_id, run_id, capture_id) VALUES ($1, $2, $3)`,
        [tenantId, runId, captureId]
      );
      return { captureId, status: 'deferred', error: errorPayload };
    }

    await serviceQuery(
      `UPDATE cc_record_captures SET status = 'failed', error = $2 WHERE id = $1`,
      [captureId, JSON.stringify(errorPayload)]
    );

    return { captureId, status: 'failed', error: errorPayload };
  }
}

interface CaptureFromSourceParams {
  tenantId: string;
  sourceId: string;
  runId?: string;
  requestedBy?: string;
}

export async function captureFromSource(params: CaptureFromSourceParams): Promise<CaptureResult[]> {
  const { tenantId, sourceId, runId, requestedBy } = params;

  // Get source config
  const sourceResult = await serviceQuery<{
    source_type: string;
    config: any;
    base_url: string;
  }>(
    `SELECT source_type, config, base_url FROM cc_record_sources WHERE id = $1 AND tenant_id = $2`,
    [sourceId, tenantId]
  );

  if (sourceResult.rows.length === 0) {
    throw new Error('SOURCE_NOT_FOUND');
  }

  const { source_type, config, base_url } = sourceResult.rows[0];
  const results: CaptureResult[] = [];

  switch (source_type) {
    case 'url': {
      const url = config.url || base_url;
      if (!url) throw new Error('NO_URL_CONFIGURED');
      const result = await fetchAndStoreUrlSnapshot({
        tenantId,
        runId,
        url,
        captureType: 'generic',
        requestedBy,
        sourceId,
        includeHeaders: config.include_headers ?? true,
      });
      results.push(result);
      break;
    }

    case 'rss': {
      const feedUrl = config.feed_url || base_url;
      if (!feedUrl) throw new Error('NO_FEED_URL_CONFIGURED');
      
      // Fetch RSS feed
      const feedResult = await fetchAndStoreUrlSnapshot({
        tenantId,
        runId,
        url: feedUrl,
        captureType: 'generic',
        requestedBy,
        sourceId,
        autoSeal: true,
      });
      results.push(feedResult);

      // Parse feed for item URLs (simplified)
      if (feedResult.status !== 'failed' && feedResult.r2Key) {
        try {
          const maxItems = config.max_items || 10;
          const keywords = config.match_keywords || [];
          
          // Get feed content from R2
          const signedUrl = await getR2SignedUrl(feedResult.r2Key);
          const feedResponse = await fetch(signedUrl);
          const feedText = await feedResponse.text();
          
          // Extract item URLs using regex (basic RSS parsing)
          const linkMatches = feedText.match(/<link[^>]*>([^<]+)<\/link>/gi) || [];
          const itemUrls: string[] = [];
          
          for (const match of linkMatches.slice(0, maxItems)) {
            const urlMatch = match.match(/>([^<]+)</);
            if (urlMatch && urlMatch[1].startsWith('http')) {
              const itemUrl = urlMatch[1];
              
              // Keyword filter
              if (keywords.length > 0) {
                const lowerUrl = itemUrl.toLowerCase();
                if (!keywords.some((kw: string) => lowerUrl.includes(kw.toLowerCase()))) {
                  continue;
                }
              }
              
              itemUrls.push(itemUrl);
            }
          }

          // Capture each item
          for (const itemUrl of itemUrls) {
            try {
              const itemResult = await fetchAndStoreUrlSnapshot({
                tenantId,
                runId,
                url: itemUrl,
                captureType: 'media_article',
                requestedBy,
                sourceId,
                deferIfFail: true,
              });
              results.push(itemResult);
            } catch {
              // Continue on individual item failures
            }
          }
        } catch {
          // Feed parsing failed, just keep the feed snapshot
        }
      }
      break;
    }

    case 'json_feed': {
      const feedUrl = config.url || base_url;
      if (!feedUrl) throw new Error('NO_JSON_URL_CONFIGURED');

      // Capture the JSON feed itself
      const feedResult = await fetchAndStoreUrlSnapshot({
        tenantId,
        runId,
        url: feedUrl,
        captureType: 'generic',
        requestedBy,
        sourceId,
      });
      results.push(feedResult);
      break;
    }

    case 'manual_url_list': {
      const urls = config.urls || [];
      for (const url of urls) {
        try {
          const result = await fetchAndStoreUrlSnapshot({
            tenantId,
            runId,
            url,
            captureType: 'generic',
            requestedBy,
            sourceId,
            deferIfFail: true,
          });
          results.push(result);
        } catch {
          // Continue on failures
        }
      }
      break;
    }

    default:
      throw new Error(`UNSUPPORTED_SOURCE_TYPE: ${source_type}`);
  }

  return results;
}
