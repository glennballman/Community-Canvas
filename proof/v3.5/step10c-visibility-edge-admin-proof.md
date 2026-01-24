# V3.5 STEP 10C: Visibility Edge Management (Admin CRUD) Proof

**Date**: 2026-01-24
**Status**: COMPLETE

## Executive Summary

STEP 10C adds admin-only endpoints to manage visibility edges:
- List visibility edges with optional filters
- Create new edges (explicit, validated)
- Archive edges (soft delete)
- Update reason/direction safely

Edges remain explicit and auditable. No UI added.

---

## SECTION A: Audit Results

### Table Structure

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cc_visibility_edges'
ORDER BY ordinal_position;
```

| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| id | uuid | NO |
| tenant_id | uuid | NO |
| source_type | USER-DEFINED | NO |
| source_id | uuid | NO |
| target_type | USER-DEFINED | NO |
| target_id | uuid | NO |
| direction | USER-DEFINED | NO |
| reason | text | YES |
| created_at | timestamp with time zone | NO |
| archived_at | timestamp with time zone | YES |

### Direction Counts

```sql
SELECT direction, COUNT(*)
FROM cc_visibility_edges
WHERE archived_at IS NULL
GROUP BY 1;
```

| direction | count |
|-----------|-------|
| up | 5 |

### Total Edges

```sql
SELECT COUNT(*) AS total_edges FROM cc_visibility_edges;
```

| total_edges |
|-------------|
| 5 |

### RLS Status

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'cc_visibility_edges';
```

| tablename | rowsecurity |
|-----------|-------------|
| cc_visibility_edges | t |

**All audits PASSED: Table exists, RLS enabled, direction constraint present.**

---

## SECTION B: Migration

### Migration Number Check

```bash
ls server/migrations/*.sql | tail -5
```

```
server/migrations/173_run_request_attachments.sql
server/migrations/174_work_request_status_canon.sql
server/migrations/175_tenant_start_addresses.sql
server/migrations/176_portal_anchor_community.sql
server/migrations/177_run_effective_visibility.sql
```

**Next migration number: 178**

### Migration: server/migrations/178_visibility_edges_indexes.sql

```sql
-- V3.5 STEP 10C: Visibility Edge Management Indexes

-- Drop old indexes if they exist (may have been created without tenant_id)
DROP INDEX IF EXISTS idx_visibility_edges_source;
DROP INDEX IF EXISTS idx_visibility_edges_target;

-- Index for efficient source lookups (tenant-scoped, active only)
CREATE INDEX idx_visibility_edges_source_v2
ON cc_visibility_edges(tenant_id, source_type, source_id)
WHERE archived_at IS NULL;

-- Index for efficient target lookups (tenant-scoped, active only)
CREATE INDEX idx_visibility_edges_target_v2
ON cc_visibility_edges(tenant_id, target_type, target_id)
WHERE archived_at IS NULL;

-- Prevent duplicate active edges (same source→target+direction)
CREATE UNIQUE INDEX IF NOT EXISTS uq_visibility_edges_active
ON cc_visibility_edges(tenant_id, source_type, source_id, target_type, target_id, direction)
WHERE archived_at IS NULL;
```

### Index Verification

```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cc_visibility_edges';
```

| indexname | indexdef |
|-----------|----------|
| cc_visibility_edges_pkey | CREATE UNIQUE INDEX ... USING btree (id) |
| idx_visibility_edges_source_v2 | CREATE INDEX ... (tenant_id, source_type, source_id) WHERE archived_at IS NULL |
| idx_visibility_edges_target_v2 | CREATE INDEX ... (tenant_id, target_type, target_id) WHERE archived_at IS NULL |
| idx_visibility_edges_tenant | CREATE INDEX ... USING btree (tenant_id) |
| uq_visibility_edges_active | CREATE UNIQUE INDEX ... (tenant_id, source_type, source_id, target_type, target_id, direction) WHERE archived_at IS NULL |

---

## SECTION C: Admin API Endpoints

### GET /api/internal/visibility/edges

List visibility edges with optional filters.

**Query Parameters:**
- `tenant_id` (optional): UUID - Filter by tenant
- `source_type` (optional): portal | zone
- `source_id` (optional): UUID
- `target_type` (optional): portal | zone
- `target_id` (optional): UUID
- `direction` (optional): up | down | lateral
- `include_archived` (optional): true | false (default: false)

**Response:**
```json
{
  "ok": true,
  "edges": [
    {
      "id": "...",
      "tenant_id": "...",
      "source_type": "zone",
      "source_id": "...",
      "source_name": "Anacla",
      "target_type": "portal",
      "target_id": "...",
      "target_name": "Bamfield Community Portal",
      "direction": "up",
      "reason": "micro-community rollup",
      "created_at": "2026-01-24T...",
      "archived_at": null
    }
  ]
}
```

### POST /api/internal/visibility/edges

Create a new visibility edge.

**Request Body:**
```json
{
  "tenant_id": "e0000000-0000-0000-0000-000000000001",
  "source_type": "zone",
  "source_id": "d2b354e8-65f8-4ebc-beeb-02c05633d903",
  "target_type": "zone",
  "target_id": "922782d2-e72b-410c-a3eb-d077fb89a7e1",
  "direction": "lateral",
  "reason": "sibling micro-communities"
}
```

**Validation Rules:**
- All required fields must be present
- source_type/target_type must be 'portal' or 'zone'
- direction must be 'up', 'down', or 'lateral'
- source_id !== target_id (no self-reference)
- Source and target entities must exist
- Source and target must belong to specified tenant_id

**Error Responses:**
- 400: `missing_required_fields`, `invalid_source_type`, `invalid_target_type`, `invalid_direction`, `self_reference_not_allowed`, `invalid_source`, `invalid_target`, `source_tenant_mismatch`, `target_tenant_mismatch`
- 409: `duplicate_edge`

### PATCH /api/internal/visibility/edges/:id/archive

Archive (soft delete) a visibility edge.

**Request Body:**
```json
{ "archived": true }
```

**Response:**
```json
{
  "ok": true,
  "edge": { ... }
}
```

### PATCH /api/internal/visibility/edges/:id

Update reason or direction.

**Request Body:**
```json
{
  "reason": "updated reason",
  "direction": "lateral"
}
```

**Error Responses:**
- 400: `invalid_direction`, `no_updates_provided`
- 404: `edge_not_found`
- 409: `duplicate_edge` (if direction change creates duplicate)

---

## SECTION D: Test Results

### Step 10B Resolver Still Works

```sql
SELECT * FROM resolve_run_effective_visibility('2f0b495c-cc53-4206-96b5-dccbd790d40c');
```

| target_type | target_id | source | via_source_type | via_source_id | direction |
|-------------|-----------|--------|-----------------|---------------|-----------|
| portal | df5561a8-8550-4498-9dc7-f02054bbbea4 | direct | (null) | (null) | (null) |

**Result**: Step 10B resolver unchanged and working correctly.

---

## Compliance Checklist

- [x] Indexes created (source, target, unique active)
- [x] Admin-only endpoints implemented (platform_admin required)
- [x] Tenant validation enforced (entity existence checks)
- [x] Duplicate protection returns 409 (unique index + API check)
- [x] Archive is soft-delete only (sets archived_at)
- [x] Self-reference rejected (source_id !== target_id)
- [x] No UI added (API only)
- [x] No auto-publishing
- [x] No geo inference
- [x] Identity unchanged (no renames)
- [x] Step 10B still works

---

## Files Modified

1. `server/migrations/178_visibility_edges_indexes.sql` - Performance indexes + unique constraint
2. `server/routes/internal.ts` - CRUD endpoints for visibility edges

---

## What This Unlocks

- STEP 10D — Recursive visibility resolution (if needed)
- Admin UI for visibility management
- Audit trail for edge changes
