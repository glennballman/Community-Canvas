# P2.14 SQL Verification Queries

Copy-paste SQL queries for verifying the Emergency/Legal/Insurance subsystem invariants.

## 1. RLS Enabled on Critical Tables

```sql
SELECT c.relname as tablename, 
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'cc_evidence_objects',
    'cc_evidence_events',
    'cc_evidence_bundles',
    'cc_evidence_bundle_items',
    'cc_claim_dossiers',
    'cc_claims',
    'cc_legal_holds',
    'cc_legal_hold_targets',
    'cc_legal_hold_events',
    'cc_authority_access_grants',
    'cc_authority_access_tokens',
    'cc_authority_access_log',
    'cc_interest_groups',
    'cc_interest_group_signals',
    'cc_emergency_runs',
    'cc_emergency_run_events',
    'cc_record_sources',
    'cc_record_captures',
    'cc_defense_packs',
    'cc_disputes'
  )
ORDER BY c.relname;
```

**Expected:** All tables show `rls_enabled = true`.

## 2. Legal Hold Trigger Presence

```sql
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name ILIKE '%legal_hold%'
   OR trigger_name ILIKE '%hold%'
   OR trigger_name ILIKE '%prevent_sealed%'
ORDER BY event_object_table, trigger_name;
```

**Expected:** Triggers present on `cc_evidence_objects` and `cc_evidence_bundles`.

## 3. Idempotency Constraints (client_request_id)

```sql
SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND ccu.column_name = 'client_request_id'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

**Expected:** Unique constraints on `cc_evidence_objects`, `cc_evidence_events`, etc.

## 4. Evidence Objects Hash Spot-Check

```sql
SELECT id, source_type, content_sha256, chain_status, sealed_at,
       LENGTH(content_sha256) as hash_length
FROM cc_evidence_objects
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:** `content_sha256` is 64 characters (SHA256 hex). Sealed objects have `sealed_at` timestamp.

## 5. Evidence Chain Integrity

```sql
SELECT 
  COUNT(*) as total_objects,
  COUNT(*) FILTER (WHERE chain_status = 'sealed') as sealed_count,
  COUNT(*) FILTER (WHERE chain_status = 'sealed' AND sealed_at IS NOT NULL) as sealed_with_timestamp,
  COUNT(*) FILTER (WHERE chain_status = 'sealed' AND sealed_at IS NULL) as sealed_missing_timestamp
FROM cc_evidence_objects;
```

**Expected:** `sealed_missing_timestamp = 0`.

## 6. Evidence Events Chain (Hash Verification)

```sql
SELECT id, evidence_object_id, event_type, event_at,
       LENGTH(event_sha256) as hash_length,
       prev_event_sha256 IS NOT NULL as has_prev_hash
FROM cc_evidence_events
ORDER BY event_at DESC
LIMIT 30;
```

**Expected:** All events have 64-character `event_sha256`. Events after first should have `has_prev_hash = true`.

## 7. Bundle Manifest Integrity

```sql
SELECT id, bundle_type, title, is_sealed, 
       LENGTH(manifest_sha256) as manifest_hash_length,
       created_at
FROM cc_evidence_bundles
WHERE manifest_sha256 IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:** Manifest hash is 64 characters when present.

## 8. Authority Access Token Security

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cc_authority_access_tokens'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Expected:** Column `token_hash` exists. No plain `token` column storing unhashed values.

## 9. Authority Access Grants with Expiry

```sql
SELECT id, grant_type, scope_type, status, 
       expires_at, created_at,
       CASE WHEN expires_at < NOW() THEN 'EXPIRED' ELSE 'VALID' END as expiry_status
FROM cc_authority_access_grants
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:** `expires_at` populated. Expired grants should have `status = 'expired'` or `'revoked'`.

## 10. Legal Hold Target Coverage

```sql
SELECT lh.id as hold_id, lh.hold_type, lh.title, lh.status,
       COUNT(lht.id) as target_count,
       array_agg(DISTINCT lht.target_type) as target_types
FROM cc_legal_holds lh
LEFT JOIN cc_legal_hold_targets lht ON lh.id = lht.hold_id
GROUP BY lh.id, lh.hold_type, lh.title, lh.status
ORDER BY lh.created_at DESC
LIMIT 20;
```

**Expected:** Active holds have associated targets.

## 11. Claim Dossier Versions

```sql
SELECT cd.id, cd.claim_id, cd.version, cd.status,
       LENGTH(cd.manifest_sha256) as manifest_hash_length,
       cd.r2_key IS NOT NULL as has_r2_export,
       cd.created_at
FROM cc_claim_dossiers cd
ORDER BY cd.created_at DESC
LIMIT 20;
```

**Expected:** Each dossier has deterministic manifest hash.

## 12. Emergency Scope Grant TTL

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cc_emergency_scope_grants'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Expected:** Columns `expires_at` and `status` exist.

## 13. Record Capture Evidence Linking

```sql
SELECT rc.id, rc.target_url, rc.status,
       rc.content_sha256, rc.evidence_object_id,
       eo.chain_status as evidence_status
FROM cc_record_captures rc
LEFT JOIN cc_evidence_objects eo ON rc.evidence_object_id = eo.id
WHERE rc.evidence_object_id IS NOT NULL
ORDER BY rc.requested_at DESC
LIMIT 20;
```

**Expected:** Captures with evidence have linked objects. SHA256 matches between capture and evidence.

## 14. Anonymous Interest Group Signal Security

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cc_interest_group_signals'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Expected:** `encrypted_contact` column exists. No plain contact storage.

## 15. Interest Group Aggregate (k-Anonymity Check)

```sql
SELECT ig.id, ig.group_type, ig.title, ig.status,
       ig.trigger_type, ig.trigger_config,
       COUNT(igs.id) as signal_count,
       CASE WHEN COUNT(igs.id) < 5 THEN 'HIDDEN' ELSE COUNT(igs.id)::text END as display_count
FROM cc_interest_groups ig
LEFT JOIN cc_interest_group_signals igs ON ig.id = igs.group_id
GROUP BY ig.id
ORDER BY ig.created_at DESC
LIMIT 20;
```

**Expected:** Groups with <5 signals show as 'HIDDEN' (k-anonymity enforcement).

## 16. Offline Sync Queue Idempotency

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cc_offline_sync_queue'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Expected:** Columns `batch_client_request_id` and `item_client_request_id` exist.

## 17. Defense Pack Structure

```sql
SELECT dp.id, dp.dispute_id, dp.version, dp.status,
       LENGTH(dp.manifest_sha256) as manifest_hash_length,
       dp.r2_key IS NOT NULL as has_export,
       dp.created_at
FROM cc_defense_packs dp
ORDER BY dp.created_at DESC
LIMIT 20;
```

**Expected:** Defense packs have deterministic manifest hashes.

## 18. Emergency Run Template Activation

```sql
SELECT et.id, et.template_name, et.run_type, et.is_active,
       et.trigger_conditions,
       COUNT(er.id) as run_count
FROM cc_emergency_templates et
LEFT JOIN cc_emergency_runs er ON et.id = er.template_id
GROUP BY et.id
ORDER BY et.created_at DESC
LIMIT 20;
```

**Expected:** Active templates can trigger runs.

## 19. RLS Policy Definitions

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename LIKE 'cc_%'
  AND tablename IN (
    'cc_evidence_objects',
    'cc_legal_holds',
    'cc_authority_access_grants',
    'cc_emergency_runs'
  )
ORDER BY tablename, policyname;
```

**Expected:** Policies exist for tenant isolation.

## 20. Service Mode Bypass Function

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_service_mode'
LIMIT 1;
```

**Expected:** Function exists for bypassing RLS in service context.
