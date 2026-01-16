# P2.13 Preserve Record → Generate Pack

## Overview

P2.13 provides a system for ingesting external records during/after emergencies:
- Evacuation orders, utility outages, media articles, alerts, official advisories
- Deterministic snapshots with SHA256 hashing stored to R2
- Chain-of-custody events via P2.5 Evidence System
- Deferred capture queue for offline/low-signal environments
- Emergency record pack generation with sealed bundles

## Database Schema

### Tables

#### cc_record_sources
Configurable sources to capture from.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant owning the source |
| portal_id | uuid | Optional portal scope |
| circle_id | uuid | Optional circle scope |
| source_type | text | Type: url, rss, json_feed, webhook, manual_url_list |
| title | text | Human-readable title |
| description | text | Optional description |
| base_url | text | Base URL for the source |
| config | jsonb | Source-specific configuration |
| enabled | boolean | Whether source is active |
| created_by_individual_id | uuid | Who created the source |
| client_request_id | text | Idempotency key |

**Config Examples:**

```json
// URL source
{ "url": "https://example.com/alerts", "include_headers": true }

// RSS source
{ "feed_url": "https://example.com/feed.rss", "match_keywords": ["tsunami", "evacuation"], "max_items": 20 }

// JSON feed
{ "url": "https://api.example.com/alerts.json", "path_items": "$.items" }

// Manual URL list
{ "urls": ["https://example.com/alert1", "https://example.com/alert2"] }
```

#### cc_record_captures
Capture attempt log (append-only).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant |
| run_id | uuid | Optional emergency run |
| source_id | uuid | Optional source reference |
| capture_type | text | Type: evac_order, utility_outage, media_article, advisory, alert, generic |
| requested_at | timestamptz | When capture was requested |
| requested_by_individual_id | uuid | Who requested the capture |
| status | text | Status: pending, fetched, stored, sealed, failed, deferred |
| target_url | text | URL being captured |
| http_status | int | HTTP response status |
| response_headers | jsonb | HTTP response headers |
| content_mime | text | Content MIME type |
| content_bytes | bigint | Content size in bytes |
| content_sha256 | text | SHA256 hash of content |
| r2_key | text | R2 storage key |
| evidence_object_id | uuid | P2.5 evidence object reference |
| error | jsonb | Error details if failed |
| client_request_id | text | Idempotency key |

#### cc_record_capture_queue
Deferred/async capture queue.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant |
| run_id | uuid | Optional emergency run |
| capture_id | uuid | Reference to capture record |
| next_attempt_at | timestamptz | When to retry |
| attempt_count | int | Number of attempts |
| status | text | Status: queued, processing, done, deadletter |
| last_error | jsonb | Last error if failed |

## API Endpoints

### Sources

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/records/sources | Create new source |
| GET | /api/records/sources | List sources |
| POST | /api/records/sources/:id/capture | Trigger capture from source |

### Manual Capture

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/records/capture-url | Capture a URL directly |

**Request Body:**
```json
{
  "run_id": "uuid (optional)",
  "url": "https://example.com/alert",
  "capture_type": "evac_order",
  "include_headers": true,
  "defer_if_fail": false,
  "client_request_id": "optional-idempotency-key"
}
```

### Queue Processing

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/records/queue/process | Process deferred captures |
| GET | /api/records/queue/stats | Get queue statistics |

### Emergency Run Integration

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/emergency/runs/:id/captures | List captures for run |
| POST | /api/emergency/runs/:id/capture-url | Capture URL for run |
| POST | /api/emergency/runs/:id/generate-record-pack | Generate record pack |
| POST | /api/emergency/runs/:id/authority/refresh | Refresh authority share with new evidence |

## Core Functions

### fetchAndStoreUrlSnapshot()

Captures a URL with deterministic snapshot.

```typescript
const result = await fetchAndStoreUrlSnapshot({
  tenantId: '...',
  runId: '...',  // Optional
  url: 'https://example.com/evacuation-order',
  captureType: 'evac_order',
  includeHeaders: true,
  requestedBy: 'individual-id',
  autoSeal: true,  // Auto-seal evidence object
  deferIfFail: false,  // Queue for later if fails
});
// result: { captureId, status, evidenceObjectId, contentSha256, r2Key }
```

**Behavior:**
1. Creates capture record with status='pending'
2. Fetches URL with timeout (30s) and size limit (5MB)
3. Validates content type (text/html, application/pdf, application/json, text/plain, XML)
4. Computes SHA256 of raw bytes
5. Uploads to R2: `record-captures/{tenantId}/{captureId}/{sha256prefix}`
6. Creates P2.5 evidence object with custody events
7. Auto-seals if requested
8. Logs run event if attached to emergency run

### captureFromSource()

Captures from a configured source.

```typescript
const results = await captureFromSource({
  tenantId: '...',
  sourceId: '...',
  runId: '...',
  requestedBy: '...',
});
// results: CaptureResult[]
```

**Source Type Behavior:**
- `url`: Captures single configured URL
- `rss`: Captures feed, then captures top N items matching keywords
- `json_feed`: Captures JSON feed as single snapshot
- `manual_url_list`: Captures each URL in list

### generateEmergencyRecordPack()

Generates a sealed evidence bundle from all captures.

```typescript
const result = await generateEmergencyRecordPack({
  runId: '...',
  tenantId: '...',
  title: 'Tsunami Evacuation Records',
  includeTypes: ['evac_order', 'advisory'],
  sealBundle: true,
  generatedBy: 'individual-id',
});
// result: { bundleId, manifestSha256, count }
```

**Behavior:**
1. Validates run exists
2. Creates legal hold if missing (P2.7)
3. Gathers all evidence objects from captures
4. Seals any unsealed evidence objects
5. Creates manifest with all evidence metadata
6. Creates sealed bundle (type=emergency_pack)
7. Stores manifest to R2
8. Updates run metadata with pack reference
9. Logs pack_generated run event

### processCaptureQueue()

Processes deferred captures.

```typescript
const result = await processCaptureQueue({ limit: 10 });
// result: { processed, succeeded, failed, deadlettered }
```

**Behavior:**
- Picks queued items ready for processing (FOR UPDATE SKIP LOCKED)
- Retries fetch with exponential backoff
- Deadletters after 5 failed attempts

## Deterministic Snapshot Rules

1. **Raw Bytes**: Content is stored as received (no normalization)
2. **SHA256 Hash**: Computed from raw bytes
3. **R2 Key**: Includes hash prefix for deduplication
4. **Headers**: Stored if include_headers=true
5. **Timestamp**: Captured at fetch time

## Deferred Queue Behavior

- Failed captures can be queued for retry
- Exponential backoff: 1min, 2min, 4min, 8min, 16min
- Max 5 attempts before deadletter
- Queue processed via `/api/records/queue/process` endpoint
- Can be invoked on-demand or via scheduled job

## Integration Points

### P2.5 Evidence Chain
- Creates evidence objects for each capture
- Records custody events (created, sealed)
- Links captures to evidence via evidence_object_id

### P2.7 Legal Holds
- Auto-creates legal hold on pack generation if missing
- Prevents deletion of captured evidence

### P2.9 Authority Sharing
- Authority refresh endpoint adds new evidence to existing shares
- Logs authority_shared event with "refreshed" action

### P2.12 Emergency Runs
- Captures can be associated with emergency runs
- Run events logged for each capture
- Pack generation links bundle to run

## Operational Guidance

### During Emergency (e.g., Tsunami Warning)

1. **Start Emergency Run**
   ```
   POST /api/emergency/runs
   { "run_type": "tsunami", "template_id": "..." }
   ```

2. **Capture Critical Records**
   ```
   POST /api/emergency/runs/:id/capture-url
   { "url": "https://gov.bc.ca/evac-order-123", "capture_type": "evac_order" }
   ```

3. **Capture from Configured Sources**
   ```
   POST /api/records/sources/:id/capture
   { "run_id": "..." }
   ```

4. **Generate Record Pack**
   ```
   POST /api/emergency/runs/:id/generate-record-pack
   { "title": "Tsunami Evacuation Evidence Pack" }
   ```

5. **Share with Authorities** (if needed)
   ```
   POST /api/emergency/runs/:id/authority/refresh
   ```

### Offline/Low-Signal Environment

1. Queue URLs for later capture with `defer_if_fail: true`
2. When connectivity returns, process queue:
   ```
   POST /api/records/queue/process
   ```

## Testing

Run tests:
```bash
npx vitest run tests/p2.13-record-capture.test.ts
```

Test coverage includes:
- Source creation and management
- Capture record creation and status updates
- Queue entry creation and lifecycle
- Emergency run integration
- Evidence object linking
- RLS tenant isolation
- Pack bundle type support
