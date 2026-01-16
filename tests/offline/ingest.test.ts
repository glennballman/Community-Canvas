/**
 * P2.8 Offline / Low-Signal Evidence Queue + Reconciliation Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { sql } from 'drizzle-orm';
import {
  upsertSyncSession,
  initializeUpload,
  completeUpload,
  ingestBatch,
  sealEvidenceObjects,
  type IngestBatch
} from '../../server/lib/offline/ingest';
import { createLegalHold, addHoldTarget, releaseHold } from '../../server/lib/legal/holds';

const TEST_TENANT_ID = 'b0000000-0000-0000-0000-000000000001';
const TEST_INDIVIDUAL_ID: string | null = null; // Using null since test individual may not exist
const TEST_DEVICE_ID = 'test_device_' + Date.now();

const createdEvidence: string[] = [];
const createdHolds: string[] = [];

async function setServiceMode() {
  await db.execute(sql`SELECT set_config('app.service_mode', 'true', false)`);
  await db.execute(sql`SELECT set_config('app.tenant_id', ${TEST_TENANT_ID}, false)`);
}

async function clearServiceMode() {
  await db.execute(sql`SELECT set_config('app.service_mode', '', false)`);
}

beforeAll(async () => {
  await setServiceMode();
});

afterAll(async () => {
  await setServiceMode();
  
  // Release holds first
  for (const holdId of createdHolds) {
    await db.execute(sql`
      UPDATE cc_legal_holds 
      SET hold_status = 'released', released_at = NOW()
      WHERE id = ${holdId}::uuid AND hold_status = 'active'
    `);
  }
  
  // Disable append-only trigger for cleanup
  await db.execute(sql`
    ALTER TABLE cc_legal_hold_events DISABLE TRIGGER trg_hold_events_append_only
  `);
  
  await db.execute(sql`
    ALTER TABLE cc_offline_reconcile_log DISABLE TRIGGER trg_reconcile_log_append_only
  `);
  
  try {
    for (const holdId of createdHolds) {
      await db.execute(sql`DELETE FROM cc_legal_holds WHERE id = ${holdId}::uuid`);
    }
    
    for (const evidenceId of createdEvidence) {
      await db.execute(sql`DELETE FROM cc_evidence_events WHERE evidence_object_id = ${evidenceId}::uuid`);
      await db.execute(sql`DELETE FROM cc_evidence_objects WHERE id = ${evidenceId}::uuid`);
    }
    
    await db.execute(sql`DELETE FROM cc_offline_ingest_queue WHERE device_id LIKE 'test_%'`);
    await db.execute(sql`DELETE FROM cc_offline_reconcile_log WHERE device_id LIKE 'test_%'`);
    await db.execute(sql`DELETE FROM cc_sync_sessions WHERE device_id LIKE 'test_%'`);
  } finally {
    await db.execute(sql`
      ALTER TABLE cc_legal_hold_events ENABLE TRIGGER trg_hold_events_append_only
    `);
    await db.execute(sql`
      ALTER TABLE cc_offline_reconcile_log ENABLE TRIGGER trg_reconcile_log_append_only
    `);
  }
  
  await clearServiceMode();
});

describe('Sync Session Management', () => {
  it('creates a new sync session', async () => {
    await setServiceMode();
    
    const session = await upsertSyncSession({
      tenantId: TEST_TENANT_ID,
      deviceId: TEST_DEVICE_ID + '_session1',
      individualId: TEST_INDIVIDUAL_ID,
      appVersion: '1.0.0'
    });
    
    expect(session.id).toBeDefined();
    expect(session.deviceId).toBe(TEST_DEVICE_ID + '_session1');
    expect(session.appVersion).toBe('1.0.0');
  });
  
  it('updates existing sync session', async () => {
    await setServiceMode();
    
    const deviceId = TEST_DEVICE_ID + '_session2';
    
    const first = await upsertSyncSession({
      tenantId: TEST_TENANT_ID,
      deviceId,
      appVersion: '1.0.0'
    });
    
    const second = await upsertSyncSession({
      tenantId: TEST_TENANT_ID,
      deviceId,
      appVersion: '2.0.0'
    });
    
    expect(second.id).toBe(first.id);
    expect(second.appVersion).toBe('2.0.0');
  });
});

describe('Batch Idempotency', () => {
  it('returns same evidence IDs when batch is posted twice', async () => {
    await setServiceMode();
    
    const batchId = 'test_batch_' + Date.now();
    const clientRequestId = 'test_item_' + Date.now();
    
    const batch: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_idem',
      batch_client_request_id: batchId,
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_1',
        source_type: 'manual_note',
        title: 'Idempotency Test Note',
        created_at_device: new Date().toISOString(),
        payload: { text: 'This is a test note' }
      }]
    };
    
    const result1 = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    expect(result1.results[0].status).toBe('created_new');
    createdEvidence.push(result1.results[0].evidence_object_id!);
    
    const result2 = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    // Batch-level idempotency returns cached results with ORIGINAL status
    // The key guarantee is the same evidence_object_id is returned
    // The from_cache flag indicates this was a duplicate request
    expect(result2.results[0].status).toBe('created_new'); // Same as original cached result
    expect(result2.results[0].evidence_object_id).toBe(result1.results[0].evidence_object_id);
    expect(result2.from_cache).toBe(true); // Indicates duplicate batch processing
  });
});

describe('Item Idempotency', () => {
  it('resolves same item client_request_id across different batches', async () => {
    await setServiceMode();
    
    const clientRequestId = 'shared_item_' + Date.now();
    
    const batch1: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_cross1',
      batch_client_request_id: 'batch_a_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_a',
        source_type: 'manual_note',
        title: 'Cross-batch Note',
        created_at_device: new Date().toISOString(),
        payload: { text: 'First batch' }
      }]
    };
    
    const result1 = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch1);
    expect(result1.results[0].status).toBe('created_new');
    const evidenceId = result1.results[0].evidence_object_id!;
    createdEvidence.push(evidenceId);
    
    const batch2: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_cross2',
      batch_client_request_id: 'batch_b_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_b',
        source_type: 'manual_note',
        title: 'Cross-batch Note Different Title',
        created_at_device: new Date().toISOString(),
        payload: { text: 'Second batch' }
      }]
    };
    
    const result2 = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch2);
    expect(result2.results[0].status).toBe('already_applied');
    expect(result2.results[0].evidence_object_id).toBe(evidenceId);
  });
});

describe('Hash Mismatch Rejection', () => {
  it('rejects item when client hash does not match computed hash', async () => {
    await setServiceMode();
    
    const batch: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_hash',
      batch_client_request_id: 'hash_test_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: 'hash_item_' + Date.now(),
        local_id: 'local_hash',
        source_type: 'manual_note',
        title: 'Hash Test Note',
        created_at_device: new Date().toISOString(),
        content_sha256: 'incorrect_hash_value_that_will_not_match',
        payload: { text: 'This hash will not match' }
      }]
    };
    
    const result = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    expect(result.results[0].status).toBe('rejected');
    expect(result.results[0].reason).toBe('HASH_MISMATCH');
  });
});

describe('Pending Bytes Flow', () => {
  it('creates evidence with pending_bytes flag for file without r2_key', async () => {
    await setServiceMode();
    
    const clientRequestId = 'pending_file_' + Date.now();
    
    const batch: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_pending',
      batch_client_request_id: 'pending_batch_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_file',
        source_type: 'file_r2',
        title: 'Pending File Upload',
        created_at_device: new Date().toISOString(),
        content_mime: 'image/jpeg',
        payload: {}
      }]
    };
    
    const result = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    expect(result.results[0].status).toBe('created_new');
    createdEvidence.push(result.results[0].evidence_object_id!);
    
    const check = await db.execute(sql`
      SELECT pending_bytes, metadata
      FROM cc_evidence_objects
      WHERE id = ${result.results[0].evidence_object_id}::uuid
    `);
    
    expect((check.rows[0] as any).pending_bytes).toBe(true);
  });
  
  it('does not allow sealing evidence with pending bytes', async () => {
    await setServiceMode();
    
    const clientRequestId = 'pending_seal_' + Date.now();
    
    const batch: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_seal_pending',
      batch_client_request_id: 'seal_pending_batch_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_seal',
        source_type: 'file_r2',
        title: 'Cannot Seal Pending',
        created_at_device: new Date().toISOString(),
        payload: {}
      }]
    };
    
    const ingestResult = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    const evidenceId = ingestResult.results[0].evidence_object_id!;
    createdEvidence.push(evidenceId);
    
    const sealResults = await sealEvidenceObjects(
      TEST_TENANT_ID,
      TEST_INDIVIDUAL_ID,
      [evidenceId]
    );
    
    expect(sealResults[0].sealed).toBe(false);
    expect(sealResults[0].error).toBe('PENDING_BYTES');
  });
});

describe('Hold Enforcement', () => {
  it('rejects offline reconciliation for evidence under legal hold', async () => {
    await setServiceMode();
    
    const clientRequestId = 'held_item_' + Date.now();
    
    // First, create the evidence
    const batch1: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_hold',
      batch_client_request_id: 'hold_batch_1_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_hold',
        source_type: 'manual_note',
        title: 'Will Be Held',
        created_at_device: new Date().toISOString(),
        payload: { text: 'Original content' }
      }]
    };
    
    const result1 = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch1);
    const evidenceId = result1.results[0].evidence_object_id!;
    createdEvidence.push(evidenceId);
    
    // Create a hold on the evidence
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'litigation',
      title: 'Hold for offline test'
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId
    });
    
    // Try to reingest with same client_request_id (would update if not held)
    const batch2: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_hold',
      batch_client_request_id: 'hold_batch_2_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_hold_retry',
        source_type: 'manual_note',
        title: 'Should Be Rejected',
        created_at_device: new Date().toISOString(),
        payload: { text: 'Modified content' }
      }]
    };
    
    const result2 = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch2);
    expect(result2.results[0].status).toBe('rejected');
    expect(result2.results[0].reason).toBe('LEGAL_HOLD_ACTIVE');
  });
});

describe('Seal After Sync', () => {
  it('seals evidence after successful sync', async () => {
    await setServiceMode();
    
    const clientRequestId = 'seal_after_' + Date.now();
    
    const batch: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_seal',
      batch_client_request_id: 'seal_batch_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: clientRequestId,
        local_id: 'local_seal_ok',
        source_type: 'manual_note',
        title: 'Ready to Seal',
        created_at_device: new Date().toISOString(),
        payload: { text: 'This will be sealed' }
      }]
    };
    
    const ingestResult = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    const evidenceId = ingestResult.results[0].evidence_object_id!;
    createdEvidence.push(evidenceId);
    
    const sealResults = await sealEvidenceObjects(
      TEST_TENANT_ID,
      TEST_INDIVIDUAL_ID,
      [evidenceId],
      'Sealed for legal preservation'
    );
    
    expect(sealResults[0].sealed).toBe(true);
    
    // Verify sealed in database
    const check = await db.execute(sql`
      SELECT chain_status, seal_reason
      FROM cc_evidence_objects
      WHERE id = ${evidenceId}::uuid
    `);
    
    expect((check.rows[0] as any).chain_status).toBe('sealed');
    expect((check.rows[0] as any).seal_reason).toBe('Sealed for legal preservation');
  });
});

describe('Reconcile Log Append-Only', () => {
  it('prevents modification of reconcile log entries', async () => {
    await setServiceMode();
    
    // First create a log entry via ingest
    const batch: IngestBatch = {
      device_id: TEST_DEVICE_ID + '_log',
      batch_client_request_id: 'log_test_' + Date.now(),
      batch_created_at: new Date().toISOString(),
      items: [{
        client_request_id: 'log_item_' + Date.now(),
        local_id: 'local_log',
        source_type: 'manual_note',
        title: 'Log Test',
        created_at_device: new Date().toISOString(),
        payload: { text: 'Creates log entry' }
      }]
    };
    
    const ingestResult = await ingestBatch(TEST_TENANT_ID, TEST_INDIVIDUAL_ID, batch);
    if (ingestResult.results[0].evidence_object_id) {
      createdEvidence.push(ingestResult.results[0].evidence_object_id);
    }
    
    // Try to update the log
    await expect(db.execute(sql`
      UPDATE cc_offline_reconcile_log
      SET result = 'rejected'
      WHERE device_id = ${TEST_DEVICE_ID + '_log'}
    `)).rejects.toThrow(/RECONCILE_LOG_IMMUTABLE/);
  });
});
