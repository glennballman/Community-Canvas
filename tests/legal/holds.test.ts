import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '../../server/db';
import { sql } from 'drizzle-orm';
import {
  createLegalHold,
  addHoldTarget,
  releaseHold,
  isRowOnActiveHold,
  listActiveHoldsForTarget,
} from '../../server/lib/legal/holds';

const TEST_TENANT_ID = 'b0000000-0000-0000-0000-000000000001';
const TEST_INDIVIDUAL_ID = '00000000-0000-0000-0000-000000000001';

const createdHolds: string[] = [];
const createdEvidence: string[] = [];
const createdBundles: string[] = [];

async function setServiceMode() {
  await db.execute(sql`SELECT set_config('app.service_mode', 'true', false)`);
}

async function clearServiceMode() {
  await db.execute(sql`SELECT set_config('app.service_mode', 'false', false)`);
}

beforeAll(async () => {
  await setServiceMode();
});

afterAll(async () => {
  await setServiceMode();
  
  // First release any active holds so evidence can be cleaned up
  for (const holdId of createdHolds) {
    await db.execute(sql`
      UPDATE cc_legal_holds 
      SET hold_status = 'released', released_at = NOW()
      WHERE id = ${holdId}::uuid AND hold_status = 'active'
    `);
  }
  
  // Disable the append-only trigger temporarily for cleanup
  await db.execute(sql`
    ALTER TABLE cc_legal_hold_events DISABLE TRIGGER trg_hold_events_append_only
  `);
  
  try {
    for (const holdId of createdHolds) {
      await db.execute(sql`DELETE FROM cc_legal_holds WHERE id = ${holdId}::uuid`);
    }
  } finally {
    await db.execute(sql`
      ALTER TABLE cc_legal_hold_events ENABLE TRIGGER trg_hold_events_append_only
    `);
  }
  
  // Clean up claim inputs first (foreign key to evidence)
  for (const evidenceId of createdEvidence) {
    await db.execute(sql`DELETE FROM cc_claim_inputs WHERE evidence_object_id = ${evidenceId}::uuid`);
  }
  
  for (const bundleId of createdBundles) {
    await db.execute(sql`DELETE FROM cc_claim_inputs WHERE bundle_id = ${bundleId}::uuid`);
    await db.execute(sql`DELETE FROM cc_evidence_bundles WHERE id = ${bundleId}::uuid`);
  }
  
  for (const evidenceId of createdEvidence) {
    await db.execute(sql`DELETE FROM cc_evidence_objects WHERE id = ${evidenceId}::uuid`);
  }
  
  await clearServiceMode();
});

afterEach(async () => {
  await clearServiceMode();
});

async function createTestEvidenceObject(): Promise<string> {
  await setServiceMode();
  const result = await db.execute(sql`
    INSERT INTO cc_evidence_objects (
      tenant_id, created_by_individual_id, source_type, title, chain_status, content_sha256
    ) VALUES (
      ${TEST_TENANT_ID}, ${TEST_INDIVIDUAL_ID}, 'file_r2', 'Test Evidence',
      'open', 'abc123'
    )
    RETURNING id
  `);
  const id = (result.rows[0] as any).id;
  createdEvidence.push(id);
  await clearServiceMode();
  return id;
}

async function createTestBundle(): Promise<string> {
  await setServiceMode();
  const result = await db.execute(sql`
    INSERT INTO cc_evidence_bundles (
      tenant_id, created_by_individual_id, bundle_type, title, bundle_status
    ) VALUES (
      ${TEST_TENANT_ID}, ${TEST_INDIVIDUAL_ID}, 'insurance_claim', 'Test Bundle', 'open'
    )
    RETURNING id
  `);
  const id = (result.rows[0] as any).id;
  createdBundles.push(id);
  await clearServiceMode();
  return id;
}

describe('Legal Hold Creation', () => {
  it('creates a legal hold with required fields', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Wildfire 2026 Hold',
      description: 'Preserve all evidence related to wildfire claims',
      createdByIndividualId: TEST_INDIVIDUAL_ID,
    });
    
    createdHolds.push(hold.id);
    
    expect(hold.id).toBeDefined();
    expect(hold.holdType).toBe('insurance_claim');
    expect(hold.title).toBe('Wildfire 2026 Hold');
    expect(hold.holdStatus).toBe('active');
    expect(hold.releasedAt).toBeNull();
  });
  
  it('logs a created event when hold is created', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'litigation',
      title: 'Test Hold with Event',
    });
    
    createdHolds.push(hold.id);
    
    const eventsResult = await db.execute(sql`
      SELECT * FROM cc_legal_hold_events
      WHERE hold_id = ${hold.id}::uuid
        AND event_type = 'created'
    `);
    
    expect(eventsResult.rows.length).toBe(1);
    expect((eventsResult.rows[0] as any).event_type).toBe('created');
  });
});

describe('Hold Target Addition', () => {
  it('adds an evidence object target to a hold', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Evidence Target Test',
    });
    createdHolds.push(hold.id);
    
    const target = await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
      notes: 'Critical evidence for claim',
    });
    
    expect(target.id).toBeDefined();
    expect(target.targetType).toBe('evidence_object');
    expect(target.targetId).toBe(evidenceId);
    expect(target.notes).toBe('Critical evidence for claim');
  });
  
  it('logs target_added event', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'dispute_defense',
      title: 'Target Event Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    const eventsResult = await db.execute(sql`
      SELECT * FROM cc_legal_hold_events
      WHERE hold_id = ${hold.id}::uuid
        AND event_type = 'target_added'
    `);
    
    expect(eventsResult.rows.length).toBe(1);
  });
  
  it('rejects adding target to non-existent evidence', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'regulatory',
      title: 'Invalid Target Test',
    });
    createdHolds.push(hold.id);
    
    await expect(addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: '00000000-0000-0000-0000-000000000999',
    })).rejects.toThrow('does not exist');
  });
});

describe('Hold Enforcement on Evidence Objects', () => {
  it('blocks update on evidence object under hold', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Update Block Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    await expect(db.execute(sql`
      UPDATE cc_evidence_objects
      SET title = 'Modified Title'
      WHERE id = ${evidenceId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_ACTIVE/);
  });
  
  it('blocks delete on evidence object under hold', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'litigation',
      title: 'Delete Block Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    await expect(db.execute(sql`
      DELETE FROM cc_evidence_objects WHERE id = ${evidenceId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_ACTIVE/);
  });
});

describe('Hold Release', () => {
  it('releases a hold with reason', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'class_action',
      title: 'Release Test Hold',
    });
    createdHolds.push(hold.id);
    
    const released = await releaseHold({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      reason: 'Claim settled, no longer needed',
      releasedByIndividualId: TEST_INDIVIDUAL_ID,
    });
    
    expect(released.holdStatus).toBe('released');
    expect(released.releasedAt).not.toBeNull();
    expect(released.releaseReason).toBe('Claim settled, no longer needed');
  });
  
  it('allows update after hold is released', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Release Update Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    await expect(db.execute(sql`
      UPDATE cc_evidence_objects SET title = 'Should Fail' WHERE id = ${evidenceId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_ACTIVE/);
    
    await releaseHold({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      reason: 'Testing release',
    });
    
    await db.execute(sql`
      UPDATE cc_evidence_objects SET title = 'After Release' WHERE id = ${evidenceId}::uuid
    `);
    
    const result = await db.execute(sql`
      SELECT title FROM cc_evidence_objects WHERE id = ${evidenceId}::uuid
    `);
    
    expect((result.rows[0] as any).title).toBe('After Release');
  });
  
  it('logs released event', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'other',
      title: 'Release Event Test',
    });
    createdHolds.push(hold.id);
    
    await releaseHold({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      reason: 'Testing event logging',
    });
    
    const eventsResult = await db.execute(sql`
      SELECT * FROM cc_legal_hold_events
      WHERE hold_id = ${hold.id}::uuid
        AND event_type = 'released'
    `);
    
    expect(eventsResult.rows.length).toBe(1);
    expect((eventsResult.rows[0] as any).event_payload).toMatchObject({ reason: 'Testing event logging' });
  });
});

describe('Bundle Hold Enforcement', () => {
  it('blocks update on bundle under hold', async () => {
    await setServiceMode();
    
    const bundleId = await createTestBundle();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Bundle Hold Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_bundle',
      targetId: bundleId,
    });
    
    await expect(db.execute(sql`
      UPDATE cc_evidence_bundles SET title = 'Modified' WHERE id = ${bundleId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_ACTIVE/);
  });
});

describe('Helper Functions', () => {
  it('isRowOnActiveHold returns true for held evidence', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Helper Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    const onHold = await isRowOnActiveHold(TEST_TENANT_ID, 'evidence_object', evidenceId);
    expect(onHold).toBe(true);
  });
  
  it('isRowOnActiveHold returns false for released hold', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'litigation',
      title: 'Released Helper Test',
    });
    createdHolds.push(hold.id);
    
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    await releaseHold({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      reason: 'Testing',
    });
    
    const onHold = await isRowOnActiveHold(TEST_TENANT_ID, 'evidence_object', evidenceId);
    expect(onHold).toBe(false);
  });
  
  it('listActiveHoldsForTarget returns active holds', async () => {
    await setServiceMode();
    
    const evidenceId = await createTestEvidenceObject();
    
    const hold1 = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'List Test 1',
    });
    createdHolds.push(hold1.id);
    
    const hold2 = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'litigation',
      title: 'List Test 2',
    });
    createdHolds.push(hold2.id);
    
    await addHoldTarget({
      holdId: hold1.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    await addHoldTarget({
      holdId: hold2.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'evidence_object',
      targetId: evidenceId,
    });
    
    const holds = await listActiveHoldsForTarget(TEST_TENANT_ID, 'evidence_object', evidenceId);
    expect(holds.length).toBe(2);
    
    await releaseHold({
      holdId: hold1.id,
      tenantId: TEST_TENANT_ID,
      reason: 'Testing',
    });
    
    const holdsAfterRelease = await listActiveHoldsForTarget(TEST_TENANT_ID, 'evidence_object', evidenceId);
    expect(holdsAfterRelease.length).toBe(1);
    expect(holdsAfterRelease[0].title).toBe('List Test 2');
  });
});

describe('Claim Scope Inheritance', () => {
  async function createTestClaim(): Promise<string> {
    await setServiceMode();
    const result = await db.execute(sql`
      INSERT INTO cc_insurance_claims (
        tenant_id, created_by_individual_id, claim_type, title, claim_status
      ) VALUES (
        ${TEST_TENANT_ID}, ${TEST_INDIVIDUAL_ID}, 'wildfire', 'Test Claim', 'draft'
      )
      RETURNING id
    `);
    const id = (result.rows[0] as any).id;
    await clearServiceMode();
    return id;
  }
  
  async function attachEvidenceToClaim(claimId: string, evidenceId: string): Promise<void> {
    await setServiceMode();
    // Seal the evidence first
    const sha = 'abc123' + Date.now();
    await db.execute(sql`
      UPDATE cc_evidence_objects 
      SET chain_status = 'sealed', content_sha256 = ${sha}
      WHERE id = ${evidenceId}::uuid
    `);
    
    await db.execute(sql`
      INSERT INTO cc_claim_inputs (
        tenant_id, claim_id, evidence_object_id, evidence_content_sha256
      ) VALUES (
        ${TEST_TENANT_ID}, ${claimId}::uuid, ${evidenceId}::uuid, ${sha}
      )
    `);
    await clearServiceMode();
  }
  
  it('holding a claim protects linked evidence objects', async () => {
    await setServiceMode();
    
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject();
    await attachEvidenceToClaim(claimId, evidenceId);
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'insurance_claim',
      title: 'Claim Scope Test',
    });
    createdHolds.push(hold.id);
    
    // Add hold to the claim (not the evidence directly)
    await addHoldTarget({
      holdId: hold.id,
      tenantId: TEST_TENANT_ID,
      targetType: 'claim',
      targetId: claimId,
    });
    
    // Evidence should now be protected via claim scope inheritance
    await expect(db.execute(sql`
      UPDATE cc_evidence_objects SET title = 'Should Fail' WHERE id = ${evidenceId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_ACTIVE/);
  });
});

describe('Append-Only Events', () => {
  it('prevents update of hold events', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'regulatory',
      title: 'Append Only Test',
    });
    createdHolds.push(hold.id);
    
    const eventsResult = await db.execute(sql`
      SELECT id FROM cc_legal_hold_events
      WHERE hold_id = ${hold.id}::uuid LIMIT 1
    `);
    
    const eventId = (eventsResult.rows[0] as any).id;
    
    await expect(db.execute(sql`
      UPDATE cc_legal_hold_events
      SET event_type = 'released'
      WHERE id = ${eventId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_EVENTS_IMMUTABLE/);
  });
  
  it('prevents delete of hold events', async () => {
    await setServiceMode();
    
    const hold = await createLegalHold({
      tenantId: TEST_TENANT_ID,
      holdType: 'class_action',
      title: 'Delete Events Test',
    });
    createdHolds.push(hold.id);
    
    const eventsResult = await db.execute(sql`
      SELECT id FROM cc_legal_hold_events
      WHERE hold_id = ${hold.id}::uuid LIMIT 1
    `);
    
    const eventId = (eventsResult.rows[0] as any).id;
    
    await expect(db.execute(sql`
      DELETE FROM cc_legal_hold_events WHERE id = ${eventId}::uuid
    `)).rejects.toThrow(/LEGAL_HOLD_EVENTS_IMMUTABLE/);
  });
});
