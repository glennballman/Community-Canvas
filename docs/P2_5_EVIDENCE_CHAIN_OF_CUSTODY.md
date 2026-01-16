# P2.5 Evidence Chain-of-Custody Engine

## Overview

The Evidence Chain-of-Custody Engine provides tamper-evident evidence bundles with immutable manifests. It supports sealed records and verification using a hash chain, preserves dual timestamps (when the event occurred vs. when it was recorded), and enforces strict tenant/circle scoping via existing GUC context and RLS.

## Data Model

### cc_evidence_objects

The canonical evidence item primitive that can represent:

- **file_r2**: File blobs stored in Cloudflare R2
- **url_snapshot**: Fetched HTML/PDF with extracted text
- **json_snapshot**: Structured JSON snapshots (API feed snapshot)
- **manual_note**: Contemporaneous notes
- **external_feed**: External data feed snapshots

Key columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | Tenant scope (RLS enforced) |
| `circle_id` | uuid | Optional circle scope |
| `source_type` | enum | One of the 5 evidence types above |
| `occurred_at` | timestamptz | When the underlying event happened |
| `created_at` | timestamptz | When recorded in the system |
| `captured_at` | timestamptz | When snapshot/capture took place |
| `content_sha256` | text | SHA256 hex of canonical content bytes |
| `chain_status` | enum | `open`, `sealed`, `superseded`, `revoked` |

### cc_evidence_events

Append-only chain events for custody tracking. Each event is linked to the previous event via hash chain.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `evidence_object_id` | uuid | FK to evidence object |
| `event_type` | enum | `created`, `uploaded`, `fetched`, `sealed`, etc. |
| `event_at` | timestamptz | When event occurred |
| `prev_event_id` | uuid | Previous event in chain |
| `event_canonical_json` | jsonb | Canonical payload used for hashing |
| `event_sha256` | text | SHA256(prev_hash + canonical_event_json) |
| `prev_event_sha256` | text | Hash of previous event |

### cc_evidence_bundles

Evidence pack/bundle container with manifest hashing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `bundle_type` | enum | `emergency_pack`, `insurance_claim`, `dispute_defense`, `class_action`, `generic` |
| `bundle_status` | enum | `open`, `sealed`, `exported` |
| `manifest_json` | jsonb | Frozen at seal time |
| `manifest_sha256` | text | Hash of canonical manifest |

### cc_evidence_bundle_items

Join table linking evidence objects to bundles.

## Hashing Rules

### What is Hashed

1. **Evidence Content**:
   - `json_snapshot`: Canonical JSON string bytes (sorted keys, no whitespace)
   - `file_r2`: Actual uploaded file bytes
   - `url_snapshot`: Fetched raw bytes (NOT extracted text)
   - `manual_note`: Note text as UTF-8 bytes

2. **Event Chain**:
   - Each event's hash = `SHA256(prev_event_hash + canonical_event_json)`
   - First event has empty string as prev_hash
   - `event_canonical_json` is a deterministic JSON representation

3. **Bundle Manifest**:
   - Includes all item IDs, content hashes, and tip event hashes
   - Manifest is canonicalized before hashing

### What is NOT Hashed

- `url_extracted_text` (optional, not included in content hash)
- Metadata fields
- Timestamps (they're in the canonical JSON payload)

### Canonical JSON Rules

1. Object keys are sorted alphabetically (recursive)
2. Array order is preserved
3. No whitespace
4. Standard JSON escaping

Example:
```javascript
// Input
{ z: 1, a: 2, nested: { c: 3, b: 4 } }

// Canonical output
{"a":2,"nested":{"b":4,"c":3},"z":1}
```

## Seal Semantics

### Evidence Object Sealing

1. Only `open` status objects can be sealed
2. Setting `chain_status = 'sealed'` is irreversible
3. `sealed_at` and `sealed_by_individual_id` are recorded
4. A `sealed` event is appended to the chain
5. Content cannot be modified after sealing

### Bundle Sealing

1. Only `open` status bundles can be sealed
2. Manifest is compiled and frozen at seal time
3. Manifest SHA256 is computed and stored
4. Items cannot be added/removed after sealing
5. Evidence objects in the bundle don't need to be sealed (but should be for legal defensibility)

### Corrections

Any correction to sealed evidence must be via:
1. Mark original as `superseded`
2. Create new evidence object with correct content
3. Append `superseded` event to original with reference to new object

## Verification Endpoint Contract

`GET /api/evidence/objects/:id/verify`

Returns:
```json
{
  "success": true,
  "valid": true,
  "evidenceObject": { ... },
  "eventChain": [
    {
      "id": "...",
      "eventType": "created",
      "eventSha256": "abc123...",
      "prevEventSha256": null
    },
    {
      "id": "...",
      "eventType": "sealed",
      "eventSha256": "def456...",
      "prevEventSha256": "abc123..."
    }
  ],
  "firstFailureIndex": null,
  "failureReason": null
}
```

If chain is invalid:
```json
{
  "success": true,
  "valid": false,
  "firstFailureIndex": 2,
  "failureReason": "Hash mismatch at event index 2: expected abc..., got def..."
}
```

Verification algorithm:
1. Get all events ordered by `event_at ASC`
2. For each event, recompute hash from canonical JSON
3. Verify `event_sha256` matches recomputed hash
4. Verify `prev_event_sha256` matches previous event's hash
5. Return first failure index if any mismatch found

## Threat Model

### Tampering

**Threat**: Attacker modifies evidence content or event data in database.

**Mitigation**:
- Hash chain detects any modification to event order or content
- `content_sha256` detects modification to evidence content
- Verification endpoint allows external auditors to check integrity

### Replay

**Threat**: Attacker replays old events or content.

**Mitigation**:
- Each event includes timestamp in canonical JSON
- Hash chain prevents inserting events out of order
- Unique constraint on `client_request_id` prevents duplicate events

### Late Uploads

**Threat**: User claims evidence existed at an earlier time.

**Mitigation**:
- Dual timestamps: `occurred_at` (claimed) vs `created_at` (system recorded)
- `captured_at` for when actual capture/fetch occurred
- Event chain timestamps provide audit trail
- For legal purposes, `created_at` is the authoritative timestamp

### Superseding

**Threat**: User replaces evidence with different content.

**Mitigation**:
- Sealed evidence cannot be modified
- Corrections require new evidence object with `superseded` status on original
- Original content hash is preserved
- Superseded event links to replacement

### Access Logging

**Threat**: Unauthorized access goes undetected.

**Mitigation**:
- `cc_evidence_access_log` table with rate-limited logging
- 5-minute dedupe window prevents log flooding
- All verification calls are logged

### RLS Bypass

**Threat**: User accesses evidence from another tenant.

**Mitigation**:
- RLS policies enforce `tenant_id` check on all tables
- Circle membership verified for circle-scoped evidence
- Service mode bypass only for platform operations
- Events table uses FORCE RLS

## API Endpoints

### Evidence Objects

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/evidence/objects` | Create evidence object |
| POST | `/api/evidence/objects/:id/upload` | Upload file content |
| POST | `/api/evidence/objects/:id/fetch-url` | Fetch and store URL content |
| POST | `/api/evidence/objects/:id/seal` | Seal evidence object |
| GET | `/api/evidence/objects/:id` | Get evidence object |
| GET | `/api/evidence/objects/:id/verify` | Verify hash chain |

### Bundles

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/evidence/bundles` | Create bundle |
| POST | `/api/evidence/bundles/:id/items` | Add evidence to bundle |
| POST | `/api/evidence/bundles/:id/seal` | Seal bundle with manifest |
| GET | `/api/evidence/bundles/:id` | Get bundle with items |
| GET | `/api/evidence/bundles/:id/manifest` | Get manifest JSON and hash |
| GET | `/api/evidence/bundles` | List bundles |

## Database Tables

### New Tables (Migration 130)

1. `cc_evidence_objects` - Evidence items
2. `cc_evidence_events` - Append-only event chain (FORCE RLS)
3. `cc_evidence_bundles` - Bundle containers
4. `cc_evidence_bundle_items` - Bundle-evidence join table
5. `cc_evidence_access_log` - Rate-limited access log

### RLS Policies

- All tables enforce `tenant_id = current_setting('app.tenant_id')`
- Circle-scoped rows require active membership in `cc_circle_members`
- Events table has no UPDATE/DELETE policies (append-only)
- Sealed objects/bundles cannot be modified (trigger enforced)

## Implementation Files

- `server/migrations/130_evidence_chain_of_custody.sql` - Database migration
- `server/lib/evidence/custody.ts` - Core utilities (hashing, event chain, verification)
- `server/routes/evidence.ts` - API endpoints
- `server/lib/evidence/custody.test.ts` - Test suite
