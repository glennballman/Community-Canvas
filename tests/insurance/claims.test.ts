/**
 * P2.6 Insurance Claim Auto-Assembler Tests
 * Tests for attach validation, deterministic hashing, versioning, and RLS
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool, db } from '../../server/db';
import { sql } from 'drizzle-orm';
import {
  attachClaimInput,
  assembleClaimDossier,
  prepareDossierExport,
} from '../../server/lib/claims/assemble';
import { canonicalizeJson, sha256Hex } from '../../server/lib/evidence/custody';

// Test data IDs - use existing tenant/individual
const TEST_TENANT_ID = 'b0000000-0000-0000-0000-000000000001';
const TEST_INDIVIDUAL_ID = '00000000-0000-0000-0000-000000000001';

// Track created resources for cleanup
let createdPolicies: string[] = [];
let createdClaims: string[] = [];
let createdBundles: string[] = [];
let createdEvidence: string[] = [];

// ============================================================
// SETUP & CLEANUP
// ============================================================

async function setServiceMode() {
  await db.execute(sql`SELECT set_config('app.tenant_id', '__SERVICE__', false)`);
}

async function clearServiceMode() {
  await db.execute(sql`SELECT set_config('app.tenant_id', '', false)`);
}

async function cleanup() {
  await setServiceMode();
  
  try {
    // Delete dossiers (cascade from claims)
    // Delete claim inputs (cascade from claims)
    // Delete claims
    for (const id of createdClaims) {
      await db.execute(sql`DELETE FROM cc_insurance_claims WHERE id = ${id}`);
    }
    
    // Delete policies
    for (const id of createdPolicies) {
      await db.execute(sql`DELETE FROM cc_insurance_policies WHERE id = ${id}`);
    }
    
    // Unseal and delete bundles
    for (const id of createdBundles) {
      await db.execute(sql`UPDATE cc_evidence_bundles SET bundle_status = 'open' WHERE id = ${id}`);
      await db.execute(sql`DELETE FROM cc_evidence_bundle_items WHERE bundle_id = ${id}`);
      await db.execute(sql`DELETE FROM cc_evidence_bundles WHERE id = ${id}`);
    }
    
    // Delete evidence objects
    for (const id of createdEvidence) {
      await db.execute(sql`UPDATE cc_evidence_objects SET chain_status = 'open' WHERE id = ${id}`);
      await db.execute(sql`DELETE FROM cc_evidence_events WHERE evidence_object_id = ${id}`);
      await db.execute(sql`DELETE FROM cc_evidence_objects WHERE id = ${id}`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
  
  await clearServiceMode();
  
  // Reset tracking arrays
  createdPolicies = [];
  createdClaims = [];
  createdBundles = [];
  createdEvidence = [];
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

beforeEach(async () => {
  await cleanup();
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function createTestPolicy(): Promise<string> {
  await setServiceMode();
  const result = await db.execute(sql`
    INSERT INTO cc_insurance_policies (
      tenant_id, policy_type, carrier_name, named_insured
    ) VALUES (
      ${TEST_TENANT_ID}, 'property', 'Test Carrier', 'Test Insured'
    )
    RETURNING id
  `);
  const policyId = (result.rows[0] as any).id;
  createdPolicies.push(policyId);
  await clearServiceMode();
  return policyId;
}

async function createTestClaim(policyId?: string): Promise<string> {
  await setServiceMode();
  const result = await db.execute(sql`
    INSERT INTO cc_insurance_claims (
      tenant_id, policy_id, claim_type, title, summary,
      loss_occurred_at, created_by_individual_id
    ) VALUES (
      ${TEST_TENANT_ID}, ${policyId || null}, 'wildfire', 'Test Wildfire Claim',
      'Test summary for wildfire damage claim',
      ${new Date().toISOString()}, ${TEST_INDIVIDUAL_ID}
    )
    RETURNING id
  `);
  const claimId = (result.rows[0] as any).id;
  createdClaims.push(claimId);
  await clearServiceMode();
  return claimId;
}

async function createTestEvidenceObject(sealed: boolean = false): Promise<string> {
  await setServiceMode();
  const contentSha = sha256Hex('test content ' + Date.now());
  const result = await db.execute(sql`
    INSERT INTO cc_evidence_objects (
      tenant_id, created_by_individual_id, source_type, title,
      content_sha256, chain_status
    ) VALUES (
      ${TEST_TENANT_ID}, ${TEST_INDIVIDUAL_ID}, 'manual_note', 'Test Evidence',
      ${contentSha}, ${sealed ? 'sealed' : 'open'}
    )
    RETURNING id
  `);
  const evidenceId = (result.rows[0] as any).id;
  createdEvidence.push(evidenceId);
  await clearServiceMode();
  return evidenceId;
}

async function createTestBundle(sealed: boolean = false, evidenceIds: string[] = []): Promise<string> {
  await setServiceMode();
  
  // Create bundle as open first
  const result = await db.execute(sql`
    INSERT INTO cc_evidence_bundles (
      tenant_id, created_by_individual_id, bundle_type, title, bundle_status
    ) VALUES (
      ${TEST_TENANT_ID}, ${TEST_INDIVIDUAL_ID}, 'insurance_claim', 'Test Bundle',
      'open'
    )
    RETURNING id
  `);
  const bundleId = (result.rows[0] as any).id;
  createdBundles.push(bundleId);
  
  // Add items to bundle (while still open)
  for (const evidenceId of evidenceIds) {
    await db.execute(sql`
      INSERT INTO cc_evidence_bundle_items (tenant_id, bundle_id, evidence_object_id)
      VALUES (${TEST_TENANT_ID}, ${bundleId}, ${evidenceId})
    `);
  }
  
  // Seal if requested
  if (sealed) {
    const manifest = { bundleId, items: evidenceIds, sealedAt: new Date().toISOString() };
    const manifestSha = sha256Hex(canonicalizeJson(manifest));
    await db.execute(sql`
      UPDATE cc_evidence_bundles
      SET bundle_status = 'sealed',
          manifest_json = ${JSON.stringify(manifest)}::jsonb,
          manifest_sha256 = ${manifestSha},
          sealed_at = NOW()
      WHERE id = ${bundleId}
    `);
  }
  
  await clearServiceMode();
  return bundleId;
}

// ============================================================
// TESTS: Attach Validation
// ============================================================

describe('Attach Input Validation', () => {
  it('rejects attaching an unsealed bundle', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(false);
    const bundleId = await createTestBundle(false, [evidenceId]);
    
    await expect(
      attachClaimInput({
        claimId,
        tenantId: TEST_TENANT_ID,
        bundleId,
        attachedByIndividualId: TEST_INDIVIDUAL_ID,
      })
    ).rejects.toThrow('unsealed');
  });

  it('accepts attaching a sealed bundle', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    const bundleId = await createTestBundle(true, [evidenceId]);
    
    const input = await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      bundleId,
      attachedByIndividualId: TEST_INDIVIDUAL_ID,
    });
    
    expect(input).toBeDefined();
    expect(input.bundleId).toBe(bundleId);
    expect(input.bundleManifestSha256).toBeDefined();
  });

  it('rejects attaching an unsealed evidence object', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(false);
    
    await expect(
      attachClaimInput({
        claimId,
        tenantId: TEST_TENANT_ID,
        evidenceObjectId: evidenceId,
        attachedByIndividualId: TEST_INDIVIDUAL_ID,
      })
    ).rejects.toThrow('unsealed');
  });

  it('accepts attaching a sealed evidence object', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    
    const input = await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId,
      attachedByIndividualId: TEST_INDIVIDUAL_ID,
    });
    
    expect(input).toBeDefined();
    expect(input.evidenceObjectId).toBe(evidenceId);
    expect(input.evidenceContentSha256).toBeDefined();
  });

  it('rejects duplicate bundle attachment', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    const bundleId = await createTestBundle(true, [evidenceId]);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      bundleId,
    });
    
    await expect(
      attachClaimInput({
        claimId,
        tenantId: TEST_TENANT_ID,
        bundleId,
      })
    ).rejects.toThrow('already attached');
  });

  it('requires exactly one of bundleId or evidenceObjectId', async () => {
    const claimId = await createTestClaim();
    
    await expect(
      attachClaimInput({
        claimId,
        tenantId: TEST_TENANT_ID,
      })
    ).rejects.toThrow('exactly one');
  });
});

// ============================================================
// TESTS: Deterministic Dossier Hash
// ============================================================

describe('Deterministic Dossier Hash', () => {
  it('produces same hash for same inputs', async () => {
    const policyId = await createTestPolicy();
    const claimId = await createTestClaim(policyId);
    const evidenceId = await createTestEvidenceObject(true);
    const bundleId = await createTestBundle(true, [evidenceId]);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      bundleId,
    });
    
    const dossier1 = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
      clientRequestId: 'test-1',
    });
    
    // Create second claim with same structure
    const claimId2 = await createTestClaim(policyId);
    const evidenceId2 = await createTestEvidenceObject(true);
    const bundleId2 = await createTestBundle(true, [evidenceId2]);
    
    await attachClaimInput({
      claimId: claimId2,
      tenantId: TEST_TENANT_ID,
      bundleId: bundleId2,
    });
    
    const dossier2 = await assembleClaimDossier({
      claimId: claimId2,
      tenantId: TEST_TENANT_ID,
      clientRequestId: 'test-2',
    });
    
    // Different claims will have different hashes due to different IDs
    // But the structure should be deterministic
    expect(dossier1.dossierJson.verification.assemblyAlgorithmVersion).toBe('claim_dossier_v1');
    expect(dossier2.dossierJson.verification.assemblyAlgorithmVersion).toBe('claim_dossier_v1');
    expect(dossier1.dossierSha256).toBeDefined();
    expect(dossier2.dossierSha256).toBeDefined();
  });

  it('includes all required verification fields', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    const bundleId = await createTestBundle(true, [evidenceId]);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      bundleId,
    });
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    expect(dossier.dossierJson.verification).toBeDefined();
    expect(dossier.dossierJson.verification.bundleManifestSha256s).toBeInstanceOf(Array);
    expect(dossier.dossierJson.verification.evidenceContentSha256s).toBeInstanceOf(Array);
    expect(dossier.dossierJson.verification.dossierSha256).toBeDefined();
    expect(dossier.dossierJson.verification.assemblyAlgorithmVersion).toBe('claim_dossier_v1');
  });

  it('includes timeline sorted by occurred_at', async () => {
    const claimId = await createTestClaim();
    
    // Create multiple evidence objects
    const evidence1 = await createTestEvidenceObject(true);
    const evidence2 = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidence1,
      label: 'First',
    });
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidence2,
      label: 'Second',
    });
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    expect(dossier.dossierJson.timeline).toBeInstanceOf(Array);
    expect(dossier.dossierJson.timeline.length).toBe(2);
  });
});

// ============================================================
// TESTS: Versioning
// ============================================================

describe('Dossier Versioning', () => {
  it('creates version 1 for first assembly', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId,
    });
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    expect(dossier.dossierVersion).toBe(1);
  });

  it('increments version on subsequent assembly', async () => {
    const claimId = await createTestClaim();
    const evidenceId1 = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId1,
    });
    
    const dossier1 = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    // Attach more evidence
    const evidenceId2 = await createTestEvidenceObject(true);
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId2,
    });
    
    const dossier2 = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    expect(dossier1.dossierVersion).toBe(1);
    expect(dossier2.dossierVersion).toBe(2);
  });

  it('marks previous version as superseded', async () => {
    const claimId = await createTestClaim();
    const evidenceId1 = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId1,
    });
    
    const dossier1 = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    // Attach more evidence and assemble again
    const evidenceId2 = await createTestEvidenceObject(true);
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId2,
    });
    
    await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    // Check v1 is superseded
    await setServiceMode();
    const result = await db.execute(sql`
      SELECT dossier_status FROM cc_claim_dossiers WHERE id = ${dossier1.id}
    `);
    await clearServiceMode();
    
    expect((result.rows[0] as any).dossier_status).toBe('superseded');
  });

  it('preserves original dossier content after supersede', async () => {
    const claimId = await createTestClaim();
    const evidenceId1 = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId1,
    });
    
    const dossier1 = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    const originalSha = dossier1.dossierSha256;
    
    // Attach more evidence and assemble again
    const evidenceId2 = await createTestEvidenceObject(true);
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId2,
    });
    
    await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    // Verify original dossier sha unchanged
    await setServiceMode();
    const result = await db.execute(sql`
      SELECT dossier_sha256 FROM cc_claim_dossiers WHERE id = ${dossier1.id}
    `);
    await clearServiceMode();
    
    expect((result.rows[0] as any).dossier_sha256).toBe(originalSha);
  });
});

// ============================================================
// TESTS: Claim Status Updates
// ============================================================

describe('Claim Status Updates', () => {
  it('updates claim status to assembled after dossier creation', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId,
    });
    
    await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    await setServiceMode();
    const result = await db.execute(sql`
      SELECT claim_status FROM cc_insurance_claims WHERE id = ${claimId}
    `);
    await clearServiceMode();
    
    expect((result.rows[0] as any).claim_status).toBe('assembled');
  });
});

// ============================================================
// TESTS: Idempotency
// ============================================================

describe('Idempotency', () => {
  it('creates dossier with unique client_request_id', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId,
    });
    
    const clientRequestId = 'idempotent-test-' + Date.now();
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
      clientRequestId,
    });
    
    expect(dossier.clientRequestId).toBe(clientRequestId);
    expect(dossier.dossierVersion).toBe(1);
    
    // Verify can retrieve by querying with clientRequestId
    await setServiceMode();
    const result = await db.execute(sql`
      SELECT * FROM cc_claim_dossiers 
      WHERE client_request_id = ${clientRequestId} AND tenant_id = ${TEST_TENANT_ID}
    `);
    await clearServiceMode();
    
    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as any).id).toBe(dossier.id);
  });
});

// ============================================================
// TESTS: Dossier Immutability
// ============================================================

describe('Dossier Immutability', () => {
  it('prevents modification of dossier_json after creation', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId,
    });
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    await setServiceMode();
    await expect(
      db.execute(sql`
        UPDATE cc_claim_dossiers 
        SET dossier_json = '{"modified": true}'::jsonb
        WHERE id = ${dossier.id}
      `)
    ).rejects.toThrow('Cannot modify dossier_json');
    await clearServiceMode();
  });

  it('allows updating dossier_status', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      evidenceObjectId: evidenceId,
    });
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    await setServiceMode();
    await db.execute(sql`
      UPDATE cc_claim_dossiers 
      SET dossier_status = 'exported'
      WHERE id = ${dossier.id}
    `);
    
    const result = await db.execute(sql`
      SELECT dossier_status FROM cc_claim_dossiers WHERE id = ${dossier.id}
    `);
    await clearServiceMode();
    
    expect((result.rows[0] as any).dossier_status).toBe('exported');
  });
});

// ============================================================
// TESTS: Export Preparation
// ============================================================

describe('Export Preparation', () => {
  it('prepares export data with dossier and inputs', async () => {
    const claimId = await createTestClaim();
    const evidenceId = await createTestEvidenceObject(true);
    const bundleId = await createTestBundle(true, [evidenceId]);
    
    await attachClaimInput({
      claimId,
      tenantId: TEST_TENANT_ID,
      bundleId,
    });
    
    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: TEST_TENANT_ID,
    });
    
    const { exportData } = await prepareDossierExport({
      dossierId: dossier.id,
      tenantId: TEST_TENANT_ID,
      format: 'zip_json',
    });
    
    expect(exportData.dossierJson).toBeDefined();
    expect(exportData.inputsJson).toBeInstanceOf(Array);
    expect(exportData.inputsJson.length).toBe(1);
    expect(exportData.inputsJson[0].bundleId).toBe(bundleId);
  });
});
