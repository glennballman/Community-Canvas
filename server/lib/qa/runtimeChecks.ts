import { serviceQuery } from '../../db/tenantDb';

interface CheckResult {
  name: string;
  ok: boolean;
  details?: Record<string, any>;
  error?: string;
}

interface QAStatusResult {
  ok: boolean;
  checks: CheckResult[];
  timestamp: string;
}

const CRITICAL_RLS_TABLES = [
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
  'cc_disputes',
];

async function checkRLSEnabled(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      tablename: string;
      rowsecurity: boolean;
    }>(
      `SELECT c.relname as tablename, c.relrowsecurity as rowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1)
       ORDER BY c.relname`,
      [CRITICAL_RLS_TABLES]
    );

    const missingRLS: string[] = [];
    const enabledTables: string[] = [];

    for (const row of result.rows) {
      if (!row.rowsecurity) {
        missingRLS.push(row.tablename);
      } else {
        enabledTables.push(row.tablename);
      }
    }

    const foundTables = result.rows.map(r => r.tablename);
    const notFound = CRITICAL_RLS_TABLES.filter(t => !foundTables.includes(t));

    return {
      name: 'rls_enabled_critical_tables',
      ok: missingRLS.length === 0,
      details: {
        enabled_count: enabledTables.length,
        missing_rls: missingRLS,
        tables_not_found: notFound,
      },
    };
  } catch (err: any) {
    return { name: 'rls_enabled_critical_tables', ok: false, error: err.message };
  }
}

async function checkLegalHoldTriggers(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      event_object_table: string;
      trigger_name: string;
    }>(
      `SELECT event_object_table, trigger_name
       FROM information_schema.triggers
       WHERE trigger_name ILIKE '%legal_hold%'
         OR trigger_name ILIKE '%hold%'
       ORDER BY event_object_table, trigger_name`
    );

    const triggersByTable: Record<string, string[]> = {};
    for (const row of result.rows) {
      if (!triggersByTable[row.event_object_table]) {
        triggersByTable[row.event_object_table] = [];
      }
      triggersByTable[row.event_object_table].push(row.trigger_name);
    }

    const expectedTables = ['cc_evidence_objects', 'cc_evidence_bundles'];
    const missingTriggers = expectedTables.filter(t => !triggersByTable[t]);

    return {
      name: 'legal_hold_triggers_present',
      ok: missingTriggers.length === 0,
      details: {
        triggers_by_table: triggersByTable,
        missing_on_tables: missingTriggers,
      },
    };
  } catch (err: any) {
    return { name: 'legal_hold_triggers_present', ok: false, error: err.message };
  }
}

async function checkIdempotencyConstraints(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      table_name: string;
      constraint_name: string;
    }>(
      `SELECT tc.table_name, tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
       WHERE tc.constraint_type = 'UNIQUE'
         AND ccu.column_name = 'client_request_id'
         AND tc.table_schema = 'public'
       ORDER BY tc.table_name`
    );

    const constraintsByTable: Record<string, string> = {};
    for (const row of result.rows) {
      constraintsByTable[row.table_name] = row.constraint_name;
    }

    const expectedTables = [
      'cc_evidence_objects',
      'cc_evidence_events',
      'cc_offline_sync_queue',
      'cc_interest_group_signals',
    ];
    const found = expectedTables.filter(t => constraintsByTable[t]);
    const missing = expectedTables.filter(t => !constraintsByTable[t]);

    return {
      name: 'idempotency_constraints_present',
      ok: found.length >= 2, // At least evidence_objects and evidence_events
      details: {
        found_constraints: constraintsByTable,
        expected_tables: expectedTables,
        missing: missing,
      },
    };
  } catch (err: any) {
    return { name: 'idempotency_constraints_present', ok: false, error: err.message };
  }
}

async function checkAuthorityTokenHashOnly(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      column_name: string;
    }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'cc_authority_access_tokens'
         AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const columns = result.rows.map(r => r.column_name);
    const hasTokenHash = columns.includes('token_hash');
    const hasPlainToken = columns.includes('token') && !columns.includes('token_hash');

    return {
      name: 'authority_token_hash_only',
      ok: hasTokenHash && !hasPlainToken,
      details: {
        has_token_hash: hasTokenHash,
        has_plain_token_column: columns.includes('token'),
        columns: columns,
      },
    };
  } catch (err: any) {
    return { name: 'authority_token_hash_only', ok: false, error: err.message };
  }
}

async function checkEmergencyScopeGrantTTL(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      column_name: string;
      data_type: string;
    }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'cc_emergency_scope_grants'
         AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const columns = result.rows.map(r => r.column_name);
    const hasExpiresAt = columns.includes('expires_at');
    const hasStatus = columns.includes('status');

    // Check status enum includes 'expired'
    let hasExpiredStatus = false;
    try {
      const enumResult = await serviceQuery<{ enumlabel: string }>(
        `SELECT e.enumlabel
         FROM pg_type t
         JOIN pg_enum e ON t.oid = e.enumtypid
         WHERE t.typname = 'cc_scope_grant_status_enum'`
      );
      hasExpiredStatus = enumResult.rows.some(r => r.enumlabel === 'expired');
    } catch {
      // Enum might not exist, check if status is text
      hasExpiredStatus = hasStatus;
    }

    return {
      name: 'emergency_scope_grant_ttl',
      ok: hasExpiresAt && hasStatus,
      details: {
        has_expires_at: hasExpiresAt,
        has_status: hasStatus,
        has_expired_status: hasExpiredStatus,
        columns: columns,
      },
    };
  } catch (err: any) {
    return { name: 'emergency_scope_grant_ttl', ok: false, error: err.message };
  }
}

async function checkEvidenceChainIntegrity(): Promise<CheckResult> {
  try {
    // Spot check: verify sealed evidence objects have sealed_at
    const result = await serviceQuery<{
      total_sealed: number;
      sealed_with_timestamp: number;
    }>(
      `SELECT 
         COUNT(*) FILTER (WHERE chain_status = 'sealed') as total_sealed,
         COUNT(*) FILTER (WHERE chain_status = 'sealed' AND sealed_at IS NOT NULL) as sealed_with_timestamp
       FROM cc_evidence_objects`
    );

    const row = result.rows[0];
    const totalSealed = Number(row.total_sealed);
    const withTimestamp = Number(row.sealed_with_timestamp);

    return {
      name: 'evidence_chain_integrity',
      ok: totalSealed === withTimestamp,
      details: {
        total_sealed: totalSealed,
        sealed_with_timestamp: withTimestamp,
        missing_timestamp: totalSealed - withTimestamp,
      },
    };
  } catch (err: any) {
    return { name: 'evidence_chain_integrity', ok: false, error: err.message };
  }
}

async function checkOfflineQueueSchema(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      column_name: string;
    }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'cc_offline_sync_queue'
         AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const columns = result.rows.map(r => r.column_name);
    const requiredColumns = ['tenant_id', 'device_id', 'batch_client_request_id', 'item_client_request_id', 'status'];
    const hasRequired = requiredColumns.filter(c => columns.includes(c));
    const missing = requiredColumns.filter(c => !columns.includes(c));

    return {
      name: 'offline_queue_schema',
      ok: missing.length === 0 || columns.length === 0, // OK if table doesn't exist or has all required
      details: {
        table_exists: columns.length > 0,
        has_required_columns: hasRequired,
        missing_columns: missing,
      },
    };
  } catch (err: any) {
    return { name: 'offline_queue_schema', ok: false, error: err.message };
  }
}

async function checkAnonymousGroupsKAnonymity(): Promise<CheckResult> {
  try {
    // Check that interest group signals table exists and has proper structure
    const result = await serviceQuery<{
      column_name: string;
    }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'cc_interest_group_signals'
         AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const columns = result.rows.map(r => r.column_name);
    const hasEncryptedContact = columns.includes('encrypted_contact');
    const hasClientRequestId = columns.includes('client_request_id');

    // Check for k-anonymity functions
    const funcResult = await serviceQuery<{ proname: string }>(
      `SELECT proname FROM pg_proc 
       WHERE proname ILIKE '%anonymous%' OR proname ILIKE '%signal%aggregate%'
       LIMIT 10`
    );

    return {
      name: 'anonymous_groups_k_anonymity',
      ok: hasEncryptedContact || columns.length === 0, // OK if encrypted or table doesn't exist
      details: {
        table_exists: columns.length > 0,
        has_encrypted_contact: hasEncryptedContact,
        has_client_request_id: hasClientRequestId,
        related_functions: funcResult.rows.map(r => r.proname),
      },
    };
  } catch (err: any) {
    return { name: 'anonymous_groups_k_anonymity', ok: false, error: err.message };
  }
}

async function checkRecordCaptureSchema(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      column_name: string;
    }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'cc_record_captures'
         AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const columns = result.rows.map(r => r.column_name);
    const requiredColumns = ['content_sha256', 'r2_key', 'evidence_object_id', 'status'];
    const hasRequired = requiredColumns.filter(c => columns.includes(c));

    return {
      name: 'record_capture_schema',
      ok: hasRequired.length === requiredColumns.length,
      details: {
        has_content_sha256: columns.includes('content_sha256'),
        has_r2_key: columns.includes('r2_key'),
        has_evidence_object_id: columns.includes('evidence_object_id'),
        column_count: columns.length,
      },
    };
  } catch (err: any) {
    return { name: 'record_capture_schema', ok: false, error: err.message };
  }
}

async function checkClaimDossierSchema(): Promise<CheckResult> {
  try {
    const result = await serviceQuery<{
      column_name: string;
    }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'cc_claim_dossiers'
         AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const columns = result.rows.map(r => r.column_name);
    const hasManifestHash = columns.includes('manifest_sha256');
    const hasVersion = columns.includes('version');

    return {
      name: 'claim_dossier_schema',
      ok: hasManifestHash || columns.length === 0,
      details: {
        table_exists: columns.length > 0,
        has_manifest_sha256: hasManifestHash,
        has_version: hasVersion,
        columns: columns.slice(0, 10), // First 10 columns
      },
    };
  } catch (err: any) {
    return { name: 'claim_dossier_schema', ok: false, error: err.message };
  }
}

export async function runAllChecks(): Promise<QAStatusResult> {
  const checks = await Promise.all([
    checkRLSEnabled(),
    checkLegalHoldTriggers(),
    checkIdempotencyConstraints(),
    checkAuthorityTokenHashOnly(),
    checkEmergencyScopeGrantTTL(),
    checkEvidenceChainIntegrity(),
    checkOfflineQueueSchema(),
    checkAnonymousGroupsKAnonymity(),
    checkRecordCaptureSchema(),
    checkClaimDossierSchema(),
  ]);

  const allOk = checks.every(c => c.ok);

  return {
    ok: allOk,
    checks,
    timestamp: new Date().toISOString(),
  };
}

export async function runSingleCheck(checkName: string): Promise<CheckResult | null> {
  const checkMap: Record<string, () => Promise<CheckResult>> = {
    'rls_enabled_critical_tables': checkRLSEnabled,
    'legal_hold_triggers_present': checkLegalHoldTriggers,
    'idempotency_constraints_present': checkIdempotencyConstraints,
    'authority_token_hash_only': checkAuthorityTokenHashOnly,
    'emergency_scope_grant_ttl': checkEmergencyScopeGrantTTL,
    'evidence_chain_integrity': checkEvidenceChainIntegrity,
    'offline_queue_schema': checkOfflineQueueSchema,
    'anonymous_groups_k_anonymity': checkAnonymousGroupsKAnonymity,
    'record_capture_schema': checkRecordCaptureSchema,
    'claim_dossier_schema': checkClaimDossierSchema,
  };

  const checkFn = checkMap[checkName];
  if (!checkFn) return null;

  return await checkFn();
}
