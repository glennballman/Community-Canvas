# Phase A2.X - Record Bundles & Contemporaneous Notes QA

## Overview

This QA document covers the Defensive Record Bundles and Contemporaneous Notes spine (Migration 127).

**Purpose**: Immutable, owner-controlled evidence packages for legal/insurance defense. This is PRIVATE, OWNER-CONTROLLED, OPT-IN RECORD PRESERVATION.

---

## 1. Migration Verification

### 1.1 Enums Created

Run the following SQL to verify all enums exist:

```sql
SELECT typname FROM pg_type WHERE typname LIKE 'cc_%enum';
```

Expected enums:
- `cc_record_bundle_type_enum`
- `cc_record_bundle_status_enum`
- `cc_record_bundle_artifact_type_enum`
- `cc_record_bundle_visibility_enum`
- `cc_note_scope_enum`
- `cc_note_visibility_enum`

### 1.2 Tables Created

```sql
SELECT tablename FROM pg_tables WHERE tablename IN (
  'cc_record_bundles',
  'cc_record_bundle_artifacts',
  'cc_record_bundle_acl',
  'cc_contemporaneous_notes',
  'cc_contemporaneous_note_media'
);
```

All 5 tables must exist.

### 1.3 Constraints Verified

```sql
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'cc_record_bundles'::regclass;
```

Expected constraints:
- `bundle_exactly_one_scope` (CHECK)
- `bundle_sealed_has_timestamp` (CHECK)
- `bundle_revoked_has_timestamp` (CHECK)

### 1.4 RLS Enabled

```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename LIKE 'cc_record_bundle%' OR tablename LIKE 'cc_contemporaneous%';
```

All tables should have `rowsecurity = true`.

### 1.5 FORCE RLS Tables

```sql
SELECT relname, relforcerowsecurity FROM pg_class
WHERE relname IN ('cc_record_bundle_artifacts', 'cc_record_bundle_acl', 'cc_contemporaneous_note_media');
```

All 3 should have `relforcerowsecurity = true`.

---

## 2. RLS Policy Checks

### 2.1 Service Mode Bypass

```sql
-- Set service mode
SELECT set_config('app.tenant_id', '__SERVICE__', true);

-- Should return all bundles
SELECT COUNT(*) FROM cc_record_bundles;
```

### 2.2 Tenant Isolation

```sql
-- Clear service mode, set tenant
SELECT set_config('app.tenant_id', 'test-tenant-uuid', true);
SELECT set_config('app.individual_id', 'test-individual-uuid', true);

-- Should only return bundles for this tenant where user is admin
SELECT id, title FROM cc_record_bundles;
```

### 2.3 ACL Delegate Access

```sql
-- Create a bundle and grant access to a delegate
INSERT INTO cc_record_bundle_acl (bundle_id, tenant_id, grantee_individual_id, scope)
VALUES ('bundle-uuid', 'tenant-uuid', 'delegate-individual-uuid', ARRAY['read']);

-- As delegate, should be able to read
SELECT set_config('app.individual_id', 'delegate-individual-uuid', true);
SELECT id, title FROM cc_record_bundles WHERE id = 'bundle-uuid';
```

---

## 3. API Endpoint Tests

### 3.1 Create Bundle (POST /api/record-bundles)

```bash
curl -X POST http://localhost:5000/api/record-bundles \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{
    "bundleType": "incident_defence",
    "title": "Test Incident Bundle",
    "incidentId": "<incident-uuid>"
  }'
```

Expected: 201 with `{ id, createdAt, status: 'draft' }`

### 3.2 List Bundles (GET /api/record-bundles)

```bash
curl http://localhost:5000/api/record-bundles \
  -H "Cookie: <session>"
```

Expected: 200 with `{ bundles: [...] }`

### 3.3 Get Bundle Details (GET /api/record-bundles/:id)

```bash
curl http://localhost:5000/api/record-bundles/<bundle-uuid> \
  -H "Cookie: <session>"
```

Expected: 200 with `{ bundle, artifacts, acl, notes }`

### 3.4 Seal Bundle (POST /api/record-bundles/:id/seal)

```bash
curl -X POST http://localhost:5000/api/record-bundles/<bundle-uuid>/seal \
  -H "Cookie: <session>"
```

Expected: 200 with `{ sealed: true, sealedAt, notesLocked }`

---

## 4. Contemporaneous Notes Tests

### 4.1 Create Note Before Incident

```bash
curl -X POST http://localhost:5000/api/record-bundles/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{
    "scope": "general",
    "noteText": "Observed potential safety issue at loading dock",
    "occurredAt": "2024-01-15T10:30:00Z"
  }'
```

Expected: 201 with `{ id, createdAt, occurredAt }`

### 4.2 Create Note During Incident

```bash
curl -X POST http://localhost:5000/api/record-bundles/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{
    "scope": "incident",
    "incidentId": "<incident-uuid>",
    "noteText": "First responders arrived at 10:45. Vehicle moved by 11:00.",
    "occurredAt": "2024-01-15T10:45:00Z"
  }'
```

### 4.3 Note Locked After Bundle Seal

1. Create a note linked to a bundle
2. Seal the bundle
3. Verify note has `is_locked = true` and `locked_at` is set

```sql
SELECT id, is_locked, locked_at FROM cc_contemporaneous_notes WHERE bundle_id = '<bundle-uuid>';
```

### 4.4 Cannot Add Notes to Sealed Bundle

```bash
curl -X POST http://localhost:5000/api/record-bundles/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{
    "scope": "bundle",
    "bundleId": "<sealed-bundle-uuid>",
    "noteText": "This should fail"
  }'
```

Expected: 400 with `{ error: 'Cannot add notes to a sealed bundle' }`

---

## 5. Activity Ledger Verification

### 5.1 Bundle Create Action

```sql
SELECT * FROM cc_folio_ledger 
WHERE action = 'record_bundle.create' 
ORDER BY created_at DESC LIMIT 5;
```

### 5.2 Bundle Seal Action

```sql
SELECT * FROM cc_folio_ledger 
WHERE action = 'record_bundle.seal' 
ORDER BY created_at DESC LIMIT 5;
```

---

## 6. Scope Validation Tests

### 6.1 Exactly One Scope Required

```sql
-- Should fail: no scope
INSERT INTO cc_record_bundles (tenant_id, bundle_type, title)
VALUES ('test', 'incident_defence', 'No scope bundle');

-- Should fail: multiple scopes
INSERT INTO cc_record_bundles (tenant_id, bundle_type, title, incident_id, worker_id)
VALUES ('test', 'incident_defence', 'Multiple scope bundle', 'incident-uuid', 'worker-uuid');

-- Should succeed: exactly one scope
INSERT INTO cc_record_bundles (tenant_id, bundle_type, title, incident_id)
VALUES ('test', 'incident_defence', 'Single scope bundle', 'incident-uuid');
```

---

## 7. Storage Contract Verification

### 7.1 R2 Key Builder

```typescript
import { buildR2KeyForBundle, buildR2KeyForNoteMedia } from '../lib/recordBundleStorage';

// Bundle artifact
const bundleKey = buildR2KeyForBundle('tenant-uuid', 'bundle-uuid', 'pdf', 'incident-report.pdf');
// Expected: bundles/tenant-uuid/bundle-uuid/pdf/incident-report.pdf

// Note media
const noteKey = buildR2KeyForNoteMedia('tenant-uuid', 'note-uuid', 'photo.jpg');
// Expected: notes/tenant-uuid/note-uuid/photo.jpg
```

---

## Acceptance Criteria Checklist

- [ ] Migration runs cleanly
- [ ] All 6 enums exist
- [ ] All 5 tables exist
- [ ] RLS enabled on all tables
- [ ] FORCE RLS on artifact, acl, and media tables
- [ ] Notes can be created by staff (tenant members)
- [ ] Notes are timestamped with occurred_at (separate from created_at)
- [ ] Bundles can be created by owner/admin
- [ ] Bundles can be sealed by owner/admin
- [ ] Notes become immutable (is_locked=true) when bundle is sealed
- [ ] Activity ledger captures record_bundle.create and record_bundle.seal actions
- [ ] ACL delegates can read bundles they have access to
- [ ] Storage key builders work correctly
