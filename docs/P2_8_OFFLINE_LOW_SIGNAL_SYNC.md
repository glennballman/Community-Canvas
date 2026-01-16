# P2.8 Offline / Low-Signal Evidence Queue + Reconciliation

## Overview

P2.8 implements an offline/low-signal capture pipeline that allows clients to capture evidence immediately even with no connectivity, then sync later using idempotent, conflict-safe APIs.

### Key Principles

1. **Immediate Capture**: Evidence can be captured without network connectivity
2. **Idempotent Sync**: Same data can be synced multiple times safely
3. **Legal Defensibility**: Preserved via immutable content hashes and append-only custody events
4. **Conflict-Safe**: Clear reconciliation rules prevent data corruption

## Data Model

### cc_sync_sessions

Tracks client device sync sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant scope |
| circle_id | uuid | Optional circle scope |
| portal_id | uuid | Optional portal scope |
| individual_id | uuid | Optional user reference |
| device_id | text | Stable per device install |
| app_version | text | Client app version |
| last_seen_at | timestamptz | Last sync timestamp |
| created_at | timestamptz | Session creation time |
| metadata | jsonb | Extensible metadata |

### cc_offline_ingest_queue

Server-side landing zone for offline batches.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant scope |
| device_id | text | Source device |
| batch_client_request_id | text | Idempotency key per batch |
| batch_created_at | timestamptz | Device-reported batch time |
| received_at | timestamptz | Server receive time |
| batch_json | jsonb | Items metadata + pointers |
| status | enum | received, processed, rejected |
| error | jsonb | Error details if rejected |

### cc_offline_reconcile_log

Append-only reconciliation log for audit trail.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant scope |
| device_id | text | Source device |
| batch_client_request_id | text | Batch reference |
| event_at | timestamptz | Event timestamp |
| result | enum | applied, partially_applied, rejected |
| details | jsonb | Reconciliation details |

## Device Model

### Device ID

Each client installation gets a stable `device_id`:
- Generated once on first launch
- Persisted in local storage
- Format: `device_{nanoid(16)}`

### Session Lifecycle

1. Client calls `/api/offline/sync/session` on network regain
2. Server upserts session, updates `last_seen_at`
3. Session ID returned for correlation

## Batch + Item Schema

### Batch Format

```json
{
  "device_id": "device_abc123",
  "batch_client_request_id": "batch_xyz789",
  "batch_created_at": "2024-01-15T10:30:00Z",
  "items": [...]
}
```

### Item Format

```json
{
  "client_request_id": "item_unique_id",
  "local_id": "client_local_reference",
  "source_type": "manual_note|file_r2|url_snapshot|json_snapshot",
  "title": "Evidence Title",
  "description": "Optional description",
  "created_at_device": "2024-01-15T10:25:00Z",
  "occurred_at_device": "2024-01-15T10:00:00Z",
  "captured_at_device": "2024-01-15T10:25:00Z",
  "circle_id": "optional-uuid",
  "portal_id": "optional-uuid",
  "content_sha256": "optional-client-computed-hash",
  "content_mime": "text/plain",
  "content_bytes": 1234,
  "payload": {
    "text": "For manual_note",
    "json": {},
    "url": "https://...",
    "r2_key": "uploaded-file-key"
  }
}
```

## Idempotency Rules

### Batch Idempotency

- Key: `(tenant_id, device_id, batch_client_request_id)`
- Resubmitting same batch returns cached results with `from_cache: true`
- Original item statuses preserved (e.g., `created_new` not changed to `already_applied`)
- No duplicate processing

### Item Idempotency

- Key: `(tenant_id, client_request_id)`
- Same `client_request_id` always resolves to same evidence object
- Works across different batches

### Reconciliation Response

Each item produces exactly one of:
- `created_new`: New evidence object created
- `already_applied`: Existing evidence found (idempotent)
- `rejected`: Error with reason code

## Pending Bytes Lifecycle

For file uploads when bytes aren't immediately available:

```
1. Ingest item with source_type=file_r2, no r2_key
   → Evidence created with pending_bytes=true
   → Custody event: created (with pending_bytes flag)

2. Client uploads bytes to R2

3. POST /api/offline/upload/complete
   → Server verifies R2 object exists
   → Computes/verifies SHA256
   → Updates evidence with r2_key, content_sha256
   → Clears pending_bytes flag
   → Custody event: uploaded

4. Seal request can now proceed
```

## Hash Verification Rules

### Client-Provided Hash

If client provides `content_sha256`:
1. Server recomputes hash from content
2. If mismatch → `HASH_MISMATCH` rejection
3. Evidence NOT created

### Server-Computed Hash

If no client hash provided:
1. Server computes from payload/bytes
2. Hash stored as authoritative

### Source Type Hashing

| Source Type | Hash Input |
|-------------|------------|
| manual_note | Canonical JSON: `{"text": "..."}` |
| json_snapshot | Canonical JSON of payload |
| url_snapshot | URL metadata (content hash after fetch) |
| file_r2 | Raw file bytes |

## Legal Hold Interactions

### Creating New Evidence

- Always allowed, even during active holds
- Holds don't prevent new evidence creation

### Existing Evidence on Hold

If `client_request_id` matches held evidence:
- Returns `rejected: LEGAL_HOLD_ACTIVE`
- No modifications permitted
- Original evidence preserved

### Scope Inheritance

Holding a claim automatically protects:
- All evidence attached via `cc_claim_inputs`
- All dossiers linked to the claim

## API Endpoints

### POST /api/offline/sync/session

Create/update device sync session.

**Request:**
```json
{
  "device_id": "device_abc123",
  "app_version": "1.0.0",
  "circle_id": "optional-uuid",
  "portal_id": "optional-uuid"
}
```

**Response:**
```json
{
  "session_id": "uuid"
}
```

### POST /api/offline/upload/init

Initialize file upload.

**Request:**
```json
{
  "device_id": "device_abc123",
  "client_request_id": "item_xyz",
  "content_mime": "image/jpeg"
}
```

**Response:**
```json
{
  "upload_url_or_token": "...",
  "r2_key_hint": "offline/tenant/device/key"
}
```

### POST /api/offline/upload/complete

Complete file upload.

**Request:**
```json
{
  "device_id": "device_abc123",
  "client_request_id": "item_xyz",
  "r2_key": "actual-r2-key",
  "content_sha256": "optional-verification-hash"
}
```

### POST /api/offline/ingest

Ingest batch of evidence items.

**Request:** (see Batch Format above)

**Response:**
```json
{
  "batch_client_request_id": "batch_xyz",
  "from_cache": false,
  "results": [
    {
      "client_request_id": "item_1",
      "status": "created_new",
      "evidence_object_id": "uuid"
    },
    {
      "client_request_id": "item_2",
      "status": "rejected",
      "reason": "HASH_MISMATCH"
    }
  ]
}
```

**Note:** When a batch with the same `batch_client_request_id` is submitted again, the response returns cached results with `from_cache: true`. Original item statuses are preserved (e.g., `created_new` remains `created_new`, not changed to `already_applied`).

### POST /api/offline/seal

Seal evidence after sync.

**Request:**
```json
{
  "device_id": "device_abc123",
  "evidence_object_ids": ["uuid1", "uuid2"],
  "reason": "Sealed for preservation"
}
```

**Response:**
```json
{
  "results": [
    {"id": "uuid1", "sealed": true},
    {"id": "uuid2", "sealed": false, "error": "PENDING_BYTES"}
  ]
}
```

### POST /api/offline/fetch-url

Server-side URL fetch for evidence capture.

**Request:**
```json
{
  "url": "https://example.com/page"
}
```

**Response:**
```json
{
  "success": true,
  "content_sha256": "abc123...",
  "content_type": "text/html",
  "http_status": 200,
  "content_bytes": 12345
}
```

## Failure Modes + Retry Behavior

### Client Retry Strategy

1. **Exponential Backoff**: Start at 1s, double each retry, max 60s
2. **Max Attempts**: 5 attempts before marking as failed
3. **Permanent Failures**: HASH_MISMATCH, LEGAL_HOLD_ACTIVE don't retry

### Network Errors

- Mark batch as failed
- Keep items for retry on next sync
- Increment retry counter

### Partial Success

- Update successfully synced items to "synced"
- Keep failed items for retry
- Log reconciliation result as "partially_applied"

## Client Queue States

| State | Description |
|-------|-------------|
| queued | Pending sync |
| uploading | Sync in progress |
| synced | Successfully synchronized |
| failed | Failed after max retries |

## Timestamp Integrity

Device timestamps preserved in evidence metadata:
```json
{
  "device": {
    "created_at": "2024-01-15T10:25:00Z",
    "captured_at": "2024-01-15T10:25:00Z",
    "occurred_at": "2024-01-15T10:00:00Z"
  }
}
```

Server `created_at` is NEVER overwritten - it reflects when evidence was persisted server-side.

## Security

### RLS Enforcement

All tables enforce:
- Tenant isolation via `app.tenant_id`
- Circle membership checks for circle-scoped data
- Service mode bypass for internal operations

### Append-Only Tables

`cc_offline_reconcile_log` has FORCE RLS and immutability trigger preventing all UPDATE/DELETE operations.

## Files

| Path | Description |
|------|-------------|
| server/migrations/134_offline_sync_queue.sql | Database schema |
| client/src/lib/offline/offlineQueue.ts | Client queue primitives |
| server/lib/offline/ingest.ts | Server ingest module |
| server/routes/offline.ts | API routes |
| tests/offline/ingest.test.ts | Test suite |
